const DEFAULT_PREFS: Record<string, boolean> = {
  trade_open: true,
  sl_hit: true,
  tp_hit: true,
  rr1_hit: true,
  rr2_hit: true,
  rr3_hit: true,
  partial_hit: true,
  command_sent: true,
  command_done: true,
  command_failed: true,
  ea_message: true,
  ea_online: true,
  ea_offline: true,
}

const EVENT_LABELS: Record<string, string> = {
  ARM_BUY: 'ARM BUY',
  ARM_SELL: 'ARM SELL',
  AUTO_ARM: 'AUTO ARM',
  CANCEL: 'CANCEL',
  CLOSE_50: 'CLOSE 50%',
  BREAK_EVEN: 'BREAK EVEN',
  FIRST_BREAK_EVEN: 'FIRST BREAK EVEN',
  CLOSE_ALL: 'CLOSE ALL',
  TOGGLE_PARTIALS: 'TOGGLE PARTIALS',
  TOGGLE_SECOND_ENTRY: 'TOGGLE SECOND ENTRY',
  TOGGLE_FIRST_TRAIL: 'TOGGLE FIRST TRAIL',
  SET_MODE: 'SET MODE',
  SET_RISK: 'SET RISK',
  SET_PARTIALS: 'SET PARTIALS',
  PING: 'PING',
}

function enc() {
  return new TextEncoder()
}

function dec() {
  return new TextDecoder()
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = ''
  for (const b of bytes) binary += String.fromCharCode(b)
  return btoa(binary)
}

function base64ToBytes(value: string) {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function cryptoKey() {
  const secret = Deno.env.get('TELEGRAM_TOKEN_ENCRYPTION_KEY')
  if (!secret || secret.length < 16) {
    throw new Error('Missing TELEGRAM_TOKEN_ENCRYPTION_KEY secret')
  }
  const hash = await crypto.subtle.digest('SHA-256', enc().encode(secret))
  return crypto.subtle.importKey('raw', hash, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function encryptTelegramToken(token: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await cryptoKey()
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc().encode(token))
  return JSON.stringify({ v: 1, iv: bytesToBase64(iv), data: bytesToBase64(new Uint8Array(cipher)) })
}

export async function decryptTelegramToken(cipherText: string) {
  const parsed = JSON.parse(cipherText || '{}')
  const iv = base64ToBytes(parsed.iv)
  const data = base64ToBytes(parsed.data)
  const key = await cryptoKey()
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
  return dec().decode(plain)
}

export function defaultTelegramPrefs() {
  return { ...DEFAULT_PREFS }
}

export function mergeTelegramPrefs(prefs: unknown) {
  const out = defaultTelegramPrefs()
  if (prefs && typeof prefs === 'object' && !Array.isArray(prefs)) {
    for (const key of Object.keys(out)) {
      const value = (prefs as Record<string, unknown>)[key]
      if (typeof value === 'boolean') out[key] = value
    }
  }
  return out
}

export async function telegramApi(token: string, method: string, body?: Record<string, unknown>) {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || !json.ok) {
    throw new Error(json.description || `Telegram ${method} failed`)
  }
  return json
}

export async function getTelegramBot(token: string) {
  const json = await telegramApi(token, 'getMe')
  return json.result || {}
}

function numberText(value: unknown, digits = 2) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '--'
  return n.toFixed(digits)
}

function signedMoney(value: unknown, currency = '') {
  const n = Number(value)
  if (!Number.isFinite(n)) return '--'
  const sign = n >= 0 ? '+' : '-'
  return `${sign}${currency ? currency + ' ' : ''}${Math.abs(n).toFixed(2)}`
}

function priceText(value: unknown) {
  const n = Number(value)
  if (!Number.isFinite(n)) return '--'
  return String(value)
}

function eaTitle(ea: any, state?: any) {
  const name = ea?.name || 'EA'
  const symbol = state?.symbol || ea?.symbol || ''
  return symbol && !String(name).includes(symbol) ? `${name} (${symbol})` : name
}

function positionKey(state: any) {
  const p = state?.position || {}
  return [
    state?.accountLogin || 'account',
    state?.symbol || 'symbol',
    p.type || 'SIDE',
    priceText(p.entry),
    priceText(p.sl),
    priceText(p.tp),
  ].join(':')
}

function hasPosition(state: any) {
  return Boolean(state?.position?.hasPosition)
}

function commandLabel(action: string) {
  return EVENT_LABELS[action] || String(action || '').replaceAll('_', ' ')
}

function commandIntent(action: string, payload: Record<string, unknown> = {}) {
  const label = commandLabel(action)
  if (action === 'ARM_BUY') return ['🟢 Buy Action Sent', 'BUY wait request sent to EA. EA will arm BUY and wait for the next valid model.']
  if (action === 'ARM_SELL') return ['🔴 Sell Action Sent', 'SELL wait request sent to EA. EA will arm SELL and wait for the next valid model.']
  if (action === 'AUTO_ARM') return ['🟡 Auto Arm Action Sent', 'Auto arm toggle request sent to EA.']
  if (action === 'CANCEL') return ['⏸ Cancel Action Sent', 'Cancel waiting mode request sent to EA.']
  if (action === 'CLOSE_50') return ['💰 Close 50% Action Sent', 'Close 50% request sent to EA.']
  if (action === 'BREAK_EVEN') return ['🛡 Break Even Action Sent', 'Break even request sent to EA.']
  if (action === 'FIRST_BREAK_EVEN') return ['🛡 First BE Action Sent', 'First trade break even request sent to EA.']
  if (action === 'CLOSE_ALL') return ['🛑 Close All Action Sent', 'Close all matching EA positions request sent to EA.']
  if (action === 'TOGGLE_PARTIALS') return ['⚙️ Partials Toggle Sent', 'Partial close toggle request sent to EA.']
  if (action === 'TOGGLE_SECOND_ENTRY') return ['⚙️ Second Entry Toggle Sent', 'Second entry toggle request sent to EA.']
  if (action === 'TOGGLE_FIRST_TRAIL') return ['⚙️ First Trail Toggle Sent', 'First trade M5 trailing toggle request sent to EA.']
  if (action === 'SET_MODE') return ['⚙️ Mode Update Sent', `Mode update sent to EA: ${String(payload.mode || '--')}.`]
  if (action === 'SET_RISK') return ['⚙️ Risk Update Sent', `Risk settings sent to EA. Lot: ${payload.lot ?? '--'}, Risk: ${payload.risk ?? '--'}, RR: 1:${payload.rr ?? '--'}.`]
  if (action === 'SET_PARTIALS' && payload.firstBreakEven) return ['🛡 First BE Action Sent', 'First trade break even request sent to EA.']
  if (action === 'SET_PARTIALS' && ('partialsOn' in payload || 'secondEntryOn' in payload || 'firstTrailOn' in payload)) return ['⚙️ Trade Controls Sent', 'Trade control settings sent to EA.']
  if (action === 'SET_PARTIALS') return ['⚙️ Partial Values Sent', `Partial values sent to EA. PC1: ${payload.pc1 ?? '--'}%, PC2: ${payload.pc2 ?? '--'}%, PC3: ${payload.pc3 ?? '--'}%.`]
  if (action === 'PING') return ['📡 Ping Sent', 'Ping request sent to EA.']
  return ['📤 Command Sent', `${label} request sent to EA.`]
}

export async function sendTelegramNotification(
  admin: any,
  userId: string,
  eaId: string,
  eventType: string,
  eventKey: string,
  text: string,
  payload: Record<string, unknown> = {},
) {
  const row = {
    user_id: userId,
    ea_id: eaId,
    event_type: eventType,
    event_key: eventKey,
    payload,
    status: 'pending',
  }

  const { data: inserted, error: eventErr } = await admin
    .from('notification_events')
    .insert(row)
    .select('id')
    .single()

  if (eventErr) {
    if (eventErr.code === '23505') return { ok: true, duplicate: true }
    throw eventErr
  }

  const eventId = inserted.id
  const { data: settings, error: settingsErr } = await admin
    .from('telegram_settings')
    .select('enabled, bot_token_cipher, chat_id, prefs')
    .eq('user_id', userId)
    .maybeSingle()

  const prefs = mergeTelegramPrefs(settings?.prefs)
  if (settingsErr || !settings?.enabled || !settings?.bot_token_cipher || !settings?.chat_id || prefs[eventType] === false) {
    await admin.from('notification_events').update({ status: 'skipped' }).eq('id', eventId)
    return { ok: true, skipped: true }
  }

  try {
    const token = await decryptTelegramToken(settings.bot_token_cipher)
    const sent = await telegramApi(token, 'sendMessage', {
      chat_id: settings.chat_id,
      text,
      disable_web_page_preview: true,
    })
    await admin.from('notification_events').update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      telegram_message_id: sent?.result?.message_id ? String(sent.result.message_id) : null,
    }).eq('id', eventId)
    return { ok: true, sent: true }
  } catch (e) {
    await admin.from('notification_events').update({
      status: 'failed',
      error: String((e as Error)?.message || e).slice(0, 500),
    }).eq('id', eventId)
    return { ok: false, error: e }
  }
}

export async function notifyCommandCreated(admin: any, command: any, ea?: any) {
  const label = commandLabel(command.action)
  const payload = command.payload && typeof command.payload === 'object' ? command.payload : {}
  const [title, detail] = commandIntent(command.action, payload)
  const text = [
    title,
    '',
    `EA: ${ea?.name || 'EA'}`,
    `Action: ${label}`,
    detail,
    payload && Object.keys(payload).length ? `Details: ${JSON.stringify(payload)}` : '',
  ].filter(Boolean).join('\n')

  return sendTelegramNotification(
    admin,
    command.user_id,
    command.ea_id,
    'command_sent',
    `command-sent:${command.id}`,
    text,
    { command_id: command.id, action: command.action, payload },
  )
}

export async function notifyCommandAck(admin: any, command: any, message = '') {
  const type = command.status === 'failed' ? 'command_failed' : 'command_done'
  const title = command.status === 'failed' ? '❌ Command Failed' : '✅ Command Done'
  const text = [
    title,
    '',
    `Action: ${commandLabel(command.action)}`,
    message ? `Message: ${message}` : '',
  ].filter(Boolean).join('\n')

  return sendTelegramNotification(
    admin,
    command.user_id,
    command.ea_id,
    type,
    `command-ack:${command.id}:${command.status}`,
    text,
    { command_id: command.id, action: command.action, status: command.status, message },
  )
}

export async function notifyEaOnline(admin: any, ea: any, state: any, nowIso: string) {
  const text = [
    '🟢 EA Online',
    '',
    `EA: ${eaTitle(ea, state)}`,
    `Account: ${state?.accountLogin || ea?.account_login || '--'}`,
    `Time: ${state?.serverTime || nowIso}`,
  ].join('\n')

  await sendTelegramNotification(admin, ea.user_id, ea.id, 'ea_online', `online:${nowIso.slice(0, 16)}`, text, { state })
  await admin.from('telegram_ea_status').upsert({
    ea_id: ea.id,
    user_id: ea.user_id,
    is_online: true,
    last_online_at: nowIso,
    updated_at: nowIso,
  }, { onConflict: 'ea_id' })
}

export async function notifyEaOffline(admin: any, ea: any, lastSeenAt: string, nowIso: string) {
  const text = [
    '🔴 EA Offline',
    '',
    `EA: ${ea?.name || 'EA'}`,
    `Symbol: ${ea?.symbol || '--'}`,
    `Account: ${ea?.account_login || '--'}`,
    `Last seen: ${lastSeenAt || '--'}`,
  ].join('\n')

  await sendTelegramNotification(admin, ea.user_id, ea.id, 'ea_offline', `offline:${lastSeenAt || nowIso}`, text, { last_seen_at: lastSeenAt })
  await admin.from('telegram_ea_status').upsert({
    ea_id: ea.id,
    user_id: ea.user_id,
    is_online: false,
    last_offline_at: nowIso,
    updated_at: nowIso,
  }, { onConflict: 'ea_id' })
}

export async function notifyStateChanges(admin: any, ea: any, previousState: any, currentState: any, nowIso: string) {
  const userId = ea.user_id
  const eaId = ea.id
  const prev = previousState || {}
  const curr = currentState || {}
  const currPos = curr.position || {}
  const prevPos = prev.position || {}
  const currency = curr.currency || ''
  const key = positionKey(curr)

  if (!previousState) return

  const prevMessage = String(prev.message || '').trim()
  const currMessage = String(curr.message || '').trim()
  if (currMessage && currMessage !== prevMessage) {
    const text = [
      '💬 EA Message',
      '',
      `EA: ${eaTitle(ea, curr)}`,
      `Status: ${curr.status || '--'}`,
      `Arm: ${curr.arm || '--'}`,
      `Message: ${currMessage}`,
    ].join('\n')
    await sendTelegramNotification(
      admin,
      userId,
      eaId,
      'ea_message',
      `ea-message:${nowIso}:${currMessage.slice(0, 160)}`,
      text,
      { message: currMessage, status: curr.status, arm: curr.arm },
    )
  }

  if (hasPosition(curr) && !hasPosition(prev)) {
    const text = [
      '🚀 Trade Opened',
      '',
      `EA: ${eaTitle(ea, curr)}`,
      `Symbol: ${curr.symbol || ea.symbol || '--'}`,
      `Type: ${currPos.type || '--'}`,
      `Volume: ${numberText(currPos.volume, 2)}`,
      '',
      `Entry Price: ${priceText(currPos.entry)}`,
      `SL Price: ${priceText(currPos.sl)}`,
      `TP Price: ${priceText(currPos.tp)}`,
      `RR: 1:${numberText(curr.rr, 1)}`,
      '',
      `Account: ${curr.accountLogin || '--'}`,
    ].join('\n')
    await sendTelegramNotification(admin, userId, eaId, 'trade_open', `trade-open:${key}`, text, { position: currPos, state: curr })
  }

  if (hasPosition(curr)) {
    const prevRr = Number(prevPos.rr)
    const currRr = Number(currPos.rr)
    if (Number.isFinite(currRr)) {
      for (const level of [1, 2, 3]) {
        if ((!Number.isFinite(prevRr) || prevRr < level) && currRr >= level) {
          const text = [
            `✅ 1:${level} Reached`,
            '',
            `EA: ${eaTitle(ea, curr)}`,
            `Symbol: ${curr.symbol || ea.symbol || '--'}`,
            `Type: ${currPos.type || '--'}`,
            `Entry: ${priceText(currPos.entry)}`,
            `SL: ${priceText(currPos.sl)}`,
            `TP: ${priceText(currPos.tp)}`,
            `Current RR: ${numberText(currRr, 2)}R`,
            `Open P/L: ${signedMoney(currPos.profit, currency)}`,
          ].join('\n')
          await sendTelegramNotification(admin, userId, eaId, `rr${level}_hit`, `rr${level}:${key}`, text, { level, position: currPos })
        }
      }
    }

    const prevVol = Number(prevPos.volume)
    const currVol = Number(currPos.volume)
    if (Number.isFinite(prevVol) && Number.isFinite(currVol) && currVol > 0 && prevVol > currVol) {
      const closed = prevVol - currVol
      const text = [
        '💰 Partial Booked',
        '',
        `EA: ${eaTitle(ea, curr)}`,
        `Symbol: ${curr.symbol || ea.symbol || '--'}`,
        `Closed Volume: ${numberText(closed, 2)}`,
        `Remaining Volume: ${numberText(currVol, 2)}`,
        `Current RR: ${numberText(currPos.rr, 2)}R`,
      ].join('\n')
      await sendTelegramNotification(admin, userId, eaId, 'partial_hit', `partial:${key}:${numberText(prevVol, 2)}-${numberText(currVol, 2)}`, text, { previous_volume: prevVol, current_volume: currVol })
    }
  }

  const prevHistory = Array.isArray(prev.tradeHistory) ? prev.tradeHistory : []
  const currHistory = Array.isArray(curr.tradeHistory) ? curr.tradeHistory : []
  const prevIds = new Set(prevHistory.map((row: any) => String(row.id || row.positionId || '')))
  for (const row of currHistory) {
    const rowId = String(row?.id || row?.positionId || '')
    if (!rowId || prevIds.has(rowId)) continue
    const reason = String(row.reason || '').toUpperCase()
    const eventType = reason === 'SL' ? 'sl_hit' : reason === 'TP' ? 'tp_hit' : ''
    if (!eventType) continue
    const title = reason === 'SL' ? '🛑 SL Hit' : '🎯 TP Hit'
    const text = [
      title,
      '',
      `EA: ${eaTitle(ea, curr)}`,
      `Symbol: ${curr.symbol || ea.symbol || '--'}`,
      `Type: ${row.type || '--'}`,
      `Entry: ${priceText(row.entryPrice)}`,
      `Exit: ${priceText(row.exitPrice)}`,
      `${reason}: ${priceText(reason === 'SL' ? row.sl : row.tp)}`,
      `P/L: ${signedMoney(row.profit, currency)}`,
      `Reason: ${row.reason || '--'}`,
    ].join('\n')
    await sendTelegramNotification(admin, userId, eaId, eventType, `${eventType}:${rowId}`, text, { trade: row })
  }
}
