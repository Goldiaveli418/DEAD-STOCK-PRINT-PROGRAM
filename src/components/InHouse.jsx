import React, { useEffect, useState, useCallback, useMemo } from 'react'

const SIZES = ['XS','S','M','L','XL','2XL','3XL','4XL']
const usd   = n => `$${(Number(n) || 0).toFixed(2)}`
const today = () => new Date().toISOString().slice(0, 10)

function inkFor(asset, size) {
  if (!asset || !size) return ''
  try { const v = JSON.parse(asset.ink_costs || '{}')[size]; return v === undefined || v === '' ? '' : String(Number(v)) } catch (_) { return '' }
}

function Stat({ label, value, warn }) {
  return (
    <div className="card px-4 py-3 min-w-[120px]">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">{label}</div>
      <div className={`text-lg font-bold font-mono tabular-nums ${warn ? 'text-red-400' : 'text-white'}`}>{value}</div>
    </div>
  )
}

// ── Print run ────────────────────────────────────────────────────────────────
function blankRun() { return { printed_on: today(), asset_id: '', design: '', blank_id: '', qty_good: '', qty_misprint: '', ink_per_piece: '', product_name: '', retail_price: '', notes: '' } }

function RunTab({ blanks, assets, runs, onChange }) {
  const [form, setForm] = useState(blankRun())
  const [err, setErr]   = useState('')
  const [inkTouched, setInkTouched] = useState(false)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const blank = blanks.find(b => b.id === Number(form.blank_id))
  const asset = assets.find(a => a.id === Number(form.asset_id))

  // Ink cost auto-fills from the design's per-size ink costs until you type your own.
  useEffect(() => {
    if (!inkTouched) set('ink_per_piece', inkFor(asset, blank?.size))
  }, [form.asset_id, form.blank_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const groups = useMemo(() => {
    const g = {}
    for (const b of blanks) if (b.qty_on_hand > 0) (g[b.style] = g[b.style] || []).push(b)
    return g
  }, [blanks])

  const good = parseInt(form.qty_good, 10) || 0
  const mis  = parseInt(form.qty_misprint, 10) || 0
  const per  = (blank?.landed_cost || 0) + (Number(form.ink_per_piece) || 0)
  const total = (good + mis) * per

  async function submit() {
    setErr('')
    const design = form.design || asset?.name || ''
    const r = await window.api.house.runs.create({ ...form, design })
    if (r?.error) return setErr(r.error)
    setForm(f => ({ ...blankRun(), printed_on: f.printed_on, asset_id: f.asset_id, design: f.design, product_name: f.product_name, retail_price: f.retail_price }))
    setInkTouched(false)
    onChange()
  }

  async function remove(id) {
    await window.api.house.runs.delete(id)
    onChange()
  }

  return (
    <div className="space-y-4">
      <div className="card-glow p-4 space-y-3">
        <div className="text-xs font-semibold text-green-300">Log a print run</div>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-2">
            <label className="label">Date</label>
            <input type="date" className="input" value={form.printed_on} onChange={e => set('printed_on', e.target.value)} />
          </div>
          <div className="col-span-4">
            <label className="label">Design</label>
            <select className="input" value={form.asset_id} onChange={e => { set('asset_id', e.target.value); set('design', '') }}>
              <option value="">— Type a name below —</option>
              {assets.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
            {!form.asset_id && (
              <input className="input mt-2" placeholder="Design name" value={form.design} onChange={e => set('design', e.target.value)} />
            )}
          </div>
          <div className="col-span-6">
            <label className="label">Blank</label>
            <select className="input" value={form.blank_id} onChange={e => set('blank_id', e.target.value)}>
              <option value="">— Pick a blank —</option>
              {Object.entries(groups).map(([style, items]) => (
                <optgroup key={style} label={style}>
                  {items.map(b => (
                    <option key={b.id} value={b.id}>
                      {b.color} / {b.size} · {b.qty_on_hand} left · {usd(b.landed_cost)}{b.sku ? ` · ${b.sku}` : ''}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            {blanks.length > 0 && Object.keys(groups).length === 0 && <p className="text-xs text-red-400 mt-1">Every blank is out of stock.</p>}
          </div>
          <div className="col-span-2">
            <label className="label">Good prints</label>
            <input type="number" min="0" className="input" value={form.qty_good} onChange={e => set('qty_good', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Misprints</label>
            <input type="number" min="0" className="input" value={form.qty_misprint} onChange={e => set('qty_misprint', e.target.value)} />
          </div>
          <div className="col-span-2">
            <label className="label">Ink $/pc</label>
            <input type="number" min="0" step="0.01" className="input" value={form.ink_per_piece}
              onChange={e => { setInkTouched(true); set('ink_per_piece', e.target.value) }} placeholder="0.00" />
          </div>
          <div className="col-span-4">
            <label className="label">Product name <span className="text-slate-600">(sends good prints to the Back Room)</span></label>
            <input className="input" value={form.product_name} onChange={e => set('product_name', e.target.value)} placeholder="e.g. Skeleton Roses Tee" />
          </div>
          <div className="col-span-2">
            <label className="label">Retail $</label>
            <input type="number" min="0" step="0.01" className="input" value={form.retail_price} onChange={e => set('retail_price', e.target.value)} placeholder="45.00" />
          </div>
          <div className="col-span-12">
            <label className="label">Notes</label>
            <input className="input" value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Optional" />
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 pt-1">
          <div className="text-xs font-mono text-slate-400">
            {blank ? (
              <>
                blank {usd(blank.landed_cost)} + ink {usd(form.ink_per_piece)} = <span className="text-white">{usd(per)}/pc</span>
                {good + mis > 0 && <> · {good + mis} used · total <span className="text-white">{usd(total)}</span>
                  {good > 0 && <> · per good piece <span className="text-green-300">{usd(total / good)}</span></>}</>}
                {good + mis > blank.qty_on_hand && <span className="text-red-400"> · only {blank.qty_on_hand} on hand</span>}
              </>
            ) : <span className="text-slate-600">Pick a blank to see cost</span>}
          </div>
          <div className="flex items-center gap-3">
            {err && <span className="text-xs text-red-400">{err}</span>}
            <button className="btn-primary" disabled={!blank || good + mis <= 0} onClick={submit}>Log run</button>
          </div>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/5 text-xs font-semibold text-slate-300">Run history</div>
        {runs.length === 0 ? (
          <div className="p-6 text-center text-sm text-slate-600">No in-house runs yet</div>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr className="border-b border-white/5">
                {['Date','Design','Blank','Good','Misprint','$/good pc','Total',''].map(h => <th key={h} className="text-left font-medium px-4 py-2">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {runs.map(r => (
                <tr key={r.id} className="group hover:bg-white/3">
                  <td className="px-4 py-2 font-mono text-slate-400">{r.printed_on}</td>
                  <td className="px-4 py-2 text-white">{r.design || <span className="text-slate-600">untitled</span>}</td>
                  <td className="px-4 py-2 text-slate-300">{r.blank_label}</td>
                  <td className="px-4 py-2 font-mono text-white">{r.qty_good}</td>
                  <td className={`px-4 py-2 font-mono ${r.qty_misprint ? 'text-yellow-400' : 'text-slate-600'}`}>{r.qty_misprint}</td>
                  <td className="px-4 py-2 font-mono text-green-300">{usd(r.cost_per_good)}</td>
                  <td className="px-4 py-2 font-mono text-slate-300">{usd(r.total_cost)}</td>
                  <td className="px-4 py-2 text-right">
                    <button onClick={() => remove(r.id)} title="Delete run (returns blanks to stock)"
                      className="btn-xs opacity-0 group-hover:opacity-100 text-red-400/60 hover:text-red-400 border-red-500/10">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ── Blanks ───────────────────────────────────────────────────────────────────
function BlankRow({ b, onChange }) {
  const [mode, setMode]   = useState(null)
  const [delta, setDelta] = useState('')
  const [reorder, setReorder] = useState(String(b.reorder_point))
  const low = b.qty_on_hand <= b.reorder_point

  async function applyAdjust() {
    const d = parseInt(delta, 10)
    if (d) await window.api.house.blanks.adjust({ id: b.id, delta: d })
    setMode(null); setDelta(''); onChange()
  }
  async function saveReorder() {
    await window.api.house.blanks.update({ id: b.id, reorder_point: reorder })
    setMode(null); onChange()
  }

  return (
    <tr className="group hover:bg-white/3">
      <td className="px-4 py-2 font-mono text-slate-500">{b.sku}</td>
      <td className="px-4 py-2 text-slate-300">{b.color}</td>
      <td className="px-4 py-2 font-mono text-slate-300">{b.size}</td>
      <td className={`px-4 py-2 font-mono font-bold ${b.qty_on_hand === 0 ? 'text-red-400' : low ? 'text-yellow-400' : 'text-white'}`}>{b.qty_on_hand}</td>
      <td className="px-4 py-2 font-mono text-slate-500">
        {mode === 'reorder' ? (
          <span className="flex gap-1">
            <input type="number" min="0" className="input-sm w-14" value={reorder} onChange={e => setReorder(e.target.value)} autoFocus />
            <button className="btn-xs" onClick={saveReorder}>✓</button>
          </span>
        ) : <button className="hover:text-slate-200" onClick={() => setMode('reorder')} title="Set reorder point">{b.reorder_point}</button>}
      </td>
      <td className="px-4 py-2 font-mono text-slate-300" title={`${usd(b.unit_cost)} + ${usd(b.ship_per_unit)} shipping`}>{usd(b.landed_cost)}</td>
      <td className="px-4 py-2 font-mono text-slate-400">{usd(b.landed_cost * b.qty_on_hand)}</td>
      <td className="px-4 py-2 text-right">
        {mode === 'adjust' ? (
          <span className="flex gap-1 justify-end">
            <input type="number" className="input-sm w-16" placeholder="±qty" value={delta} onChange={e => setDelta(e.target.value)} autoFocus />
            <button className="btn-xs" onClick={applyAdjust}>Apply</button>
            <button className="btn-xs" onClick={() => setMode(null)}>✕</button>
          </span>
        ) : (
          <button className="btn-xs opacity-0 group-hover:opacity-100" onClick={() => setMode('adjust')} title="Adjust count">±</button>
        )}
      </td>
    </tr>
  )
}

function BlanksTab({ blanks, onChange }) {
  const [q, setQ] = useState('')
  const groups = useMemo(() => {
    const g = {}
    const f = q.toLowerCase()
    for (const b of blanks) {
      if (f && ![b.style, b.color, b.size, b.sku].join(' ').toLowerCase().includes(f)) continue
      ;(g[b.style] = g[b.style] || []).push(b)
    }
    for (const k in g) g[k].sort((a, b) => a.color.localeCompare(b.color) || SIZES.indexOf(a.size) - SIZES.indexOf(b.size))
    return g
  }, [blanks, q])

  if (!blanks.length) return <div className="p-10 text-center text-sm text-slate-600">No blanks yet. Use <span className="text-slate-400">Receive Order</span> to add a supplier order.</div>

  return (
    <div className="space-y-4">
      <input className="input w-60" placeholder="Search style, color, size, SKU…" value={q} onChange={e => setQ(e.target.value)} />
      {Object.entries(groups).map(([style, items]) => (
        <div key={style} className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/5 flex items-center">
            <span className="text-sm font-semibold text-white">{style}</span>
            <span className="ml-auto text-xs font-mono text-slate-500">
              {items.reduce((s, b) => s + b.qty_on_hand, 0)} on hand · {usd(items.reduce((s, b) => s + b.qty_on_hand * b.landed_cost, 0))}
            </span>
          </div>
          <table className="w-full text-xs">
            <thead className="text-slate-500">
              <tr className="border-b border-white/5">
                {['SKU','Color','Size','On hand','Reorder at','Cost/pc','Value',''].map(h => <th key={h} className="text-left font-medium px-4 py-2">{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map(b => <BlankRow key={b.id} b={b} onChange={onChange} />)}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  )
}

// ── Receive order ────────────────────────────────────────────────────────────
// Paste rows straight from a spreadsheet: SKU, Style, Color, Size, Unit cost, Qty
function parseLines(text) {
  return text.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const c = l.includes('\t') ? l.split('\t') : l.split(',')
    const [sku, style, color, size, unit_cost, qty] = c.map(x => x.trim())
    return { sku, style, color, size: (size || '').toUpperCase(), unit_cost: Number(String(unit_cost || '').replace(/[$,]/g, '')), qty: parseInt(qty, 10) || 0 }
  }).filter(l => !/^sku$/i.test(l.sku) && l.qty > 0)
}

function ReceiveTab({ receipts, onChange }) {
  const [form, setForm] = useState({ supplier: '', order_no: '', received_on: today(), shipping: '', text: '' })
  const [msg, setMsg]   = useState('')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const lines    = useMemo(() => parseLines(form.text), [form.text])
  const units    = lines.reduce((s, l) => s + l.qty, 0)
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unit_cost, 0)
  const shipPer  = units ? (Number(form.shipping) || 0) / units : 0

  async function submit() {
    setMsg('')
    const r = await window.api.house.receive({ ...form, lines })
    if (r?.error) return setMsg(r.error)
    setMsg(`Received ${r.units} blanks from ${r.supplier || 'supplier'} ${r.order_no}`.trim())
    setForm({ supplier: '', order_no: '', received_on: today(), shipping: '', text: '' })
    onChange()
  }

  return (
    <div className="space-y-4">
      <div className="card-glow p-4 space-y-3">
        <div className="text-xs font-semibold text-green-300">Receive a blank order</div>
        <div className="grid grid-cols-4 gap-3">
          <div><label className="label">Supplier</label><input className="input" value={form.supplier} onChange={e => set('supplier', e.target.value)} placeholder="Shaka Wear" /></div>
          <div><label className="label">Order #</label><input className="input" value={form.order_no} onChange={e => set('order_no', e.target.value)} /></div>
          <div><label className="label">Received</label><input type="date" className="input" value={form.received_on} onChange={e => set('received_on', e.target.value)} /></div>
          <div><label className="label">Shipping paid ($)</label><input type="number" min="0" step="0.01" className="input" value={form.shipping} onChange={e => set('shipping', e.target.value)} /></div>
        </div>
        <div>
          <label className="label">Lines: SKU, Style, Color, Size, Unit cost, Qty (paste from a spreadsheet, one per line)</label>
          <textarea className="input font-mono h-40" value={form.text} onChange={e => set('text', e.target.value)}
            placeholder={'MHS01S, 7.5oz Max Heavyweight Short Sleeve, White, S, 3.80, 6\nTC02L, 9.0oz Heavyweight Thermal, Black, L, 10.30, 3'} />
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs font-mono text-slate-400">
            {lines.length} lines · {units} units · subtotal {usd(subtotal)} + shipping {usd(form.shipping)} = <span className="text-white">{usd(subtotal + (Number(form.shipping) || 0))}</span>
            {units > 0 && <> · shipping adds <span className="text-green-300">{usd(shipPer)}/unit</span></>}
          </div>
          <div className="flex items-center gap-3">
            {msg && <span className="text-xs text-slate-300">{msg}</span>}
            <button className="btn-primary" disabled={!lines.length} onClick={submit}>Receive into stock</button>
          </div>
        </div>
      </div>

      {receipts.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-white/5 text-xs font-semibold text-slate-300">Received orders</div>
          <table className="w-full text-xs">
            <thead className="text-slate-500"><tr className="border-b border-white/5">
              {['Received','Supplier','Order #','Units','Subtotal','Shipping','Total'].map(h => <th key={h} className="text-left font-medium px-4 py-2">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-white/5">
              {receipts.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-mono text-slate-400">{r.received_on}</td>
                  <td className="px-4 py-2 text-white">{r.supplier}</td>
                  <td className="px-4 py-2 font-mono text-slate-300">{r.order_no}</td>
                  <td className="px-4 py-2 font-mono text-slate-300">{r.units}</td>
                  <td className="px-4 py-2 font-mono text-slate-300">{usd(r.subtotal)}</td>
                  <td className="px-4 py-2 font-mono text-slate-300">{usd(r.shipping)}</td>
                  <td className="px-4 py-2 font-mono text-white">{usd(r.subtotal + r.shipping)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}


// ── Back Room ────────────────────────────────────────────────────────────────
const STATUS = {
  back_room: ['Back Room', 'status-new'],
  requested: ['Sent to Deck', 'status-printing'],
  listed:    ['Listed', 'status-done'],
}

function PieceCard({ f, onChange }) {
  const [price, setPrice] = useState(f.price ? String(f.price) : '')
  const [err, setErr]     = useState('')
  const per    = f.units ? f.cost_total / f.units : 0
  const margin = f.price ? (f.price - per) / f.price : 0
  const [label, cls] = STATUS[f.status] || STATUS.back_room
  const locked = f.status !== 'back_room'

  async function addPhotos() {
    const picked = await window.api.openFile()
    if (picked?.length) { await window.api.house.finished.update({ id: f.id, photos: [...f.photos, ...picked] }); onChange() }
  }
  async function removePhoto(p) { await window.api.house.finished.update({ id: f.id, photos: f.photos.filter(x => x !== p) }); onChange() }
  async function savePrice() { if (price !== String(f.price)) { await window.api.house.finished.update({ id: f.id, price }); onChange() } }
  async function send() {
    setErr('')
    await savePrice()
    const r = await window.api.house.finished.request(f.id)
    if (r?.error) return setErr(r.error)
    onChange()
  }

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-white truncate">{f.name}</span>
            <span className={cls}>{label}</span>
          </div>
          <div className="text-xs text-slate-500 mt-0.5">{f.style} · {f.color}</div>
        </div>
        <div className="text-right text-xs font-mono">
          <div className="text-slate-400">cost {usd(per)}/pc</div>
          {f.price > 0 && <div className={margin >= 0.5 ? 'text-green-300' : 'text-yellow-400'}>{(margin * 100).toFixed(0)}% margin</div>}
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {SIZES.filter(sz => f.sizes[sz]).map(sz => (
          <span key={sz} className="px-2 py-1 rounded-md bg-white/5 text-xs font-mono"><span className="text-slate-400">{sz}</span> <span className="text-white font-bold">{f.sizes[sz]}</span></span>
        ))}
        <span className="px-2 py-1 text-xs font-mono text-slate-500">{f.units} pcs</span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {f.photos.map(p => (
          <span key={p} className="group flex items-center gap-1 px-2 py-1 rounded-md bg-white/5 text-[11px] text-slate-300 max-w-[200px]">
            <span className="truncate" title={p}>📷 {p.split('/').pop()}</span>
            {!locked && <button onClick={() => removePhoto(p)} className="text-slate-600 hover:text-red-400">✕</button>}
          </span>
        ))}
        {!locked && <button className="btn-xs" onClick={addPhotos}>+ Floor photos</button>}
      </div>

      {f.status === 'listed' ? (
        <div className="text-xs text-green-300">On the site{f.shopify_url && <> · <span className="font-mono select-text">{f.shopify_url.replace(/^https?:\/\//, '')}</span></>}</div>
      ) : f.status === 'requested' ? (
        <div className="text-xs text-yellow-300/80">Waiting on Ava in the Deck. Hit <span className="text-white">Push to site</span> on the alert there.</div>
      ) : (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">Retail $</span>
          <input type="number" min="0" step="0.01" className="input-sm w-20" value={price} onChange={e => setPrice(e.target.value)} onBlur={savePrice} />
          <div className="flex-1" />
          {err && <span className="text-xs text-red-400">{err}</span>}
          <button className="btn-primary" disabled={!f.photos.length || !(Number(price) > 0)} onClick={send}
            title={!f.photos.length ? 'Add a floor photo first' : 'Hand this piece to Ava to list on the site'}>Send to Deck</button>
        </div>
      )}
      {f.notes && <div className="text-xs text-red-300/80">{f.notes}</div>}
    </div>
  )
}

function BackRoomTab({ finished, onChange }) {
  const [showListed, setShowListed] = useState(false)
  const active = finished.filter(f => f.status !== 'listed')
  const listed = finished.filter(f => f.status === 'listed')
  if (!finished.length) return <div className="p-10 text-center text-sm text-slate-600">Nothing in the Back Room. Give a print run a <span className="text-slate-400">product name</span> and its good prints land here.</div>
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-500">Printed and named, not on the site yet. When a piece hits the floor: add the photo, check the price, and send it to the Deck. Ava lists it with the cost per item, and Shopify takes over the count from there.</p>
      <div className="grid grid-cols-2 gap-4">{active.map(f => <PieceCard key={f.id} f={f} onChange={onChange} />)}</div>
      {listed.length > 0 && (
        <div>
          <button className="btn-xs" onClick={() => setShowListed(v => !v)}>{showListed ? 'Hide' : 'Show'} listed ({listed.length})</button>
          {showListed && <div className="grid grid-cols-2 gap-4 mt-3">{listed.map(f => <PieceCard key={f.id} f={f} onChange={onChange} />)}</div>}
        </div>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
const TABS = [['run', 'Print Run'], ['backroom', 'Back Room'], ['blanks', 'Blanks'], ['receive', 'Receive Order']]

export default function InHouse() {
  const [tab, setTab]           = useState('run')
  const [blanks, setBlanks]     = useState([])
  const [runs, setRuns]         = useState([])
  const [receipts, setReceipts] = useState([])
  const [assets, setAssets]     = useState([])
  const [sum, setSum]           = useState(null)
  const [finished, setFinished] = useState([])

  const load = useCallback(async () => {
    const [b, r, rc, s, a, f] = await Promise.all([
      window.api.house.blanks.list(), window.api.house.runs.list(), window.api.house.receipts(),
      window.api.house.summary(), window.api.assets.list(), window.api.house.finished.list(),
    ])
    setBlanks(b || []); setRuns(r || []); setReceipts(rc || []); setSum(s); setAssets(a || []); setFinished(f || [])
  }, [])

  useEffect(() => { load() }, [load])
  // Pick up Ava's "listed" results while a piece is waiting on the Deck.
  useEffect(() => {
    if (!finished.some(f => f.status === 'requested')) return
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [finished, load])

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 shrink-0 space-y-3">
        <div className="flex items-end justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-white">In-House</h1>
            <p className="text-xs text-slate-500">Our own blanks and prints. Separate from client orders. Cost = blank + shipping + ink, no labor.</p>
          </div>
          <div className="flex gap-1 p-1 rounded-lg bg-white/5">
            {TABS.map(([id, label]) => (
              <button key={id} onClick={() => setTab(id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${tab === id ? 'bg-green-600/20 text-green-300' : 'text-slate-400 hover:text-slate-200'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        {sum && (
          <div className="flex gap-3 flex-wrap">
            <Stat label="Blanks on hand" value={sum.blanks_on_hand} />
            <Stat label="Stock value" value={usd(sum.stock_value)} />
            <Stat label="Low stock" value={sum.low_count} warn={sum.low_count > 0} />
            <Stat label="Printed" value={sum.printed_good} />
            <Stat label="Misprint rate" value={`${(sum.misprint_rate * 100).toFixed(1)}%`} warn={sum.misprint_rate > 0.05} />
            <Stat label="Avg cost / piece" value={usd(sum.avg_cost_per_good)} />
            <Stat label="Back Room" value={`${finished.filter(f => f.status !== 'listed').reduce((s, f) => s + f.units, 0)} pcs`} />
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-6">
        {tab === 'run'     && <RunTab blanks={blanks} assets={assets} runs={runs} onChange={load} />}
        {tab === 'backroom' && <BackRoomTab finished={finished} onChange={load} />}
        {tab === 'blanks'  && <BlanksTab blanks={blanks} onChange={load} />}
        {tab === 'receive' && <ReceiveTab receipts={receipts} onChange={load} />}
      </div>
    </div>
  )
}
