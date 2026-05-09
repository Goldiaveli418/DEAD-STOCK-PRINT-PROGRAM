import React, { useEffect, useState } from 'react'

const STATUS_LABEL = {
  new: 'New', art: 'Art Review', printing: 'Printing',
  done: 'Done', shipped: 'Shipped', invoiced: 'Invoiced',
}

const STATUS_CLASS = {
  new: 'status-new', art: 'status-art', printing: 'status-printing',
  done: 'status-done', shipped: 'status-shipped', invoiced: 'status-invoiced',
}

function StatCard({ label, value, sub, green, yellow, red }) {
  const color = green ? 'text-green-400' : yellow ? 'text-yellow-400' : red ? 'text-red-400' : 'text-white'
  return (
    <div className="card-glow p-4">
      <div className="text-xs text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>}
    </div>
  )
}

function dueSeverity(diffDays) {
  if (diffDays < 0)  return { label: `${Math.abs(diffDays)}d overdue`, rowCls: 'bg-red-500/10 border border-red-500/20', badge: 'text-red-400' }
  if (diffDays === 0) return { label: 'Due today',    rowCls: 'bg-red-500/10 border border-red-500/20',    badge: 'text-red-400' }
  if (diffDays === 1) return { label: 'Due tomorrow', rowCls: 'bg-yellow-500/10 border border-yellow-500/20', badge: 'text-yellow-400' }
  return { label: `Due in ${diffDays}d`, rowCls: 'bg-yellow-500/5 border border-yellow-500/10', badge: 'text-yellow-400/70' }
}

export default function Dashboard({ onGoToOrders }) {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    window.api.stats.get().then(setStats)
  }, [])

  if (!stats) return <div className="flex items-center justify-center h-full text-slate-500 text-sm">Loading…</div>

  const margin = stats.revenue > 0 ? ((stats.profit / stats.revenue) * 100).toFixed(1) : '0.0'

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div>
        <h1 className="text-lg font-bold text-white">Dashboard</h1>
        <p className="text-xs text-slate-500 mt-0.5">Overview of your print shop</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Clients"     value={stats.totalClients} />
        <StatCard label="Active Orders"     value={stats.activeOrders} sub={`${stats.totalOrders} total`} />
        <StatCard label="Revenue (billed)"  value={`$${stats.revenue.toFixed(2)}`} green />
        <StatCard label="Profit"            value={`$${stats.profit.toFixed(2)}`} sub={`${margin}% margin`} green />
        <StatCard label="Outstanding"       value={`$${(stats.outstanding || 0).toFixed(2)}`} sub="unpaid invoices" yellow={stats.outstanding > 0} />
        <StatCard label="Rush Orders"       value={stats.rushOrders} red={stats.rushOrders > 0} />
      </div>

      {stats.rushOrders > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          <span className="text-base">⚡</span>
          <span><span className="font-semibold">{stats.rushOrders} rush order{stats.rushOrders !== 1 ? 's' : ''}</span> need attention</span>
        </div>
      )}

      {stats.dueSoonOrders?.length > 0 && (
        <div className="card p-4 space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Due Soon</div>
          {stats.dueSoonOrders.map(o => {
            const { label, rowCls, badge } = dueSeverity(o.diffDays)
            return (
              <div key={o.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg ${rowCls}`}>
                {o.is_rush === 1 && <span className="text-xs text-red-400">⚡</span>}
                <div className="flex-1 min-w-0">
                  <span className="text-sm text-slate-200 font-medium truncate">{o.title}</span>
                  <span className="text-xs text-slate-500 ml-2">{o.client_name}</span>
                </div>
                <span className={STATUS_CLASS[o.status] || 'status-new'}>{STATUS_LABEL[o.status] || o.status}</span>
                <span className={`text-xs font-mono font-semibold shrink-0 ${badge}`}>{label}</span>
              </div>
            )
          })}
        </div>
      )}

      <div className="card p-4">
        <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Recent Orders</div>
        {stats.recentOrders.length === 0 ? (
          <div className="text-sm text-slate-500 py-4 text-center">No orders yet</div>
        ) : (
          <div className="space-y-2">
            {stats.recentOrders.map(o => (
              <div key={o.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0 animate-feed-item">
                <div className="flex items-center gap-3">
                  {o.is_rush === 1 && <span className="text-xs text-red-400">⚡</span>}
                  <div>
                    <div className="text-sm text-slate-200 font-medium">{o.title}</div>
                    <div className="text-xs text-slate-500">{o.client_name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className={STATUS_CLASS[o.status] || 'status-new'}>{STATUS_LABEL[o.status] || o.status}</span>
                  <span className="text-sm font-mono text-green-400">${o.sell_price.toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
