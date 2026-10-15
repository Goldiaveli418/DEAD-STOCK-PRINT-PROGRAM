// In-house production: our own blank stock + print runs. Separate from client orders
// and client inventory. Cost = blank landed cost (unit + shipping share) + ink. No labor.

const r2 = n => Math.round((Number(n) || 0) * 100) / 100
const r4 = n => Math.round((Number(n) || 0) * 1e6) / 1e6

function ensure(store) {
  store.houseBlanks   = store.houseBlanks   || []
  store.houseReceipts = store.houseReceipts || []
  store.houseRuns     = store.houseRuns     || []
  store.houseLog      = store.houseLog      || []
}

function landed(b) {
  return r4((Number(b.unit_cost) || 0) + (Number(b.ship_per_unit) || 0))
}

function log(store, nextId, now, blank_id, delta, reason) {
  store.houseLog.push({ id: nextId(store.houseLog), blank_id, delta, reason: reason || '', created_at: now() })
}

function key(sku, style, color, size) {
  return sku ? `sku:${String(sku).trim().toUpperCase()}` : `ssc:${[style, color, size].map(s => String(s || '').trim().toLowerCase()).join('|')}`
}

// Receive a supplier order. Shipping is spread evenly across every unit in the order.
// Existing blanks (same SKU, or same style/color/size if no SKU) get topped up and their
// cost becomes the weighted average of old stock and the new landed cost.
function receive(store, nextId, now, data) {
  ensure(store)
  const lines = (data.lines || [])
    .map(l => ({ ...l, qty: parseInt(l.qty, 10) || 0, unit_cost: Number(l.unit_cost) || 0 }))
    .filter(l => l.qty > 0 && (l.sku || l.style))
  if (!lines.length) return { error: 'No lines with a quantity' }

  const units    = lines.reduce((s, l) => s + l.qty, 0)
  const shipping = Number(data.shipping) || 0
  const shipPer  = units ? shipping / units : 0
  const receipt  = {
    id:          nextId(store.houseReceipts),
    supplier:    data.supplier || '',
    order_no:    data.order_no || '',
    received_on: data.received_on || now().slice(0, 10),
    subtotal:    r2(lines.reduce((s, l) => s + l.qty * l.unit_cost, 0)),
    shipping:    r2(shipping),
    units,
    created_at:  now(),
  }
  store.houseReceipts.push(receipt)

  for (const l of lines) {
    const k   = key(l.sku, l.style, l.color, l.size)
    let   b   = store.houseBlanks.find(x => key(x.sku, x.style, x.color, x.size) === k)
    const newLanded = l.unit_cost + shipPer
    if (b) {
      const oldQty = Number(b.qty_on_hand) || 0
      const avg    = oldQty + l.qty ? (oldQty * landed(b) + l.qty * newLanded) / (oldQty + l.qty) : newLanded
      b.unit_cost     = r4(avg - shipPer)
      b.ship_per_unit = r4(shipPer)
      b.qty_on_hand   = oldQty + l.qty
      b.qty_received  = (Number(b.qty_received) || 0) + l.qty
      b.supplier      = receipt.supplier || b.supplier
    } else {
      b = {
        id:            nextId(store.houseBlanks),
        sku:           String(l.sku || '').trim().toUpperCase(),
        style:         l.style || '',
        color:         l.color || '',
        size:          l.size || '',
        supplier:      receipt.supplier,
        unit_cost:     r2(l.unit_cost),
        ship_per_unit: r4(shipPer),
        qty_on_hand:   l.qty,
        qty_received:  l.qty,
        reorder_point: 2,
        notes:         '',
        created_at:    now(),
      }
      store.houseBlanks.push(b)
    }
    log(store, nextId, now, b.id, l.qty, `Received ${receipt.supplier} ${receipt.order_no}`.trim())
  }
  return receipt
}

function updateBlank(store, data) {
  ensure(store)
  const b = store.houseBlanks.find(x => x.id === data.id)
  if (!b) return null
  for (const f of ['sku', 'style', 'color', 'size', 'supplier', 'notes']) if (data[f] !== undefined) b[f] = data[f]
  for (const f of ['unit_cost', 'ship_per_unit']) if (data[f] !== undefined && data[f] !== '') b[f] = r4(data[f])
  if (data.reorder_point !== undefined && data.reorder_point !== '') b.reorder_point = parseInt(data.reorder_point, 10) || 0
  return b
}

function adjust(store, nextId, now, { id, delta, reason }) {
  ensure(store)
  const b = store.houseBlanks.find(x => x.id === id)
  const d = parseInt(delta, 10) || 0
  if (!b || !d) return b || null
  b.qty_on_hand = Math.max(0, (Number(b.qty_on_hand) || 0) + d)
  log(store, nextId, now, id, d, reason || 'Manual adjust')
  return b
}

// Log a print run. Good + misprints both consume blanks. Cost per good piece carries the
// misprint waste, so a run with misprints shows its true cost.
function createRun(store, nextId, now, data) {
  ensure(store)
  const b    = store.houseBlanks.find(x => x.id === Number(data.blank_id))
  if (!b) return { error: 'Pick a blank' }
  const good = parseInt(data.qty_good, 10) || 0
  const mis  = parseInt(data.qty_misprint, 10) || 0
  const used = good + mis
  if (used <= 0) return { error: 'Enter how many you printed' }
  if (used > (Number(b.qty_on_hand) || 0)) return { error: `Only ${b.qty_on_hand} of that blank on hand` }

  const blankCost = landed(b)
  const inkCost   = r2(data.ink_per_piece)
  const total     = r2(used * (blankCost + inkCost))
  const run = {
    id:              nextId(store.houseRuns),
    printed_on:      data.printed_on || now().slice(0, 10),
    design:          data.design || '',
    asset_id:        data.asset_id ? Number(data.asset_id) : null,
    blank_id:        b.id,
    blank_label:     [b.style, b.color, b.size].filter(Boolean).join(' / '),
    sku:             b.sku,
    qty_good:        good,
    qty_misprint:    mis,
    blank_cost:      blankCost,
    ink_per_piece:   inkCost,
    total_cost:      total,
    cost_per_good:   good ? r2(total / good) : 0,
    notes:           data.notes || '',
    created_at:      now(),
  }
  store.houseRuns.push(run)
  b.qty_on_hand = (Number(b.qty_on_hand) || 0) - used
  log(store, nextId, now, b.id, -used, `Run #${run.id}: ${run.design || 'untitled'}${mis ? ` (${mis} misprint)` : ''}`)
  return run
}

// Deleting a run puts its blanks back on the shelf.
function deleteRun(store, nextId, now, id) {
  ensure(store)
  const run = store.houseRuns.find(r => r.id === id)
  if (!run) return false
  const b = store.houseBlanks.find(x => x.id === run.blank_id)
  const used = run.qty_good + run.qty_misprint
  if (b) {
    b.qty_on_hand = (Number(b.qty_on_hand) || 0) + used
    log(store, nextId, now, b.id, used, `Run #${run.id} deleted`)
  }
  store.houseRuns = store.houseRuns.filter(r => r.id !== id)
  return true
}

function summary(store) {
  ensure(store)
  const runs  = store.houseRuns
  const good  = runs.reduce((s, r) => s + r.qty_good, 0)
  const mis   = runs.reduce((s, r) => s + r.qty_misprint, 0)
  const spent = r2(runs.reduce((s, r) => s + r.total_cost, 0))
  return {
    blanks_on_hand: store.houseBlanks.reduce((s, b) => s + (Number(b.qty_on_hand) || 0), 0),
    stock_value:    r2(store.houseBlanks.reduce((s, b) => s + (Number(b.qty_on_hand) || 0) * landed(b), 0)),
    low_count:      store.houseBlanks.filter(b => (Number(b.qty_on_hand) || 0) <= (Number(b.reorder_point) || 0)).length,
    printed_good:   good,
    misprints:      mis,
    misprint_rate:  good + mis ? mis / (good + mis) : 0,
    spent,
    avg_cost_per_good: good ? r2(spent / good) : 0,
  }
}

function register(ipcMain, ctx) {
  const { getStore, save, nextId, now } = ctx
  const s = () => { const st = getStore(); ensure(st); return st }
  const sortKey = b => `${b.style}|${b.color}|${['XS','S','M','L','XL','2XL','3XL','4XL'].indexOf(b.size)}`

  ipcMain.handle('house:blanks:list', () => [...s().houseBlanks]
    .map(b => ({ ...b, landed_cost: landed(b) }))
    .sort((a, b) => sortKey(a).localeCompare(sortKey(b), undefined, { numeric: true })))
  ipcMain.handle('house:blanks:update', (_, d) => { const r = updateBlank(s(), d); save(); return r })
  ipcMain.handle('house:blanks:adjust', (_, d) => { const r = adjust(s(), nextId, now, d); save(); return r })
  ipcMain.handle('house:blanks:delete', (_, id) => { const st = s(); st.houseBlanks = st.houseBlanks.filter(b => b.id !== id); save(); return true })
  ipcMain.handle('house:receive', (_, d) => { const r = receive(s(), nextId, now, d); if (!r.error) save(); return r })
  ipcMain.handle('house:receipts:list', () => [...s().houseReceipts].reverse())
  ipcMain.handle('house:runs:list', () => [...s().houseRuns].reverse())
  ipcMain.handle('house:runs:create', (_, d) => { const r = createRun(s(), nextId, now, d); if (!r.error) save(); return r })
  ipcMain.handle('house:runs:delete', (_, id) => { const r = deleteRun(s(), nextId, now, id); save(); return r })
  ipcMain.handle('house:summary', () => summary(s()))
}

module.exports = { register, receive, createRun, deleteRun, adjust, updateBlank, summary, landed }
