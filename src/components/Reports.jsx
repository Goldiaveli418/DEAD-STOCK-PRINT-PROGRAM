import React, { useEffect, useState, useCallback } from 'react'

function fmt(n) { return Number(n || 0).toFixed(2) }
function fmtPct(n) { return `${Number(n || 0).toFixed(1)}%` }

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`rounded-xl border p-4 ${accent ? 'bg-green-500/5 border-green-500/20' : 'bg-[#0e1018] border-white/5'}`}>
      <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono tabular-nums ${accent ? 'text-green-300' : 'text-white'}`}>${value}</div>
      {sub && <div className="text-xs text-slate-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <div className="text-xs text-slate-500 font-semibold uppercase tracking-wider mb-3">{title}</div>
      {children}
    </div>
  )
}

const PRESETS = [
  { label: 'This month', get: () => {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth(), 1)
    const to   = new Date(now.getFullYear(), now.getMonth()+1, 0)
    return { from: toYMD(from), to: toYMD(to) }
  }},
  { label: 'Last month', get: () => {
    const now = new Date()
    const from = new Date(now.getFullYear(), now.getMonth()-1, 1)
    const to   = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from: toYMD(from), to: toYMD(to) }
  }},
  { label: 'Last 30 days', get: () => {
    const to   = new Date()
    const from = new Date(); from.setDate(from.getDate()-30)
    return { from: toYMD(from), to: toYMD(to) }
  }},
  { label: 'This year', get: () => {
    const now = new Date()
    return { from: `${now.getFullYear()}-01-01`, to: `${now.getFullYear()}-12-31` }
  }},
]

function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

export default function Reports() {
  const today = toYMD(new Date())
  const thisMonthStart = (() => { const d = new Date(); d.setDate(1); return toYMD(d) })()

  const [from, setFrom] = useState(thisMonthStart)
  const [to, setTo]     = useState(today)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const result = await window.api.reports.get({ from, to })
      setData(result)
    } finally {
      setLoading(false)
    }
  }, [from, to])

  useEffect(() => { load() }, [load])

  function applyPreset(preset) {
    const { from: f, to: t } = preset.get()
    setFrom(f); setTo(t)
  }

  const margin = data?.revenue > 0 ? ((data.profit / data.revenue) * 100) : 0

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-white">Reports</h1>
            <p className="text-xs text-slate-500">Financial breakdown by date range</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Presets */}
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className="px-2.5 h-7 text-xs rounded-lg border border-white/8 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-1.5">
              <input
                type="date"
                className="input-sm w-36"
                value={from}
                onChange={e => setFrom(e.target.value)}
              />
              <span className="text-slate-600 text-xs">→</span>
              <input
                type="date"
                className="input-sm w-36"
                value={to}
                onChange={e => setTo(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {loading && (
          <div className="text-center text-slate-600 py-12 text-sm">Loading…</div>
        )}

        {!loading && data && (
          <>
            {/* Top stats */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard label="Revenue" value={fmt(data.revenue)} accent />
              <StatCard label="Profit" value={fmt(data.profit)} sub={`${fmtPct(margin)} margin`} />
              <StatCard label="Orders" value={data.orderCount || 0} sub={`${data.paidCount || 0} paid`} />
              <StatCard label="Pieces" value={data.totalPieces || 0} />
            </div>

            {/* Cost breakdown */}
            <Section title="Cost Breakdown">
              <div className="rounded-xl border border-white/5 bg-[#0e1018] overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/5">
                      <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-semibold">Category</th>
                      <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-semibold">Amount</th>
                      <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-semibold">% of Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Garment Cost',      val: data.garmentCost,  key: 'garment' },
                      { label: 'Ink Cost',           val: data.inkCost,      key: 'ink' },
                      { label: 'Labor',              val: data.laborCost,    key: 'labor' },
                    ].map(row => (
                      <tr key={row.key} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                        <td className="px-4 py-2.5 text-slate-300">{row.label}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-300">${fmt(row.val)}</td>
                        <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                          {data.revenue > 0 ? fmtPct((row.val / data.revenue) * 100) : '—'}
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-white/3">
                      <td className="px-4 py-2.5 text-xs text-slate-500 font-semibold">Total Costs</td>
                      <td className="px-4 py-2.5 text-right font-mono font-semibold text-slate-300">${fmt((data.garmentCost||0) + (data.inkCost||0) + (data.laborCost||0))}</td>
                      <td className="px-4 py-2.5 text-right font-mono text-slate-500">
                        {data.revenue > 0 ? fmtPct((((data.garmentCost||0) + (data.inkCost||0) + (data.laborCost||0)) / data.revenue) * 100) : '—'}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Section>

            {/* Operator / House split */}
            {(data.operatorEarnings > 0 || data.houseEarnings > 0) && (
              <Section title="Earnings Split">
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl border border-white/5 bg-[#0e1018] p-4">
                    <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">Operator (Labor)</div>
                    <div className="text-xl font-bold font-mono text-white">${fmt(data.operatorEarnings)}</div>
                    {data.revenue > 0 && <div className="text-xs text-slate-600 mt-0.5">{fmtPct((data.operatorEarnings/data.revenue)*100)} of revenue</div>}
                  </div>
                  <div className="rounded-xl border border-white/5 bg-[#0e1018] p-4">
                    <div className="text-[11px] text-slate-500 uppercase tracking-wider mb-1">House (Profit)</div>
                    <div className="text-xl font-bold font-mono text-white">${fmt(data.houseEarnings)}</div>
                    {data.revenue > 0 && <div className="text-xs text-slate-600 mt-0.5">{fmtPct((data.houseEarnings/data.revenue)*100)} of revenue</div>}
                  </div>
                </div>
              </Section>
            )}

            {/* Orders by status */}
            <Section title="Orders by Status">
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.byStatus || {}).map(([status, count]) => (
                  <div key={status} className="px-3 py-2 rounded-lg border border-white/5 bg-[#0e1018] text-center min-w-[80px]">
                    <div className="text-lg font-bold font-mono text-white">{count}</div>
                    <div className="text-[10px] text-slate-500 capitalize">{status}</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* Top clients */}
            {data.byClient?.length > 0 && (
              <Section title="Top Clients">
                <div className="rounded-xl border border-white/5 bg-[#0e1018] overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="text-left px-4 py-2.5 text-xs text-slate-500 font-semibold">Client</th>
                        <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-semibold">Orders</th>
                        <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-semibold">Revenue</th>
                        <th className="text-right px-4 py-2.5 text-xs text-slate-500 font-semibold">Pieces</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byClient.slice(0, 10).map((c, i) => (
                        <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                          <td className="px-4 py-2.5 text-slate-300 font-medium">{c.name}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-400">{c.orderCount}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-300">${fmt(c.revenue)}</td>
                          <td className="px-4 py-2.5 text-right font-mono text-slate-400">{c.pieces}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {data.orderCount === 0 && (
              <div className="text-center py-12 text-slate-600 text-sm">No orders in this date range</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
