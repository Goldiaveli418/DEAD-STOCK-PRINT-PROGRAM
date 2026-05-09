import React, { useEffect, useState, useCallback } from 'react'

const STATUSES = [
  { value: 'new',      label: 'New' },
  { value: 'art',      label: 'Art Review' },
  { value: 'printing', label: 'Printing' },
  { value: 'done',     label: 'Done' },
  { value: 'shipped',  label: 'Shipped' },
  { value: 'invoiced', label: 'Invoiced' },
]

const STATUS_CLASS = {
  new: 'status-new', art: 'status-art', printing: 'status-printing',
  done: 'status-done', shipped: 'status-shipped', invoiced: 'status-invoiced',
}

const EXTRA_LABOR = 3
const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']

function blankSizes()    { return Object.fromEntries(SIZES.map(s => [s, ''])) }
function blankInkCosts() { return Object.fromEntries(SIZES.map(s => [s, ''])) }

function parseJSON(raw) {
  if (!raw) return null
  try {
    const p = JSON.parse(raw)
    if (p && typeof p === 'object' && !Array.isArray(p)) return p
  } catch (_) {}
  return null
}

function parseSizes(raw)    { return { ...blankSizes(),    ...(parseJSON(raw) || {}) } }
function parseInkCosts(raw) { return { ...blankInkCosts(), ...(parseJSON(raw) || {}) } }

function itemQty(item) {
  return SIZES.reduce((sum, s) => sum + (Number(item.sizes?.[s]) || 0), 0)
}

function itemInk(item) {
  return SIZES.reduce((sum, s) => {
    return sum + (Number(item.sizes?.[s]) || 0) * (Number(item.ink_costs?.[s]) || 0)
  }, 0)
}

function itemLabor(item) {
  const qty    = itemQty(item)
  const prints = Number(item.prints_on_garment) || 1
  const base   = Number(item.labor_base) || 7
  return qty * (base + EXTRA_LABOR * Math.max(0, prints - 1))
}

function itemGarment(item) {
  if (item.customer_supplied) return 0
  return (Number(item.garment_cost_per_piece) || 0) * itemQty(item)
}

function blankItem(printTypes) {
  return {
    shirt_brand: '', shirt_color: '',
    print_type_id: printTypes[0]?.id || '',
    description: '',
    sizes: blankSizes(),
    ink_costs: blankInkCosts(),
    fill_ink: '',
    garment_cost_per_piece: '',
    labor_base: '7',
    prints_on_garment: '1',
    customer_supplied: false,
    asset_path: '',
    asset_name: '',
  }
}

function Toggle({ on, onChange, label, small }) {
  return (
    <label className="flex items-center gap-1.5 cursor-pointer select-none">
      <div
        className={`${small ? 'w-7 h-4' : 'w-9 h-5'} rounded-full transition-colors relative ${on ? 'bg-green-500' : 'bg-white/10'}`}
        onClick={() => onChange(!on)}
      >
        <div className={`absolute top-0.5 ${small ? 'w-3 h-3' : 'w-4 h-4'} rounded-full bg-white shadow transition-transform ${on ? (small ? 'translate-x-3' : 'translate-x-4') : 'translate-x-0.5'}`} />
      </div>
      {label && <span className={`${small ? 'text-xs' : 'text-sm'} text-slate-300`}>{label}</span>}
    </label>
  )
}

function Modal({ title, wide, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`card-glow w-full ${wide ? 'max-w-3xl' : 'max-w-md'} p-6 mx-4 animate-feed-item max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors text-lg leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function OrderForm({ initial, clients, printTypes, onSave, onCancel }) {
  const [form, setForm] = useState(() => {
    const base = initial || {}
    return {
      client_id: base.client_id || clients[0]?.id || '',
      title: base.title || '', status: base.status || 'new', is_rush: base.is_rush || false,
      due_date: base.due_date || '', notes: base.notes || '', sell_price: base.sell_price || '',
      operator_split: String(base.operator_split ?? 50),
      house_split:    String(base.house_split ?? 50),
      id: base.id,
    }
  })
  const [items, setItems] = useState([blankItem(printTypes)])
  const [pendingAssets, setPendingAssets] = useState([])

  useEffect(() => {
    if (initial?.id) {
      window.api.orders.get(initial.id).then(o => {
        if (o?.items?.length) {
          setItems(o.items.map(i => ({
            ...i,
            sizes:      parseSizes(i.size_breakdown),
            ink_costs:  parseInkCosts(i.ink_cost_breakdown),
            fill_ink:   '',
            labor_base: String(i.labor_base || 7),
            asset_path: i.asset_path || '',
            asset_name: i.asset_name || '',
            _asset_saved: !!(i.asset_path),
          })))
        }
      })
    }
  }, [initial?.id])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function addItem() {
    if (items.length >= 10) return
    setItems(i => [...i, blankItem(printTypes)])
  }

  function updateItem(idx, k, v) {
    setItems(items => items.map((item, i) => i !== idx ? item : { ...item, [k]: v }))
  }

  function removeItem(idx) {
    if (items.length === 1) return
    setItems(i => i.filter((_, ii) => ii !== idx))
  }

  function fillInkCosts(idx, val) {
    setItems(items => items.map((item, i) =>
      i !== idx ? item
        : { ...item, ink_costs: Object.fromEntries(SIZES.map(s => [s, val])) }
    ))
  }

  async function pickItemAsset(idx) {
    const paths = await window.api.openFile()
    if (!paths.length) return
    const p = paths[0]
    const parts = p.split(/[\\/]/)
    const name = parts[parts.length - 1].replace(/\.[^.]+$/, '')
    setItems(items => items.map((item, i) =>
      i !== idx ? item : { ...item, asset_path: p, asset_name: name, _asset_new: true }
    ))
  }

  async function pickOrderAssets() {
    const paths = await window.api.openFile()
    if (!paths.length) return
    const next = paths.map(p => {
      const parts = p.split(/[\\/]/)
      return { file_path: p, name: parts[parts.length - 1].replace(/\.[^.]+$/, '') }
    })
    setPendingAssets(a => [...a, ...next.filter(n => !a.some(x => x.file_path === n.file_path))])
  }

  const totalInk     = items.reduce((s, i) => s + itemInk(i), 0)
  const totalGarment = items.reduce((s, i) => s + itemGarment(i), 0)
  const totalLabor   = items.reduce((s, i) => s + itemLabor(i), 0)
  const totalQty     = items.reduce((s, i) => s + itemQty(i), 0)
  const totalCost    = totalInk + totalGarment + totalLabor
  const profit       = Number(form.sell_price || 0) - totalCost

  async function handleSubmit(e) {
    e.preventDefault()
    const serializedItems = items.map(i => ({
      ...i,
      quantity:           itemQty(i),
      size_breakdown:     JSON.stringify(i.sizes || {}),
      ink_cost_breakdown: JSON.stringify(i.ink_costs || {}),
    }))
    await onSave(
      {
        ...form,
        is_rush:           form.is_rush ? 1 : 0,
        garment_qty:       totalQty,
        ink_cost:          totalInk,
        garment_cost:      totalGarment,
        labor_cost:        totalLabor,
        customer_supplied: items.every(i => i.customer_supplied) ? 1 : 0,
      },
      serializedItems,
      pendingAssets,
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Order header */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Client *</label>
          <select className="input" value={form.client_id} onChange={e => set('client_id', e.target.value)} required>
            <option value="">Select client…</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" value={form.status} onChange={e => set('status', e.target.value)}>
            {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className="label">Order Title *</label>
        <input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Spring Drop – Mixed Tees" required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Due Date</label>
          <input className="input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </div>
        <div className="flex items-end pb-0.5">
          <Toggle on={!!form.is_rush} onChange={v => set('is_rush', v)} label="Rush Order ⚡" />
        </div>
      </div>

      {/* Line items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <label className="label mb-0">Items</label>
            <span className="text-[10px] text-slate-600">{items.length}/10</span>
          </div>
          {items.length < 10 && (
            <button type="button" onClick={addItem} className="text-xs text-green-400 hover:text-green-300 transition-colors">+ Add Item</button>
          )}
        </div>

        <div className="space-y-3">
          {items.map((item, idx) => {
            const labor = itemLabor(item)
            const ink   = itemInk(item)
            const gmt   = itemGarment(item)
            const qty   = itemQty(item)
            return (
              <div key={idx} className="p-3 rounded-xl bg-[#181c2a] border border-white/5 space-y-2.5">

                {/* Item header row */}
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Item {idx + 1}</span>
                  <div className="flex items-center gap-3">
                    <Toggle small on={!!item.customer_supplied} onChange={v => updateItem(idx, 'customer_supplied', v)} label="Customer Blanks" />
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors">Remove</button>
                    )}
                  </div>
                </div>

                {/* Art attachment */}
                {item.asset_path ? (
                  <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-black/30 border border-green-500/20">
                    <span className="text-xs">🖼</span>
                    <span className="text-xs text-slate-300 flex-1 min-w-0 truncate">{item.asset_name || item.asset_path.split(/[\\/]/).pop()}</span>
                    <button
                      type="button"
                      onClick={() => setItems(its => its.map((it, i) => i !== idx ? it : { ...it, asset_path: '', asset_name: '', _asset_new: false }))}
                      className="text-slate-600 hover:text-red-400 transition-colors text-xs shrink-0"
                    >✕</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => pickItemAsset(idx)}
                    className="w-full text-xs text-slate-500 hover:text-green-400 py-1.5 rounded-lg border border-dashed border-white/10 hover:border-green-500/30 transition-colors"
                  >
                    + Attach Art File
                  </button>
                )}

                {/* Shirt brand / color / print type / description */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Shirt Brand</label>
                    <input className="input text-xs py-1.5" value={item.shirt_brand} onChange={e => updateItem(idx, 'shirt_brand', e.target.value)} placeholder="Gildan 64000" />
                  </div>
                  <div>
                    <label className="label">Shirt Color</label>
                    <input className="input text-xs py-1.5" value={item.shirt_color} onChange={e => updateItem(idx, 'shirt_color', e.target.value)} placeholder="Black" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="label">Print Type</label>
                    <select className="input text-xs py-1.5" value={item.print_type_id} onChange={e => updateItem(idx, 'print_type_id', e.target.value)}>
                      <option value="">Custom</option>
                      {printTypes.map(pt => <option key={pt.id} value={pt.id}>{pt.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Description</label>
                    <input className="input text-xs py-1.5" value={item.description} onChange={e => updateItem(idx, 'description', e.target.value)} placeholder="e.g. Front chest logo" />
                  </div>
                </div>

                {/* Size / ink table */}
                <div>
                  {/* Column headers */}
                  <div className="grid gap-1 mb-0.5" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
                    <div />
                    {SIZES.map(s => (
                      <div key={s} className="text-[9px] text-center text-slate-500 font-medium">{s}</div>
                    ))}
                  </div>

                  {/* Qty row */}
                  <div className="grid gap-1 items-center mb-1" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
                    <div className="text-[10px] text-slate-400">Qty</div>
                    {SIZES.map(s => (
                      <input
                        key={s}
                        className="input text-xs py-1 text-center px-0.5"
                        type="number" min="0"
                        value={item.sizes?.[s] ?? ''}
                        onChange={e => updateItem(idx, 'sizes', { ...item.sizes, [s]: e.target.value })}
                        placeholder="0"
                      />
                    ))}
                  </div>

                  {/* Ink $/pc row */}
                  <div className="grid gap-1 items-center" style={{ gridTemplateColumns: '52px repeat(7, 1fr)' }}>
                    <div className="text-[10px] text-slate-400 leading-tight">Ink<br/>$/pc</div>
                    {SIZES.map(s => (
                      <input
                        key={s}
                        className="input text-xs py-1 text-center px-0.5"
                        type="number" step="0.01" min="0"
                        value={item.ink_costs?.[s] ?? ''}
                        onChange={e => updateItem(idx, 'ink_costs', { ...item.ink_costs, [s]: e.target.value })}
                        placeholder="0"
                      />
                    ))}
                  </div>

                  {/* Fill ink + totals */}
                  <div className="flex items-center justify-between mt-1.5 gap-2">
                    <span className="text-[10px] text-slate-500 font-mono">
                      {qty} pcs · ink <span className="text-slate-400">${ink.toFixed(2)}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <input
                        className="input text-xs py-0.5 w-20 text-center"
                        type="number" step="0.01" min="0"
                        value={item.fill_ink ?? ''}
                        onChange={e => updateItem(idx, 'fill_ink', e.target.value)}
                        placeholder="$/pc"
                      />
                      <button
                        type="button"
                        onClick={() => fillInkCosts(idx, item.fill_ink)}
                        className="text-[11px] px-2 py-0.5 rounded bg-green-500/10 hover:bg-green-500/20 text-green-400 border border-green-500/20 transition-colors whitespace-nowrap"
                      >
                        Fill all →
                      </button>
                    </div>
                  </div>
                </div>

                {/* Blank cost + # prints + labor base */}
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="label"># Prints</label>
                    <input className="input text-xs py-1.5" type="number" min="1" max="10" value={item.prints_on_garment} onChange={e => updateItem(idx, 'prints_on_garment', e.target.value)} placeholder="1" />
                  </div>
                  <div>
                    <label className="label">Labor $/pc</label>
                    <input className="input text-xs py-1.5" type="number" step="0.01" min="0" value={item.labor_base} onChange={e => updateItem(idx, 'labor_base', e.target.value)} placeholder="7.00" />
                  </div>
                  <div>
                    <label className="label">Blank $/pc</label>
                    <input
                      className={`input text-xs py-1.5 ${item.customer_supplied ? 'opacity-30 pointer-events-none' : ''}`}
                      type="number" step="0.01"
                      value={item.customer_supplied ? '' : item.garment_cost_per_piece}
                      onChange={e => updateItem(idx, 'garment_cost_per_piece', e.target.value)}
                      placeholder={item.customer_supplied ? 'supplied' : '0.00'}
                      disabled={!!item.customer_supplied}
                    />
                  </div>
                </div>

                {/* Item cost summary */}
                {(qty > 0 || ink > 0) && (
                  <div className="flex gap-3 pt-1.5 border-t border-white/5 text-[10px] font-mono text-slate-500">
                    <span>Garment: <span className="text-slate-400">${gmt.toFixed(2)}</span></span>
                    <span>Labor: <span className="text-slate-400">${labor.toFixed(2)}</span></span>
                    <span className="ml-auto font-semibold">Item total: <span className="text-green-400/80">${(gmt + ink + labor).toFixed(2)}</span></span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Order-level graphic assets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Additional Assets</label>
          <button type="button" onClick={pickOrderAssets} className="text-xs text-green-400 hover:text-green-300 transition-colors">+ Attach Files</button>
        </div>
        {pendingAssets.length === 0 ? (
          <div
            className="text-xs text-slate-500 py-2 text-center border border-dashed border-white/10 rounded-lg cursor-pointer hover:border-green-500/30 transition-colors"
            onClick={pickOrderAssets}
          >
            Attach extra files — auto-saved to client assets
          </div>
        ) : (
          <div className="space-y-1.5">
            {pendingAssets.map((a, i) => (
              <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#181c2a] border border-white/5">
                <span className="text-sm">🖼</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-200 truncate">{a.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{a.file_path}</div>
                </div>
                <button type="button" onClick={() => setPendingAssets(p => p.filter((_, j) => j !== i))} className="text-slate-600 hover:text-red-400 transition-colors text-xs">✕</button>
              </div>
            ))}
            <p className="text-[10px] text-green-500/60 px-1">Saved to client asset library on order save.</p>
          </div>
        )}
      </div>

      {/* Order totals */}
      <div className="rounded-xl bg-[#181c2a] border border-white/5 p-3 space-y-1">
        <div className="flex justify-between text-xs text-slate-500 pb-1 border-b border-white/5 mb-1">
          <span>{items.length} item{items.length !== 1 ? 's' : ''} · {totalQty} garments</span>
          <span className="font-mono">Total Cost: ${totalCost.toFixed(2)}</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px] font-mono text-center">
          <div className="rounded-lg bg-black/20 p-2">
            <div className="text-slate-500 mb-0.5">Garment</div>
            <div className="text-slate-300">${totalGarment.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-black/20 p-2">
            <div className="text-slate-500 mb-0.5">Ink</div>
            <div className="text-slate-300">${totalInk.toFixed(2)}</div>
          </div>
          <div className="rounded-lg bg-black/20 p-2">
            <div className="text-slate-500 mb-0.5">Labor</div>
            <div className="text-slate-300">${totalLabor.toFixed(2)}</div>
          </div>
        </div>
      </div>

      {/* Sell price */}
      <div>
        <label className="label">Sell Price ($)</label>
        <input className="input" type="number" step="0.01" value={form.sell_price} onChange={e => set('sell_price', e.target.value)} placeholder="0.00" />
        {form.sell_price && (
          <div className={`text-sm font-mono text-right mt-1.5 ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            Profit: {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
          </div>
        )}
      </div>

      {/* Internal profit splits */}
      <div className="rounded-xl bg-[#0d1117] border border-yellow-500/15 p-3 space-y-2.5">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[10px] font-semibold text-yellow-500/60 uppercase tracking-wider">Internal — Profit Splits</span>
          <span className="text-[9px] text-slate-600">not visible to clients</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="label">Operator %</label>
            <input
              className="input text-xs py-1.5"
              type="number" min="0" max="100" step="1"
              value={form.operator_split}
              onChange={e => {
                const v = Math.min(100, Math.max(0, Number(e.target.value) || 0))
                set('operator_split', String(v))
                set('house_split', String(100 - v))
              }}
              placeholder="50"
            />
          </div>
          <div>
            <label className="label">House %</label>
            <input
              className="input text-xs py-1.5"
              type="number" min="0" max="100" step="1"
              value={form.house_split}
              onChange={e => {
                const v = Math.min(100, Math.max(0, Number(e.target.value) || 0))
                set('house_split', String(v))
                set('operator_split', String(100 - v))
              }}
              placeholder="50"
            />
          </div>
        </div>
        {form.sell_price && profit !== 0 && (() => {
          const opPct  = Number(form.operator_split) || 0
          const hsPct  = Number(form.house_split) || 0
          const opAmt  = profit * opPct / 100
          const hsAmt  = profit * hsPct / 100
          const color  = profit >= 0 ? 'text-green-400' : 'text-red-400'
          return (
            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-center pt-1 border-t border-white/5">
              <div className="rounded-lg bg-black/20 p-2">
                <div className="text-slate-500 mb-0.5">Operator ({opPct}%)</div>
                <div className={color}>{opAmt >= 0 ? '+' : ''}${opAmt.toFixed(2)}</div>
              </div>
              <div className="rounded-lg bg-black/20 p-2">
                <div className="text-slate-500 mb-0.5">House ({hsPct}%)</div>
                <div className={color}>{hsAmt >= 0 ? '+' : ''}${hsAmt.toFixed(2)}</div>
              </div>
            </div>
          )
        })()}
      </div>

      <div>
        <label className="label">Notes</label>
        <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Special instructions…" />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary flex-1">{initial?.id ? 'Save Changes' : 'Create Order'}</button>
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </form>
  )
}

export default function Orders({ clientFilter, onClearFilter }) {
  const [orders, setOrders]       = useState([])
  const [clients, setClients]     = useState([])
  const [printTypes, setPrintTypes] = useState([])
  const [modal, setModal]         = useState(null)
  const [deleting, setDeleting]   = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]       = useState('')
  const [pdfing, setPdfing]       = useState(null)

  const load = useCallback(() => {
    window.api.orders.list(clientFilter || undefined).then(setOrders)
  }, [clientFilter])

  useEffect(() => {
    load()
    window.api.clients.list().then(setClients)
    window.api.printTypes.list().then(setPrintTypes)
  }, [load])

  async function handleSave(form, items, pendingAssets) {
    let order
    if (form.id) {
      order = await window.api.orders.update(form)
    } else {
      order = await window.api.orders.create(form)
    }

    if (items) await window.api.orderItems.save({ orderId: order.id, items })

    // Order-level extra assets
    for (const a of (pendingAssets || [])) {
      await window.api.assets.create({
        client_id: order.client_id,
        name: a.name,
        file_path: a.file_path,
        notes: `From order: ${order.title}`,
      })
    }

    // Per-item art files (only newly attached)
    for (const item of (items || [])) {
      if (item.asset_path && item._asset_new) {
        await window.api.assets.create({
          client_id: order.client_id,
          name: item.asset_name || item.asset_path.split(/[\\/]/).pop(),
          file_path: item.asset_path,
          notes: `From order: ${order.title}`,
        })
      }
    }

    setModal(null)
    load()
  }

  async function handleDelete(id) {
    await window.api.orders.delete(id)
    setDeleting(null)
    load()
  }

  async function handlePdf(orderId) {
    setPdfing(orderId)
    try {
      const order = await window.api.orders.get(orderId)
      if (!order) return
      await window.api.invoice.pdf({ order, items: order.items || [] })
    } finally {
      setPdfing(null)
    }
  }

  const clientName = clientFilter ? clients.find(c => c.id === clientFilter)?.name : null

  const filtered = orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    if (search && !o.title.toLowerCase().includes(search.toLowerCase()) && !(o.client_name || '').toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between gap-4 mb-3">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              Orders
              {clientName && (
                <span className="text-sm font-normal text-green-400 flex items-center gap-1">
                  — {clientName}
                  <button onClick={onClearFilter} className="ml-1 text-slate-500 hover:text-slate-200 text-xs">✕</button>
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-500">{filtered.length} order{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            <input className="input w-44" placeholder="Search orders…" value={search} onChange={e => setSearch(e.target.value)} />
            <button onClick={() => setModal('add')} className="btn-primary whitespace-nowrap">+ New Order</button>
          </div>
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['all', ...STATUSES.map(s => s.value)].map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${statusFilter === s ? 'bg-green-600/25 text-green-300 border border-green-500/30' : 'bg-white/5 text-slate-400 hover:bg-white/10 border border-white/5'}`}
            >
              {s === 'all' ? 'All' : STATUSES.find(x => x.value === s)?.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <span className="text-4xl opacity-30">◎</span>
            <p className="text-sm">No orders found</p>
            <button onClick={() => setModal('add')} className="btn-primary text-xs">+ New Order</button>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(o => {
              const totalCost = o.garment_cost + o.ink_cost + (o.labor_cost || 0)
              const profit = o.sell_price - totalCost
              return (
                <div key={o.id} className="card p-4 hover:border-green-500/15 transition-colors animate-feed-item">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {o.is_rush === 1 && <span className="text-xs text-red-400">⚡</span>}
                        <span className="font-medium text-white truncate">{o.title}</span>
                        <span className={STATUS_CLASS[o.status] || 'status-new'}>{STATUSES.find(s => s.value === o.status)?.label || o.status}</span>
                      </div>
                      <div className="text-xs text-slate-400">{o.client_name}</div>
                      <div className="text-xs text-slate-500 mt-0.5 font-mono">
                        {o.garment_qty ? `${o.garment_qty} pcs` : ''}
                        {o.garment_qty && (o.ink_cost || o.labor_cost) ? ' · ' : ''}
                        {o.ink_cost ? `ink $${o.ink_cost.toFixed(2)}` : ''}
                        {o.labor_cost ? ` · labor $${o.labor_cost.toFixed(2)}` : ''}
                      </div>
                      {o.due_date && <div className="text-xs text-slate-500 mt-0.5">Due: {o.due_date}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono text-green-400 font-semibold">${o.sell_price.toFixed(2)}</div>
                      <div className={`text-xs font-mono ${profit >= 0 ? 'text-emerald-500/70' : 'text-red-400/70'}`}>
                        {profit >= 0 ? '+' : ''}${profit.toFixed(2)} profit
                      </div>
                      <div className="flex gap-1 mt-2 justify-end">
                        <button
                          onClick={() => handlePdf(o.id)}
                          disabled={pdfing === o.id}
                          className="text-xs px-2 py-0.5 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-colors border border-blue-500/10 disabled:opacity-40"
                        >
                          {pdfing === o.id ? '…' : 'PDF'}
                        </button>
                        <button onClick={() => setModal(o)} className="text-xs px-2 py-0.5 rounded bg-white/5 hover:bg-white/10 text-slate-400 transition-colors border border-white/5">Edit</button>
                        <button onClick={() => setDeleting(o)} className="text-xs px-2 py-0.5 rounded bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors border border-red-500/10">Del</button>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'New Order' : 'Edit Order'} wide onClose={() => setModal(null)}>
          <OrderForm
            initial={modal === 'add' ? (clientFilter ? { client_id: clientFilter } : null) : modal}
            clients={clients}
            printTypes={printTypes}
            onSave={handleSave}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card-glow w-full max-w-sm p-6 mx-4">
            <h2 className="text-base font-semibold text-white mb-2">Delete Order</h2>
            <p className="text-sm text-slate-300 mb-1">Delete <span className="text-white font-semibold">"{deleting.title}"</span>?</p>
            <p className="text-xs text-slate-500 mb-5">This cannot be undone.</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(deleting.id)} className="btn-danger flex-1">Delete</button>
              <button onClick={() => setDeleting(null)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
