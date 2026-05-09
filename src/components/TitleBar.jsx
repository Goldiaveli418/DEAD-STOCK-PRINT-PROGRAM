import React from 'react'

export default function TitleBar() {
  return (
    <div className="h-10 bg-[#0a0c12] border-b border-white/5 flex items-center justify-between px-4 drag-region shrink-0">
      <div className="flex items-center gap-2 no-drag">
        <div className="w-6 h-6 rounded-md bg-gradient-to-br from-green-500 to-emerald-700 flex items-center justify-center text-white font-bold text-xs shadow-lg shadow-green-500/20">
          P
        </div>
        <span className="text-xs font-semibold text-slate-300 tracking-wider">PRINTFLOW</span>
      </div>
      <div className="flex items-center gap-1 no-drag">
        <button onClick={() => window.api.minimize()} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-500 hover:text-slate-200 transition-colors text-xs">─</button>
        <button onClick={() => window.api.maximize()} className="w-7 h-7 flex items-center justify-center rounded hover:bg-white/10 text-slate-500 hover:text-slate-200 transition-colors text-xs">□</button>
        <button onClick={() => window.api.close()}    className="w-7 h-7 flex items-center justify-center rounded hover:bg-red-500/20 text-slate-500 hover:text-red-400 transition-colors text-xs">✕</button>
      </div>
    </div>
  )
}
