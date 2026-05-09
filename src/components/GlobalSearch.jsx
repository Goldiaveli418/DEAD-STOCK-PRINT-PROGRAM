import React, { useEffect, useState, useRef } from 'react'

function Section({ label, children }) {
  return (
    <div>
      <div className="px-4 py-1.5 text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</div>
      {children}
    </div>
  )
}

function ResultRow({ icon, primary, secondary, onClick }) {
  return (
    <button
      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/5 transition-colors text-left"
      onClick={onClick}
    >
      <span className="text-slate-600 w-4 text-center text-sm">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-slate-200 truncate">{primary}</div>
        {secondary && <div className="text-xs text-slate-500 truncate">{secondary}</div>}
      </div>
    </button>
  )
}

export default function GlobalSearch({ onNavigate, onClose }) {
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState(null)
  const inputRef = useRef()

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    if (query.trim().length < 2) { setResults(null); return }
    const t = setTimeout(async () => {
      const r = await window.api.search.all(query)
      setResults(r)
    }, 150)
    return () => clearTimeout(t)
  }, [query])

  function handleKey(e) {
    if (e.key === 'Escape') onClose()
  }

  const total = results ? results.clients.length + results.orders.length + results.assets.length : 0

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center pt-24 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg mx-4 bg-[#0e1018] rounded-2xl border border-white/10 shadow-2xl overflow-hidden animate-feed-item"
        onClick={e => e.stopPropagation()}
      >
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-white/8">
          <span className="text-slate-500 text-lg">⌕</span>
          <input
            ref={inputRef}
            className="flex-1 bg-transparent text-slate-200 text-sm outline-none placeholder:text-slate-600"
            placeholder="Search orders, clients, assets…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKey}
          />
          <kbd className="text-[10px] text-slate-600 bg-white/5 px-1.5 py-0.5 rounded border border-white/10 shrink-0">Esc</kbd>
        </div>

        {/* Results */}
        {results && total === 0 && (
          <div className="py-8 text-center text-sm text-slate-500">No results for "{query}"</div>
        )}

        {results && total > 0 && (
          <div className="max-h-80 overflow-y-auto py-2">
            {results.clients.length > 0 && (
              <Section label="Clients">
                {results.clients.map(c => (
                  <ResultRow
                    key={c.id} icon="◈"
                    primary={c.name}
                    secondary={[c.email, c.phone].filter(Boolean).join(' · ')}
                    onClick={() => { onNavigate('clients'); onClose() }}
                  />
                ))}
              </Section>
            )}
            {results.orders.length > 0 && (
              <Section label="Orders">
                {results.orders.map(o => (
                  <ResultRow
                    key={o.id} icon="◎"
                    primary={o.title}
                    secondary={o.client_name}
                    onClick={() => { onNavigate('orders'); onClose() }}
                  />
                ))}
              </Section>
            )}
            {results.assets.length > 0 && (
              <Section label="Assets">
                {results.assets.map(a => (
                  <ResultRow
                    key={a.id} icon="⊞"
                    primary={a.name}
                    secondary={[a.client_name, a.shirt_color, a.shirt_brand].filter(Boolean).join(' · ')}
                    onClick={() => { onNavigate('assets'); onClose() }}
                  />
                ))}
              </Section>
            )}
          </div>
        )}

        {!results && (
          <div className="py-6 text-center text-xs text-slate-600">Type at least 2 characters to search</div>
        )}

        <div className="px-4 py-2 border-t border-white/5 flex gap-4 text-[10px] text-slate-600">
          <span><kbd className="bg-white/5 border border-white/10 px-1 rounded">↵</kbd> select</span>
          <span><kbd className="bg-white/5 border border-white/10 px-1 rounded">Esc</kbd> close</span>
          <span className="ml-auto">⌘K to open</span>
        </div>
      </div>
    </div>
  )
}
