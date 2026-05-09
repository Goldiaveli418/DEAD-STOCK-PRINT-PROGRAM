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

function itemLabor(item) {
  const qty = Number(item.quantity) || 0
  const prints = Number(item.prints_on_garment) || 1
  return qty * (BASE_LABOR + EXTRA_LABOR * Math.max(0, prints - 1))
}

function itemInk(item) {
  return (Number(item.ink_cost) || 0) * (Number(item.quantity) || 0)
}

function itemGarment(item) {
  if (item.customer_supplied) return 0
  return (Number(item.garment_cost_per_piece) || 0) * (Number(item.quantity) || 0)
}

function blankItem(printTypes) {
  return {
    shirt_brand: '', shirt_color: '',
    print_type_id: printTypes[0]?.id || '',
    description: '',
    quantity: '',
    size_breakdown: '',
    ink_cost: '',
    garment_cost_per_piece: '',
    prints_on_garment: '1',
    customer_supplied: false,
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
  const [form, setForm] = useState(initial || {
    client_id: clients[0]?.id || '',
    title: '', status: 'new', is_rush: false,
    due_date: '', notes: '', sell_price: '',
  })
  const [items, setItems] = useState([blankItem(printTypes)])
  const [pendingAssets, setPendingAssets] = useState([])

  useEffect(() => {
    if (initial?.id) {
      window.api.orders.get(initial.id).then(o => {
        if (o?.items?.length) setItems(o.items)
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

  async function pickAssets() {
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
  const totalQty     = items.reduce((s, i) => s + (Number(i.quantity) || 0), 0)
  const totalCost    = totalInk + totalGarment + totalLabor
  const profit       = Number(form.sell_price || 0) - totalCost

  async function handleSubmit(e) {
    e.preventDefault()
    await onSave(
      {
        ...form,
        is_rush: form.is_rush ? 1 : 0,
        garment_qty: totalQty,
        ink_cost: totalInk,
        garment_cost: totalGarment,
        labor_cost: totalLabor,
        customer_supplied: items.every(i => i.customer_supplied) ? 1 : 0,
      },
      items,
      pendingAssets,
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Header */}
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
            return (
              <div key={idx} className="p-3 rounded-xl bg-[#181c2a] border border-white/5 space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Item {idx + 1}</span>
                  <div className="flex items-center gap-3">
                    <Toggle small on={!!item.customer_supplied} onChange={v => updateItem(idx, 'customer_supplied', v)} label="Customer Blanks" />
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="text-[10px] text-red-400/50 hover:text-red-400 transition-colors">Remove</button>
                    )}
                  </div>
                </div>

                {/* Shirt + print */}
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

                {/* Numbers */}
                <div className="grid grid-cols-4 gap-2">
                  <div>
                    <label className="label">Qty</label>
                    <input className="input text-xs py-1.5" type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} placeholder="0" />
                  </div>
                  <div>
                    <label className="label"># Prints</label>
                    <input className="input text-xs py-1.5" type="number" min="1" max="10" value={item.prints_on_garment} onChange={e => updateItem(idx, 'prints_on_garment', e.target.value)} placeholder="1" />
                  </div>
                  <div>
                    <label className="label">Ink $/pc</label>
                    <input className="input text-xs py-1.5" type="number" step="0.01" value={item.ink_cost} onChange={e => updateItem(idx, 'ink_cost', e.target.value)} placeholder="0.00" />
                  </div>
                  <div>
                    <label className="label">{item.customer_supplied ? 'Garment $/pc' : 'Blank $/pc'}</label>
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

                <div>
                  <label className="label">Sizes</label>
                  <input className="input text-xs py-1.5" value={item.size_breakdown} onChange={e => updateItem(idx, 'size_breakdown', e.target.value)} placeholder="e.g. S5 M10 L10 XL5" />
                </div>

                {/* Item totals */}
                {(item.quantity || item.ink_cost) && (
                  <div className="flex gap-3 pt-1 border-t border-white/5 text-[10px] font-mono text-slate-500">
                    <span>Garment: <span className="text-slate-400">${gmt.toFixed(2)}</span></span>
                    <span>Ink: <span className="text-slate-400">${ink.toFixed(2)}</span></span>
                    <span>Labor: <span className="text-slate-400">${labor.toFixed(2)}</span></span>
                    <span className="ml-auto">Item total: <span className="text-green-400/80">${(gmt + ink + labor).toFixed(2)}</span></span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Graphic assets */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Graphic Assets</label>
          <button type="button" onClick={pickAssets} className="text-xs text-green-400 hover:text-green-300 transition-colors">+ Attach Files</button>
        </div>
        {pendingAssets.length === 0 ? (
          <div className="text-xs text-slate-500 py-2 text-center border border-dashed border-white/10 rounded-lg cursor-pointer hover:border-green-500/30 transition-colors" onClick={pickAssets}>
            Attach design files — auto-saved to client assets
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
                <button type="button" onClick={() => setPendingAssets(p => p.filter((_, i) => i !== idx))} className="text-slate-600 hover:text-red-400 transition-colors text-xs">✕</button>
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
