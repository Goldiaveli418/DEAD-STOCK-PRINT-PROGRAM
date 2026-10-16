import React, { useEffect, useState, useCallback, useMemo } from 'react'
import { BlanksTab, ReceiveTab } from './InHouse.jsx'

// Inventory = two pools of blanks.
//   Dead Stock Blanks       — our own stock. In-house runs and client orders that buy blanks from us draw from it.
//   Customer Supplied Blanks — what each client sends us, kept per client. Their orders draw from it.

const SIZES = ['XS','S','M','L','XL','2XL','3XL','4XL']
const usd   = n => `$${(Number(n) || 0).toFixed(2)}`

// ── Customer supplied ────────────────────────────────────────────────────────
function parseClientLines(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const c = (l.includes('\t') ? l.split('\t') : l.split(',')).map(x => x.trim())
    const [style, color, size, qty] = c
    return { style, color, size: (size || '').toUpperCase(), qty: parseInt(qty, 10) || 0 }
  }).filter(l => !/^style$/i.test(l.style) && l.qty > 0)
}

function ClientBlankRow({ b, onChange }) {
  const [adj, setAdj]       = useState(false)
  const [delta, setDelta]   = useState('')
  const [reason, setReason] = useState('')
  async function apply() {
    const d = parseInt(delta, 10)
    if (d) await window.api.clientBlanks.adjust({ id: b.id, delta: d, reason })
    setAdj(false); setDelta(''); setReason(''); onChange()
  }
  return (
    <tr className="group hover:bg-white/3">
      <td className="px-4 py-2 text-slate-300">{b.color}</td>
      <td className="px-4 py-2 font-mono text-slate-300">{b.size}</td>
      <td className="px-4 py-2 font-mono text-slate-500">{b.qty_received}</td>
      <td className="px-4 py-2 font-mono text-slate-500">{b.qty_printed || 0}</td>
      <td className={`px-4 py-2 font-mono font-bold ${b.qty_on_hand === 0 ? 'text-red-400' : 'text-white'}`}>{b.qty_on_hand}</td>
      <td className="px-4 py-2 text-right">
        {adj ? (
          <span className="flex gap-1 justify-end">
            <input type="number" className="input-sm w-16" placeholder="±qty" value={delta} onChange={e => setDelta(e.target.value)} autoFocus />
            <input className="input-sm w-28" placeholder="misprint, returned…" value={reason} onChange={e => setReason(e.target.value)} />
            <button className="btn-xs" onClick={apply}>Apply</button>
            <button className="btn-xs" onClick={() => setAdj(false)}>✕</button>
          </span>
        ) : <button className="btn-xs opacity-0 group-hover:opacity-100" onClick={() => setAdj(true)} title="Adjust (misprints, returns, recount)">±</button>}
      </td>
    </tr>
  )
}

function CustomerSupplied({ clients }) {
  const [clientId, setClientId] = useState('')
  const [blanks, setBlanks]     = useState([])
  const [receiving, setReceiving] = useState(false)
  const [form, setForm]         = useState({ source: '', text: '' })
  const [msg, setMsg]           = useState('')
  const [counts, setCounts]     = useState({})

  // On-hand totals per client for the picker
  const loadCounts = useCallback(async () => {
    const all = await Promise.all(clients.map(c => window.api.clientBlanks.list(c.id)))
    setCounts(Object.fromEntries(clients.map((c, i) => [c.id, (all[i] || []).reduce((s, b) => s + b.qty_on_hand, 0)])))
  }, [clients])

  const load = useCallback(async () => {
    if (clientId) setBlanks(await window.api.clientBlanks.list(Number(clientId)) || [])
    loadCounts()
  }, [clientId, loadCounts])

  useEffect(() => { load() }, [load])
  useEffect(() => { if (!clientId && clients.length) setClientId(String(clients[0].id)) }, [clients, clientId])

  const lines = useMemo(() => parseClientLines(form.text), [form.text])
  const groups = useMemo(() => {
    const g = {}
    for (const b of blanks) (g[b.style] = g[b.style] || []).push(b)
    for (const k in g) g[k].sort((a, b) => a.color.localeCompare(b.color) || SIZES.indexOf(a.size) - SIZES.indexOf(b.size))
    return g
  }, [blanks])

  async function receive() {
    setMsg('')
    const r = await window.api.clientBlanks.receive({ client_id: Number(clientId), source: form.source, lines })
    if (r?.error) return setMsg(r.error)
    setMsg(`Received ${r.units} blanks`); setForm({ source: '', text: '' }); setReceiving(false); load()
  }

  if (!clients.length) return <div className="p-10 text-center text-sm text-slate-600">Add a client first.</div>
  const client = clients.find(c => c.id === Number(clientId))

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {clients.map(c => (
          <button key={c.id} onClick={() => { setClientId(String(c.id)); setReceiving(false); setMsg('') }}
            className={`px-3 py-1.5 rounded-lg text-xs border transition-colors ${Number(clientId) === c.id ? 'bg-green-600/20 text-green-300 border-green-500/30' : 'border-white/10 text-slate-400 hover:text-slate-200'}`}>
            {c.name} <span className="font-mono text-slate-500 ml-1">{counts[c.id] ?? 0}</span>
          </button>
        ))}
        <div className="flex-1" />
        {msg && <span className="text-xs text-slate-300">{msg}</span>}
        <button className="px-3 h-8 rounded-lg text-xs bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/20" onClick={() => setReceiving(v => !v)}>
          + Receive {client?.name}'s blanks
        </button>
      </div>

      {receiving && (
        <div className="card-glow p-4 space-y-3">
          <div className="text-xs font-semibold text-green-300">Receive blanks from {client?.name}</div>
          <div><label className="label">Where from (optional)</label><input className="input" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))} placeholder="S&S packing slip #, drop-off…" /></div>
          <div>
            <label className="label">Lines: Style, Color, Size, Qty (one per line, paste from a spreadsheet works)</label>
            <textarea className="input font-mono h-32" value={form.text} onChange={e => setForm(f => ({ ...f, text: e.target.value }))}
              placeholder={'Shaka Wear Max Heavyweight Tee, Black, L, 7\nNext Level Ideal Crop Top 1580, White, S, 7'} />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono text-slate-400">{lines.length} lines · {lines.reduce((s, l) => s + l.qty, 0)} blanks</span>
            <button className="btn-primary" disabled={!lines.length} onClick={receive}>Receive</button>
          </div>
        </div>
      )}

      {!blanks.length ? (
        <div className="p-10 text-center text-sm text-slate-600">No blanks on file for {client?.name}.</div>
      ) : Object.entries(groups).map(([style, items]) => (
        <div key={style} className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/5 flex items-center">
            <span className="text-sm font-semibold text-white">{style}</span>
            <span className="ml-auto text-xs font-mono text-slate-500">{items.reduce((s, b) => s + b.qty_on_hand, 0)} on hand</span>
          </div>
          <table className="w-full text-xs">
            <thead className="text-slate-500"><tr className="border-b border-white/5">
              {['Color', 'Size', 'Received', 'Printed', 'On hand', ''].map(h => <th key={h} className="text-left font-medium px-4 py-2">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-white/5">{items.map(b => <ClientBlankRow key={b.id} b={b} onChange={load} />)}</tbody>
          </table>
        </div>
      ))}
      <p className="text-xs text-slate-600">Printed counts update automatically when one of {client?.name}'s orders using Customer Blanks hits Printing or Done. Use ± for misprints and returns.</p>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
const SECTIONS = [['dead', 'Dead Stock Blanks'], ['customer', 'Customer Supplied Blanks']]

export default function Inventory() {
  const [section, setSection] = useState('dead')
  const [sub, setSub]         = useState('stock')
  const [blanks, setBlanks]   = useState([])
  const [receipts, setReceipts] = useState([])
  const [clients, setClients] = useState([])

  const load = useCallback(async () => {
    const [b, r, c] = await Promise.all([window.api.house.blanks.list(), window.api.house.receipts(), window.api.clients.list()])
    setBlanks(b || []); setReceipts(r || []); setClients(c || [])
  }, [])
  useEffect(() => { load() }, [load])

  const onHand = blanks.reduce((s, b) => s + b.qty_on_hand, 0)
  const value  = blanks.reduce((s, b) => s + b.qty_on_hand * b.landed_cost, 0)
  const low    = blanks.filter(b => b.qty_on_hand <= b.reorder_point).length

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 shrink-0">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-white">Inventory</h1>
            <p className="text-xs text-slate-500">
              {section === 'dead'
                ? <>Dead Stock Blanks · {onHand} on hand · {usd(value)}{low > 0 && <> · <span className="text-red-400">{low} low</span></>}</>
                : 'Blanks clients send us, kept per client'}
            </p>
          </div>
          <div className="flex gap-1 p-1 rounded-lg bg-white/5">
            {SECTIONS.map(([id, label]) => (
              <button key={id} onClick={() => setSection(id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${section === id ? 'bg-green-600/20 text-green-300' : 'text-slate-400 hover:text-slate-200'}`}>{label}</button>
            ))}
          </div>
        </div>
        {section === 'dead' && (
          <div className="flex gap-4 mt-3 text-xs">
            {[['stock', 'Stock'], ['receive', 'Receive Order']].map(([id, label]) => (
              <button key={id} onClick={() => setSub(id)} className={`pb-1 border-b-2 ${sub === id ? 'border-green-500 text-green-300' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>{label}</button>
            ))}
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {section === 'dead' && sub === 'stock'   && <BlanksTab blanks={blanks} onChange={load} />}
        {section === 'dead' && sub === 'receive' && <ReceiveTab receipts={receipts} onChange={load} />}
        {section === 'customer' && <CustomerSupplied clients={clients} />}
      </div>
    </div>
  )
}
