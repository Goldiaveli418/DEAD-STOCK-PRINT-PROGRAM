import React, { useEffect, useState, useCallback } from 'react'

const EXT_ICON = {
  png: '🖼', jpg: '🖼', jpeg: '🖼', svg: '✦', pdf: '📄',
  ai: '✦', psd: '🎨', eps: '✦', tiff: '🖼', tif: '🖼',
}

function extOf(path) {
  return (path || '').split('.').pop().toLowerCase()
}

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="card-glow w-full max-w-lg p-6 mx-4 animate-feed-item">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-200 text-lg leading-none transition-colors">✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function AssetForm({ initial, clients, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { client_id: clients[0]?.id || '', name: '', file_path: '', notes: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function pickFile() {
    const paths = await window.api.openFile()
    if (paths.length > 0) {
      set('file_path', paths[0])
      if (!form.name) {
        const parts = paths[0].split(/[\\/]/)
        set('name', parts[parts.length - 1].replace(/\.[^.]+$/, ''))
      }
    }
  }

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form) }} className="space-y-4">
      <div>
        <label className="label">Client *</label>
        <select className="input" value={form.client_id} onChange={e => set('client_id', e.target.value)} required>
          <option value="">Select client…</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      <div>
        <label className="label">Asset Name *</label>
        <input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Summer Drop Logo v2" required />
      </div>
      <div>
        <label className="label">File Path *</label>
        <div className="flex gap-2">
          <input className="input flex-1 font-mono text-xs" value={form.file_path} onChange={e => set('file_path', e.target.value)} placeholder="/Users/you/Designs/logo.png" required />
          <button type="button" onClick={pickFile} className="btn-ghost whitespace-nowrap text-xs">Browse…</button>
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input resize-none" rows={2} value={form.notes} onChange={e => set('notes', e.target.value)} placeholder="Color info, version notes…" />
      </div>
      <div className="flex gap-2 pt-1">
        <button type="submit" className="btn-primary flex-1">{initial?.id ? 'Save Changes' : 'Add Asset'}</button>
        <button type="button" onClick={onCancel} className="btn-ghost">Cancel</button>
      </div>
    </form>
  )
}

export default function Assets({ clientFilter, onClearFilter }) {
  const [assets, setAssets] = useState([])
  const [clients, setClients] = useState([])
  const [modal, setModal] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [search, setSearch] = useState('')

  const load = useCallback(() => {
    window.api.assets.list(clientFilter || undefined).then(setAssets)
  }, [clientFilter])

  useEffect(() => {
    load()
    window.api.clients.list().then(setClients)
  }, [load])

  async function handleSave(form) {
    if (form.id) {
      await window.api.assets.update(form)
    } else {
      await window.api.assets.create(form)
    }
    setModal(null)
    load()
  }

  async function handleDelete(id) {
    await window.api.assets.delete(id)
    setDeleting(null)
    load()
  }

  async function handleBulkAdd() {
    const paths = await window.api.openFile()
    if (!paths.length) return
    const clientId = clientFilter || clients[0]?.id
    if (!clientId) return
    for (const p of paths) {
      const parts = p.split(/[\\/]/)
      const name = parts[parts.length - 1].replace(/\.[^.]+$/, '')
      await window.api.assets.create({ client_id: clientId, name, file_path: p, notes: '' })
    }
    load()
  }

  const clientName = clientFilter ? clients.find(c => c.id === clientFilter)?.name : null

  const filtered = assets.filter(a =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.client_name.toLowerCase().includes(search.toLowerCase()) ||
    (a.file_path || '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="px-6 py-4 border-b border-white/5 shrink-0 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            Assets
            {clientName && (
              <span className="text-sm font-normal text-green-400 flex items-center gap-1">
                — {clientName}
                <button onClick={onClearFilter} className="ml-1 text-slate-500 hover:text-slate-200 text-xs">✕</button>
              </span>
            )}
          </h1>
          <p className="text-xs text-slate-500">{filtered.length} file{filtered.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <input className="input w-44" placeholder="Search assets…" value={search} onChange={e => setSearch(e.target.value)} />
          <button onClick={handleBulkAdd} className="btn-ghost text-xs whitespace-nowrap">+ Bulk Add</button>
          <button onClick={() => setModal('add')} className="btn-primary whitespace-nowrap">+ Add Asset</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <span className="text-4xl opacity-30">⊞</span>
            <p className="text-sm">No assets yet</p>
            <button onClick={() => setModal('add')} className="btn-primary text-xs">+ Add Asset</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {filtered.map(a => {
              const ext = extOf(a.file_path)
              const icon = EXT_ICON[ext] || '📁'
              return (
                <div key={a.id} className="card p-4 hover:border-green-500/15 transition-colors animate-feed-item">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[#181c2a] border border-white/5 flex items-center justify-center text-xl shrink-0">
                      {icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-white text-sm truncate">{a.name}</div>
                      <div className="text-xs text-green-400/70 mb-0.5">{a.client_name}</div>
                      <div className="text-[10px] text-slate-500 font-mono truncate">{a.file_path}</div>
                      {a.notes && <div className="text-xs text-slate-500 mt-1 line-clamp-1">{a.notes}</div>}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => setModal(a)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-500 hover:text-slate-200 transition-colors text-xs">✎</button>
                      <button onClick={() => setDeleting(a)} className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors text-xs">✕</button>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] font-mono text-slate-600 uppercase">{ext || 'file'}</span>
                    <span className="text-[10px] text-slate-600">{new Date(a.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {modal && (
        <Modal title={modal === 'add' ? 'Add Asset' : `Edit Asset`} onClose={() => setModal(null)}>
          <AssetForm
            initial={modal === 'add' ? (clientFilter ? { client_id: clientFilter } : null) : modal}
            clients={clients}
            onSave={handleSave}
            onCancel={() => setModal(null)}
          />
        </Modal>
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="card-glow w-full max-w-sm p-6 mx-4">
            <h2 className="text-base font-semibold text-white mb-2">Remove Asset</h2>
            <p className="text-sm text-slate-300 mb-1">Remove <span className="text-white font-semibold">"{deleting.name}"</span>?</p>
            <p className="text-xs text-slate-500 mb-5">The file itself won't be deleted, just the record.</p>
            <div className="flex gap-2">
              <button onClick={() => handleDelete(deleting.id)} className="btn-danger flex-1">Remove</button>
              <button onClick={() => setDeleting(null)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
