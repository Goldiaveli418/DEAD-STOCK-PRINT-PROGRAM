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

const BASE_LABOR = 7
const EXTRA_LABOR = 3

function calcLabor(qty, printCount) {
  if (!qty || !printCount) return 0
  return qty * (BASE_LABOR + EXTRA_LABOR * Math.max(0, printCount - 1))
}

function Toggle({ on, onChange, label }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer select-none">
      <div
        className={`w-9 h-5 rounded-full transition-colors relative ${on ? 'bg-green-500' : 'bg-white/10'}`}
        onClick={() => onChange(!on)}
      >
        <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
      <span className="text-sm text-slate-300">{label}</span>
    </label>
  )
}

function Modal({ title, wide, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className={`card-glow w-full ${wide ? 'max-w-2xl' : 'max-w-md'} p-6 mx-4 animate-feed-item max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors text-lg leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function CostRow({ label, value, sub, green, dim }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className={`text-xs ${dim ? 'text-slate-600' : 'text-slate-400'}`}>{label}</span>
      <span className={`text-xs font-mono ${green ? 'text-green-400' : dim ? 'text-slate-600' : 'text-slate-300'}`}>
        {value}{sub && <span className="text-slate-600 ml-1">{sub}</span>}
      </span>
    </div>
  )
}

function OrderForm({ initial, clients, printTypes, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    client_id: clients[0]?.id || '',
    title: '', status: 'new', is_rush: false,
    due_date: '', notes: '',
    shirt_brand: '', shirt_color: '',
    garment_qty: '',
    customer_supplied: false,
    garment_cost: '',
    labor_override: '',
    sell_price: '',
  })
  const [items, setItems] = useState([])
  const [pendingAssets, setPendingAssets] = useState([])

  useEffect(() => {
    if (initial?.id) {
      window.api.orders.get(initial.id).then(o => {
        if (o?.items) setItems(o.items)
      })
    }
  }, [initial?.id])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function addItem() {
    setItems(i => [...i, {
      print_type_id: printTypes[0]?.id || '',
      description: '',
      ink_cost: '',
      size_breakdown: '',
    }])
  }

  function updateItem(idx, k, v) {
    setItems(items => items.map((item, i) => i !== idx ? item : { ...item, [k]: v }))
  }

  function removeItem(idx) {
    setItems(i => i.filter((_, ii) => ii !== idx))
  }

  async function pickAssets() {
    const paths = await window.api.openFile()
    if (!paths.length) return
    const newAssets = paths.map(p => {
      const parts = p.split(/[\\/]/)
      return { file_path: p, name: parts[parts.length - 1].replace(/\.[^.]+$/, '') }
    })
    setPendingAssets(a => [...a, ...newAssets.filter(n => !a.some(x => x.file_path === n.file_path))])
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const qty = Number(form.garment_qty) || 0
    const autoLabor = calcLabor(qty, items.length)
    const laborCost = form.labor_override !== '' ? Number(form.labor_override) : autoLabor
    const inkCost = items.reduce((s, i) => s + (Number(i.ink_cost) || 0), 0) * qty
    await onSave(
      {
        ...form,
        is_rush: form.is_rush ? 1 : 0,
        customer_supplied: form.customer_supplied ? 1 : 0,
        garment_qty: qty,
        ink_cost: inkCost,
        labor_cost: laborCost,
        garment_cost: form.customer_supplied ? 0 : (Number(form.garment_cost) || 0),
      },
      items,
      pendingAssets,
    )
  }

  const qty = Number(form.garment_qty) || 0
  const autoLabor = calcLabor(qty, items.length)
  const laborCost = form.labor_override !== '' ? Number(form.labor_override) : autoLabor
  const inkCost = items.reduce((s, i) => s + (Number(i.ink_cost) || 0), 0) * qty
  const garmentCost = form.customer_supplied ? 0 : (Number(form.garment_cost) || 0)
  const totalCost = garmentCost + inkCost + laborCost
  const profit = Number(form.sell_price || 0) - totalCost

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Client + Status */}
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

      {/* Title */}
      <div>
        <label className="label">Order Title *</label>
        <input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Spring Drop – 50 Black Tees" required />
      </div>

      {/* Shirt details + qty */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Shirt Brand</label>
          <input className="input" value={form.shirt_brand} onChange={e => set('shirt_brand', e.target.value)} placeholder="Gildan 64000" />
        </div>
        <div>
          <label className="label">Shirt Color</label>
          <input className="input" value={form.shirt_color} onChange={e => set('shirt_color', e.target.value)} placeholder="Black" />
        </div>
        <div>
          <label className="label">Garment Qty</label>
          <input className="input" type="number" min="1" value={form.garment_qty} onChange={e => set('garment_qty', e.target.value)} placeholder="e.g. 50" />
        </div>
      </div>

      {/* Due date + Rush */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Due Date</label>
          <input className="input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </div>
        <div className="flex items-end pb-0.5">
          <Toggle on={!!form.is_rush} onChange={v => set('is_rush', v)} label="Rush Order ⚡" />
        </div>
      </div>

      {/* Print items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div>
            <label className="label mb-0">Print Locations</label>
            {items.length > 0 && qty > 0 && (
              <span className="text-[10px] text-slate-500 ml-2">
                Labor: ${BASE_LABOR} base + ${EXTRA_LABOR} × {Math.max(0, items.length - 1)} extra = <span className="text-green-500/70">${BASE_LABOR + EXTRA_LABOR * Math.max(0, items.length - 1)}/garment</span>
              </span>
            )}
          </div>
          <button type="button" onClick={addItem} className="text-xs text-green-400 hover:text-green-300 transition-colors">+ Add Location</button>
        </div>
        {items.length === 0 ? (
          <div className="text-xs text-slate-500 py-2 text-center border border-dashed border-white/10 rounded-lg cursor-pointer hover:border-green-500/30 transition-colors" onClick={addItem}>
            Click to add a print location (chest, back, sleeve…)
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-[#181c2a] border border-white/5">
                <div className="grid grid-cols-3 gap-2 mb-2">
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
                  <div>
                    <label className="label">Ink Cost / piece ($)</label>
                    <input className="input text-xs py-1.5" type="number" step="0.01" value={item.ink_cost} onChange={e => updateItem(idx, 'ink_cost', e.target.value)} placeholder="from Garment Creator" />
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <input className="input text-xs py-1.5 w-48" value={item.size_breakdown} onChange={e => updateItem(idx, 'size_breakdown', e.target.value)} placeholder="Sizes: S5 M20 L15 XL10" />
                  <button type="button" onClick={() => removeItem(idx)} className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors">Remove</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Graphic assets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Graphic Assets</label>
          <button type="button" onClick={pickAssets} className="text-xs text-green-400 hover:text-green-300 transition-colors">+ Attach Files</button>
        </div>
        {pendingAssets.length === 0 ? (
          <div className="text-xs text-slate-500 py-2 text-center border border-dashed border-white/10 rounded-lg cursor-pointer hover:border-green-500/30 transition-colors" onClick={pickAssets}>
            Click to attach design files — auto-saved to client assets
          </div>
        ) : (
          <div className="space-y-1.5">
            {pendingAssets.map((a, idx) => (
              <div key={idx} className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#181c2a] border border-white/5">
                <span className="text-sm">🖼</span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-slate-200 truncate">{a.name}</div>
                  <div className="text-[10px] text-slate-500 font-mono truncate">{a.file_path}</div>
                </div>
                <button type="button" onClick={() => removePending(idx)} className="text-slate-600 hover:text-red-400 transition-colors text-xs">✕</button>
              </div>
            ))}
            <p className="text-[10px] text-green-500/60 px-1">Saved to client asset library on order save.</p>
          </div>
        )}
      </div>

      {/* Costs */}
      <div className="space-y-3">
        <Toggle
          on={!!form.customer_supplied}
          onChange={v => { set('customer_supplied', v); if (v) set('garment_cost', '0') }}
          label="Customer Supplied Blanks"
        />
        <div className="grid grid-cols-2 gap-3">
          {!form.customer_supplied && (
            <div>
              <label className="label">Garment Cost ($) total</label>
              <input className="input" type="number" step="0.01" value={form.garment_cost} onChange={e => set('garment_cost', e.target.value)} placeholder="0.00" />
            </div>
          )}
          <div className={form.customer_supplied ? 'col-span-2' : ''}>
            <label className="label">
              Labor Cost ($)
              {qty > 0 && items.length > 0 && (
                <span className="ml-1 text-slate-600 font-normal">auto: ${autoLabor.toFixed(2)}</span>
              )}
            </label>
            <input
              className="input"
              type="number" step="0.01"
              value={form.labor_override}
              onChange={e => set('labor_override', e.target.value)}
              placeholder={qty > 0 && items.length > 0 ? `$${autoLabor.toFixed(2)} (auto)` : '$7/garment + $3/extra print'}
            />
          </div>
        </div>
        <div>
          <label className="label">Sell Price ($)</label>
          <input className="input" type="number" step="0.01" value={form.sell_price} onChange={e => set('sell_price', e.target.value)} placeholder="0.00" />
        </div>
      </div>

      {/* Cost breakdown */}
      {(qty > 0 || form.sell_price) && (
        <div className="rounded-lg bg-[#181c2a] border border-white/5 p-3 space-y-0.5">
          <CostRow label="Garment" value={form.customer_supplied ? 'Supplied' : `$${garmentCost.toFixed(2)}`} dim={form.customer_supplied} />
          <CostRow label={`Ink (${items.length} location${items.length !== 1 ? 's' : ''} × ${qty} pcs)`} value={`$${inkCost.toFixed(2)}`} />
          <CostRow label={`Labor (${qty} × $${(BASE_LABOR + EXTRA_LABOR * Math.max(0, items.length - 1)).toFixed(0)})`} value={`$${laborCost.toFixed(2)}`} />
          <div className="border-t border-white/5 mt-1 pt-1">
            <CostRow label="Total Cost" value={`$${totalCost.toFixed(2)}`} />
            <CostRow label="Profit" value={`${profit >= 0 ? '+' : ''}$${profit.toFixed(2)}`} green={profit >= 0} />
          </div>
        </div>
      )}

      <div>
        <label className="label">Notes</label>
        <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Special instructions, art details…" />
      </div>

      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary flex-1">{initial?.id ? 'Save Changes' : 'Create Order'}</button>
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </form>
  )
}

export default function Orders({ clientFilter, onClearFilter }) {
  const [orders, setOrders] = useState([])
  const [clients, setClients] = useState([])
  const [printTypes, setPrintTypes] = useState([])
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch] = useState('')

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
    if (pendingAssets?.length) {
      for (const a of pendingAssets) {
        await window.api.assets.create({
          client_id: order.client_id,
          name: a.name,
          file_path: a.file_path,
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

  const clientName = clientFilter ? clients.find(c => c.id === clientFilter)?.name : null

  const filtered = orders.filter(o => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false
    if (search && !o.title.toLowerCase().includes(search.toLowerCase()) && !o.client_name?.toLowerCase().includes(search.toLowerCase())) return false
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
              const totalCost = (o.customer_supplied ? 0 : o.garment_cost) + o.ink_cost + (o.labor_cost || 0)
              const profit = o.sell_price - totalCost
              return (
                <div key={o.id} className="card p-4 hover:border-green-500/15 transition-colors animate-feed-item">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        {o.is_rush === 1 && <span className="text-xs text-red-400">⚡</span>}
                        <span className="font-medium text-white truncate">{o.title}</span>
                        <span className={STATUS_CLASS[o.status] || 'status-new'}>{STATUSES.find(s => s.value === o.status)?.label || o.status}</span>
                        {o.customer_supplied === 1 && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-300 border border-blue-500/20">Customer Blanks</span>}
                      </div>
                      <div className="text-xs text-slate-400">{o.client_name}</div>
                      {(o.shirt_brand || o.shirt_color) && (
                        <div className="text-xs text-slate-500 mt-0.5">{[o.shirt_brand, o.shirt_color].filter(Boolean).join(' · ')}{o.garment_qty ? ` · ${o.garment_qty} pcs` : ''}</div>
                      )}
                      {o.due_date && <div className="text-xs text-slate-500 mt-0.5">Due: {o.due_date}</div>}
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-mono text-green-400 font-semibold">${o.sell_price.toFixed(2)}</div>
                      <div className={`text-xs font-mono ${profit >= 0 ? 'text-emerald-500/70' : 'text-red-400/70'}`}>
                        {profit >= 0 ? '+' : ''}${profit.toFixed(2)} profit
                      </div>
                      <div className="flex gap-1 mt-2 justify-end">
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
