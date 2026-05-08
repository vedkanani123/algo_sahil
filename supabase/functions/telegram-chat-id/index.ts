import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decryptTelegramToken, getTelegramBot, telegramApi } from '../_shared/telegram.ts'

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
    if (userErr || !userData.user) return json({ ok: false, error: 'Unauthorized' }, 401)
    if (req.method !== 'POST') return json({ ok: false, error: 'Method not allowed' }, 405)

    const { bot_token } = await req.json().catch(() => ({}))
    let token = String(bot_token || '').trim()
    if (!token) {
      const { data: settings, error: settingsErr } = await admin
        .from('telegram_settings')
        .select('bot_token_cipher')
        .eq('user_id', userData.user.id)
        .maybeSingle()
      if (settingsErr) throw settingsErr
      if (settings?.bot_token_cipher) token = await decryptTelegramToken(settings.bot_token_cipher)
    }
    if (!token) return json({ ok: false, error: 'Telegram bot token is required' }, 400)

    const bot = await getTelegramBot(token)
    const updates = await telegramApi(token, 'getUpdates', { limit: 20, allowed_updates: ['message'] })
    const messages = Array.isArray(updates.result) ? updates.result : []
    const latest = [...messages].reverse().find((item: any) => item?.message?.chat?.id)
    if (!latest) {
      return json({
        ok: false,
        error: `Open @${bot.username || 'your_bot'} in Telegram, press Start, send any message, then click Get Chat ID again.`,
        bot_username: bot.username || '',
      }, 404)
    }

    const chat = latest.message.chat
    return json({
      ok: true,
      bot_username: bot.username || '',
      chat: {
        id: String(chat.id),
        type: chat.type || '',
        username: chat.username || '',
        first_name: chat.first_name || '',
        title: chat.title || '',
      },
    })
  } catch (e) {
    return json({ ok: false, error: String((e as Error)?.message || e) }, 500)
  }
})
