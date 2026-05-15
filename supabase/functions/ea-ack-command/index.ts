import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { notifyCommandAck } from '../_shared/telegram.ts'

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const { ea_id, ea_token, command_id, status, message = '' } = await req.json()
    const ea = await verifyEA(admin, ea_id, ea_token)
    if (!['done','failed'].includes(status)) return json({ ok:false, error:'Invalid status' }, 400)
    const { data: command, error } = await admin.from('commands')
      .update({ status, done_at: new Date().toISOString(), result_message: String(message).slice(0, 500) })
      .eq('id', command_id)
      .eq('ea_id', ea.id)
      .select('id,user_id,ea_id,action,payload,status,result_message')
      .single()
    if (error) throw error

    const notifyTask = notifyCommandAck(admin, command, String(message).slice(0, 500)).catch((notifyErr) => {
      console.error('telegram command ack notification failed', notifyErr)
    })
    ;(globalThis as any).EdgeRuntime?.waitUntil?.(notifyTask)
    return json({ ok:true })
  } catch (e) {
    return json({ ok:false, error:String((e as Error)?.message || e) }, 401)
  }
})
