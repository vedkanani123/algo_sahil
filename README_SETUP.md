# TCX Supabase React Web Controller

This project is the professional easy version:

React / Vite website -> Supabase Auth + Postgres + Edge Functions -> MT5 EA WebRequest -> your same Three Candle EA logic.

No Python. No Node backend server. Node is only used to run/build the React website on your computer.

## Files

- `src/` - modern React dashboard UI
- `supabase/schema.sql` - database tables + Row Level Security
- `supabase/functions/*` - Edge Functions used by website and EA
- `../Three_Candle_EA_SUPABASE_WEB_FULL.mq5` - updated full MT5 EA file

## 1. Create Supabase project

1. Go to Supabase and create a new project.
2. Open SQL Editor.
3. Paste and run everything from `supabase/schema.sql`.

## 2. Deploy Edge Functions

Install Supabase CLI first.

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
supabase secrets set TELEGRAM_TOKEN_ENCRYPTION_KEY=LONG_RANDOM_SECRET_AT_LEAST_16_CHARS
supabase functions deploy create-command
supabase functions deploy create-bulk-command
supabase functions deploy ea-next-command --no-verify-jwt
supabase functions deploy ea-ack-command --no-verify-jwt
supabase functions deploy ea-post-state --no-verify-jwt
supabase functions deploy telegram-settings --no-verify-jwt
supabase functions deploy telegram-chat-id --no-verify-jwt
supabase functions deploy telegram-offline-monitor --no-verify-jwt
```

The three EA functions use EA ID + EA token, so deploy them with `--no-verify-jwt`.
The Telegram settings functions are also deployed with `--no-verify-jwt` so browser CORS preflight requests can pass. They still verify the signed-in website user inside the function with `admin.auth.getUser(jwt)`. The offline monitor is intended for a scheduled call and does not change the EA file.

## 3. Run website locally

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

Run:

```bash
npm run dev
```

Open the URL shown by Vite, usually `http://localhost:5173`.

## 4. Deploy website

Set these environment variables in your hosting provider before building/deploying:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
```

For Vercel: Project Settings -> Environment Variables -> add both values for Production, Preview, and Development if needed -> Redeploy.

For Netlify: Site configuration -> Environment variables -> add both values -> Trigger deploy.

Do not add `SUPABASE_SERVICE_ROLE_KEY` to the web app. That key is only for Supabase Edge Function secrets.

## 5. Create EA connection in website

1. Sign up / sign in.
2. Create EA Instance.
3. Copy:
   - `InpSupabaseEaId`
   - `InpSupabaseEaToken`
   - `InpSupabaseFunctionsUrl`

## 6. Install EA in MT5

1. Copy `Three_Candle_EA_SUPABASE_WEB_FULL.mq5` to `MQL5/Experts/`.
2. Compile in MetaEditor.
3. In MT5: `Tools -> Options -> Expert Advisors`.
4. Enable Algo Trading.
5. Enable WebRequest and add this URL:

```text
https://YOUR_PROJECT_REF.functions.supabase.co
```

6. Attach EA to XAUUSD/XAUUSDm chart.
7. EA inputs:

```text
InpWebControlEnabled    = true
InpSupabaseFunctionsUrl = https://YOUR_PROJECT_REF.functions.supabase.co
InpSupabaseEaId         = copied EA ID
InpSupabaseEaToken      = copied EA token
InpRiskMoney            = account-currency risk per trade, for example 100
InpWebPollMilliseconds  = 200
```

Risk is now money, not percent. If the account currency is USD and the web dashboard risk field is `100`, the EA sizes the trade so the stop-loss risk is about USD 100 before broker lot-step rounding and margin limits.

## How ARM BUY works

Website ARM BUY -> Supabase command row -> EA polls `ea-next-command` -> EA calls `SetArmMode(ARM_BUY)` -> your existing `TryArmedExecution()` waits for a fresh BUY model -> your existing `ExecuteSignal()` opens trade with your risk/SL/TP logic.

For the multi-account controller, `create-bulk-command` creates one verified command row per selected EA. Each EA still receives only its own command and uses its own risk, lot, RR, partials, symbol, VPS, and broker account settings.

## Test order

1. Run website.
2. Create EA instance.
3. Configure MT5 WebRequest.
4. Attach EA on demo account.
5. Website should show EA ONLINE in 2-5 seconds.
6. Click PING first.
7. Click ARM BUY / ARM SELL.
8. Check Experts tab in MT5 and command log in website.

Use demo first. Do not use live until the command log, state updates, close, BE, and partial commands all work.

## Telegram alerts

Telegram alerts are configured per website user. Each user adds their own Telegram bot token and chat ID in `Settings -> Telegram Settings`.

User setup:

1. Open Telegram and create a bot with `@BotFather`.
2. Copy the bot token into the website Telegram settings.
3. Open the new bot in Telegram and press Start.
4. Click `Get Chat ID` in the website.
5. Click `Save & Test`.

Alerts are sent from Supabase Edge Functions, not from the EA file. The bot token is encrypted with `TELEGRAM_TOKEN_ENCRYPTION_KEY` before it is stored.

To send EA offline alerts, schedule `telegram-offline-monitor` to run every minute. It sends one offline alert per offline transition when `last_seen_at` is older than 60 seconds.
