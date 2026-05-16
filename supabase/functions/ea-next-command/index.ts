import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}
async function sha256Hex(input: string) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')
}
async function verifyEA(admin: any, ea_id: string, ea_token: string) {
  if (!ea_id || !ea_token) throw new Error('Missing EA credentials')
  const { data: ea, error } = await admin.from('ea_instances').select('id,user_id,token_hash,enabled').eq('id', ea_id).single()
  if (error || !ea || !ea.enabled) throw new Error('EA not found or disabled')
  const hash = await sha256Hex(ea_token)
  if (hash !== ea.token_hash) throw new Error('Invalid EA token')
  return ea
}

function waitUntil(task: Promise<unknown>) {
  ;(globalThis as any).EdgeRuntime?.waitUntil?.(task.catch((err) => {
    console.error('ea-next-command background maintenance failed', err)
  }))
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const { ea_id, ea_token } = await req.json()

    const { data: claimed, error: rpcErr } = await admin.rpc('claim_next_command', {
      p_ea_id: ea_id,
      p_ea_token: ea_token,
    })
    if (!rpcErr) {
      if (!claimed?.ok) return json({ ok:false, error: claimed?.error || 'Invalid EA credentials' }, 401)
      return json(claimed)
    }
    console.warn('claim_next_command unavailable, using compatibility path', rpcErr)

    const ea = await verifyEA(admin, ea_id, ea_token)
    const now = new Date()
    const nowIso = now.toISOString()
    const staleHeartbeat = new Date(now.getTime() - 2_000).toISOString()

    waitUntil(Promise.allSettled([
      admin.from('ea_instances')
        .update({ last_seen_at: nowIso })
        .eq('id', ea.id)
        .or(`last_seen_at.is.null,last_seen_at.lt.${staleHeartbeat}`),
      admin.from('commands').update({ status:'expired', result_message:'Expired before EA pickup' })
        .eq('ea_id', ea.id).eq('status','pending').lt('expires_at', nowIso),
    ]))

    const { data: cmd, error } = await admin.from('commands')
      .select('id, action, payload, created_at, expires_at')
      .eq('ea_id', ea.id)
      .eq('status', 'pending')
      .gt('expires_at', nowIso)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (!cmd) return json({ ok:true, command:null })

    await admin.from('commands').update({ status:'sent', sent_at: new Date().toISOString() }).eq('id', cmd.id)
    return json({ ok:true, command: cmd })
  } catch (e) {
    return json({ ok:false, error:String((e as Error)?.message || e) }, 401)
  }
})
