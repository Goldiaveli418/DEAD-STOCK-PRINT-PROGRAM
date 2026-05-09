import React, { useEffect, useState, useCallback } from 'react'

const VIEW_LABELS = { day: 'Day', week: 'Week', month: 'Month' }

const STATUS_CLASS = {
  new: 'status-new', art: 'status-art', printing: 'status-printing', done: 'status-done',
}
const STATUS_LABELS = {
  new: 'New', art: 'Art Review', printing: 'Printing', done: 'Done',
}

function startOf(view, date) {
  const d = new Date(date)
  if (view === 'day') { d.setHours(0,0,0,0); return d }
  if (view === 'week') {
    const day = d.getDay()
    d.setDate(d.getDate() - day)
    d.setHours(0,0,0,0)
    return d
  }
  // month
  d.setDate(1); d.setHours(0,0,0,0); return d
}

function endOf(view, date) {
  const d = new Date(date)
  if (view === 'day') { d.setHours(23,59,59,999); return d }
  if (view === 'week') {
    const day = d.getDay()
    d.setDate(d.getDate() + (6 - day))
    d.setHours(23,59,59,999)
    return d
  }
  // month
  d.setMonth(d.getMonth() + 1); d.setDate(0); d.setHours(23,59,59,999); return d
}

function addPeriod(view, date, delta) {
  const d = new Date(date)
  if (view === 'day')   d.setDate(d.getDate() + delta)
  if (view === 'week')  d.setDate(d.getDate() + delta * 7)
  if (view === 'month') d.setMonth(d.getMonth() + delta)
  return d
}

function formatHeader(view, anchor) {
  const s = startOf(view, anchor)
  const e = endOf(view, anchor)
  if (view === 'day') return s.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
  if (view === 'week') {
    const opts = { month: 'short', day: 'numeric' }
    return `${s.toLocaleDateString('en-US', opts)} – ${e.toLocaleDateString('en-US', opts)}, ${e.getFullYear()}`
  }
  return s.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function toYMD(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function getDueSeverity(dueDate) {
  if (!dueDate) return null
  const todayMs = new Date().setHours(0,0,0,0)
  const diffDays = Math.round((new Date(dueDate) - todayMs) / 86400000)
  if (diffDays < 0)  return { cls: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',       label: `${Math.abs(diffDays)}d overdue` }
  if (diffDays === 0) return { cls: 'text-red-400',    bg: 'bg-red-500/10 border-red-500/20',       label: 'Due today' }
  if (diffDays === 1) return { cls: 'text-yellow-400', bg: 'bg-yellow-500/10 border-yellow-500/20', label: 'Due tomorrow' }
  return null
}

function OrderChip({ order }) {
  const due = getDueSeverity(order.due_date)
  return (
    <div className={`px-2 py-1.5 rounded-lg text-xs border transition-colors cursor-default ${due ? due.bg : 'bg-white/5 border-white/8'}`}>
      <div className="flex items-center gap-1.5 flex-wrap">
        {order.is_rush === 1 && <span className="text-red-400 text-[10px]">⚡</span>}
        <span className={`font-medium truncate max-w-[140px] ${due ? due.cls : 'text-slate-200'}`}>{order.title}</span>
        <span className={STATUS_CLASS[order.status] || 'status-new'}>{STATUS_LABELS[order.status] || order.status}</span>
      </div>
      <div className="text-slate-500 mt-0.5 text-[10px] truncate">
        {order.client_name}{order.invoice_number ? ` · ${order.invoice_number}` : ''}
        {due ? ` · ${due.label}` : ''}
      </div>
    </div>
  )
}

function DayCell({ label, isToday, orders, compact }) {
  return (
    <div className={`border border-white/5 rounded-xl p-3 min-h-[80px] flex flex-col gap-2 ${isToday ? 'bg-green-500/5 border-green-500/15' : 'bg-[#0e1018]'}`}>
      <div className={`text-xs font-semibold ${isToday ? 'text-green-300' : 'text-slate-500'}`}>{label}</div>
      {orders.length === 0 ? (
        <div className="text-[10px] text-slate-700 flex-1 flex items-center justify-center">—</div>
      ) : (
        <div className="space-y-1">
          {orders.map(o => <OrderChip key={o.id} order={o} />)}
        </div>
      )}
    </div>
  )
}

export default function Schedule() {
  const [view, setView]     = useState('week')
  const [anchor, setAnchor] = useState(new Date())
  const [orders, setOrders] = useState([])

  const load = useCallback(() => {
    window.api.orders.list(null).then(data => setOrders(data || []))
  }, [])

  useEffect(() => { load() }, [load])

  const todayYMD = toYMD(new Date())
  const s = startOf(view, anchor)
  const e = endOf(view, anchor)

  // Filter orders that have a due_date within the window
  const inWindow = orders.filter(o => {
    if (!o.due_date) return false
    const d = o.due_date
    return d >= toYMD(s) && d <= toYMD(e)
  })

  // Build day buckets
  function buildDays() {
    if (view === 'day') {
      const ymd = toYMD(s)
      return [{ ymd, label: s.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }), orders: inWindow.filter(o => o.due_date === ymd) }]
    }
    if (view === 'week') {
      const days = []
      for (let i = 0; i < 7; i++) {
        const d = new Date(s); d.setDate(d.getDate() + i)
        const ymd = toYMD(d)
        days.push({ ymd, label: d.toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }), orders: inWindow.filter(o => o.due_date === ymd) })
      }
      return days
    }
    // month
    const days = []
    const cur = new Date(s)
    while (cur <= e) {
      const ymd = toYMD(cur)
      days.push({ ymd, label: String(cur.getDate()), orders: inWindow.filter(o => o.due_date === ymd) })
      cur.setDate(cur.getDate() + 1)
    }
    return days
  }

  const days = buildDays()
  const unscheduled = orders.filter(o => !o.due_date && o.status !== 'done')

  const gridCols = view === 'week' ? 'grid-cols-7' : view === 'month' ? 'grid-cols-7' : 'grid-cols-1'

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-bold text-white">Schedule</h1>
            <p className="text-xs text-slate-500">{formatHeader(view, anchor)}</p>
          </div>
          <div className="flex items-center gap-2">
            {/* View selector */}
            <div className="flex rounded-lg border border-white/8 overflow-hidden">
              {Object.entries(VIEW_LABELS).map(([v, l]) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 text-xs transition-colors ${view === v ? 'bg-green-600/25 text-green-300' : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            {/* Nav */}
            <button
              onClick={() => setAnchor(addPeriod(view, anchor, -1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/8 text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-xs"
            >‹</button>
            <button
              onClick={() => setAnchor(new Date())}
              className="px-2.5 h-7 text-xs rounded-lg border border-white/8 text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            >Today</button>
            <button
              onClick={() => setAnchor(addPeriod(view, anchor, 1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg border border-white/8 text-slate-400 hover:text-white hover:bg-white/5 transition-colors text-xs"
            >›</button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {/* Day-of-week labels for week/month */}
        {(view === 'week' || view === 'month') && (
          <div className="grid grid-cols-7 gap-2">
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d => (
              <div key={d} className="text-[10px] text-slate-600 text-center font-semibold uppercase tracking-wider">{d}</div>
            ))}
          </div>
        )}

        {/* Grid */}
        <div className={`grid ${gridCols} gap-2`}>
          {view === 'month' && (() => {
            const firstDay = new Date(s).getDay()
            const blanks = Array(firstDay).fill(null)
            return [
              ...blanks.map((_, i) => <div key={`blank-${i}`} />),
              ...days.map(({ ymd, label, orders: dayOrders }) => (
                <DayCell key={ymd} label={label} isToday={ymd === todayYMD} orders={dayOrders} />
              ))
            ]
          })()}
          {view !== 'month' && days.map(({ ymd, label, orders: dayOrders }) => (
            <DayCell key={ymd} label={label} isToday={ymd === todayYMD} orders={dayOrders} />
          ))}
        </div>

        {/* Unscheduled orders */}
        {unscheduled.length > 0 && (
          <div>
            <div className="text-xs text-slate-500 font-semibold mb-2 uppercase tracking-wider">No due date</div>
            <div className="flex flex-wrap gap-2">
              {unscheduled.map(o => <OrderChip key={o.id} order={o} />)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
