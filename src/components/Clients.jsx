import React, { useEffect, useState, useCallback } from 'react'

const INTERACTION_TYPES = ['Call', 'Email', 'Meeting', 'Quote', 'Note', 'Other']

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card-glow w-full max-w-md p-6 mx-4 animate-feed-item">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 transition-colors text-lg leading-none">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ClientForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name: '', email: '', phone: '', notes: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
      <div>
        <label className="label">Client Name *</label>
        <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Jordan Athletics" required />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="hello@example.com" />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 000-0000" />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input resize-none" rows={3} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Any notes about this client…" />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary flex-1">{initial?.id ? 'Save Changes' : 'Add Client'}</button>
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </form>
  )
}

function InteractionLog({ clientId }) {
  const [items, setItems]   = useState([])
  const [adding, setAdding] = useState(false)
  const [form, setForm]     = useState({ type: 'Note', notes: '' })

  const load = useCallback(() => {
    window.api.interactions.list(clientId).then(data => setItems(data || []))
  }, [clientId])

  useEffect(() => { load() }, [load])

  async function handleAdd() {
    if (!form.notes.trim()) return
    await window.api.interactions.create({ client_id: clientId, type: form.type, notes: form.notes })
    setForm({ type: 'Note', notes: '' })
    setAdding(false)
    load()
  }

  async function handleDelete(id) {
    await window.api.interactions.delete(id)
    load()
  }

  function relativeTime(ts) {
    if (!ts) return ''
    const diff = Date.now() - new Date(ts).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)   return 'Just now'
    if (mins < 60)  return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)   return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    if (days < 7)   return `${days}d ago`
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const TYPE_COLOR = {
    Call:    'text-blue-400 bg-blue-500/10 border-blue-500/20',
    Email:   'text-purple-400 bg-purple-500/10 border-purple-500/20',
    Meeting: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20',
    Quote:   'text-green-400 bg-green-500/10 border-green-500/20',
    Note:    'text-slate-400 bg-white/5 border-white/10',
    Other:   'text-slate-400 bg-white/5 border-white/10',
  }

  return (
    <div className="border-t border-white/5 mt-3 pt-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">Interaction Log</span>
        <button
          onClick={() => setAdding(a => !a)}
          className="text-[10px] px-2 py-0.5 rounded border border-white/8 text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
        >
          + Log
        </button>
      </div>

      {adding && (
        <div className="space-y-2 p-2.5 rounded-lg bg-black/30 border border-white/8">
          <div className="flex gap-2">
            <select
              className="input-sm"
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
            >
              {INTERACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <textarea
            className="w-full bg-black/30 border border-white/8 rounded-lg text-xs text-slate-300 placeholder:text-slate-600 px-2.5 py-1.5 resize-none outline-none focus:border-white/15 transition-colors"
            rows={2}
            placeholder="Notes…"
            value={form.notes}
            onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
            autoFocus
          />
          <div className="flex gap-1.5">
            <button onClick={handleAdd} className="btn-xs bg-green-500/20 text-green-300 border-green-500/20 hover:bg-green-500/30">Save</button>
            <button onClick={() => setAdding(false)} className="btn-xs">Cancel</button>
          </div>
        </div>
      )}

      {items.length === 0 && !adding && (
        <div className="text-[11px] text-slate-700 py-1">No interactions logged yet.</div>
      )}

      <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
        {items.map(item => (
          <div key={item.id} className="flex gap-2 group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded border ${TYPE_COLOR[item.type] || TYPE_COLOR.Other}`}>{item.type}</span>
                <span className="text-[10px] text-slate-600">{relativeTime(item.created_at)}</span>
              </div>
              <p className="text-[11px] text-slate-400 leading-snug line-clamp-2">{item.notes}</p>
            </div>
            <button
              onClick={() => handleDelete(item.id)}
              className="opacity-0 group-hover:opacity-100 text-slate-700 hover:text-red-400 transition-all text-xs shrink-0 mt-0.5"
            >✕</button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Clients({ onGoToOrders, onGoToAssets }) {
  const [clients, setClients]     = useState([])
  const [modal, setModal]         = useState(null)
  const [search, setSearch]       = useState('')
  const [deleting, setDeleting]   = useState(null)
  const [expandedLog, setExpandedLog] = useState({})

  const load = () => window.api.clients.list().then(setClients)
  useEffect(() => { load() }, [])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email || '').toLowerCase().includes(search.toLowerCase())
  )

  async function handleSave(form) {
    if (form.id) {
      await window.api.clients.update(form)
    } else {
      await window.api.clients.create(form)
    }
    setModal(null)
    load()
  }

  async function handleDelete(id) {
    await window.api.clients.delete(id)
    setDeleting(null)
    load()
  }

  function toggleLog(id) {
    setExpandedLog(e => ({ ...e, [id]: !e[id] }))
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between gap-4 shrink-0">
        <div>
          <h1 className="text-lg font-bold text-white">Clients</h1>
          <p className="text-xs text-slate-500">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            className="input w-52"
            placeholder="Search clients…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <button onClick={() => setModal('add')} className="btn-primary whitespace-nowrap">+ Add Client</button>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <span className="text-4xl opacity-30">◈</span>
            <p className="text-sm">{search ? 'No clients match your search' : 'No clients yet — add your first one'}</p>
            {!search && <button onClick={() => setModal('add')} className="btn-primary text-xs">+ Add Client</button>}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map(c => (
              <div key={c.id} className="card p-4 hover:border-green-500/20 transition-colors animate-feed-item">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-semibold text-white">{c.name}</div>
                    {c.email && <div className="text-xs text-slate-400 mt-0.5">{c.email}</div>}
                    {c.phone && <div className="text-xs text-slate-500">{c.phone}</div>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setModal(c)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-500 hover:text-slate-200 transition-colors text-xs">✎</button>
                    <button onClick={() => setDeleting(c)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors text-xs">✕</button>
                  </div>
                </div>
                {c.notes && <p className="text-xs text-slate-500 mb-3 line-clamp-2">{c.notes}</p>}
                <div className="flex items-center gap-2 pt-2 border-t border-white/5">
                  <span className="text-xs text-slate-500">{c.order_count} order{c.order_count !== 1 ? 's' : ''}</span>
                  <button
                    onClick={() => toggleLog(c.id)}
                    className={`text-xs px-2 py-0.5 rounded border transition-colors ${expandedLog[c.id] ? 'border-slate-500/30 text-slate-400 bg-white/5' : 'border-white/8 text-slate-600 hover:text-slate-400 hover:bg-white/5'}`}
                  >
                    {expandedLog[c.id] ? 'Hide log' : 'Log'}
                  </button>
                  <div className="ml-auto flex gap-1.5">
                    <button onClick={() => onGoToOrders(c.id)} className="text-xs px-2 py-1 rounded bg-green-600/15 text-green-400 hover:bg-green-600/25 border border-green-500/20 transition-colors">Orders</button>
                    <button onClick={() => onGoToAssets(c.id)} className="text-xs px-2 py-1 rounded bg-white/5 text-slate-400 hover:bg-white/10 border border-white/10 transition-colors">Assets</button>
                  </div>
                </div>

                {expandedLog[c.id] && <InteractionLog clientId={c.id} />}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit modal */}
      {modal && (
        <Modal title={modal === 'add' ? 'Add Client' : `Edit — ${modal.name}`} onClose={() => setModal(null)}>
          <ClientForm initial={modal === 'add' ? null : modal} onSave={handleSave} onCancel={() => setModal(null)} />
        </Modal>
      )}

      {/* Delete confirm */}
      {deleting && (
        <Modal title="Delete Client" onClose={() => setDeleting(null)}>
          <p className="text-sm text-slate-300 mb-1">Delete <span className="text-white font-semibold">{deleting.name}</span>?</p>
          <p className="text-xs text-slate-500 mb-5">This will also delete all their orders and assets. This cannot be undone.</p>
          <div className="flex gap-2">
            <button onClick={() => handleDelete(deleting.id)} className="btn-danger flex-1">Delete</button>
            <button onClick={() => setDeleting(null)} className="btn-ghost">Cancel</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
