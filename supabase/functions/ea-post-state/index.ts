import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { notifyEaOnline, notifyStateChanges } from '../_shared/telegram.ts'

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
  const { data: ea, error } = await admin.from('ea_instances').select('id,user_id,token_hash,enabled,name,symbol,account_login,last_seen_at').eq('id', ea_id).single()
  if (error || !ea || !ea.enabled) throw new Error('EA not found or disabled')
  const hash = await sha256Hex(ea_token)
  if (hash !== ea.token_hash) throw new Error('Invalid EA token')
  return ea
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const { ea_id, ea_token, state = {} } = await req.json()
    const ea = await verifyEA(admin, ea_id, ea_token)
    const now = new Date().toISOString()
    const { data: previousRow, error: previousErr } = await admin.from('ea_states').select('state,updated_at').eq('ea_id', ea.id).maybeSingle()
    if (previousErr) throw previousErr
    await admin.from('ea_instances').update({ last_seen_at: now, symbol: state.symbol || undefined, account_login: state.accountLogin || undefined }).eq('id', ea.id)
    const { error } = await admin.from('ea_states').upsert({ ea_id: ea.id, user_id: ea.user_id, state, updated_at: now }, { onConflict: 'ea_id' })
    if (error) throw error

    const notifyTask = (async () => {
      const { data: status } = await admin.from('telegram_ea_status').select('is_online').eq('ea_id', ea.id).maybeSingle()
      if (!status?.is_online) await notifyEaOnline(admin, ea, state, now)
      else {
        await admin.from('telegram_ea_status').upsert({
          ea_id: ea.id,
          user_id: ea.user_id,
          is_online: true,
          last_online_at: now,
          updated_at: now,
        }, { onConflict: 'ea_id' })
      }
      await notifyStateChanges(admin, ea, previousRow?.state || null, state, now)
    })().catch((notifyErr) => {
      console.error('telegram state notification failed', notifyErr)
    })
    ;(globalThis as any).EdgeRuntime?.waitUntil?.(notifyTask)
    return json({ ok:true })
  } catch (e) {
    return json({ ok:false, error:String((e as Error)?.message || e) }, 401)
  }
})
