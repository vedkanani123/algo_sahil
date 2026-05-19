import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { notifyCommandCreated } from '../_shared/telegram.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function cleanEaIds(value: unknown) {
  if (!Array.isArray(value)) return []
  return Array.from(new Set(value.map(item => String(item || '').trim()).filter(Boolean)))
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
    if (userErr || !userData.user) return json({ ok: false, error: 'Unauthorized' }, 401)

    const { ea_ids, action, payload = {}, client_id = null } = await req.json()
    const allowed = ['ARM_BUY','ARM_SELL','AUTO_ARM','CANCEL','CLOSE_50','BREAK_EVEN','FIRST_BE_EXIT','FIRST_BREAK_EVEN','CLOSE_ALL','TOGGLE_PARTIALS','TOGGLE_SECOND_ENTRY','SET_MODE','SET_RISK','SET_PARTIALS','PING']
    const eaIds = cleanEaIds(ea_ids)
    if (!eaIds.length || eaIds.length > 100 || !allowed.includes(action)) {
      return json({ ok: false, error: 'Invalid bulk command' }, 400)
    }

    let safePayload: Record<string, unknown> = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {}
    if (action === 'SET_RISK') {
      const lot = Number(safePayload.lot)
      const risk = Number(safePayload.risk)
      const rr = Number(safePayload.rr)
      if (![lot, risk, rr].every(Number.isFinite) || lot <= 0 || risk <= 0 || rr <= 0) {
        return json({ ok: false, error: 'Invalid risk settings' }, 400)
      }
      safePayload = { ...safePayload, lot, risk, rr }
    }

    const { data: eas, error: eaErr } = await admin
      .from('ea_instances')
      .select('id,user_id,enabled,name,symbol')
      .eq('user_id', userData.user.id)
      .eq('enabled', true)
      .in('id', eaIds)
    if (eaErr) throw eaErr
    if (!eas || eas.length !== eaIds.length) {
      return json({ ok: false, error: 'One or more selected EAs were not found or are disabled' }, 404)
    }

    const expiresAt = new Date(Date.now() + 45_000).toISOString()
    const baseClientId = String(client_id || crypto.randomUUID()).slice(0, 120)
    const rows = eas.map((ea: any) => ({
      user_id: userData.user.id,
      ea_id: ea.id,
      client_id: `${baseClientId}:${ea.id}`,
      action,
      payload: safePayload,
      status: 'pending',
      expires_at: expiresAt,
    }))

    const { data, error } = await admin.from('commands').insert(rows).select()
    if (error) {
      if (error.code === '23505') {
        const { data: existing, error: existingErr } = await admin
          .from('commands')
          .select('*')
          .eq('user_id', userData.user.id)
          .in('client_id', rows.map(row => row.client_id))
        if (existingErr) throw existingErr
        return json({ ok: true, commands: existing || [], duplicate: true })
      }
      throw error
    }

    const eaById = new Map((eas || []).map((ea: any) => [ea.id, ea]))
    const backgroundTasks = Promise.allSettled([
      admin.from('audit_logs').insert((data || []).map((command: any) => ({
        user_id: userData.user.id,
        ea_id: command.ea_id,
        action: 'create_bulk_command',
        details: { command_id: command.id, action, bulk_client_id: baseClientId },
      }))),
      Promise.allSettled((data || []).map((command: any) => notifyCommandCreated(admin, command, eaById.get(command.ea_id)))),
    ]).then((results) => {
      const labels = ['bulk audit logs', 'telegram bulk command notifications']
      results.forEach((result, index) => {
        if (result.status === 'rejected') console.error(`${labels[index]} failed`, result.reason)
      })
    })
    ;(globalThis as any).EdgeRuntime?.waitUntil?.(backgroundTasks)

    return json({ ok: true, commands: data || [] })
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500)
  }
})
