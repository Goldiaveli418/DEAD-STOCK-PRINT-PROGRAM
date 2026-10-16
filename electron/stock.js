// Client stock + order deductions.
// Two pools of blanks:
//   shop   — our own blanks (store.houseBlanks, managed in the In-House tab). Used by in-house runs
//            AND by client orders when the client buys blanks from us.
//   client — blanks a client sends us (store.clientBlanks, managed under each client).
// An order item says which pool with `customer_supplied` and which blank with `blank_style` + shirt_color.
// Stock comes off once, the first time the order reaches Printing or Done.

const house = require('./house')

function ensure(store) {
  store.clientBlanks   = store.clientBlanks   || []
  store.clientBlankLog = store.clientBlankLog || []
  store.houseBlanks    = store.houseBlanks    || []
  store.houseLog       = store.houseLog       || []
}

const norm = s => String(s || '').trim().toLowerCase()
const SIZE_ORDER = ['XS','S','M','L','XL','2XL','3XL','4XL']

function clientLog(store, nextId, now, blank_id, delta, reason) {
  store.clientBlankLog.push({ id: nextId(store.clientBlankLog), blank_id, delta, reason: reason || '', created_at: now() })
}

function listClient(store, clientId) {
  ensure(store)
  return store.clientBlanks
    .filter(b => b.client_id === Number(clientId))
    .sort((a, b) => `${a.style}|${a.color}`.localeCompare(`${b.style}|${b.color}`) || SIZE_ORDER.indexOf(a.size) - SIZE_ORDER.indexOf(b.size))
}

// Blanks a client dropped off / had shipped to us. Lines: { style, color, size, qty }.
function receiveClient(store, nextId, now, { client_id, source, lines }) {
  ensure(store)
  const cid = Number(client_id)
  const good = (lines || []).map(l => ({ ...l, qty: parseInt(l.qty, 10) || 0 })).filter(l => l.qty > 0 && l.style)
  if (!cid || !good.length) return { error: 'No lines with a quantity' }
  for (const l of good) {
    let b = store.clientBlanks.find(x => x.client_id === cid && norm(x.style) === norm(l.style) && norm(x.color) === norm(l.color) && x.size === String(l.size).toUpperCase())
    if (!b) {
      b = { id: nextId(store.clientBlanks), client_id: cid, style: l.style.trim(), color: (l.color || '').trim(), size: String(l.size || '').toUpperCase(),
            qty_received: 0, qty_on_hand: 0, qty_printed: 0, created_at: now() }
      store.clientBlanks.push(b)
    }
    b.qty_received += l.qty
    b.qty_on_hand  += l.qty
    clientLog(store, nextId, now, b.id, l.qty, `Received${source ? ` · ${source}` : ''}`)
  }
  return { ok: true, units: good.reduce((s, l) => s + l.qty, 0) }
}

function adjustClient(store, nextId, now, { id, delta, reason }) {
  ensure(store)
  const b = store.clientBlanks.find(x => x.id === id)
  const d = parseInt(delta, 10) || 0
  if (!b || !d) return b || null
  b.qty_on_hand = Math.max(0, b.qty_on_hand + d)
  clientLog(store, nextId, now, id, d, reason || 'Manual adjust')
  return b
}

// Distinct style/color choices for the order-item picker, with on-hand and (shop only) cost per size.
function choices(store, { source, client_id }) {
  ensure(store)
  const pool = source === 'client' ? listClient(store, client_id) : store.houseBlanks
  const g = {}
  for (const b of pool) {
    const k = `${b.style}|${b.color}`
    const c = g[k] = g[k] || { style: b.style, color: b.color, on_hand: 0, sizes: {}, costs: {} }
    c.on_hand += Number(b.qty_on_hand) || 0
    c.sizes[b.size] = (c.sizes[b.size] || 0) + (Number(b.qty_on_hand) || 0)
    if (source !== 'client') c.costs[b.size] = Math.round(house.landed(b) * 100) / 100
  }
  return Object.values(g).sort((a, b) => `${a.style}|${a.color}`.localeCompare(`${b.style}|${b.color}`))
}

// Take an order's blanks out of the right pool. Runs once per order.
function deductForOrder(store, nextId, now, order) {
  ensure(store)
  if (!order || order.stock_deducted) return []
  if (!['printing', 'done'].includes(order.status)) return []
  const notes = []
  for (const item of store.orderItems.filter(i => i.order_id === order.id)) {
    if (!item.blank_style) continue
    let sizes = {}
    try { sizes = JSON.parse(item.size_breakdown || '{}') } catch (_) {}
    const fromClient = !!item.customer_supplied
    for (const [sz, raw] of Object.entries(sizes)) {
      const q = parseInt(raw, 10) || 0
      if (!q) continue
      const pool = fromClient ? store.clientBlanks.filter(b => b.client_id === order.client_id) : store.houseBlanks
      const b = pool.find(x => norm(x.style) === norm(item.blank_style) && norm(x.color) === norm(item.shirt_color) && x.size === sz)
      if (!b) { notes.push(`no ${fromClient ? 'client' : 'shop'} stock for ${item.blank_style} ${item.shirt_color} ${sz}`); continue }
      const take = Math.min(q, Number(b.qty_on_hand) || 0)
      if (take < q) notes.push(`short ${q - take} × ${b.style} ${b.color} ${sz}`)
      b.qty_on_hand = (Number(b.qty_on_hand) || 0) - take
      const reason = `Order #${order.id}: ${order.title || ''}`.trim()
      if (fromClient) { b.qty_printed = (b.qty_printed || 0) + take; clientLog(store, nextId, now, b.id, -take, reason) }
      else store.houseLog.push({ id: nextId(store.houseLog), blank_id: b.id, delta: -take, reason, created_at: now() })
    }
  }
  order.stock_deducted = 1
  order.stock_notes = notes.join('; ')
  return notes
}

function register(ipcMain, { getStore, save, nextId, now }) {
  const s = () => { const st = getStore(); ensure(st); return st }
  ipcMain.handle('clientBlanks:list',    (_, cid) => listClient(s(), cid))
  ipcMain.handle('clientBlanks:receive', (_, d) => { const r = receiveClient(s(), nextId, now, d); if (!r.error) save(); return r })
  ipcMain.handle('clientBlanks:adjust',  (_, d) => { const r = adjustClient(s(), nextId, now, d); save(); return r })
  ipcMain.handle('clientBlanks:delete',  (_, id) => { const st = s(); st.clientBlanks = st.clientBlanks.filter(b => b.id !== id); save(); return true })
  ipcMain.handle('stock:choices',        (_, d) => choices(s(), d || {}))
}

module.exports = { register, deductForOrder, receiveClient, adjustClient, choices, listClient }
