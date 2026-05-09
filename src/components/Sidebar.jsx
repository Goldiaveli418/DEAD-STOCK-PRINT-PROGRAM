import React from 'react'

const NAV = [
  { id: 'dashboard', icon: '⬡', label: 'Dashboard' },
  { id: 'clients',   icon: '◈', label: 'Clients'   },
  { id: 'orders',    icon: '◎', label: 'Orders'     },
  { id: 'assets',    icon: '⊞', label: 'Assets'     },
  { id: 'pricing',   icon: '◷', label: 'Pricing'    },
]

export default function Sidebar({ page, setPage }) {
  return (
    <aside className="w-52 h-full flex flex-col bg-[#0a0c12] border-r border-white/5 shrink-0">
      <nav className="flex-1 px-2 pt-3 space-y-0.5">
        {NAV.map(({ id, icon, label }) => (
          <button
            key={id}
            onClick={() => setPage(id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-150 ${
              page === id
                ? 'bg-green-600/20 text-green-300 border border-green-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <span className="text-base w-5 text-center">{icon}</span>
            <span className="font-medium">{label}</span>
          </button>
        ))}
      </nav>
      <div className="px-3 pb-4">
        <div className="p-3 rounded-xl bg-[#0d1017] border border-white/5 text-center">
          <div className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">DTG Workflow</div>
          <div className="text-[10px] text-green-500/60 mt-0.5">PrintFlow v1.0</div>
        </div>
      </div>
    </aside>
  )
}
