import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decryptTelegramToken, defaultTelegramPrefs, encryptTelegramToken, getTelegramBot, mergeTelegramPrefs, telegramApi } from '../_shared/telegram.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

function cleanChatId(value: unknown) {
  return String(value || '').trim()
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

    const userId = userData.user.id

    if (req.method === 'GET') {
      const { data, error } = await admin
        .from('telegram_settings')
        .select('enabled, chat_id, bot_username, prefs, connected_at, updated_at, bot_token_cipher')
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return json({
        ok: true,
        settings: data ? {
          enabled: Boolean(data.enabled),
          chat_id: data.chat_id || '',
          bot_username: data.bot_username || '',
          prefs: mergeTelegramPrefs(data.prefs),
          connected_at: data.connected_at,
          updated_at: data.updated_at,
          has_token: Boolean(data.bot_token_cipher),
        } : {
          enabled: false,
          chat_id: '',
          bot_username: '',
          prefs: defaultTelegramPrefs(),
          connected_at: null,
          updated_at: null,
          has_token: false,
        },
      })
    }

    if (req.method === 'DELETE') {
      const { error } = await admin.from('telegram_settings').delete().eq('user_id', userId)
      if (error) throw error
      return json({ ok: true })
    }

    if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

    const body = await req.json().catch(() => ({}))
    const enabled = Boolean(body.enabled)
    const chatId = cleanChatId(body.chat_id)
    const prefs = mergeTelegramPrefs(body.prefs)
    const test = Boolean(body.test)
    const tokenInput = String(body.bot_token || '').trim()

    const { data: existing, error: existingErr } = await admin
      .from('telegram_settings')
      .select('bot_token_cipher, bot_username, chat_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (existingErr) throw existingErr

    let botTokenCipher = existing?.bot_token_cipher || null
    let botUsername = existing?.bot_username || ''
    let tokenForTest = ''

    if (tokenInput) {
      const bot = await getTelegramBot(tokenInput)
      botUsername = bot.username || ''
      botTokenCipher = await encryptTelegramToken(tokenInput)
      tokenForTest = tokenInput
    }

    if (enabled && !botTokenCipher) return json({ ok: false, error: 'Telegram bot token is required' }, 400)
    if (enabled && !chatId) return json({ ok: false, error: 'Telegram chat ID is required' }, 400)

    const now = new Date().toISOString()
    const row = {
      user_id: userId,
      bot_token_cipher: botTokenCipher,
      chat_id: chatId || existing?.chat_id || null,
      bot_username: botUsername || null,
      enabled,
      prefs,
      connected_at: enabled ? now : null,
      updated_at: now,
    }

    const { error } = await admin.from('telegram_settings').upsert(row, { onConflict: 'user_id' })
    if (error) throw error

    if (test && enabled) {
      if (!tokenForTest) {
        tokenForTest = await decryptTelegramToken(botTokenCipher)
      }
      await telegramApi(tokenForTest, 'sendMessage', {
        chat_id: row.chat_id,
        text: 'TCX Telegram connected successfully. You will receive EA and trade updates here.',
      })
    }

    return json({
      ok: true,
      settings: {
        enabled,
        chat_id: row.chat_id || '',
        bot_username: botUsername || '',
        prefs,
        connected_at: row.connected_at,
        updated_at: row.updated_at,
        has_token: Boolean(botTokenCipher),
      },
    })
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500)
  }
})
