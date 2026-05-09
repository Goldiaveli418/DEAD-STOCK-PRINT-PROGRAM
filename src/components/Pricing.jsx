import React, { useEffect, useState } from 'react'

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card-glow w-full max-w-md p-6 mx-4 animate-feed-item">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-lg leading-none transition-colors">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function PrintTypeForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name: '', description: '', base_cost: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
      <div>
        <label className="label">Print Type Name *</label>
        <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. DTG Full Front" required />
      </div>
      <div>
        <label className="label">Description</label>
        <input className="input" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description of this print type" />
      </div>
      <div>
        <label className="label">Base Ink Cost ($)</label>
        <input className="input" type="number" step="0.01" value={form.base_cost} onChange={e => set('base_cost', e.target.value)} placeholder="0.00" />
        <p className="text-[11px] text-slate-500 mt-1">Your ink cost for this print from Garment Creator or your estimate — used to auto-fill when building orders.</p>
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary flex-1">{initial?.id ? 'Save Changes' : 'Add Print Type'}</button>
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </form>
  )
}

export default function Pricing() {
  const [types, setTypes] = useState([])
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)

  const load = () => window.api.printTypes.list().then(setTypes)
  useEffect(() => { load() }, [])

  async function handleSave(form) {
    if (form.id) {
      await window.api.printTypes.update({ ...form, base_cost: Number(form.base_cost) || 0 })
    } else {
      await window.api.printTypes.create({ ...form, base_cost: Number(form.base_cost) || 0 })
    }
    setModal(null)
    load()
  }

  async function handleDelete(id) {
    await window.api.printTypes.delete(id)
    setDeleting(null)
    load()
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 shrink-0 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Pricing</h1>
          <p className="text-xs text-slate-500">Manage ink costs per print type for quick order calculation</p>
        </div>
        <button onClick={() => setModal('add')} className="btn-primary">+ Add Print Type</button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 p-3 rounded-xl bg-green-500/5 border border-green-500/10 text-xs text-green-400/80">
          💡 Set your ink cost per print type here (from Garment Creator or your own estimate). When you create an order, selecting a print type will auto-fill its cost so you always know your margin.
        </div>

        {types.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
            <span className="text-4xl opacity-30">◷</span>
            <p className="text-sm">No print types yet</p>
            <button onClick={() => setModal('add')} className="btn-primary text-xs">+ Add Print Type</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {types.map(pt => (
              <div key={pt.id} className="card p-4 hover:border-green-500/15 transition-colors animate-feed-item">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-white">{pt.name}</div>
                    {pt.description && <div className="text-xs text-slate-400 mt-0.5">{pt.description}</div>}
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <div className="text-right">
                      <div className="text-sm font-mono font-bold text-green-400">${Number(pt.base_cost).toFixed(2)}</div>
                      <div className="text-[10px] text-slate-500">ink cost</div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <button onClick={() => setModal(pt)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-500 hover:text-slate-200 transition-colors text-xs">✎</button>
                      <button onClick={() => setDeleting(pt)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors text-xs">✕</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Print Type' : `Edit — ${modal.name}`} onClose={() => setModal(null)}>
          <PrintTypeForm initial={modal === 'add' ? null : modal} onSave={handleSave} onCancel={() => setModal(null)} />
        </Modal>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card-glow w-full max-w-sm p-6 mx-4">
            <h2 className="text-base font-semibold text-white mb-2">Delete Print Type</h2>
            <p className="text-sm text-slate-300 mb-1">Delete <span className="text-white font-semibold">"{deleting.name}"</span>?</p>
            <p className="text-xs text-slate-500 mb-5">Existing orders using this type won't be affected.</p>
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
