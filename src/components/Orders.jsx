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

function OrderForm({ initial, clients, printTypes, onSave, onCancel }) {
  const [form, setForm] = useState(initial || {
    client_id: clients[0]?.id || '',
    title: '', status: 'new', is_rush: false,
    due_date: '', notes: '', garment_cost: '', ink_cost: '', sell_price: '',
  })
  const [items, setItems] = useState([])

  useEffect(() => {
    if (initial?.id) {
      window.api.orders.get(initial.id).then(o => { if (o?.items) setItems(o.items) })
    }
  }, [initial?.id])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function addItem() {
    setItems(i => [...i, { print_type_id: printTypes[0]?.id || '', description: '', quantity: 1, size_breakdown: '', unit_price: printTypes[0]?.base_cost || '' }])
  }

  function updateItem(idx, k, v) {
    setItems(items => items.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [k]: v }
      if (k === 'print_type_id') {
        const pt = printTypes.find(p => p.id === Number(v))
        if (pt) updated.unit_price = pt.base_cost
      }
      return updated
    }))
  }

  function removeItem(idx) {
    setItems(i => i.filter((_, ii) => ii !== idx))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const saved = await onSave({ ...form, is_rush: form.is_rush ? 1 : 0 }, items)
    return saved
  }

  const totalItems = items.reduce((s, i) => s + (Number(i.unit_price) * Number(i.quantity || 1)), 0)
  const profit = Number(form.sell_price || 0) - Number(form.garment_cost || 0) - Number(form.ink_cost || 0)

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
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
        <input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="e.g. Spring Drop – 50 Black Tees" required />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Due Date</label>
          <input className="input" type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)} />
        </div>
        <div className="flex items-end pb-0.5">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <div className={`w-9 h-5 rounded-full transition-colors ${form.is_rush ? 'bg-red-500' : 'bg-white/10'} relative`} onClick={() => set('is_rush', !form.is_rush)}>
              <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.is_rush ? 'translate-x-4' : 'translate-x-0.5'}`} />
            </div>
            <span className="text-sm text-slate-300">Rush Order ⚡</span>
          </label>
        </div>
      </div>

      {/* Print items */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="label mb-0">Print Items</label>
          <button type="button" onClick={addItem} className="text-xs text-green-400 hover:text-green-300 transition-colors">+ Add Item</button>
        </div>
        {items.length === 0 ? (
          <div className="text-xs text-slate-500 py-2 text-center border border-dashed border-white/10 rounded-lg cursor-pointer hover:border-green-500/30 transition-colors" onClick={addItem}>
            Click to add a print item
          </div>
        ) : (
          <div className="space-y-2">
            {items.map((item, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-[#181c2a] border border-white/5 space-y-2">
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
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="label">Qty</label>
                    <input className="input text-xs py-1.5" type="number" min="1" value={item.quantity} onChange={e => updateItem(idx, 'quantity', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Unit Cost ($)</label>
                    <input className="input text-xs py-1.5" type="number" step="0.01" value={item.unit_price} onChange={e => updateItem(idx, 'unit_price', e.target.value)} />
                  </div>
                  <div>
                    <label className="label">Sizes</label>
                    <input className="input text-xs py-1.5" value={item.size_breakdown} onChange={e => updateItem(idx, 'size_breakdown', e.target.value)} placeholder="S2 M10 L20…" />
                  </div>
                </div>
                <button type="button" onClick={() => removeItem(idx)} className="text-[10px] text-red-400/60 hover:text-red-400 transition-colors">Remove item</button>
              </div>
            ))}
            {items.length > 0 && (
              <div className="text-right text-xs text-slate-400 font-mono">Items total: <span className="text-green-400">${totalItems.toFixed(2)}</span></div>
            )}
          </div>
        )}
      </div>

      {/* Costs */}
      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="label">Garment Cost ($)</label>
          <input className="input" type="number" step="0.01" value={form.garment_cost} onChange={e => set('garment_cost', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label">Ink Cost ($)</label>
          <input className="input" type="number" step="0.01" value={form.ink_cost} onChange={e => set('ink_cost', e.target.value)} placeholder="0.00" />
        </div>
        <div>
          <label className="label">Sell Price ($)</label>
          <input className="input" type="number" step="0.01" value={form.sell_price} onChange={e => set('sell_price', e.target.value)} placeholder="0.00" />
        </div>
      </div>

      {(form.sell_price || form.garment_cost || form.ink_cost) && (
        <div className={`text-sm font-mono text-right ${profit >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          Profit: {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
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

  async function handleSave(form, items) {
    let order
    if (form.id) {
      order = await window.api.orders.update(form)
    } else {
      order = await window.api.orders.create(form)
    }
    if (items) await window.api.orderItems.save({ orderId: order.id, items })
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
    if (search && !o.title.toLowerCase().includes(search.toLowerCase()) && !o.client_name.toLowerCase().includes(search.toLowerCase())) return false
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
              const profit = o.sell_price - o.garment_cost - o.ink_cost
              return (
                <div key={o.id} className="card p-4 hover:border-green-500/15 transition-colors animate-feed-item">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {o.is_rush === 1 && <span className="text-xs text-red-400">⚡</span>}
                        <span className="font-medium text-white truncate">{o.title}</span>
                        <span className={STATUS_CLASS[o.status] || 'status-new'}>{STATUSES.find(s => s.value === o.status)?.label || o.status}</span>
                      </div>
                      <div className="text-xs text-slate-400">{o.client_name}</div>
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
        <Modal title={modal === 'add' ? 'New Order' : `Edit Order`} wide onClose={() => setModal(null)}>
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
