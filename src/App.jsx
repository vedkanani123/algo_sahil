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

function Topbar({ user, instances, selectedId, setSelectedId, refresh, onNewEa, onDeleteEa, lastSyncAt, isRefreshing, view, setView }) {
  const [isEditing, setIsEditing] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
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

  return (
    <header className="topbar glass">
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
          <div className="chip">TF <b>{s.period || '--'}</b></div>
          <div className="chip">Spread <b>{s.spread ?? '--'}</b></div>
          <div className="chip">SL/TP Space <b>{s.spreadProtectionPoints ?? 0}</b></div>
          <div className="chip">2nd <b>{s.secondEntryOn ? 'ON' : 'OFF'}</b></div>
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
        </div>

        <div className="inlineStatus">{s.secondEntryStatus || '2nd entry OFF'}</div>

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
        <div className="emptyState">No matching open position.</div>
      ) : (
        <div className="positionList">
          {positions.map((pos, index) => (
            <div className="positionRow" key={pos.ticket || `${pos.type}-${index}`}>
              <div className="posItem"><span>Type</span><strong className={pos.type === 'BUY' ? 'pos' : 'neg'}>{pos.type}</strong></div>
              <div className="posItem"><span>Volume</span><strong>{pos.volume}</strong></div>
              <div className="posItem"><span>RR</span><strong>{n(pos.rr)}R</strong></div>
              <div className="posItem"><span>P/L</span><strong className={clsPL(pos.profit)}>{money(pos.profit, s.currency)}</strong></div>
              <div className="posItem"><span>Entry</span><strong>{pos.entry}</strong></div>
              <div className="posItem"><span>SL</span><strong>{pos.sl}</strong></div>
              <div className="posItem"><span>TP</span><strong>{pos.tp}</strong></div>
            </div>
          ))}
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
      ) : (
        <>
          <StatusHero state={state} selected={selected} />
          <StatCards state={state} />
          <CommandPanel session={session} selected={selected} state={state} reloadCommands={() => loadCommands(selectedId)} />
          <PositionPanel state={state} />
          <StructurePanel state={state} />
          <CommandsLog commands={commands} />
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
