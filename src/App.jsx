import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { hasSupabaseConfig, supabase, functionsUrl, SUPABASE_ANON_KEY } from './supabaseClient.js'
import './styles.css'
import {
  Activity,
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Bell,
  ChevronDown,
  CheckCircle2,
  CircleDot,
  Clock3,
  Copy,
  Database,
  Eye,
  EyeOff,
  Gauge,
  History,
  KeyRound,
  ListChecks,
  Lock,
  LogOut,
  Minus,
  PauseCircle,
  Pencil,
  PlayCircle,
  Plus,
  Radio,
  RefreshCw,
  Save,
  Send,
  Server,
  Settings2,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Trash2,
  WalletCards,
  Wifi,
  WifiOff,
  X,
  XCircle,
  Zap
} from 'lucide-react'

const ACTIONS = {
  ARM_BUY: 'ARM_BUY',
  ARM_SELL: 'ARM_SELL',
  AUTO_ARM: 'AUTO_ARM',
  CANCEL: 'CANCEL',
  CLOSE_50: 'CLOSE_50',
  BREAK_EVEN: 'BREAK_EVEN',
  CLOSE_ALL: 'CLOSE_ALL',
  TOGGLE_PARTIALS: 'TOGGLE_PARTIALS',
  TOGGLE_SECOND_ENTRY: 'TOGGLE_SECOND_ENTRY',
  TOGGLE_FIRST_TRAIL: 'TOGGLE_FIRST_TRAIL',
  SET_MODE: 'SET_MODE',
  SET_RISK: 'SET_RISK',
  SET_PARTIALS: 'SET_PARTIALS',
  PING: 'PING'
}

const TELEGRAM_PREFS = [
  ['trade_open', 'Trade Open'],
  ['sl_hit', 'SL Hit'],
  ['tp_hit', 'TP Hit'],
  ['rr1_hit', '1:1 Hit'],
  ['rr2_hit', '1:2 Hit'],
  ['rr3_hit', '1:3 Hit'],
  ['partial_hit', 'Partial Close'],
  ['command_sent', 'Command Sent'],
  ['command_done', 'Command Done'],
  ['command_failed', 'Command Failed'],
  ['ea_message', 'EA Message'],
  ['ea_online', 'EA Online'],
  ['ea_offline', 'EA Offline']
]

const DEFAULT_TELEGRAM_PREFS = TELEGRAM_PREFS.reduce((acc, [key]) => ({ ...acc, [key]: true }), {})

const RULE_COMPANIES = [
  { id: 'fundingpips', label: 'FundingPips', hasRules: true },
  { id: 'other', label: 'Other company', hasRules: false }
]

const ACCOUNT_SIZE_AUTO = 'auto'
const ACCOUNT_SIZE_CUSTOM = 'custom'
const FUNDING_PIPS_STANDARD_SIZES = [5000, 10000, 25000, 50000, 100000]
const FUNDING_PIPS_EXTENDED_SIZES = [...FUNDING_PIPS_STANDARD_SIZES, 200000]

const COMMON_FP_RULES = {
  lotLimit: 20,
  riskIdeaSmall: 3,
  riskIdeaLarge: 2,
  riskIdeaSplit: 50000,
  inactivityDays: 30,
  commissions: [
    ['Forex', '$5 per lot', '$10 per lot'],
    ['Metals', '$5 per lot', '$10 per lot'],
    ['Energies', 'No commission', 'No commission'],
    ['Indices', 'No commission', 'No commission'],
    ['Crypto', '0.04%', '0.04%']
  ],
  leverage: [
    ['Forex', '1:30', '1:30'],
    ['Metals', '1:10', '1:10'],
    ['Energies', '1:10', '1:10'],
    ['Indices', '1:5', '1:5'],
    ['Crypto', '1:1', '1:1']
  ],
  dynamicLeverage: [
    ['0.00 - 0.05 lots', '1:50'],
    ['0.05 - 0.10 lots', '1:30'],
    ['0.10 - 0.15 lots', '1:25'],
    ['0.15 - 0.25 lots', '1:20'],
    ['0.25 - 0.50 lots', '1:10'],
    ['0.50+ lots', '1:5']
  ],
  generalRules: [
    '20 lots maximum per click or transaction.',
    'Inactivity breach after 30 consecutive days without a completed trade.',
    'Copy trading is allowed only between accounts owned by the same trader.',
    'Forbidden strategies include gap trading, HFT, latency arbitrage, toxic flow, hedging, opposite account trading, tick scalping, and third-party account management.',
    'Stop loss is not required, but risk limits still apply.'
  ]
}

const FUNDING_PIPS_RULES = {
  one_step: {
    id: 'one_step',
    label: '1 Step Model',
    summary: 'Single evaluation phase, then Live account.',
    source: 'FundingPips Help Center - 1 Step Model',
    accountSizes: FUNDING_PIPS_STANDARD_SIZES,
    phases: [
      { label: 'Phase 1', target: 10, days: 3 },
      { label: 'Live', target: null, days: null }
    ],
    dailyLossPct: 3,
    maxLossPct: 6,
    maxLossLabel: 'Maximum Loss',
    consistencyPct: 35,
    consistencyScope: 'On Demand Live rewards',
    rewardText: 'On Demand 90%, Weekly 60%, Bi-Weekly 80%, Monthly 100%.',
    news: 'Evaluation has no news holding restriction. Live account cannot open or close within 5 minutes before or after high-impact news on affected instruments.',
    weekend: 'Temporary master rule: weekend holding is not allowed; open trades may be closed by the system.',
    leverage: COMMON_FP_RULES.leverage,
    commissions: COMMON_FP_RULES.commissions
  },
  two_step: {
    id: 'two_step',
    label: '2 Step Model',
    summary: 'Two evaluation phases, then Live account.',
    source: 'FundingPips Help Center - 2 Step Model',
    accountSizes: FUNDING_PIPS_STANDARD_SIZES,
    phases: [
      { label: 'Phase 1 - 8%', target: 8, days: 3 },
      { label: 'Phase 1 - 10%', target: 10, days: 3 },
      { label: 'Phase 2', target: 5, days: 3 },
      { label: 'Live', target: null, days: null }
    ],
    dailyLossPct: 5,
    maxLossPct: 10,
    maxLossLabel: 'Maximum Loss',
    consistencyPct: 35,
    consistencyScope: 'On Demand Live rewards',
    rewardText: 'On Demand 90%, Weekly 60%, Bi-Weekly 80%, Monthly 100%.',
    news: 'Evaluation has no news holding restriction. Live account cannot open or close within 5 minutes before or after high-impact news on affected instruments.',
    weekend: 'Temporary master rule: weekend holding is not allowed; open trades may be closed by the system.',
    leverage: [
      ['Forex', '1:100', '1:30'],
      ['Metals', '1:30', '1:10'],
      ['Energies', '1:10', '1:10'],
      ['Indices', '1:20', '1:5'],
      ['Crypto', '1:2', '1:1']
    ],
    commissions: COMMON_FP_RULES.commissions
  },
  two_step_pro: {
    id: 'two_step_pro',
    label: '2 Step Pro Model',
    summary: 'Two faster phases with 1 minimum trading day each.',
    source: 'FundingPips Help Center - 2 Step Pro Model',
    accountSizes: FUNDING_PIPS_EXTENDED_SIZES,
    phases: [
      { label: 'Phase 1', target: 6, days: 1 },
      { label: 'Phase 2', target: 6, days: 1 },
      { label: 'Live', target: null, days: null }
    ],
    dailyLossPct: 3,
    maxLossPct: 6,
    maxLossLabel: 'Maximum Loss',
    consistencyPct: 35,
    consistencyScope: 'Only when Daily Reward cycle is selected for evaluation phases',
    rewardText: 'Weekly reward cycle has no consistency rule; Daily Reward add-on adds 35% consistency during evaluation phases.',
    news: 'Evaluation has no news holding restriction. Live account cannot open or close within 5 minutes before or after high-impact news on affected instruments.',
    weekend: 'Weekend holding follows Live account announcements and temporary trading condition updates.',
    leverage: COMMON_FP_RULES.leverage,
    commissions: COMMON_FP_RULES.commissions
  },
  zero: {
    id: 'zero',
    label: 'FundingPips Zero',
    summary: 'Direct Live account with trailing loss, risk, consistency, news, and weekend restrictions.',
    source: 'FundingPips Help Center - FundingPips Zero',
    accountSizes: FUNDING_PIPS_EXTENDED_SIZES,
    phases: [
      { label: 'Live', target: null, days: null }
    ],
    dailyLossPct: 3,
    trailingLossPct: 5,
    maxRiskPct: 1,
    maxLossLabel: 'Maximum Trailing Loss',
    consistencyPct: 15,
    consistencyScope: 'Reward request on Zero Live account',
    profitableDaysRequired: 7,
    profitableDayPct: 0.25,
    rewardText: 'Bi-Weekly 95% reward split after first executed trade, with 15% consistency, 7 profitable days, 3% safety cushion, and biggest loss not exceeding biggest win.',
    news: 'High-impact news holding is not allowed on Zero Live account.',
    weekend: 'Weekend holding is not allowed on FundingPips Zero, even with Swap Free add-on.',
    leverage: [
      ['Forex', '1:50', '1:30'],
      ['Metals', '1:20', '1:10'],
      ['Energies', '1:10', '1:10'],
      ['Indices', '1:20', '1:5'],
      ['Crypto', '1:2', '1:1']
    ],
    commissions: [
      ['Forex', '$7 per lot', '$10 per lot'],
      ['Metals', '$7 per lot', '$10 per lot'],
      ['Energies', 'No commission', 'No commission'],
      ['Indices', 'No commission', 'No commission'],
      ['Crypto', '0.04%', '0.04%']
    ]
  },
  instant_1k: {
    id: 'instant_1k',
    label: '1K Instant Account',
    summary: 'Giveaway instant account with no evaluation phase.',
    source: 'FundingPips Help Center - 1K Instant Account',
    accountSizes: [1000],
    phases: [
      { label: 'Live', target: null, days: null }
    ],
    dailyLossPct: null,
    maxLossPct: null,
    maxLossLabel: 'Not published in crawl',
    consistencyPct: null,
    rewardText: 'No evaluation phase, no minimum days, no time limits, no consistency score. Minimum 50% of every reward request is transferred to Tradin account.',
    news: 'News trading is allowed.',
    weekend: 'Weekend holding is allowed.',
    leverage: [],
    commissions: [],
    specialRules: ['Hedging is strictly prohibited and may result in immediate account closure.', 'Third-party EAs and trade copiers are permitted.']
  }
}

function n(v, d = 2) {
  const x = Number(v)
  if (!Number.isFinite(x)) return '--'
  return x.toFixed(d)
}

function money(v, currency = '') {
  const x = Number(v)
  if (!Number.isFinite(x)) return '--'
  const s = `${x >= 0 ? '+' : '-'}${currency ? currency + ' ' : ''}${Math.abs(x).toFixed(2)}`
  return s
}

function moneyPlain(v, currency = '') {
  const x = Number(v)
  if (!Number.isFinite(x)) return '--'
  return `${currency ? currency + ' ' : ''}${x.toFixed(2)}`
}

function pct(v) {
  return Number.isFinite(Number(v)) ? `${Number(v).toFixed(2)}%` : '--'
}

function clsPL(v) {
  return Number(v) >= 0 ? 'pos' : 'neg'
}

function statusClass(state) {
  if (!state) return 'idle'
  if (state.position?.hasPosition || String(state.status || '').includes('POSITION')) return 'position'
  if (state.arm === 'BUY') return 'buy'
  if (state.arm === 'SELL') return 'sell'
  if (state.arm === 'AUTO') return 'auto'
  return 'idle'
}

function formatClock(value) {
  if (!value) return 'Waiting'
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return 'Waiting'
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function formatHistoryTime(value) {
  if (!value) return '--'
  if (typeof value === 'string') return value
  const date = new Date(Number(value) * 1000)
  if (Number.isNaN(date.getTime())) return '--'
  return date.toLocaleString([], { month: 'short', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function nearNumber(a, b, tolerance = 0.000001) {
  const x = Number(a)
  const y = Number(b)
  return Number.isFinite(x) && Number.isFinite(y) && Math.abs(x - y) <= tolerance
}

function clampNumber(value, min, max) {
  const x = Number(value)
  if (!Number.isFinite(x)) return min
  return Math.max(min, Math.min(max, x))
}

function moneyValue(v, currency = '') {
  const x = Number(v)
  if (!Number.isFinite(x)) return '--'
  return `${currency ? currency + ' ' : ''}${x.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function rulePct(used, inverse = false) {
  const x = Number(used)
  if (!Number.isFinite(x)) return 0
  const pctValue = inverse ? 100 - x : x
  return Math.max(0, Math.min(100, pctValue))
}

function numberValue(value, fallback = 0) {
  const x = Number(value)
  return Number.isFinite(x) ? x : fallback
}

function avg(values) {
  const clean = values.filter(v => Number.isFinite(Number(v)))
  if (!clean.length) return null
  return clean.reduce((sum, v) => sum + Number(v), 0) / clean.length
}

function pad2(value) {
  return String(value).padStart(2, '0')
}

function dateKeyFromSeconds(seconds) {
  const d = new Date(Number(seconds) * 1000)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

function displayDateKey(key) {
  if (!key) return '--'
  const [year, month, day] = String(key).split('-')
  if (!year || !month || !day) return key
  return `${day}-${month}-${year}`
}

function historySeconds(row, field = 'closeTimeSec') {
  const direct = Number(row?.[field])
  if (Number.isFinite(direct) && direct > 0) return direct
  const text = row?.[field.replace('Sec', '')]
  if (!text) return 0
  const normalized = String(text).replace(/\./g, '-')
  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? 0 : Math.floor(parsed.getTime() / 1000)
}

function durationParts(fromSeconds, toMs = Date.now()) {
  const start = Number(fromSeconds) * 1000
  if (!Number.isFinite(start) || start <= 0) return null
  let remaining = Math.max(0, Math.floor((toMs - start) / 1000))
  const days = Math.floor(remaining / 86400)
  remaining -= days * 86400
  const hours = Math.floor(remaining / 3600)
  remaining -= hours * 3600
  const minutes = Math.floor(remaining / 60)
  const seconds = remaining - minutes * 60
  return { days, hours, minutes, seconds }
}

function tradeR(row) {
  const entry = Number(row?.entryPrice)
  const exit = Number(row?.exitPrice)
  const sl = Number(row?.sl)
  if (![entry, exit, sl].every(Number.isFinite) || sl <= 0) return null
  const risk = Math.abs(entry - sl)
  if (risk <= 0) return null
  const side = String(row?.type || '').toUpperCase()
  const move = side === 'SELL' ? entry - exit : exit - entry
  return move / risk
}

function ringStatus(used, allowed, inverse = false) {
  if (!Number.isFinite(Number(allowed)) || Number(allowed) <= 0) return 'neutral'
  const pctUsed = Math.max(0, Number(used) / Number(allowed) * 100)
  if (inverse) return pctUsed >= 100 ? 'pass' : 'watch'
  if (pctUsed >= 100) return 'breach'
  if (pctUsed >= 75) return 'watch'
  return 'pass'
}

function buildRuleMetrics(rawState, rule, selectedPhase, selectedAccountSize = null) {
  const s = rawState || {}
  const rows = Array.isArray(s.tradeHistory) ? s.tradeHistory : []
  const currency = s.currency || 'USD'
  const currentBalance = numberValue(s.balance, 0)
  const currentEquity = numberValue(s.equity, currentBalance)
  const openPL = numberValue(s.openPL, currentEquity - currentBalance)
  const closedNetFromRows = rows.reduce((sum, row) => sum + numberValue(row.profit, 0), 0)
  const closedNet = Number.isFinite(Number(s.totalNet)) ? Number(s.totalNet) : closedNetFromRows
  const inferredSize = currentBalance - closedNet
  const explicitSize = Number(selectedAccountSize)
  const accountSize = explicitSize > 0 ? explicitSize : inferredSize > 0 ? inferredSize : currentBalance > 0 ? currentBalance : 100000
  const totalProfit = currentEquity - accountSize
  const positiveProfit = Math.max(0, totalProfit)
  const dayNet = Number.isFinite(Number(s.dayNet)) ? Number(s.dayNet) : 0
  const dailyStartBalance = currentBalance - dayNet
  const dailyStartEquity = currentEquity - dayNet - openPL
  const dailyBase = Math.max(dailyStartBalance, dailyStartEquity, accountSize)
  const dailyAllowed = rule?.dailyLossPct ? dailyBase * rule.dailyLossPct / 100 : null
  const dailyUsed = dailyAllowed === null ? null : Math.max(0, dailyBase - currentEquity)
  const dailyRemaining = dailyAllowed === null ? null : dailyAllowed - dailyUsed
  const dailyFloor = dailyAllowed === null ? null : dailyBase - dailyAllowed

  const dailyMap = new Map()
  for (const row of rows) {
    const sec = historySeconds(row, 'closeTimeSec')
    const key = dateKeyFromSeconds(sec)
    if (!key) continue
    const profit = numberValue(row.profit, 0)
    const current = dailyMap.get(key) || { key, net: 0, trades: 0, wins: 0, losses: 0 }
    current.net += profit
    current.trades += 1
    if (profit > 0) current.wins += 1
    if (profit < 0) current.losses += 1
    dailyMap.set(key, current)
  }

  const todayKey = dateKeyFromSeconds(Date.now() / 1000)
  if (todayKey) {
    const today = dailyMap.get(todayKey) || { key: todayKey, net: 0, trades: 0, wins: 0, losses: 0 }
    today.net = dayNet || today.net
    today.trades = Number.isFinite(Number(s.dayTrades)) ? Number(s.dayTrades) : today.trades
    dailyMap.set(todayKey, today)
  }

  const dailyRowsAsc = Array.from(dailyMap.values()).sort((a, b) => a.key.localeCompare(b.key))
  const visibleClosedNet = dailyRowsAsc.reduce((sum, day) => sum + day.net, 0)
  let runningBalance = currentBalance - visibleClosedNet
  const chartRows = dailyRowsAsc.map(day => {
    runningBalance += day.net
    return {
      ...day,
      balance: runningBalance,
      equity: day.key === todayKey ? currentEquity : runningBalance
    }
  })
  if (!chartRows.length) {
    chartRows.push({ key: todayKey || dateKeyFromSeconds(Date.now() / 1000), net: dayNet, trades: numberValue(s.dayTrades, 0), wins: 0, losses: 0, balance: currentBalance, equity: currentEquity })
  }

  const highwater = Math.max(accountSize, currentBalance, currentEquity, ...chartRows.map(day => Math.max(day.balance, day.equity)))
  const watchValue = Math.min(currentBalance || currentEquity, currentEquity || currentBalance)
  const maxFloor = rule?.trailingLossPct
    ? Math.min(accountSize, highwater - accountSize * rule.trailingLossPct / 100)
    : rule?.maxLossPct ? accountSize * (1 - rule.maxLossPct / 100) : null
  const maxAllowed = maxFloor === null ? null : rule?.trailingLossPct ? highwater - maxFloor : accountSize - maxFloor
  const maxUsed = maxFloor === null ? null : rule?.trailingLossPct ? Math.max(0, highwater - watchValue) : Math.max(0, accountSize - watchValue)
  const maxRemaining = maxAllowed === null || maxUsed === null ? null : maxAllowed - maxUsed

  const targetAmount = selectedPhase?.target ? accountSize * selectedPhase.target / 100 : null
  const targetProgress = targetAmount ? Math.max(0, positiveProfit) / targetAmount * 100 : null
  const tradingDays = dailyRowsAsc.filter(day => day.trades > 0).length
  const profitableDayFloor = rule?.profitableDayPct ? accountSize * rule.profitableDayPct / 100 : 0
  const profitableDays = dailyRowsAsc.filter(day => day.net >= profitableDayFloor && day.trades > 0).length
  const requiredDays = rule?.profitableDaysRequired || selectedPhase?.days || 0
  const dayObjectiveCount = rule?.profitableDaysRequired ? profitableDays : tradingDays

  const consistencyTopDay = Math.max(0, ...dailyRowsAsc.map(day => day.net))
  const consistencyScore = positiveProfit > 0 ? consistencyTopDay / positiveProfit * 100 : 0
  const consistencyAllowed = rule?.consistencyPct || null
  const totalTrades = numberValue(s.totalTrades, rows.length)
  const wins = numberValue(s.wins, rows.filter(row => numberValue(row.profit, 0) > 0).length)
  const losses = numberValue(s.losses, rows.filter(row => numberValue(row.profit, 0) < 0).length)
  const winRate = totalTrades > 0 ? numberValue(s.winRate, wins * 100 / totalTrades) : 0
  const lossRate = totalTrades > 0 ? 100 - winRate : 0
  const avgWin = avg(rows.map(row => numberValue(row.profit, NaN)).filter(v => v > 0))
  const avgLoss = avg(rows.map(row => numberValue(row.profit, NaN)).filter(v => v < 0))
  const avgRR = avg(rows.map(tradeR).filter(v => v !== null))
  const expectancy = totalTrades > 0 ? closedNet / totalTrades : null
  const positions = Array.isArray(s.position?.positions) ? s.position.positions : []
  const maxOpenLots = Math.max(0, ...positions.map(pos => numberValue(pos.volume, 0)))
  const openFloatingLoss = Math.max(0, -openPL)
  const zeroMaxRiskAmount = rule?.maxRiskPct ? accountSize * rule.maxRiskPct / 100 : null
  const firstTradeSec = rows.reduce((min, row) => {
    const sec = historySeconds(row, 'openTimeSec') || historySeconds(row, 'closeTimeSec')
    return sec > 0 ? Math.min(min, sec) : min
  }, Number.POSITIVE_INFINITY)

  return {
    currency,
    rows,
    currentBalance,
    currentEquity,
    openPL,
    closedNet,
    accountSize,
    inferredAccountSize: inferredSize > 0 ? inferredSize : null,
    explicitAccountSize: explicitSize > 0 ? explicitSize : null,
    totalProfit,
    positiveProfit,
    dailyStartBalance,
    dailyStartEquity,
    dailyBase,
    dailyAllowed,
    dailyUsed,
    dailyRemaining,
    dailyFloor,
    maxFloor,
    maxAllowed,
    maxUsed,
    maxRemaining,
    highwater,
    targetAmount,
    targetProgress,
    tradingDays,
    profitableDays,
    profitableDayFloor,
    requiredDays,
    dayObjectiveCount,
    consistencyTopDay,
    consistencyScore,
    consistencyAllowed,
    totalTrades,
    wins,
    losses,
    winRate,
    lossRate,
    avgWin,
    avgLoss,
    avgRR,
    expectancy,
    maxOpenLots,
    openFloatingLoss,
    zeroMaxRiskAmount,
    firstTradeSec: Number.isFinite(firstTradeSec) ? firstTradeSec : null,
    elapsed: Number.isFinite(firstTradeSec) ? durationParts(firstTradeSec) : null,
    chartRows,
    dailyRows: chartRows.slice().reverse()
  }
}

async function sha256Hex(text) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

function token() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  let out = 'tcx_'
  const arr = new Uint32Array(40)
  crypto.getRandomValues(arr)
  for (const v of arr) out += chars[v % chars.length]
  return out
}

function uid() {
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random()
}

function Login() {
  const [mode, setMode] = useState('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  async function submit(e) {
    e.preventDefault()
    setLoading(true)
    setMsg('')
    const res = mode === 'signup'
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (res.error) setMsg(res.error.message)
    else setMsg(mode === 'signup' ? 'Account created. Check email if confirmation is enabled.' : 'Signed in.')
  }

  return (
    <div className="loginShell">
      <section className="loginIntro">
        <div className="brandMark">
          <span className="brandGlyph"><Zap size={24} /></span>
          <span>TCX Pro</span>
        </div>
        <h1>MT5 execution control, cleaned up for daily use.</h1>
        <div className="loginMetrics" aria-label="Controller features">
          <span><Radio size={16} /> Live EA state</span>
          <span><Shield size={16} /> RLS secured</span>
          <span><ListChecks size={16} /> Command log</span>
        </div>
      </section>

      <section className="loginCard glass" aria-label="Authentication">
        <div className="sectionEyebrow">Secure dashboard</div>
        <h2>{mode === 'signup' ? 'Create account' : 'Sign in'}</h2>
        <form onSubmit={submit} className="loginForm">
          <label>Email<input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="you@email.com" required /></label>
          <label>Password<input value={password} onChange={e => setPassword(e.target.value)} type="password" placeholder="Minimum 6 characters" required /></label>
          <button className="primaryBtn" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
        {msg && <div className="notice">{msg}</div>}
        <button className="textBtn" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>
          {mode === 'signup' ? 'Already have account? Sign in' : 'New user? Create account'}
        </button>
      </section>
    </div>
  )
}

function EASetup({ user, onCreated, onDone }) {
  const [name, setName] = useState('XAUUSD Main VPS')
  const [symbol, setSymbol] = useState('XAUUSD')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState(null)

  async function createEA() {
    setSaving(true)
    const plain = token()
    const token_hash = await sha256Hex(plain)
    const { data, error } = await supabase.from('ea_instances').insert({
      user_id: user.id,
      name,
      symbol,
      token_hash,
      enabled: true
    }).select().single()
    setSaving(false)
    if (error) return alert(error.message)
    setCreated({ ...data, token: plain })
    onCreated?.(data)
  }

  return (
    <div className="setupShell">
      <section className="glass setupCard">
        <div className="panelHeader">
          <div className="panelIcon"><Terminal /></div>
          <div>
            <p className="sectionEyebrow">MT5 bridge</p>
            <h2>Create EA connection</h2>
          </div>
        </div>

        {!created ? (
          <>
            <div className="setupFields">
              <label>EA Name<input value={name} onChange={e => setName(e.target.value)} /></label>
              <label>Symbol<input value={symbol} onChange={e => setSymbol(e.target.value)} /></label>
            </div>
            <button className="primaryBtn fullBtn" onClick={createEA} disabled={saving}>
              {saving ? 'Creating...' : 'Create EA Instance'}
            </button>
          </>
        ) : (
          <div className="secretBox">
            <h3>Copy into MT5 EA inputs</h3>
            <CopyRow label="InpSupabaseEaId" value={created.id} />
            <CopyRow label="InpSupabaseEaToken" value={created.token} />
            <CopyRow label="InpSupabaseFunctionsUrl" value={`${import.meta.env.VITE_SUPABASE_URL?.replace('.supabase.co', '.functions.supabase.co') || 'https://PROJECT_REF.functions.supabase.co'}`} />
            <div className="dangerText"><AlertTriangle size={18} /> Save the token now. It is shown only once.</div>
            <button className="primaryBtn fullBtn" onClick={() => onDone?.()}>Go To Dashboard</button>
          </div>
        )}
      </section>
    </div>
  )
}

function CopyRow({ label, value }) {
  return (
    <div className="copyRow">
      <span>{label}</span>
      <code>{value}</code>
      <button title={`Copy ${label}`} aria-label={`Copy ${label}`} onClick={() => navigator.clipboard?.writeText(value)}>
        <Copy size={15} />
      </button>
    </div>
  )
}

function MissingConfig() {
  return (
    <div className="loginShell">
      <section className="loginIntro">
        <div className="brandMark">
          <span className="brandGlyph"><Zap size={24} /></span>
          <span>TCX Pro</span>
        </div>
        <h1>Supabase config is missing from this deployment.</h1>
        <div className="loginMetrics" aria-label="Required environment variables">
          <span><Server size={16} /> VITE_SUPABASE_URL</span>
          <span><KeyRound size={16} /> VITE_SUPABASE_ANON_KEY</span>
        </div>
      </section>

      <section className="loginCard glass" aria-label="Deployment configuration error">
        <div className="sectionEyebrow">Deploy setup</div>
        <h2>Environment variables required</h2>
        <div className="notice errorNotice">
          Add the Supabase URL and anon key in your hosting provider, then redeploy the site.
        </div>
        <div className="envList">
          <code>VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co</code>
          <code>VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY</code>
        </div>
      </section>
    </div>
  )
}

function CollapsibleSection({ id, title, eyebrow, icon, children, defaultOpen = true, className = '', bodyClassName = '' }) {
  const storageKey = `tcx-section-open-${id}`
  const [open, setOpen] = useState(defaultOpen)

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey)
      if (saved !== null) setOpen(saved === 'true')
    } catch {
      // Collapsing is a UI convenience; it should never block dashboard use.
    }
  }, [storageKey])

  function toggleOpen() {
    setOpen(current => {
      const next = !current
      try {
        window.localStorage.setItem(storageKey, String(next))
      } catch {
        // Ignore storage failures.
      }
      return next
    })
  }

  return (
    <section className={`collapsibleSection glass ${open ? 'open' : 'closed'} ${className}`}>
      <button type="button" className="collapseHeader" onClick={toggleOpen} aria-expanded={open}>
        <span className="collapseTitle">
          <span className="collapseIcon">{icon}</span>
          <span>
            {eyebrow && <small>{eyebrow}</small>}
            <strong>{title}</strong>
          </span>
        </span>
        <span className="collapseControl" title={open ? 'Minimize section' : 'Maximize section'}>
          <ChevronDown size={18} />
        </span>
      </button>
      {open && <div className={`collapseBody ${bodyClassName}`}>{children}</div>}
    </section>
  )
}

function Topbar({ user, instances, selectedId, setSelectedId, refresh, onNewEa, onDeleteEa, lastSyncAt, isRefreshing, view, setView }) {
  const [isEditing, setIsEditing] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [menuOpen, setMenuOpen] = useState(() => {
    try {
      const saved = window.localStorage.getItem('tcx-topbar-open')
      return saved === null ? true : saved === 'true'
    } catch {
      return true
    }
  })
  const [editName, setEditName] = useState('')
  const [editSymbol, setEditSymbol] = useState('')

  const selected = instances.find(x => x.id === selectedId)

  useEffect(() => {
    if (selected) {
      setEditName(selected.name || '')
      setEditSymbol(selected.symbol || '')
    }
  }, [selectedId, selected, isEditing])

  async function handleSave() {
    if (!selectedId) return
    const { error } = await supabase.from('ea_instances').update({ name: editName, symbol: editSymbol }).eq('id', selectedId)
    if (error) alert(error.message)
    else {
      setIsEditing(false)
      refresh()
    }
  }

  function toggleMenuOpen() {
    setMenuOpen(current => {
      const next = !current
      try {
        window.localStorage.setItem('tcx-topbar-open', String(next))
      } catch {
        // Ignore storage failures.
      }
      return next
    })
  }

  return (
    <header className={`topbar glass ${menuOpen ? 'open' : 'topbarClosed'}`}>
      <div className="topbarLeft">
        <div className="brand">
          <div className="logo"><Zap size={22} /></div>
          <div className="brandText">
            <h2>TCX Pro</h2>
            <div className="emailPrivacy">
              <span>{showEmail ? user?.email || 'Supabase MT5 Controller' : 'Email hidden'}</span>
              {user?.email && (
                <button type="button" onClick={() => setShowEmail(v => !v)} title={showEmail ? 'Hide email' : 'Show email'} aria-label={showEmail ? 'Hide email' : 'Show email'}>
                  {showEmail ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              )}
            </div>
          </div>
          <button type="button" className="topbarCollapseBtn" onClick={toggleMenuOpen} title={menuOpen ? 'Minimize menu' : 'Maximize menu'} aria-expanded={menuOpen}>
            <ChevronDown size={18} />
          </button>
        </div>

        <div className={`topbarSelect ${isEditing ? 'editing' : ''}`}>
          {isEditing ? (
            <>
              <input value={editName} onChange={e => setEditName(e.target.value)} placeholder="EA name" />
              <input className="symbolInput" value={editSymbol} onChange={e => setEditSymbol(e.target.value)} placeholder="Symbol" />
              <button className="primaryBtn compactBtn" onClick={handleSave} title="Save EA"><Save size={16} /> Save</button>
              <button className="ghostBtn compactBtn" onClick={() => setIsEditing(false)} title="Cancel edit"><X size={16} /> Cancel</button>
            </>
          ) : (
            <>
              <select value={selectedId || ''} onChange={e => setSelectedId(e.target.value)} aria-label="Select EA instance">
                {instances.map(x => <option key={x.id} value={x.id}>{x.name} {x.symbol ? `- ${x.symbol}` : ''}</option>)}
              </select>
              <button className="ghostBtn iconTextBtn" onClick={() => setIsEditing(true)} title="Edit EA"><Pencil size={16} /> Edit</button>
              <button className="ghostBtn dangerGhost iconTextBtn" onClick={onDeleteEa} title="Delete EA"><Trash2 size={16} /> Delete</button>
            </>
          )}
        </div>
      </div>

      <div className="topbarActions">
        <div className="viewToggle" role="group" aria-label="Dashboard view">
          <button className={view === 'dashboard' ? 'active' : ''} onClick={() => setView('dashboard')} title="Dashboard"><Activity size={16} /> Dashboard</button>
          <button className={view === 'history' ? 'active' : ''} onClick={() => setView('history')} title="Trade history"><History size={16} /> Trades</button>
          <button className={view === 'rules' ? 'active' : ''} onClick={() => setView('rules')} title="Funding rules"><ListChecks size={16} /> Rules</button>
          <button className={view === 'settings' ? 'active' : ''} onClick={() => setView('settings')} title="Settings"><Settings2 size={16} /> Settings</button>
        </div>
        <div className="syncBadge" title="Dashboard polls live data every 1 second">
          <span className="liveDot" />
          <span>1s live</span>
          <small>{formatClock(lastSyncAt)}</small>
        </div>
        <button className="ghostBtn iconTextBtn" onClick={refresh} title="Refresh now">
          <RefreshCw className={isRefreshing ? 'spin' : ''} size={16} /> Refresh
        </button>
        <button className="primaryBtn iconTextBtn" onClick={onNewEa} title="New EA"><Plus size={16} /> New EA</button>
        <button className="ghostBtn iconTextBtn" onClick={() => supabase.auth.signOut()} title="Logout"><LogOut size={16} /> Logout</button>
      </div>
    </header>
  )
}

function StatusHero({ state, selected }) {
  const updatedAt = state?.updated_at ? new Date(state.updated_at) : null
  const online = updatedAt && (Date.now() - updatedAt.getTime()) < 8000
  const s = state?.state || {}
  const score = Number(s.qualityScore ?? 0)
  const scorePct = Math.max(0, Math.min(1, score / 8 || 0))
  const symbol = selected?.symbol || s.symbol || 'XAUUSD'

  return (
    <section className={`hero glass ${statusClass(s)}`}>
      <div className="heroLeft">
        <div className="statusMeta">
          <div className={`onlineRow ${online ? 'online' : 'offline'}`}>
            {online ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span>{online ? 'EA ONLINE' : 'WAITING FOR EA'}</span>
          </div>
          <div className="symbolPill"><Server size={15} /> {symbol}</div>
          <div className="symbolPill"><Clock3 size={15} /> {formatClock(updatedAt)}</div>
        </div>

        <h1>{s.status || 'No live state yet'}</h1>
        <p>{s.message || 'Attach the EA to MT5, enable Algo Trading, and allow WebRequest to your Supabase functions URL.'}</p>

        <div className="chips">
          <div className="chip">Arm <b>{s.arm || 'OFF'}</b></div>
          <div className="chip">Positions <b>{s.position?.count ?? (s.position?.hasPosition ? 1 : 0)}</b></div>
          <div className="chip">Manual <b>{s.position?.manualCount ?? 0}</b></div>
          <div className="chip">TF <b>{s.period || '--'}</b></div>
          <div className="chip">Spread <b>{s.spread ?? '--'}</b></div>
          <div className="chip">SL/TP Space <b>{s.spreadProtectionPoints ?? 0}</b></div>
          <div className="chip">2nd <b>{s.secondEntryOn ? 'ON' : 'OFF'}</b></div>
          <div className="chip">1st Trail <b>{s.firstTrailOn ? 'ON' : 'OFF'}</b></div>
          <div className="chip">Quality <b>{s.qualityText || '--'}</b></div>
        </div>
      </div>

      <aside className="heroRight" aria-label="Trade quality score">
        <div className="scoreRing" style={{ '--score': scorePct }}>
          <div className="scoreValue"><span>{score}</span><small>/8</small></div>
        </div>
        <p>Trade quality</p>
      </aside>
    </section>
  )
}

function StatCards({ state }) {
  const s = state?.state || {}
  const cur = s.currency || ''
  const cards = [
    ['Balance', cur ? `${cur} ${n(s.balance)}` : n(s.balance), <WalletCards />, ''],
    ['Equity', cur ? `${cur} ${n(s.equity)}` : n(s.equity), <Activity />, ''],
    ['Open P/L', money(s.openPL, cur), <BarChart3 />, clsPL(s.openPL)],
    ['Total P/L', money(s.totalNet, cur), <Database />, clsPL(s.totalNet)],
    ['Win Rate', pct(s.winRate), <CheckCircle2 />, ''],
    ['Profit Factor', n(s.profitFactor), <Sparkles />, ''],
    ['Risk/Trade', moneyPlain(s.risk, cur), <Shield />, ''],
    ['Daily R', `${n(s.dayR)}R`, <Shield />, Number(s.dayR) >= 0 ? 'pos' : 'neg'],
    ['Daily Losses', `${s.dayLosses ?? 0}/${s.dayLossLimit ?? 0}`, <AlertTriangle />, Number(s.dayLosses) >= Number(s.dayLossLimit) ? 'neg' : '']
  ]

  return (
    <section className="statGrid" aria-label="Account statistics">
      {cards.map(([t, v, ic, c]) => (
        <div className="statCard glass" key={t}>
          <div className="statIcon">{ic}</div>
          <div className="statInfo"><span>{t}</span><strong className={c || ''}>{v}</strong></div>
        </div>
      ))}
    </section>
  )
}

function StepperInput({ label, value, onChange, onStep, stepLabel }) {
  return (
    <label className="stepperLabel">
      <span>{label}</span>
      <div className="stepperControl">
        <button type="button" className="stepBtn" onClick={() => onStep(-1)} title={`Decrease ${label}`}><Minus size={15} /></button>
        <input inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} />
        <button type="button" className="stepBtn" onClick={() => onStep(1)} title={`Increase ${label}`}><Plus size={15} /></button>
      </div>
      {stepLabel && <small>{stepLabel}</small>}
    </label>
  )
}

function CommandPanel({ session, selected, state, reloadCommands }) {
  const s = state?.state || {}
  const [busy, setBusy] = useState('')
  const [risk, setRisk] = useState({ lot: '0.01', risk: '100.00', rr: '3.0' })
  const [pc, setPc] = useState({ pc1: '30', pc2: '30', pc3: '40' })
  const [riskDirty, setRiskDirty] = useState(false)
  const [pcDirty, setPcDirty] = useState(false)
  const [pendingRisk, setPendingRisk] = useState(null)
  const [pendingPc, setPendingPc] = useState(null)
  const currency = s.currency || 'Money'

  useEffect(() => {
    if (!s) return
    if (pendingRisk && nearNumber(s.lot, pendingRisk.lot) && nearNumber(s.risk, pendingRisk.risk, 0.01) && nearNumber(s.rr, pendingRisk.rr, 0.01)) {
      setPendingRisk(null)
      setRiskDirty(false)
    }
    if (!riskDirty && !pendingRisk) {
      setRisk(r => ({ lot: String(s.lot ?? r.lot), risk: String(s.risk ?? r.risk), rr: String(s.rr ?? r.rr) }))
    }
    if (pendingPc && nearNumber(s.pc1, pendingPc.pc1, 0.1) && nearNumber(s.pc2, pendingPc.pc2, 0.1) && nearNumber(s.pc3, pendingPc.pc3, 0.1)) {
      setPendingPc(null)
      setPcDirty(false)
    }
    if (!pcDirty && !pendingPc) {
      setPc(p => ({ pc1: String(s.pc1 ?? p.pc1), pc2: String(s.pc2 ?? p.pc2), pc3: String(s.pc3 ?? p.pc3) }))
    }
  }, [state?.updated_at, s.lot, s.risk, s.rr, s.pc1, s.pc2, s.pc3, riskDirty, pcDirty, pendingRisk, pendingPc])

  async function cmd(action, payload = {}, options = {}) {
    if (!selected?.id) return alert('Create/select EA first')
    setBusy(action)
    try {
      const res = await fetch(`${functionsUrl}/create-command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ea_id: selected.id, action, payload, client_id: uid() })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) {
        if (!options.silent) alert(json.error || 'Command failed')
        return false
      }
      reloadCommands?.()
      return true
    } finally {
      setBusy('')
    }
  }

  function updateRiskField(key, value) {
    setRisk(r => ({ ...r, [key]: value }))
    setRiskDirty(true)
  }

  function updatePcField(key, value) {
    setPc(p => ({ ...p, [key]: value }))
    setPcDirty(true)
  }

  function stepRiskField(key, direction) {
    const steps = { lot: 0.01, risk: 1, rr: 0.1 }
    const decimals = { lot: 2, risk: 2, rr: 1 }
    const min = { lot: 0.01, risk: 0.01, rr: 0.1 }
    const max = { lot: 100, risk: 100000000, rr: 20 }
    const next = clampNumber((Number(risk[key]) || 0) + direction * steps[key], min[key], max[key])
    updateRiskField(key, next.toFixed(decimals[key]))
  }

  function stepPcField(key, direction) {
    const next = clampNumber((Number(pc[key]) || 0) + direction, 0, 100)
    updatePcField(key, next.toFixed(0))
  }

  async function sendRiskSettings() {
    const lot = Number(risk.lot)
    const riskAmount = Number(risk.risk)
    const rr = Number(risk.rr)
    if (!Number.isFinite(lot) || lot <= 0) return alert('Lot must be greater than zero')
    if (!Number.isFinite(riskAmount) || riskAmount <= 0) return alert('Risk amount must be greater than zero')
    if (!Number.isFinite(rr) || rr <= 0) return alert('RR must be greater than zero')
    const ok = await cmd(ACTIONS.SET_RISK, { lot, risk: riskAmount, rr })
    if (ok) setPendingRisk({ lot, risk: riskAmount, rr })
  }

  async function sendPartialSettings() {
    const next = {
      pc1: clampNumber(pc.pc1, 0, 100),
      pc2: clampNumber(pc.pc2, 0, 100),
      pc3: clampNumber(pc.pc3, 0, 100)
    }
    const ok = await cmd(ACTIONS.SET_PARTIALS, next)
    if (ok) setPendingPc(next)
  }

  async function toggleSecondEntry() {
    const nextOn = !s.secondEntryOn
    const directOk = await cmd(ACTIONS.TOGGLE_SECOND_ENTRY, {}, { silent: true })
    if (directOk) return

    const fallback = {
      pc1: clampNumber(pc.pc1, 0, 100),
      pc2: clampNumber(pc.pc2, 0, 100),
      pc3: clampNumber(pc.pc3, 0, 100),
      secondEntryOn: nextOn
    }
    await cmd(ACTIONS.SET_PARTIALS, fallback)
  }

  return (
    <section className="mainLayout">
      <div className="glass panel controlPanel">
        <div className="panelHeader">
          <div className="panelIcon"><PlayCircle /></div>
          <div>
            <p className="sectionEyebrow">Execution</p>
            <h2>Trade Control</h2>
          </div>
        </div>

        <div className="bigBtns">
          <button className="buyBtn" disabled={Boolean(busy)} onClick={() => cmd(ACTIONS.ARM_BUY)}><ArrowUpCircle /> ARM BUY</button>
          <button className="sellBtn" disabled={Boolean(busy)} onClick={() => cmd(ACTIONS.ARM_SELL)}><ArrowDownCircle /> ARM SELL</button>
        </div>

        <div className="miniBtns">
          <button onClick={() => cmd(ACTIONS.AUTO_ARM)} disabled={Boolean(busy)}><CircleDot /> AUTO ARM</button>
          <button onClick={() => cmd(ACTIONS.CANCEL)} disabled={Boolean(busy)}><PauseCircle /> CANCEL</button>
          <button onClick={() => cmd(ACTIONS.PING)} disabled={Boolean(busy)}><Wifi /> PING</button>
        </div>

        <div className="dangerZone">
          <button onClick={() => cmd(ACTIONS.CLOSE_50)} disabled={Boolean(busy)}><SlidersHorizontal /> CLOSE 50%</button>
          <button onClick={() => cmd(ACTIONS.BREAK_EVEN)} disabled={Boolean(busy)}><Shield /> BREAK EVEN</button>
          <button className="redBtn" onClick={() => window.confirm('Close all EA positions?') && cmd(ACTIONS.CLOSE_ALL)} disabled={Boolean(busy)}><XCircle /> CLOSE ALL</button>
        </div>
      </div>

      <div className="glass panel">
        <div className="panelHeader">
          <div className="panelIcon"><Settings2 /></div>
          <div>
            <p className="sectionEyebrow">Risk</p>
            <h2>Mode & Partials</h2>
          </div>
        </div>

        <div className="settingsGrid">
          <StepperInput label="Lot" value={risk.lot} onChange={value => updateRiskField('lot', value)} onStep={direction => stepRiskField('lot', direction)} stepLabel="+/- 0.01" />
          <StepperInput label={`Risk ${currency}`} value={risk.risk} onChange={value => updateRiskField('risk', value)} onStep={direction => stepRiskField('risk', direction)} stepLabel="+/- 1" />
          <StepperInput label="RR" value={risk.rr} onChange={value => updateRiskField('rr', value)} onStep={direction => stepRiskField('rr', direction)} stepLabel="+/- 0.1" />
        </div>

        <button className="primaryBtn fullBtn" onClick={sendRiskSettings} disabled={Boolean(busy)}>
          Send Risk Settings
        </button>

        <div className="modeToggle" role="group" aria-label="EA mode controls">
          <button onClick={() => cmd(ACTIONS.SET_MODE, { mode: 'safe' })} className={!s.advanced ? 'active' : ''} disabled={Boolean(busy)}>Safe</button>
          <button onClick={() => cmd(ACTIONS.SET_MODE, { mode: 'advanced' })} className={s.advanced ? 'active' : ''} disabled={Boolean(busy)}>Advanced</button>
          <button onClick={() => cmd(ACTIONS.TOGGLE_PARTIALS)} className={s.partialsOn ? 'active successToggle' : ''} disabled={Boolean(busy)}>Partials {s.partialsOn ? 'ON' : 'OFF'}</button>
          <button onClick={toggleSecondEntry} className={s.secondEntryOn ? 'active successToggle' : ''} disabled={Boolean(busy)}>2nd {s.secondEntryOn ? 'ON' : 'OFF'}</button>
          <button onClick={() => cmd(ACTIONS.TOGGLE_FIRST_TRAIL)} className={s.firstTrailOn ? 'active successToggle' : ''} disabled={Boolean(busy)}>1st Trail {s.firstTrailOn ? 'ON' : 'OFF'}</button>
        </div>

        <div className="inlineStatus">{s.secondEntryStatus || '2nd entry OFF'}</div>
        <div className="inlineStatus">{s.firstTrailStatus || '1st trail OFF'}</div>

        <div className="settingsGrid">
          <StepperInput label="PC1 %" value={pc.pc1} onChange={value => updatePcField('pc1', value)} onStep={direction => stepPcField('pc1', direction)} stepLabel="+/- 1" />
          <StepperInput label="PC2 %" value={pc.pc2} onChange={value => updatePcField('pc2', value)} onStep={direction => stepPcField('pc2', direction)} stepLabel="+/- 1" />
          <StepperInput label="PC3 %" value={pc.pc3} onChange={value => updatePcField('pc3', value)} onStep={direction => stepPcField('pc3', direction)} stepLabel="+/- 1" />
        </div>

        <button className="ghostBtn fullBtn" onClick={sendPartialSettings} disabled={Boolean(busy)}>
          Send Partial Settings
        </button>
      </div>
    </section>
  )
}

function PositionPanel({ state }) {
  const s = state?.state || {}
  const p = s.position || {}
  const positions = Array.isArray(p.positions) && p.positions.length ? p.positions : (p.hasPosition ? [p] : [])
  const sourceText = (pos) => pos.source || (Number(pos.magic) === 0 ? 'Manual' : 'EA')

  return (
    <section className="glass panel positionPanel">
      <div className="panelHeader">
        <div className="panelIcon"><Gauge /></div>
        <div>
          <p className="sectionEyebrow">Position</p>
          <h2>{positions.length > 1 ? 'Live Positions' : 'Live Position'}</h2>
        </div>
      </div>

      {!positions.length ? (
        <div className="emptyState">No open dashboard position.</div>
      ) : (
        <div className="positionList">
          {positions.map((pos, index) => {
            const source = sourceText(pos)
            return (
              <div className="positionRow" key={pos.ticket || `${pos.type}-${index}`}>
                <div className="posItem"><span>Source</span><strong><span className={`sourcePill ${source === 'Manual' ? 'manual' : 'ea'}`}>{source}</span></strong></div>
                <div className="posItem"><span>Type</span><strong className={pos.type === 'BUY' ? 'pos' : 'neg'}>{pos.type}</strong></div>
                <div className="posItem"><span>Volume</span><strong>{pos.volume}</strong></div>
                <div className="posItem"><span>RR</span><strong>{n(pos.rr)}R</strong></div>
                <div className="posItem"><span>P/L</span><strong className={clsPL(pos.profit)}>{money(pos.profit, s.currency)}</strong></div>
                <div className="posItem"><span>Entry</span><strong>{pos.entry}</strong></div>
                <div className="posItem"><span>SL</span><strong>{pos.sl}</strong></div>
                <div className="posItem"><span>TP</span><strong>{pos.tp}</strong></div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function StructurePanel({ state }) {
  const st = state?.state?.structure || {}
  const candles = st.candles || []
  const sweeps = st.sweeps || []

  return (
    <section className="structureContainer">
      <div className="glass panel">
        <div className="panelHeader">
          <div className="panelIcon"><Clock3 /></div>
          <div>
            <p className="sectionEyebrow">Structure</p>
            <h2>Candle Structure</h2>
          </div>
        </div>
        <div className="structList">
          {candles.length ? candles.map((x, i) => <StructureRow key={i} label={x.label} good={x.valid} text={!x.valid ? 'No data' : x.bull ? 'Above open' : 'Below open'} kind={x.bull ? 'pos' : 'neg'} />) : <div className="emptyState compact">No candle data.</div>}
        </div>
      </div>

      <div className="glass panel">
        <div className="panelHeader">
          <div className="panelIcon"><Zap /></div>
          <div>
            <p className="sectionEyebrow">Sweep</p>
            <h2>Sweep Structure</h2>
          </div>
        </div>
        <div className="structList">
          {sweeps.length ? sweeps.map((x, i) => <StructureRow key={i} label={x.label} good={x.valid} text={!x.valid ? 'No sweep' : x.high ? 'High sweep' : x.low ? 'Low sweep' : 'Clean'} kind={x.high ? 'neg' : x.low ? 'pos' : ''} />) : <div className="emptyState compact">No sweep data.</div>}
        </div>
      </div>
    </section>
  )
}

function StructureRow({ label, good, text, kind }) {
  return (
    <div className="structRow">
      <span className="structLabel">{label}</span>
      <div className="structState"><b className={kind}>{text}</b><div className={`dot ${good ? 'ok' : 'off'}`} /></div>
    </div>
  )
}

function CommandsLog({ commands }) {
  return (
    <section className="glass panel">
      <div className="panelHeader">
        <div className="panelIcon"><KeyRound /></div>
        <div>
          <p className="sectionEyebrow">History</p>
          <h2>Command Log</h2>
        </div>
      </div>
      <div className="logContainer">
        {commands.length ? commands.map(c => (
          <div className="logItem" key={c.id}>
            <div className={`logBadge ${c.status}`}>{c.status}</div>
            <div className="logContent"><strong>{String(c.action || '').replaceAll('_', ' ')}</strong><p>{c.result_message || 'Waiting for EA...'}</p></div>
            <div className="logTime">{formatClock(c.created_at)}</div>
          </div>
        )) : <div className="emptyState">No commands yet.</div>}
      </div>
    </section>
  )
}

function TelegramSettingsPage({ session }) {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [chatLoading, setChatLoading] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [hasToken, setHasToken] = useState(false)
  const [botUsername, setBotUsername] = useState('')
  const [savedMeta, setSavedMeta] = useState({ connected_at: null, updated_at: null })
  const [form, setForm] = useState({
    enabled: false,
    bot_token: '',
    chat_id: '',
    prefs: DEFAULT_TELEGRAM_PREFS
  })

  const authHeaders = useMemo(() => ({
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session.access_token}`
  }), [session.access_token])

  const loadSettings = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${functionsUrl}/telegram-settings`, { headers: authHeaders })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error || 'Unable to load Telegram settings')
      const s = json.settings || {}
      setHasToken(Boolean(s.has_token))
      setBotUsername(s.bot_username || '')
      setSavedMeta({ connected_at: s.connected_at || null, updated_at: s.updated_at || null })
      setForm({
        enabled: Boolean(s.enabled),
        bot_token: '',
        chat_id: s.chat_id || '',
        prefs: { ...DEFAULT_TELEGRAM_PREFS, ...(s.prefs || {}) }
      })
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setLoading(false)
    }
  }, [authHeaders])

  useEffect(() => { loadSettings() }, [loadSettings])

  function setPref(key, value) {
    setForm(current => ({ ...current, prefs: { ...current.prefs, [key]: value } }))
  }

  async function saveSettings(test = false) {
    setSaving(true)
    setNotice('')
    setError('')
    try {
      const res = await fetch(`${functionsUrl}/telegram-settings`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          enabled: test ? true : form.enabled,
          bot_token: form.bot_token.trim() || undefined,
          chat_id: form.chat_id.trim(),
          prefs: form.prefs,
          test
        })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error || 'Unable to save Telegram settings')
      const s = json.settings || {}
      setHasToken(Boolean(s.has_token))
      setBotUsername(s.bot_username || botUsername)
      setSavedMeta({ connected_at: s.connected_at || null, updated_at: s.updated_at || null })
      setForm(current => ({ ...current, enabled: Boolean(s.enabled), bot_token: '', chat_id: s.chat_id || current.chat_id, prefs: { ...DEFAULT_TELEGRAM_PREFS, ...(s.prefs || current.prefs) } }))
      setNotice(test ? 'Telegram saved and test message sent.' : 'Telegram settings saved.')
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setSaving(false)
    }
  }

  async function getChatId() {
    setChatLoading(true)
    setNotice('')
    setError('')
    try {
      const res = await fetch(`${functionsUrl}/telegram-chat-id`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ bot_token: form.bot_token.trim() || undefined })
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error || 'Unable to get Telegram chat ID')
      setBotUsername(json.bot_username || botUsername)
      const chatId = json.chat?.id || form.chat_id
      setForm(current => ({ ...current, enabled: true, chat_id: chatId }))

      const saveRes = await fetch(`${functionsUrl}/telegram-settings`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({
          enabled: true,
          bot_token: form.bot_token.trim() || undefined,
          chat_id: chatId,
          prefs: form.prefs,
          test: false
        })
      })
      const saveJson = await saveRes.json().catch(() => ({}))
      if (!saveRes.ok || !saveJson.ok) throw new Error(saveJson.error || 'Chat ID detected but could not be saved')
      const s = saveJson.settings || {}
      setHasToken(Boolean(s.has_token))
      setSavedMeta({ connected_at: s.connected_at || null, updated_at: s.updated_at || null })
      setForm(current => ({ ...current, enabled: Boolean(s.enabled), bot_token: '', chat_id: s.chat_id || chatId, prefs: { ...DEFAULT_TELEGRAM_PREFS, ...(s.prefs || current.prefs) } }))
      setNotice(`Chat ID detected and saved${json.chat?.username ? ` for @${json.chat.username}` : ''}.`)
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setChatLoading(false)
    }
  }

  async function disconnect() {
    if (!window.confirm('Disconnect Telegram alerts?')) return
    setSaving(true)
    setNotice('')
    setError('')
    try {
      const res = await fetch(`${functionsUrl}/telegram-settings`, { method: 'DELETE', headers: authHeaders })
      const json = await res.json().catch(() => ({}))
      if (!res.ok || !json.ok) throw new Error(json.error || 'Unable to disconnect Telegram')
      setHasToken(false)
      setBotUsername('')
      setSavedMeta({ connected_at: null, updated_at: null })
      setForm({ enabled: false, bot_token: '', chat_id: '', prefs: DEFAULT_TELEGRAM_PREFS })
      setNotice('Telegram disconnected.')
    } catch (e) {
      setError(String(e.message || e))
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <section className="glass panel">
        <div className="emptyState">Loading Telegram settings...</div>
      </section>
    )
  }

  return (
    <section className="settingsPage">
      <div className="glass panel telegramPanel">
        <div className="panelHeader settingsHeader">
          <div className="panelIcon"><Bell /></div>
          <div>
            <p className="sectionEyebrow">Alerts</p>
            <h2>Telegram Settings</h2>
          </div>
          <div className={`telegramStatus ${form.enabled ? 'connected' : ''}`}>
            {form.enabled ? 'Connected' : 'Disabled'}
          </div>
        </div>

        <div className="telegramGrid">
          {(hasToken || form.chat_id || botUsername) && (
            <div className="telegramSavedBox">
              <div><span>Bot Token</span><strong>{hasToken ? 'Saved securely' : 'Not saved'}</strong></div>
              <div><span>Chat ID</span><strong>{form.chat_id || 'Not set'}</strong></div>
              <div><span>Bot</span><strong>{botUsername ? `@${botUsername}` : 'Not checked'}</strong></div>
              <div><span>Updated</span><strong>{formatClock(savedMeta.updated_at)}</strong></div>
            </div>
          )}

          <label className="toggleLine">
            <input type="checkbox" checked={form.enabled} onChange={e => setForm(current => ({ ...current, enabled: e.target.checked }))} />
            <span>Enable Telegram Alerts</span>
          </label>

          <label>
            Telegram Bot Token
            <input
              type="password"
              value={form.bot_token}
              onChange={e => setForm(current => ({ ...current, bot_token: e.target.value }))}
              placeholder={hasToken ? 'Token saved - paste new token to replace' : '123456789:AA...'}
              autoComplete="off"
            />
          </label>

          <label>
            Telegram Chat ID
            <div className="chatIdRow">
              <input
                value={form.chat_id}
                onChange={e => setForm(current => ({ ...current, chat_id: e.target.value }))}
                placeholder="Press Start in your bot, then get chat ID"
              />
              <button className="ghostBtn" onClick={getChatId} disabled={chatLoading || (!form.bot_token.trim() && !hasToken)}>
                <Send size={16} /> {chatLoading ? 'Checking...' : 'Get Chat ID'}
              </button>
            </div>
          </label>

          {botUsername && <div className="telegramBotLine">Bot: @{botUsername}</div>}
          {notice && <div className="notice">{notice}</div>}
          {error && <div className="notice errorNotice">{error}</div>}

          <div className="telegramActions">
            <button className="primaryBtn" onClick={() => saveSettings(true)} disabled={saving}>
              <Send size={16} /> {saving ? 'Saving...' : 'Save & Test'}
            </button>
            <button className="ghostBtn" onClick={() => saveSettings(false)} disabled={saving}>
              <Save size={16} /> Save
            </button>
            <button className="ghostBtn dangerGhost" onClick={disconnect} disabled={saving || (!hasToken && !form.chat_id)}>
              <Trash2 size={16} /> Disconnect
            </button>
          </div>
        </div>
      </div>

      <div className="glass panel telegramPanel">
        <div className="panelHeader">
          <div className="panelIcon"><Settings2 /></div>
          <div>
            <p className="sectionEyebrow">Preferences</p>
            <h2>Message Types</h2>
          </div>
        </div>
        <div className="prefGrid">
          {TELEGRAM_PREFS.map(([key, label]) => (
            <label className="prefItem" key={key}>
              <input type="checkbox" checked={form.prefs[key] !== false} onChange={e => setPref(key, e.target.checked)} />
              <span>{label}</span>
            </label>
          ))}
        </div>
      </div>
    </section>
  )
}

function RulesPage({ state, selected }) {
  const s = state?.state || {}
  const [company, setCompany] = useState('fundingpips')
  const [modelId, setModelId] = useState('two_step')
  const [phaseIndex, setPhaseIndex] = useState(0)
  const [accountSizeMode, setAccountSizeMode] = useState(ACCOUNT_SIZE_AUTO)
  const [customAccountSize, setCustomAccountSize] = useState('')
  const storageKey = `tcx-rule-config-${selected?.id || 'default'}`
  const rule = FUNDING_PIPS_RULES[modelId]
  const companyInfo = RULE_COMPANIES.find(x => x.id === company)
  const accountSizeOptions = rule?.accountSizes || FUNDING_PIPS_STANDARD_SIZES
  const selectedAccountSize = accountSizeMode === ACCOUNT_SIZE_AUTO
    ? null
    : accountSizeMode === ACCOUNT_SIZE_CUSTOM
      ? Number(customAccountSize)
      : Number(accountSizeMode)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey)
      if (!raw) return
      const saved = JSON.parse(raw)
      if (saved.company) setCompany(saved.company)
      if (saved.modelId && FUNDING_PIPS_RULES[saved.modelId]) setModelId(saved.modelId)
      if (Number.isFinite(Number(saved.phaseIndex))) setPhaseIndex(Number(saved.phaseIndex))
      if (saved.accountSizeMode) setAccountSizeMode(String(saved.accountSizeMode))
      if (saved.customAccountSize) setCustomAccountSize(String(saved.customAccountSize))
    } catch {
      // Local storage is optional. Live calculations still work without it.
    }
  }, [storageKey])

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, JSON.stringify({ company, modelId, phaseIndex, accountSizeMode, customAccountSize }))
    } catch {
      // Ignore storage failures in private browsing or locked-down browsers.
    }
  }, [storageKey, company, modelId, phaseIndex, accountSizeMode, customAccountSize])

  useEffect(() => {
    if (accountSizeMode === ACCOUNT_SIZE_AUTO || accountSizeMode === ACCOUNT_SIZE_CUSTOM) return
    if (!accountSizeOptions.includes(Number(accountSizeMode))) setAccountSizeMode(ACCOUNT_SIZE_AUTO)
  }, [accountSizeMode, accountSizeOptions])

  const phases = rule?.phases || []
  const selectedPhase = phases[Math.min(phaseIndex, Math.max(0, phases.length - 1))] || phases[0] || {}
  const metrics = buildRuleMetrics(s, rule, selectedPhase, selectedAccountSize)
  const currency = metrics.currency
  const riskIdeaPct = metrics.accountSize < COMMON_FP_RULES.riskIdeaSplit ? COMMON_FP_RULES.riskIdeaSmall : COMMON_FP_RULES.riskIdeaLarge
  const riskIdeaAmount = metrics.accountSize * riskIdeaPct / 100
  const targetLeft = metrics.targetAmount === null ? null : Math.max(0, metrics.targetAmount - metrics.positiveProfit)
  const requiredDayLabel = rule?.profitableDaysRequired ? 'Profitable Days' : 'Min. Trading Days'
  const dayProgress = metrics.requiredDays ? metrics.dayObjectiveCount / metrics.requiredDays * 100 : null
  const dailyProgress = metrics.dailyAllowed ? metrics.dailyUsed / metrics.dailyAllowed * 100 : null
  const maxProgress = metrics.maxAllowed ? metrics.maxUsed / metrics.maxAllowed * 100 : null
  const consistencyProgress = metrics.consistencyAllowed ? metrics.consistencyScore / metrics.consistencyAllowed * 100 : null
  const riskProgress = metrics.zeroMaxRiskAmount
    ? metrics.openFloatingLoss / metrics.zeroMaxRiskAmount * 100
    : metrics.maxOpenLots / COMMON_FP_RULES.lotLimit * 100
  const objectives = [
    {
      label: 'Profit',
      value: money(metrics.totalProfit, currency),
      progress: metrics.targetAmount ? metrics.targetProgress : null,
      center: metrics.targetAmount ? `${n(rulePct(metrics.targetProgress), 0)}%` : null,
      state: metrics.targetAmount ? (metrics.positiveProfit >= metrics.targetAmount ? 'pass' : 'watch') : metrics.totalProfit >= 0 ? 'pass' : 'breach',
      detail: metrics.targetAmount ? `${moneyValue(Math.max(0, metrics.positiveProfit), currency)} / ${moneyValue(metrics.targetAmount, currency)} target` : 'No target on this phase.'
    },
    {
      label: 'Daily Loss',
      value: metrics.dailyAllowed === null ? 'N/A' : `${moneyValue(metrics.dailyUsed, currency)} / ${moneyValue(metrics.dailyAllowed, currency)}`,
      progress: dailyProgress,
      center: dailyProgress === null ? 'N/A' : `${n(rulePct(dailyProgress), 0)}%`,
      state: ringStatus(metrics.dailyUsed, metrics.dailyAllowed),
      detail: metrics.dailyFloor === null ? 'No daily loss in this rule pack.' : `Floor ${moneyValue(metrics.dailyFloor, currency)}, remaining ${moneyValue(metrics.dailyRemaining, currency)}.`
    },
    {
      label: rule?.maxLossLabel || 'Maximum Loss',
      value: metrics.maxAllowed === null ? 'N/A' : `${moneyValue(metrics.maxUsed, currency)} / ${moneyValue(metrics.maxAllowed, currency)}`,
      progress: maxProgress,
      center: maxProgress === null ? 'N/A' : `${n(rulePct(maxProgress), 0)}%`,
      state: ringStatus(metrics.maxUsed, metrics.maxAllowed),
      detail: metrics.maxFloor === null ? 'No maximum loss in this rule pack.' : `Breach level ${moneyValue(metrics.maxFloor, currency)}, remaining ${moneyValue(metrics.maxRemaining, currency)}.`
    },
    {
      label: requiredDayLabel,
      value: metrics.requiredDays ? `${metrics.dayObjectiveCount} / ${metrics.requiredDays}` : 'N/A',
      progress: dayProgress,
      center: dayProgress === null ? 'N/A' : `${n(rulePct(dayProgress), 0)}%`,
      state: metrics.requiredDays ? (metrics.dayObjectiveCount >= metrics.requiredDays ? 'pass' : 'watch') : 'neutral',
      detail: rule?.profitableDaysRequired ? `Zero reward rule uses profitable days of at least ${moneyValue(metrics.profitableDayFloor, currency)}.` : selectedPhase.days ? `${selectedPhase.label} needs ${selectedPhase.days} minimum day(s).` : 'No minimum day rule for this phase.'
    },
    {
      label: 'Consistency',
      value: metrics.consistencyAllowed ? `${n(metrics.consistencyScore, 2)}% / ${metrics.consistencyAllowed}%` : 'N/A',
      progress: consistencyProgress,
      center: metrics.consistencyAllowed ? `${n(metrics.consistencyScore, 0)}%` : 'N/A',
      state: !metrics.consistencyAllowed || metrics.positiveProfit <= 0 ? 'neutral' : metrics.consistencyScore <= metrics.consistencyAllowed ? 'pass' : 'breach',
      detail: metrics.consistencyAllowed ? `Top day ${moneyValue(metrics.consistencyTopDay, currency)}. ${rule.consistencyScope}.` : 'No consistency rule in this pack.'
    },
    {
      label: metrics.zeroMaxRiskAmount ? 'Floating Risk' : 'Lot Limit',
      value: metrics.zeroMaxRiskAmount ? `${moneyValue(metrics.openFloatingLoss, currency)} / ${moneyValue(metrics.zeroMaxRiskAmount, currency)}` : `${n(metrics.maxOpenLots, 2)} / ${COMMON_FP_RULES.lotLimit} lots`,
      progress: riskProgress,
      center: `${n(rulePct(riskProgress), 0)}%`,
      state: metrics.zeroMaxRiskAmount ? ringStatus(metrics.openFloatingLoss, metrics.zeroMaxRiskAmount) : ringStatus(metrics.maxOpenLots, COMMON_FP_RULES.lotLimit),
      detail: metrics.zeroMaxRiskAmount ? `Zero risk cap is ${rule.maxRiskPct}% of initial size.` : `Single click limit. Idea risk guide: ${riskIdeaPct}% (${moneyValue(riskIdeaAmount, currency)}).`
    }
  ]

  const clearChecks = objectives.filter(card => card.state === 'pass').length
  const statusText = state?.updated_at ? `Live ${formatClock(state.updated_at)}` : 'Waiting for live state'
  const accountSizeSource = metrics.explicitAccountSize
    ? accountSizeMode === ACCOUNT_SIZE_CUSTOM ? 'Custom' : 'Selected'
    : metrics.inferredAccountSize ? 'Auto'
      : 'Fallback'

  if (!companyInfo?.hasRules) {
    return (
      <section className="rulesPage">
        <div className="glass panel rulesControlPanel">
          <div className="panelHeader">
            <div className="panelIcon"><ListChecks /></div>
            <div>
              <p className="sectionEyebrow">Rules Dashboard</p>
              <h2>Account Rule Pack</h2>
            </div>
          </div>
          <div className="rulesControlGrid">
            <label>Company<select value={company} onChange={e => setCompany(e.target.value)}>{RULE_COMPANIES.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select></label>
          </div>
          <div className="emptyState">No rule pack is configured for this company yet.</div>
        </div>
      </section>
    )
  }

  return (
    <section className="rulesPage">
      <section className="glass rulesHero ruleDashboardHero">
        <div>
          <p className="sectionEyebrow">FundingPips Rules</p>
          <h1>{rule.label}</h1>
          <p>{rule.summary} All objective values below are calculated from the latest MT5 balance, equity, open P/L, positions, and closed trade history.</p>
          <div className="chips">
            <div className="chip">Account Size <b>{moneyValue(metrics.accountSize, currency)}</b></div>
            <div className="chip">Size Source <b>{accountSizeSource}</b></div>
            <div className="chip">Phase <b>{selectedPhase.label}</b></div>
            <div className="chip">Symbol <b>{s.symbol || selected?.symbol || '--'}</b></div>
            <div className="chip">Update <b>{statusText}</b></div>
          </div>
        </div>
        <div className="rulesScore">
          <strong>{clearChecks}</strong>
          <span>checks clear</span>
        </div>
      </section>

      <section className="glass panel rulesControlPanel autoRulesControls">
        <div className="panelHeader">
          <div className="panelIcon"><SlidersHorizontal /></div>
          <div>
            <p className="sectionEyebrow">Selectors</p>
            <h2>Company, Account, Phase</h2>
          </div>
        </div>
        <div className="rulesControlGrid">
          <label>Company<select value={company} onChange={e => setCompany(e.target.value)}>{RULE_COMPANIES.map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select></label>
          <label>Account Type<select value={modelId} onChange={e => { setModelId(e.target.value); setPhaseIndex(0) }}>{Object.values(FUNDING_PIPS_RULES).map(x => <option value={x.id} key={x.id}>{x.label}</option>)}</select></label>
          <label>Account Size<select value={accountSizeMode} onChange={e => setAccountSizeMode(e.target.value)}>
            <option value={ACCOUNT_SIZE_AUTO}>Auto from MT5</option>
            {accountSizeOptions.map(size => <option value={String(size)} key={size}>{moneyValue(size, currency)}</option>)}
            <option value={ACCOUNT_SIZE_CUSTOM}>Custom / Scaled</option>
          </select></label>
          <label>Phase<select value={phaseIndex} onChange={e => setPhaseIndex(Number(e.target.value))}>{phases.map((x, i) => <option value={i} key={`${x.label}-${i}`}>{x.label}</option>)}</select></label>
          {accountSizeMode === ACCOUNT_SIZE_CUSTOM && (
            <label>Custom Account Size<input type="number" min="1" step="1000" value={customAccountSize} onChange={e => setCustomAccountSize(e.target.value)} placeholder="Example 120000" /></label>
          )}
        </div>
      </section>

      <section className="glass panel objectivesPanel">
        <div className="panelHeader">
          <div className="panelIcon"><Shield /></div>
          <div>
            <p className="sectionEyebrow">Objectives</p>
            <h2>Live Funding Checks</h2>
          </div>
        </div>
        <div className="objectivesGrid">
          {objectives.map(card => <ObjectiveCard key={card.label} {...card} />)}
        </div>
      </section>

      <section className="accountSnapshotGrid">
        <div className="glass accountMetricCard">
          <span>Balance</span>
          <strong className={clsPL(metrics.currentBalance - metrics.accountSize)}>{moneyValue(metrics.currentBalance, currency)}</strong>
        </div>
        <div className="glass accountMetricCard">
          <span>Equity</span>
          <strong className={clsPL(metrics.currentEquity - metrics.accountSize)}>{moneyValue(metrics.currentEquity, currency)}</strong>
        </div>
        <div className="glass accountMetricCard">
          <span>Open P/L</span>
          <strong className={clsPL(metrics.openPL)}>{money(metrics.openPL, currency)}</strong>
        </div>
        <div className="glass accountMetricCard">
          <span>Win Ratio</span>
          <strong>{n(metrics.winRate, 0)}%</strong>
        </div>
      </section>

      <section className="ruleDashboardGrid">
        <div className="glass panel accountChartPanel">
          <div className="panelHeader">
            <div className="panelIcon"><BarChart3 /></div>
            <div>
              <p className="sectionEyebrow">Account Balance</p>
              <h2>Balance, Equity, And Loss Floors</h2>
            </div>
          </div>
          <AccountCurveChart metrics={metrics} />
          <div className="lossInfoGrid">
            <div><span>Max permitted loss</span><strong>{metrics.maxAllowed === null ? 'N/A' : moneyValue(metrics.maxAllowed, currency)}</strong></div>
            <div><span>Today permitted loss</span><strong>{metrics.dailyAllowed === null ? 'N/A' : moneyValue(metrics.dailyAllowed, currency)}</strong></div>
            <div><span>Today result</span><strong className={clsPL(numberValue(s.dayNet, 0))}>{money(numberValue(s.dayNet, 0), currency)}</strong></div>
            <div><span>Target left</span><strong>{targetLeft === null ? 'N/A' : moneyValue(targetLeft, currency)}</strong></div>
          </div>
        </div>

        <div className="rulesSideStack">
          <div className="glass panel accountDataPanel">
            <div className="panelHeader">
              <div className="panelIcon"><Database /></div>
              <div>
                <p className="sectionEyebrow">Account Data</p>
                <h2>MT5 Details</h2>
              </div>
            </div>
            <div className="accountInfoList">
              <AccountInfoRow icon={<KeyRound />} label="Login" value={s.accountLogin ? `#${s.accountLogin}` : '--'} />
              <AccountInfoRow icon={<WalletCards />} label="Account Size" value={moneyValue(metrics.accountSize, currency)} />
              <AccountInfoRow icon={<Server />} label="Platform" value={s.platform || 'MetaTrader 5'} />
              <AccountInfoRow icon={<Database />} label="Server" value={s.accountServer || s.accountCompany || 'Waiting for EA'} />
              <AccountInfoRow icon={<Activity />} label="Company" value={s.accountCompany || companyInfo.label} />
            </div>
          </div>

          <div className="glass panel elapsedPanel">
            <h2>Time Since First Trade</h2>
            <div className="elapsedGrid">
              <div><strong>{metrics.elapsed?.days ?? '--'}</strong><span>DAY</span></div>
              <div><strong>{metrics.elapsed?.hours ?? '--'}</strong><span>HR</span></div>
              <div><strong>{metrics.elapsed?.minutes ?? '--'}</strong><span>MIN</span></div>
              <div><strong>{metrics.elapsed?.seconds ?? '--'}</strong><span>SEC</span></div>
            </div>
            <p>Start Date</p>
            <strong>{metrics.firstTradeSec ? displayDateKey(dateKeyFromSeconds(metrics.firstTradeSec)) : '--'}</strong>
          </div>
        </div>
      </section>

      <section className="rulesGrid">
        <div className="glass panel statisticsPanel">
          <div className="panelHeader">
            <div className="panelIcon"><Gauge /></div>
            <div>
              <p className="sectionEyebrow">Statistics</p>
              <h2>Trading Performance</h2>
            </div>
          </div>
          <div className="statisticsGrid">
            <StatValue label="Number of Trades" value={metrics.totalTrades} />
            <StatValue label="Average Winning Trade" value={metrics.avgWin === null ? '--' : moneyValue(metrics.avgWin, currency)} mood="pos" />
            <StatValue label="Highwater Mark Balance" value={moneyValue(metrics.highwater, currency)} />
            <StatValue label="Average Losing Trade" value={metrics.avgLoss === null ? '--' : moneyValue(metrics.avgLoss, currency)} mood="neg" />
            <StatValue label="Win Rate %" value={`${n(metrics.winRate, 0)}%`} />
            <StatValue label="Average RRR" value={metrics.avgRR === null ? '--' : n(metrics.avgRR, 2)} />
            <StatValue label="Loss Rate %" value={`${n(metrics.lossRate, 0)}%`} />
            <StatValue label="Expectancy" value={metrics.expectancy === null ? '--' : moneyValue(metrics.expectancy, currency)} mood={metrics.expectancy >= 0 ? 'pos' : 'neg'} />
            <StatValue label="Consistency Top Day" value={moneyValue(metrics.consistencyTopDay, currency)} />
          </div>
        </div>

        <div className="glass panel dailySummaryPanel">
          <div className="panelHeader">
            <div className="panelIcon"><Clock3 /></div>
            <div>
              <p className="sectionEyebrow">Daily Summary</p>
              <h2>Balance By Day</h2>
            </div>
          </div>
          <DailySummaryTable rows={metrics.dailyRows} currency={currency} />
        </div>
      </section>

      <section className="rulesGrid">
        <div className="glass panel">
          <div className="panelHeader">
            <div className="panelIcon"><ListChecks /></div>
            <div>
              <p className="sectionEyebrow">Path</p>
              <h2>Account Flow</h2>
            </div>
          </div>
          <div className="phaseFlow">
            {phases.map((phase, index) => (
              <div className={`phaseNode ${index === phaseIndex ? 'active' : ''}`} key={`${phase.label}-${index}`}>
                <span>{index + 1}</span>
                <strong>{phase.label}</strong>
                <p>{phase.target ? `${phase.target}% target` : 'No profit target'}</p>
                <small>{phase.days ? `${phase.days} minimum day(s)` : 'Ongoing'}</small>
              </div>
            ))}
          </div>
        </div>

        <div className="glass panel">
          <div className="panelHeader">
            <div className="panelIcon"><AlertTriangle /></div>
            <div>
              <p className="sectionEyebrow">Hard And Soft Rules</p>
              <h2>Trade Conditions</h2>
            </div>
          </div>
          <div className="conditionList">
            {[rule.news, rule.weekend, rule.rewardText, ...(rule.specialRules || []), ...COMMON_FP_RULES.generalRules].filter(Boolean).map((text, index) => (
              <div className="conditionItem" key={index}><span>{index + 1}</span><p>{text}</p></div>
            ))}
          </div>
        </div>
      </section>

      <section className="rulesGrid">
        <RulesTable title="Commission" rows={rule.commissions || []} columns={['Instrument', 'Standard', 'Swap-Free MT5']} />
        <RulesTable title="Leverage" rows={rule.leverage || []} columns={['Instrument', 'Standard', 'Swap-Free MT5']} />
      </section>

      <section className="glass panel">
        <div className="panelHeader">
          <div className="panelIcon"><Database /></div>
          <div>
            <p className="sectionEyebrow">Dynamic Leverage</p>
            <h2>Live Account Tier Diagram</h2>
          </div>
        </div>
        <div className="tierDiagram">
          {COMMON_FP_RULES.dynamicLeverage.map(([lots, lev]) => (
            <div className="tierStep" key={lots}>
              <span>{lots}</span>
              <strong>{lev}</strong>
            </div>
          ))}
        </div>
        <p className="rulesFootnote">Rules are based on the local FundingPips Help Center PDF crawl and official FundingPips help articles. Re-check FundingPips before taking high-stakes action because prop firm rules can change.</p>
      </section>
    </section>
  )
}

function ObjectiveCard({ label, value, progress, center, state, detail }) {
  const pctValue = progress === null || progress === undefined ? null : rulePct(progress)
  return (
    <div className={`objectiveCard ${state || 'neutral'}`}>
      <h3>{label}</h3>
      {pctValue === null ? (
        <div className="objectiveValueOnly"><strong>{value}</strong></div>
      ) : (
        <div className="objectiveRing" style={{ '--pct': pctValue }}>
          <span>{center || `${n(pctValue, 0)}%`}</span>
        </div>
      )}
      <strong className="objectiveValue">{value}</strong>
      <p>{detail}</p>
    </div>
  )
}

function AccountInfoRow({ icon, label, value }) {
  return (
    <div className="accountInfoRow">
      <span>{icon}</span>
      <b>{label}</b>
      <strong>{value || '--'}</strong>
    </div>
  )
}

function StatValue({ label, value, mood }) {
  return (
    <div className="statValue">
      <span>{label}</span>
      <strong className={mood || ''}>{value}</strong>
    </div>
  )
}

function AccountCurveChart({ metrics }) {
  const rows = metrics.chartRows.length ? metrics.chartRows : [{ key: dateKeyFromSeconds(Date.now() / 1000), balance: metrics.currentBalance, equity: metrics.currentEquity }]
  const width = 720
  const height = 280
  const pad = 34
  const values = rows.flatMap(row => [row.balance, row.equity, metrics.dailyFloor, metrics.maxFloor]).filter(v => Number.isFinite(Number(v)))
  const minValue = Math.min(...values, metrics.accountSize) - Math.max(20, metrics.accountSize * 0.01)
  const maxValue = Math.max(...values, metrics.accountSize) + Math.max(20, metrics.accountSize * 0.01)
  const xFor = index => pad + (rows.length <= 1 ? (width - pad * 2) / 2 : index * (width - pad * 2) / (rows.length - 1))
  const yFor = value => {
    if (maxValue === minValue) return height / 2
    return height - pad - (Number(value) - minValue) * (height - pad * 2) / (maxValue - minValue)
  }
  const pathFor = key => rows.map((row, index) => `${index === 0 ? 'M' : 'L'} ${xFor(index).toFixed(1)} ${yFor(row[key]).toFixed(1)}`).join(' ')
  const floorLine = value => Number.isFinite(Number(value)) ? `M ${pad} ${yFor(value).toFixed(1)} L ${width - pad} ${yFor(value).toFixed(1)}` : ''
  const labels = [maxValue, (maxValue + minValue) / 2, minValue]

  return (
    <div className="accountCurve">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Account balance chart">
        {labels.map((value, index) => (
          <g key={index}>
            <line x1={pad} x2={width - pad} y1={yFor(value)} y2={yFor(value)} />
            <text x="4" y={yFor(value) + 4}>{moneyValue(value, metrics.currency)}</text>
          </g>
        ))}
        {metrics.maxFloor !== null && <path className="floor maxFloor" d={floorLine(metrics.maxFloor)} />}
        {metrics.dailyFloor !== null && <path className="floor dailyFloor" d={floorLine(metrics.dailyFloor)} />}
        <path className="equityLine" d={pathFor('equity')} />
        <path className="balanceLine" d={pathFor('balance')} />
        {rows.map((row, index) => (
          <circle key={row.key} cx={xFor(index)} cy={yFor(row.balance)} r="4" />
        ))}
      </svg>
      <div className="chartLegend">
        <span className="balanceLegend">Balance</span>
        <span className="equityLegend">Equity</span>
        <span className="dailyLegend">Daily floor</span>
        <span className="maxLegend">Max floor</span>
      </div>
    </div>
  )
}

function DailySummaryTable({ rows, currency }) {
  const visible = rows.slice(0, 8)
  if (!visible.length) return <div className="emptyState compact">No daily data yet.</div>
  return (
    <div className="dailyTableWrap">
      <table className="dailyTable">
        <thead><tr><th>Date</th><th>Balance</th><th>Equity</th><th>Result</th></tr></thead>
        <tbody>
          {visible.map(row => (
            <tr key={row.key}>
              <td data-label="Date">{displayDateKey(row.key)}</td>
              <td data-label="Balance">{moneyValue(row.balance, currency)}</td>
              <td data-label="Equity">{moneyValue(row.equity, currency)}</td>
              <td data-label="Result"><strong className={clsPL(row.net)}>{money(row.net, currency)}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RuleBar({ label, value, note, danger = false, inverse = false }) {
  const pctValue = rulePct(value, inverse)
  const raw = Math.max(0, Math.min(100, Number(value) || 0))
  const isHot = danger ? raw >= 80 : false
  return (
    <div className="ruleBar">
      <div className="ruleBarTop"><span>{label}</span><strong>{n(raw, 1)}%</strong></div>
      <div className={`ruleTrack ${isHot ? 'hot' : ''}`}><span style={{ width: `${pctValue}%` }} /></div>
      <p>{note}</p>
    </div>
  )
}

function RulesTable({ title, rows, columns }) {
  return (
    <div className="glass panel">
      <div className="panelHeader">
        <div className="panelIcon"><Database /></div>
        <div>
          <p className="sectionEyebrow">Reference</p>
          <h2>{title}</h2>
        </div>
      </div>
      {rows.length ? (
        <div className="rulesTableWrap">
          <table className="rulesTable">
            <thead><tr>{columns.map(x => <th key={x}>{x}</th>)}</tr></thead>
            <tbody>{rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={`${i}-${j}`}>{cell}</td>)}</tr>)}</tbody>
          </table>
        </div>
      ) : (
        <div className="emptyState compact">No table values published in this rule pack.</div>
      )}
    </div>
  )
}

function TradeHistoryPage({ state }) {
  const s = state?.state || {}
  const currency = s.currency || ''
  const rows = Array.isArray(s.tradeHistory) ? s.tradeHistory : []
  const totals = rows.reduce((acc, row) => {
    const profit = Number(row.profit)
    if (Number.isFinite(profit)) {
      acc.net += profit
      if (profit > 0) acc.wins += 1
      if (profit < 0) acc.losses += 1
    }
    return acc
  }, { net: 0, wins: 0, losses: 0 })

  return (
    <section className="historyPage">
      <div className="historySummary">
        <div className="glass historyMetric"><span>Total Trades</span><strong>{rows.length}</strong></div>
        <div className="glass historyMetric"><span>Wins</span><strong className="pos">{totals.wins}</strong></div>
        <div className="glass historyMetric"><span>Losses</span><strong className="neg">{totals.losses}</strong></div>
        <div className="glass historyMetric"><span>Net P/L</span><strong className={clsPL(totals.net)}>{money(totals.net, currency)}</strong></div>
      </div>

      <section className="glass panel">
        <div className="panelHeader">
          <div className="panelIcon"><History /></div>
          <div>
            <p className="sectionEyebrow">Trade History</p>
            <h2>Closed Trades</h2>
          </div>
        </div>

        {rows.length ? (
          <div className="historyTableWrap">
            <table className="historyTable">
              <thead>
                <tr>
                  <th>Close Time</th>
                  <th>Source</th>
                  <th>Type</th>
                  <th>Lot</th>
                  <th>Entry</th>
                  <th>Exit</th>
                  <th>SL</th>
                  <th>Target</th>
                  <th>Profit/Loss</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={row.id || `${row.positionId || 'trade'}-${index}`}>
                    <td data-label="Close Time">{formatHistoryTime(row.closeTime || row.closeTimeSec)}</td>
                    <td data-label="Source"><span className={`sourcePill ${row.source === 'Manual' ? 'manual' : 'ea'}`}>{row.source || 'EA'}</span></td>
                    <td data-label="Type"><span className={`sidePill ${row.type === 'BUY' ? 'buy' : 'sell'}`}>{row.type || '--'}</span></td>
                    <td data-label="Lot">{n(row.volume, 2)}</td>
                    <td data-label="Entry">{row.entryPrice ?? '--'}</td>
                    <td data-label="Exit">{row.exitPrice ?? '--'}</td>
                    <td data-label="SL">{row.sl ?? '--'}</td>
                    <td data-label="Target">{row.tp ?? '--'}</td>
                    <td data-label="Profit/Loss"><strong className={clsPL(row.profit)}>{money(row.profit, currency)}</strong></td>
                    <td data-label="Reason">{row.reason || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="emptyState">No closed trade history from EA yet.</div>
        )}
      </section>
    </section>
  )
}

function Dashboard({ session }) {
  const [instances, setInstances] = useState([])
  const [selectedId, setSelectedId] = useState('')
  const [state, setState] = useState(null)
  const [commands, setCommands] = useState([])
  const [showSetup, setShowSetup] = useState(false)
  const [lastSyncAt, setLastSyncAt] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [view, setView] = useState('dashboard')
  const pollingRef = useRef(false)

  const selected = useMemo(() => instances.find(x => x.id === selectedId), [instances, selectedId])

  const loadInstances = useCallback(async () => {
    const { data, error } = await supabase.from('ea_instances').select('*').order('created_at', { ascending: false })
    if (!error) {
      setInstances(data || [])
      setSelectedId(current => data?.some(x => x.id === current) ? current : data?.[0]?.id || '')
    }
  }, [])

  const loadState = useCallback(async (id = selectedId) => {
    if (!id) return
    const { data, error } = await supabase.from('ea_states').select('*').eq('ea_id', id).maybeSingle()
    if (!error) setState(data || null)
    setLastSyncAt(new Date())
  }, [selectedId])

  const loadCommands = useCallback(async (id = selectedId) => {
    if (!id) return
    const { data, error } = await supabase.from('commands').select('*').eq('ea_id', id).order('created_at', { ascending: false }).limit(12)
    if (!error) setCommands(data || [])
  }, [selectedId])

  const refresh = useCallback(async () => {
    setIsRefreshing(true)
    try {
      await Promise.all([loadInstances(), loadState(), loadCommands()])
    } finally {
      setIsRefreshing(false)
    }
  }, [loadCommands, loadInstances, loadState])

  const deleteSelectedEa = useCallback(async () => {
    if (!selectedId) return
    const target = instances.find(x => x.id === selectedId)
    const label = target ? `${target.name}${target.symbol ? ` - ${target.symbol}` : ''}` : 'this EA'
    if (!window.confirm(`Delete ${label}? This removes its live state and command history from the dashboard.`)) return

    const { error } = await supabase
      .from('ea_instances')
      .delete()
      .eq('id', selectedId)
      .eq('user_id', session.user.id)

    if (error) {
      alert(error.message)
      return
    }

    const remaining = instances.filter(x => x.id !== selectedId)
    setInstances(remaining)
    setSelectedId(remaining[0]?.id || '')
    setState(null)
    setCommands([])
    loadInstances()
  }, [instances, loadInstances, selectedId, session.user.id])

  useEffect(() => { loadInstances() }, [loadInstances])

  useEffect(() => {
    if (!selectedId) return
    loadState(selectedId)
    loadCommands(selectedId)
  }, [selectedId, loadCommands, loadState])

  useEffect(() => {
    if (!selectedId) return undefined
    let cancelled = false

    async function pollLiveData() {
      if (pollingRef.current) return
      pollingRef.current = true
      try {
        await Promise.all([loadState(selectedId), loadCommands(selectedId)])
      } finally {
        pollingRef.current = false
      }
    }

    pollLiveData()
    const interval = window.setInterval(() => {
      if (!cancelled) pollLiveData()
    }, 1000)

    return () => {
      cancelled = true
      window.clearInterval(interval)
    }
  }, [selectedId, loadCommands, loadState])

  useEffect(() => {
    if (!selectedId) return undefined
    const ch = supabase.channel(`tcx-${selectedId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ea_states', filter: `ea_id=eq.${selectedId}` }, payload => {
        if (payload.new) setState(payload.new)
        setLastSyncAt(new Date())
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commands', filter: `ea_id=eq.${selectedId}` }, () => loadCommands(selectedId))
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [selectedId, loadCommands])

  if (!instances.length || showSetup) {
    return (
      <main className="app setupApp">
        <EASetup
          user={session.user}
          onCreated={(data) => { loadInstances(); setSelectedId(data.id) }}
          onDone={() => setShowSetup(false)}
        />
        {instances.length > 0 && (
          <div className="setupBack">
            <button className="ghostBtn" onClick={() => setShowSetup(false)}>Cancel & Go Back</button>
          </div>
        )}
      </main>
    )
  }

  return (
    <main className="app">
      <Topbar
        user={session.user}
        instances={instances}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        refresh={refresh}
        onNewEa={() => setShowSetup(true)}
        onDeleteEa={deleteSelectedEa}
        lastSyncAt={lastSyncAt}
        isRefreshing={isRefreshing}
        view={view}
        setView={setView}
      />
      {view === 'settings' ? (
        <TelegramSettingsPage session={session} />
      ) : view === 'history' ? (
        <TradeHistoryPage state={state} />
      ) : view === 'rules' ? (
        <RulesPage state={state} selected={selected} />
      ) : (
        <>
          <CollapsibleSection id={`${selectedId}-status`} title="Status" eyebrow="Live EA" icon={<Activity />} bodyClassName="flushBody">
            <StatusHero state={state} selected={selected} />
          </CollapsibleSection>
          <CollapsibleSection id={`${selectedId}-stats`} title="Account Stats" eyebrow="Money & Risk" icon={<WalletCards />} bodyClassName="flushBody">
            <StatCards state={state} />
          </CollapsibleSection>
          <CollapsibleSection id={`${selectedId}-controls`} title="Trade Controls" eyebrow="Execution" icon={<PlayCircle />} bodyClassName="flushBody">
            <CommandPanel session={session} selected={selected} state={state} reloadCommands={() => loadCommands(selectedId)} />
          </CollapsibleSection>
          <CollapsibleSection id={`${selectedId}-positions`} title="Positions" eyebrow="Open Trades" icon={<Gauge />} bodyClassName="flushBody">
            <PositionPanel state={state} />
          </CollapsibleSection>
          <CollapsibleSection id={`${selectedId}-structure`} title="Market Structure" eyebrow="Model Checks" icon={<Zap />} bodyClassName="flushBody" defaultOpen={false}>
            <StructurePanel state={state} />
          </CollapsibleSection>
          <CollapsibleSection id={`${selectedId}-commands`} title="Command Log" eyebrow="History" icon={<KeyRound />} bodyClassName="flushBody" defaultOpen={false}>
            <CommandsLog commands={commands} />
          </CollapsibleSection>
        </>
      )}
      <div className="footer"><Lock size={14} /> Each user sees only their own EAs via Supabase RLS. EA commands are verified by EA ID and private token.</div>
    </main>
  )
}

function App() {
  const [session, setSession] = useState(null)
  useEffect(() => {
    if (!hasSupabaseConfig) return undefined
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSession(session))
    return () => sub.subscription.unsubscribe()
  }, [])
  if (!hasSupabaseConfig) return <MissingConfig />
  return session ? <Dashboard session={session} /> : <Login />
}

const rootElement = document.getElementById('root')
const root = globalThis.__tcxRoot || createRoot(rootElement)
globalThis.__tcxRoot = root
root.render(<App />)
