import React, { useEffect, useState, useCallback } from 'react'

const STATUS_LABELS = {
  new: 'New', art: 'Art Review', printing: 'Printing', done: 'Done',
}
const STATUS_CLASS = {
  new: 'status-new', art: 'status-art', printing: 'status-printing', done: 'status-done',
}

function ProgressBar({ done, total }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{
            width: `${pct}%`,
            background: pct === 100 ? '#22c55e' : pct > 0 ? '#3b82f6' : 'transparent',
          }}
        />
      </div>
      <span className={`text-[10px] font-mono tabular-nums shrink-0 ${pct === 100 ? 'text-green-400' : 'text-slate-500'}`}>
        {done}/{total}
      </span>
    </div>
  )
}

export default function Production() {
  const [orders, setOrders] = useState([])
  const [collapsed, setCollapsed] = useState({})

  const load = useCallback(() => {
    window.api.orderItems.listActive().then(setOrders)
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleItem(itemId, current) {
    await window.api.orderItems.setComplete({ id: itemId, completed: !current })
    setOrders(prev => prev.map(o => ({
      ...o,
      items: o.items.map(i => i.id === itemId ? { ...i, completed: current ? 0 : 1 } : i),
    })))
  }

  function toggleCollapse(orderId) {
    setCollapsed(c => ({ ...c, [orderId]: !c[orderId] }))
  }

  const totalItems = orders.reduce((s, o) => s + o.items.length, 0)
  const totalDone  = orders.reduce((s, o) => s + o.items.filter(i => i.completed).length, 0)

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-white/5 shrink-0">
        <div className="flex items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-lg font-bold text-white">Production</h1>
            <p className="text-xs text-slate-500">{orders.length} active order{orders.length !== 1 ? 's' : ''}</p>
          </div>
          {totalItems > 0 && (
            <div className="text-right shrink-0">
              <div className="text-xs text-slate-500 mb-1">{totalDone} of {totalItems} items complete</div>
              <ProgressBar done={totalDone} total={totalItems} />
            </div>
          )}
        </div>
      </div>

      {/* Order list */}
      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-500">
            <span className="text-4xl opacity-30">✓</span>
            <p className="text-sm">No active orders</p>
          </div>
        ) : orders.map(order => {
          const items = order.items || []
          const done  = items.filter(i => i.completed).length
          const isCollapsed = !!collapsed[order.id]
          const allDone = items.length > 0 && done === items.length

          return (
            <div
              key={order.id}
              className={`rounded-xl border transition-colors ${allDone ? 'bg-[#0d1a12] border-green-500/20' : 'bg-[#0e1018] border-white/5'}`}
            >
              {/* Order header */}
              <button
                type="button"
                className="w-full text-left px-4 py-3 flex items-center gap-3"
                onClick={() => toggleCollapse(order.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {order.is_rush === 1 && <span className="text-xs text-red-400">⚡</span>}
                    <span className={`font-semibold text-sm truncate ${allDone ? 'text-green-300' : 'text-white'}`}>{order.title}</span>
                    <span className={STATUS_CLASS[order.status] || 'status-new'}>{STATUS_LABELS[order.status] || order.status}</span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{order.client_name}</span>
                    {order.due_date && <span>Due {order.due_date}</span>}
                    <span>{order.garment_qty || 0} pcs</span>
                  </div>
                </div>
                <div className="shrink-0 w-36">
                  <ProgressBar done={done} total={items.length} />
                </div>
                <span className="text-slate-600 text-xs shrink-0 ml-1">{isCollapsed ? '▶' : '▼'}</span>
              </button>

              {/* Item checklist */}
              {!isCollapsed && items.length > 0 && (
                <div className="px-4 pb-3 space-y-1 border-t border-white/5 pt-2">
                  {items.map(item => {
                    const checked = !!item.completed
                    const qty = Number(item.quantity) || 0
                    const garmentLabel = [item.shirt_brand, item.shirt_color].filter(Boolean).join(' · ')
                    const descLabel = [item.description, item.print_type_name].filter(Boolean).join(' — ')

                    return (
                      <label
                        key={item.id}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-colors select-none ${checked ? 'bg-green-500/8 hover:bg-green-500/12' : 'bg-black/20 hover:bg-white/5'}`}
                      >
                        {/* Checkbox */}
                        <div
                          onClick={() => toggleItem(item.id, checked)}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${checked ? 'bg-green-500 border-green-500' : 'border-white/20 bg-transparent'}`}
                        >
                          {checked && (
                            <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                              <path d="M1 4L4 7L10 1" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          )}
                        </div>

                        {/* Item info */}
                        <div className="flex-1 min-w-0" onClick={() => toggleItem(item.id, checked)}>
                          <div className={`text-sm font-medium truncate ${checked ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                            {garmentLabel || descLabel || `Item`}
                          </div>
                          {descLabel && garmentLabel && (
                            <div className={`text-[11px] truncate ${checked ? 'text-slate-600' : 'text-slate-500'}`}>{descLabel}</div>
                          )}
                        </div>

                        {/* Qty badge */}
                        <div className={`text-xs font-mono shrink-0 px-2 py-0.5 rounded-full ${checked ? 'bg-green-500/15 text-green-500/60' : 'bg-white/5 text-slate-400'}`}>
                          {qty} pc{qty !== 1 ? 's' : ''}
                        </div>
                      </label>
                    )
                  })}

                  {items.length > 1 && done < items.length && (
                    <button
                      type="button"
                      onClick={() => Promise.all(items.filter(i => !i.completed).map(i => toggleItem(i.id, false)))}
                      className="w-full text-[11px] text-slate-600 hover:text-green-400 py-1 transition-colors"
                    >
                      Mark all complete
                    </button>
                  )}
                </div>
              )}

              {items.length === 0 && !isCollapsed && (
                <div className="px-4 pb-3 pt-2 text-xs text-slate-600 border-t border-white/5">No items on this order.</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
