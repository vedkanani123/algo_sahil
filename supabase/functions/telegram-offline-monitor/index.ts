import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { notifyEaOffline } from '../_shared/telegram.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-monitor-secret',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const expectedSecret = Deno.env.get('TELEGRAM_OFFLINE_MONITOR_SECRET')
    if (expectedSecret && req.headers.get('x-monitor-secret') !== expectedSecret) {
      return json({ ok: false, error: 'Unauthorized' }, 401)
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const admin = createClient(SUPABASE_URL, SERVICE_KEY)
    const now = new Date()
    const nowIso = now.toISOString()
    const offlineBefore = new Date(now.getTime() - 60_000).toISOString()

    const { data: eas, error } = await admin
      .from('ea_instances')
      .select('id, user_id, name, symbol, account_login, last_seen_at, enabled')
      .eq('enabled', true)
      .not('last_seen_at', 'is', null)
      .lt('last_seen_at', offlineBefore)
      .limit(500)
    if (error) throw error

    let checked = 0
    let notified = 0
    for (const ea of eas || []) {
      checked++
      const { data: status, error: statusErr } = await admin
        .from('telegram_ea_status')
        .select('is_online')
        .eq('ea_id', ea.id)
        .maybeSingle()
      if (statusErr) throw statusErr
      if (!status?.is_online) continue
      await notifyEaOffline(admin, ea, ea.last_seen_at, nowIso)
      notified++
    }

    return json({ ok: true, checked, notified, offline_before: offlineBefore })
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500)
  }
})
