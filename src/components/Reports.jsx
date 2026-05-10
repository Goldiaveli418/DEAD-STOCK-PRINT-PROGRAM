import React, { useEffect, useState, useCallback } from 'react'

function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function fmt(n)    { return Number(n || 0).toFixed(2) }
function fmtN(n)   { return Number(n || 0).toLocaleString() }
function fmtPct(n) { return `${Number(n || 0).toFixed(1)}%` }

const STATUS_LABELS = { new:'New', art:'Art Review', printing:'Printing', done:'Done', shipped:'Shipped', invoiced:'Invoiced' }
const STATUS_COLORS = {
  new:'text-slate-400', art:'text-blue-400', printing:'text-yellow-400',
  done:'text-green-400', shipped:'text-emerald-400', invoiced:'text-purple-400',
}

const PRESETS = [
  { label: 'Today', get: () => { const d = toYMD(new Date()); return { from: d, to: d } } },
  { label: 'This week', get: () => {
    const now = new Date(); const day = now.getDay()
    const s = new Date(now); s.setDate(now.getDate() - day)
    const e = new Date(now); e.setDate(now.getDate() + (6 - day))
    return { from: toYMD(s), to: toYMD(e) }
  }},
  { label: 'This month', get: () => {
    const now = new Date()
    return { from: toYMD(new Date(now.getFullYear(), now.getMonth(), 1)), to: toYMD(new Date(now.getFullYear(), now.getMonth()+1, 0)) }
  }},
  { label: 'Last month', get: () => {
    const now = new Date()
    return { from: toYMD(new Date(now.getFullYear(), now.getMonth()-1, 1)), to: toYMD(new Date(now.getFullYear(), now.getMonth(), 0)) }
  }},
  { label: 'Last 30 days', get: () => {
    const to = new Date(); const from = new Date(); from.setDate(from.getDate()-30)
    return { from: toYMD(from), to: toYMD(to) }
  }},
  { label: 'This year', get: () => {
    const y = new Date().getFullYear()
    return { from: `${y}-01-01`, to: `${y}-12-31` }
  }},
  { label: 'All time', get: () => ({ from: '', to: '' }) },
]

function Stat({ label, value, sub, color, prefix, small }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#0e1018] p-4">
      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{label}</div>
      <div className={`font-bold font-mono tabular-nums ${small ? 'text-xl' : 'text-2xl'} ${color || 'text-white'}`}>
        {prefix || ''}{value}
      </div>
      {sub && <div className="text-[11px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function Section({ title, children, noPad }) {
  return (
    <div>
      <div className="text-[11px] text-slate-500 font-semibold uppercase tracking-widest mb-3">{title}</div>
      {children}
    </div>
  )
}

function Table({ cols, rows }) {
  return (
    <div className="rounded-xl border border-white/5 bg-[#0e1018] overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-white/5">
            {cols.map((c, i) => (
              <th key={i} className={`px-4 py-2.5 text-[11px] text-slate-500 font-semibold ${c.right ? 'text-right' : 'text-left'}`}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
              {cols.map((c, j) => (
                <td key={j} className={`px-4 py-2.5 ${c.right ? 'text-right font-mono' : ''} ${c.cls || 'text-slate-300'}`}>
                  {c.render ? c.render(row) : row[c.key]}
                </td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={cols.length} className="px-4 py-6 text-center text-slate-600 text-xs">No data</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

function MiniBar({ value, max, color }) {
  const pct = max > 0 ? Math.max(2, (value / max) * 100) : 0
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: color || '#22c55e' }} />
      </div>
    </div>
  )
}

function ClientDetail({ client }) {
  const [open, setOpen] = useState(false)
  const margin = client.revenue > 0 ? (client.profit / client.revenue) * 100 : 0
  return (
    <div className="rounded-xl border border-white/5 bg-[#0e1018] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-4 px-4 py-3 hover:bg-white/3 transition-colors text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white text-sm">{client.name}</span>
            {client.outstanding > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-yellow-500/20 bg-yellow-500/10 text-yellow-400">
                ${fmt(client.outstanding)} outstanding
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 mt-0.5">
            {client.orderCount} order{client.orderCount !== 1 ? 's' : ''} · {fmtN(client.pieces)} pcs · ${fmt(client.revenue)} billed
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-sm font-mono font-bold text-green-300">${fmt(client.profit)}</div>
          <div className="text-[10px] text-slate-600">{fmtPct(margin)} margin</div>
        </div>
        <span className="text-slate-600 text-xs shrink-0">{open ? '▼' : '▶'}</span>
      </button>

      {open && (
        <div className="border-t border-white/5">
          {/* Client cost breakdown */}
          <div className="grid grid-cols-4 gap-0 border-b border-white/5">
            {[
              { label: 'Revenue',  val: `$${fmt(client.revenue)}`, color: 'text-white' },
              { label: 'Garments', val: `$${fmt(client.garmentCost)}`, color: 'text-slate-400' },
              { label: 'Ink',      val: `$${fmt(client.inkCost)}`, color: 'text-slate-400' },
              { label: 'Labor',    val: `$${fmt(client.laborCost)}`, color: 'text-slate-400' },
            ].map(s => (
              <div key={s.label} className="px-4 py-2.5 border-r border-white/5 last:border-0">
                <div className="text-[10px] text-slate-600">{s.label}</div>
                <div className={`text-sm font-mono font-semibold ${s.color}`}>{s.val}</div>
              </div>
            ))}
          </div>
          {/* Order list */}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-4 py-2 text-left text-slate-600 font-semibold">Order</th>
                <th className="px-4 py-2 text-left text-slate-600 font-semibold">Invoice</th>
                <th className="px-4 py-2 text-right text-slate-600 font-semibold">Pcs</th>
                <th className="px-4 py-2 text-right text-slate-600 font-semibold">Price</th>
                <th className="px-4 py-2 text-left text-slate-600 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody>
              {client.orders.sort((a,b) => (b.created_at||'').localeCompare(a.created_at||'')).map(o => (
                <tr key={o.id} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                  <td className="px-4 py-2 text-slate-300 truncate max-w-[160px]">{o.title}</td>
                  <td className="px-4 py-2 text-slate-600 font-mono">{o.invoice_number || '—'}</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-400">{o.garment_qty || 0}</td>
                  <td className="px-4 py-2 text-right font-mono text-slate-300">${fmt(o.sell_price)}</td>
                  <td className="px-4 py-2">
                    <span className={`${STATUS_COLORS[o.status] || 'text-slate-400'}`}>
                      {STATUS_LABELS[o.status] || o.status}
                      {o.status === 'invoiced' && <span className={o.paid ? ' · text-green-400' : ' · text-yellow-400'}>{o.paid ? ' Paid' : ' Unpaid'}</span>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default function Reports() {
  const today = toYMD(new Date())
  const [from, setFrom]     = useState(toYMD(new Date(new Date().getFullYear(), new Date().getMonth(), 1)))
  const [to, setTo]         = useState(today)
  const [data, setData]     = useState(null)
  const [loading, setLoading] = useState(false)
  const [activePreset, setActivePreset] = useState('This month')

  const load = useCallback(async () => {
    setLoading(true)
    try { setData(await window.api.reports.get({ from, to })) }
    finally { setLoading(false) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  function applyPreset(p) {
    const { from: f, to: t } = p.get()
    setFrom(f); setTo(t); setActivePreset(p.label)
  }

  const maxDayRevenue = Math.max(...(data?.byDay || []).map(d => d.revenue), 1)
  const maxDayPieces  = Math.max(...(data?.byDay || []).map(d => d.pieces), 1)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-lg font-bold text-white">Reports</h1>
            <p className="text-xs text-slate-500">
              {from && to && from !== to ? `${from} → ${to}` : from === to && from ? from : 'All time'}
            </p>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className={`px-2.5 h-7 text-xs rounded-lg border transition-colors ${activePreset === p.label ? 'bg-green-600/25 text-green-300 border-green-500/30' : 'border-white/8 text-slate-400 hover:text-white hover:bg-white/5'}`}
              >
                {p.label}
              </button>
            ))}
            <div className="flex items-center gap-1.5 ml-1">
              <input type="date" className="input-sm w-36" value={from} onChange={e => { setFrom(e.target.value); setActivePreset('') }} />
              <span className="text-slate-600 text-xs">→</span>
              <input type="date" className="input-sm w-36" value={to} onChange={e => { setTo(e.target.value); setActivePreset('') }} />
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-7">
        {loading && <div className="text-center text-slate-600 py-16 text-sm">Loading…</div>}

        {!loading && data && (
          <>
            {/* ── Top money stats ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Revenue" prefix="$" value={fmt(data.revenue)} sub={`${data.billedOrders} completed orders`} color="text-green-300" />
              <Stat label="Profit"  prefix="$" value={fmt(data.profit)}  sub={`${fmtPct(data.margin)} margin`} color={data.profit >= 0 ? 'text-white' : 'text-red-400'} />
              <Stat label="Pipeline" prefix="$" value={fmt(data.pipelineValue)} sub={`${data.activeOrders} active orders`} color="text-blue-300" />
              <Stat label="Outstanding" prefix="$" value={fmt(data.outstanding)} sub="invoiced, unpaid" color={data.outstanding > 0 ? 'text-yellow-300' : 'text-slate-500'} />
            </div>

            {/* ── Volume stats ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Stat label="Total Orders"  value={fmtN(data.totalOrders)}  sub={`${data.billedOrders} billed · ${data.activeOrders} active`} />
              <Stat label="Pieces Printed" value={fmtN(data.billedPieces)} sub={`${fmtN(data.totalPieces)} total incl. active`} />
              <Stat label="Print Locations" value={fmtN(data.totalPrintLocations)} sub="across all items" />
              <Stat label="Rush Orders" value={fmtN(data.rushOrders)} sub={data.rushRevenue > 0 ? `$${fmt(data.rushRevenue)} billed` : 'none billed yet'} />
            </div>

            {/* ── Averages ── */}
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Avg Order Value"  prefix="$" value={fmt(data.avgOrderValue)}    sub="billed orders only" small />
              <Stat label="Avg Pieces / Order" value={Number(data.avgPiecesPerOrder).toFixed(1)} sub="billed orders only" small />
              <Stat label="Paid Revenue" prefix="$" value={fmt(data.paidRevenue)} sub={`${data.paidOrders} paid invoice${data.paidOrders !== 1 ? 's' : ''}`} color="text-green-400" small />
            </div>

            {/* ── Cost breakdown ── */}
            <Section title="Cost Breakdown">
              <Table
                cols={[
                  { label: 'Category', key: 'label' },
                  { label: 'Amount', right: true, render: r => `$${fmt(r.val)}` },
                  { label: '% of Revenue', right: true, cls: 'text-slate-500', render: r => data.revenue > 0 ? fmtPct((r.val / data.revenue) * 100) : '—' },
                  { label: '% of Cost', right: true, cls: 'text-slate-500', render: r => data.totalCost > 0 ? fmtPct((r.val / data.totalCost) * 100) : '—' },
                ]}
                rows={[
                  { label: 'Garment / Blanks', val: data.garmentCost },
                  { label: 'Ink',              val: data.inkCost },
                  { label: 'Labor',            val: data.laborCost },
                  { label: 'Total Costs',      val: data.totalCost },
                ]}
              />
            </Section>

            {/* ── Earnings split ── */}
            {(data.operatorEarnings > 0 || data.houseEarnings > 0) && (
              <Section title="Operator / House Split">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Operator Earnings', val: data.operatorEarnings },
                    { label: 'House Earnings',    val: data.houseEarnings },
                  ].map(s => (
                    <div key={s.label} className="rounded-xl border border-white/5 bg-[#0e1018] p-4">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">{s.label}</div>
                      <div className="text-2xl font-bold font-mono text-white">${fmt(s.val)}</div>
                      {data.revenue > 0 && <div className="text-xs text-slate-600 mt-0.5">{fmtPct((s.val/data.revenue)*100)} of revenue</div>}
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {/* ── Pipeline by status ── */}
            <Section title="Orders by Status">
              <div className="flex flex-wrap gap-2">
                {Object.entries(data.byStatus).sort((a,b) => {
                  const order = ['new','art','printing','done','shipped','invoiced']
                  return order.indexOf(a[0]) - order.indexOf(b[0])
                }).map(([status, count]) => (
                  <div key={status} className="px-3 py-2.5 rounded-xl border border-white/5 bg-[#0e1018] text-center min-w-[90px]">
                    <div className={`text-xl font-bold font-mono ${STATUS_COLORS[status] || 'text-white'}`}>{count}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5">{STATUS_LABELS[status] || status}</div>
                  </div>
                ))}
              </div>
            </Section>

            {/* ── Outstanding invoices ── */}
            {data.allOutstanding?.length > 0 && (
              <Section title="Outstanding Invoices">
                <Table
                  cols={[
                    { label: 'Order', render: r => r.title },
                    { label: 'Client', render: r => r.client_name, cls: 'text-slate-400' },
                    { label: 'Invoice', render: r => r.invoice_number || '—', cls: 'text-slate-600 font-mono' },
                    { label: 'Amount', right: true, render: r => `$${fmt(r.sell_price)}`, cls: 'text-yellow-300' },
                  ]}
                  rows={data.allOutstanding}
                />
                <div className="mt-2 text-right text-xs text-slate-500">
                  Total outstanding: <span className="text-yellow-300 font-mono font-semibold">${fmt(data.outstanding)}</span>
                </div>
              </Section>
            )}

            {/* ── Daily activity ── */}
            {data.byDay?.length > 0 && (
              <Section title="Daily Activity">
                <div className="rounded-xl border border-white/5 bg-[#0e1018] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/5">
                        <th className="px-4 py-2 text-left text-slate-600 font-semibold">Date</th>
                        <th className="px-4 py-2 text-right text-slate-600 font-semibold">Orders</th>
                        <th className="px-4 py-2 text-right text-slate-600 font-semibold">Pieces</th>
                        <th className="px-3 py-2 w-24 text-left text-slate-600 font-semibold">Pieces</th>
                        <th className="px-4 py-2 text-right text-slate-600 font-semibold">Revenue</th>
                        <th className="px-3 py-2 w-24 text-left text-slate-600 font-semibold">Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byDay.map(d => (
                        <tr key={d.date} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                          <td className="px-4 py-2 font-mono text-slate-400">{d.date}</td>
                          <td className="px-4 py-2 text-right font-mono text-slate-300">{d.orders}</td>
                          <td className="px-4 py-2 text-right font-mono text-slate-300">{d.pieces}</td>
                          <td className="px-3 py-2 w-24"><MiniBar value={d.pieces} max={maxDayPieces} color="#3b82f6" /></td>
                          <td className="px-4 py-2 text-right font-mono text-slate-300">{d.revenue > 0 ? `$${fmt(d.revenue)}` : '—'}</td>
                          <td className="px-3 py-2 w-24"><MiniBar value={d.revenue} max={maxDayRevenue} color="#22c55e" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Section>
            )}

            {/* ── Print type breakdown ── */}
            {data.byPrintType?.length > 0 && (
              <Section title="Print Type Usage">
                <Table
                  cols={[
                    { label: 'Print Type', render: r => r.name },
                    { label: 'Items', right: true, render: r => r.count },
                    { label: 'Pieces', right: true, render: r => fmtN(r.pieces) },
                    { label: '% of Volume', right: true, cls: 'text-slate-500', render: r => data.totalPieces > 0 ? fmtPct((r.pieces / data.totalPieces) * 100) : '—' },
                  ]}
                  rows={data.byPrintType}
                />
              </Section>
            )}

            {/* ── Per-client breakdown ── */}
            {data.byClient?.length > 0 && (
              <Section title="Client Breakdown">
                <div className="space-y-2">
                  {data.byClient.map(c => (
                    <ClientDetail key={c.clientId} client={c} />
                  ))}
                </div>
              </Section>
            )}

            {/* ── Completed orders list ── */}
            {data.completedOrders?.length > 0 && (
              <Section title="Completed Orders">
                <Table
                  cols={[
                    { label: 'Order',    render: r => r.title, cls: 'text-slate-200 font-medium max-w-[180px] truncate' },
                    { label: 'Client',   render: r => r.client_name, cls: 'text-slate-400' },
                    { label: 'Invoice',  render: r => r.invoice_number || '—', cls: 'text-slate-600 font-mono' },
                    { label: 'Pcs',      right: true, render: r => r.garment_qty },
                    { label: 'Revenue',  right: true, render: r => `$${fmt(r.sell_price)}` },
                    { label: 'Cost',     right: true, render: r => `$${fmt((r.garment_cost||0)+(r.ink_cost||0)+(r.labor_cost||0))}`, cls: 'text-slate-500' },
                    { label: 'Profit',   right: true, render: r => `$${fmt(r.profit)}`, cls: r => r.profit >= 0 ? 'text-green-400' : 'text-red-400' },
                    { label: 'Status',   render: r => (
                      <span className={STATUS_COLORS[r.status] || 'text-slate-400'}>
                        {STATUS_LABELS[r.status] || r.status}
                        {r.status === 'invoiced' && <span className={r.paid ? ' text-green-400' : ' text-yellow-400'}>{r.paid ? ' ✓' : ' !'}</span>}
                      </span>
                    )},
                  ]}
                  rows={data.completedOrders}
                />
              </Section>
            )}

            {data.totalOrders === 0 && (
              <div className="text-center py-16 text-slate-600 text-sm">No orders in this date range</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
