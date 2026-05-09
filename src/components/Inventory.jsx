import React, { useEffect, useState, useCallback } from 'react'

const SIZES = ['XS','S','M','L','XL','2XL','3XL','4XL']

function blankForm() {
  return { brand: '', style: '', color: '', size: 'M', qty_on_hand: '', reorder_point: '5', cost_per_unit: '', notes: '' }
}

function RowForm({ initial, onSave, onCancel, compact }) {
  const [form, setForm] = useState(initial || blankForm())
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className={`space-y-2 ${compact ? '' : 'p-3 rounded-xl border border-green-500/20 bg-green-500/5'}`}>
      {!compact && <div className="text-xs font-semibold text-green-300">New Inventory Item</div>}
      <div className="flex gap-2 flex-wrap">
        <input className="input-sm w-28" placeholder="Brand *" value={form.brand} onChange={e => set('brand', e.target.value)} />
        <input className="input-sm w-24" placeholder="Style" value={form.style} onChange={e => set('style', e.target.value)} />
        <input className="input-sm w-28" placeholder="Color" value={form.color} onChange={e => set('color', e.target.value)} />
        <select className="input-sm w-20" value={form.size} onChange={e => set('size', e.target.value)}>
          {SIZES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <input type="number" min="0" className="input-sm w-20" placeholder="Qty" value={form.qty_on_hand} onChange={e => set('qty_on_hand', e.target.value)} />
        <input type="number" min="0" step="0.01" className="input-sm w-24" placeholder="Cost/pc" value={form.cost_per_unit} onChange={e => set('cost_per_unit', e.target.value)} />
        <input className="input-sm flex-1 min-w-[120px]" placeholder="Notes" value={form.notes} onChange={e => set('notes', e.target.value)} />
      </div>
      <div className="flex gap-1.5">
        <button
          onClick={() => { if (form.brand.trim()) onSave(form) }}
          className="btn-xs bg-green-500/20 text-green-300 border-green-500/20 hover:bg-green-500/30"
        >
          {initial ? 'Save' : 'Add Item'}
        </button>
        <button onClick={onCancel} className="btn-xs">Cancel</button>
      </div>
    </div>
  )
}

function AdjustPanel({ item, onAdjust, onClose }) {
  const [delta, setDelta]   = useState('')
  const [reason, setReason] = useState('')

  async function apply() {
    const d = parseInt(delta, 10)
    if (!d) return
    await onAdjust({ id: item.id, delta: d, reason: reason || undefined })
    onClose()
  }

  return (
    <div className="flex items-center gap-2 flex-wrap px-4 pb-2 border-t border-white/5 pt-2">
      <span className="text-xs text-slate-500">Adjust {item.brand} {item.color} {item.size}:</span>
      <input type="number" className="input-sm w-20" placeholder="±qty" value={delta} onChange={e => setDelta(e.target.value)} autoFocus />
      <input className="input-sm flex-1 min-w-[100px]" placeholder="Reason (optional)" value={reason} onChange={e => setReason(e.target.value)} />
      <button onClick={apply} className="btn-xs bg-blue-500/20 text-blue-300 border-blue-500/20 hover:bg-blue-500/30">Apply</button>
      <button onClick={onClose} className="btn-xs">Cancel</button>
    </div>
  )
}

function groupItems(items) {
  const groups = {}
  for (const item of items) {
    const key = `${item.brand}|${item.color}`
    if (!groups[key]) groups[key] = { brand: item.brand, color: item.color, style: item.style, items: [] }
    groups[key].items.push(item)
  }
  return Object.values(groups)
}

export default function Inventory() {
  const [items, setItems]     = useState([])
  const [adding, setAdding]   = useState(false)
  const [editId, setEditId]   = useState(null)
  const [adjId, setAdjId]     = useState(null)
  const [search, setSearch]   = useState('')

  const load = useCallback(async () => {
    const data = await window.api.inventory.list()
    setItems(data || [])
  }, [])

  useEffect(() => { load() }, [load])

  async function handleCreate(form) {
    await window.api.inventory.create(form)
    setAdding(false)
    load()
  }

  async function handleUpdate(form) {
    await window.api.inventory.update(form)
    setEditId(null)
    load()
  }

  async function handleDelete(id) {
    await window.api.inventory.delete(id)
    load()
  }

  async function handleAdjust(args) {
    await window.api.inventory.adjust(args)
    setAdjId(null)
    load()
  }

  const filtered = items.filter(i =>
    !search ||
    i.brand.toLowerCase().includes(search.toLowerCase()) ||
    i.color.toLowerCase().includes(search.toLowerCase()) ||
    (i.style || '').toLowerCase().includes(search.toLowerCase())
  )

  const totalPcs    = items.reduce((s, i) => s + (Number(i.qty_on_hand) || 0), 0)
  const lowCount    = items.filter(i => Number(i.qty_on_hand) <= Number(i.reorder_point || 5)).length
  const groups      = groupItems(filtered)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-white">Inventory</h1>
            <p className="text-xs text-slate-500">
              {items.length} SKUs · {totalPcs} pcs
              {lowCount > 0 && <> · <span className="text-red-400">{lowCount} low stock</span></>}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              className="input w-44"
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            <button
              onClick={() => setAdding(a => !a)}
              className="px-3 h-8 rounded-lg text-xs bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/20 transition-colors"
            >
              + Add Item
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {adding && (
          <RowForm onSave={handleCreate} onCancel={() => setAdding(false)} />
        )}

        {items.length === 0 && !adding ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-600 gap-2">
            <span className="text-3xl opacity-30">▤</span>
            <p className="text-sm">No inventory items yet</p>
            <p className="text-xs text-center">Items auto-deduct when an order moves to Printing.<br/>Match by brand + color + size.</p>
          </div>
        ) : (
          groups.map(group => (
            <div key={`${group.brand}|${group.color}`} className="rounded-xl border border-white/5 bg-[#0e1018] overflow-hidden">
              {/* Group header */}
              <div className="px-4 py-2.5 bg-white/3 border-b border-white/5 flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{group.brand}</span>
                {group.color && <span className="text-xs text-slate-400">{group.color}</span>}
                {group.style && <span className="text-xs text-slate-600">{group.style}</span>}
                <span className="ml-auto text-xs text-slate-500 font-mono">
                  {group.items.reduce((s, i) => s + (Number(i.qty_on_hand) || 0), 0)} pcs total
                </span>
              </div>

              {/* Size rows */}
              <div className="divide-y divide-white/5">
                {group.items
                  .sort((a, b) => SIZES.indexOf(a.size) - SIZES.indexOf(b.size))
                  .map(item => {
                    const qty = Number(item.qty_on_hand) || 0
                    const low = qty <= Number(item.reorder_point || 5)
                    const isEditing = editId === item.id
                    const isAdj = adjId === item.id

                    return (
                      <div key={item.id}>
                        {isEditing ? (
                          <div className="px-3 py-2">
                            <RowForm
                              initial={{ ...item, qty_on_hand: String(item.qty_on_hand), cost_per_unit: String(item.cost_per_unit || '') }}
                              onSave={handleUpdate}
                              onCancel={() => setEditId(null)}
                              compact
                            />
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 px-4 py-2 group hover:bg-white/3 transition-colors">
                            <div className={`text-xs font-mono font-semibold w-8 text-center rounded px-1 py-0.5 ${low ? 'text-red-400 bg-red-500/10' : qty === 0 ? 'text-slate-700' : 'text-slate-300'}`}>
                              {item.size}
                            </div>
                            <div className={`text-sm font-mono font-bold w-12 tabular-nums ${low ? 'text-red-400' : qty === 0 ? 'text-slate-700' : 'text-white'}`}>
                              {qty}
                            </div>
                            <div className="text-xs text-slate-600 flex-1">
                              {low && qty > 0 ? <span className="text-yellow-400/70">Low stock</span> : ''}
                              {qty === 0 ? <span className="text-red-400/60">Out of stock</span> : ''}
                              {item.notes ? <span className="ml-2 text-slate-600 italic">{item.notes}</span> : ''}
                            </div>
                            {item.cost_per_unit > 0 && (
                              <div className="text-xs text-slate-600 font-mono">${Number(item.cost_per_unit).toFixed(2)}/pc</div>
                            )}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <button onClick={() => setAdjId(item.id)} className="btn-xs" title="Adjust">±</button>
                              <button onClick={() => setEditId(item.id)} className="btn-xs" title="Edit">✎</button>
                              <button onClick={() => handleDelete(item.id)} className="btn-xs text-red-400/60 hover:text-red-400 hover:bg-red-500/10 border-red-500/10" title="Delete">✕</button>
                            </div>
                          </div>
                        )}
                        {isAdj && (
                          <AdjustPanel item={item} onAdjust={handleAdjust} onClose={() => setAdjId(null)} />
                        )}
                      </div>
                    )
                  })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
