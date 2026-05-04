import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const authHeader = req.headers.get('Authorization') || ''
    const jwt = authHeader.replace('Bearer ', '')
    const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
    if (userErr || !userData.user) return json({ ok:false, error:'Unauthorized' }, 401)

    const { ea_id, action, payload = {}, client_id = null } = await req.json()
    const allowed = ['ARM_BUY','ARM_SELL','AUTO_ARM','CANCEL','CLOSE_50','BREAK_EVEN','CLOSE_ALL','TOGGLE_PARTIALS','SET_MODE','SET_RISK','SET_PARTIALS','PING']
    if (!ea_id || !allowed.includes(action)) return json({ ok:false, error:'Invalid command' }, 400)

    let safePayload: Record<string, unknown> = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}
    if (action === 'SET_RISK') {
      const lot = Number(safePayload.lot)
      const risk = Number(safePayload.risk)
      const rr = Number(safePayload.rr)
      if (![lot, risk, rr].every(Number.isFinite) || lot <= 0 || risk <= 0 || rr <= 0) {
        return json({ ok:false, error:'Invalid risk settings' }, 400)
      }
      safePayload = { ...safePayload, lot, risk, rr }
    }

    const { data: ea, error: eaErr } = await admin.from('ea_instances').select('id,user_id,enabled').eq('id', ea_id).eq('user_id', userData.user.id).single()
    if (eaErr || !ea || !ea.enabled) return json({ ok:false, error:'EA not found or disabled' }, 404)

    const { data, error } = await admin.from('commands').insert({
      user_id: userData.user.id,
      ea_id,
      client_id,
      action,
      payload: safePayload,
      status: 'pending',
      expires_at: new Date(Date.now() + 45_000).toISOString()
    }).select().single()
    if (error) throw error
    await admin.from('audit_logs').insert({ user_id:userData.user.id, ea_id, action:'create_command', details:{ command_id:data.id, action } })
    return json({ ok:true, command:data })
  } catch (e) {
    return json({ ok:false, error:String((e as Error)?.message || e) }, 500)
  }
})
