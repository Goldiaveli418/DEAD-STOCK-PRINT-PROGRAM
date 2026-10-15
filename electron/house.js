// In-house production: our own blank stock + print runs. Separate from client orders
// and client inventory. Cost = blank landed cost (unit + shipping share) + ink. No labor.
// Good prints become finished pieces in the Back Room; "Send to Deck" hands a piece to Ava
// (Ava Deck) to list on the Dead Stock Cincy site, and her result file flips it to Listed.

const fs   = require('fs')
const path = require('path')
const os   = require('os')

const r2 = n => Math.round((Number(n) || 0) * 100) / 100
const r4 = n => Math.round((Number(n) || 0) * 1e6) / 1e6

function ensure(store) {
  store.houseBlanks   = store.houseBlanks   || []
  store.houseReceipts = store.houseReceipts || []
  store.houseRuns     = store.houseRuns     || []
  store.houseLog      = store.houseLog      || []
  store.houseFinished = store.houseFinished || []
}

const SIZE_ORDER = ['XS','S','M','L','XL','2XL','3XL','4XL']
const pieceKey = (name, style, color) => [name, style, color].map(s => String(s || '').trim().toLowerCase()).join('|')

// Add (or with a negative qty, remove) good prints from a finished piece in the Back Room.
function bumpFinished(store, nextId, now, { name, style, color, size, qty, cost, price }) {
  if (!name || !qty) return null
  const k = pieceKey(name, style, color)
  let f = store.houseFinished.find(x => pieceKey(x.name, x.style, x.color) === k && x.status !== 'listed')
  if (!f) {
    if (qty < 0) return null
    f = { id: nextId(store.houseFinished), name: name.trim(), style, color, sizes: {}, size_costs: {}, cost_total: 0, units: 0,
          price: Number(price) || 0, status: 'back_room', photos: [], shopify_url: '', notes: '', created_at: now() }
    store.houseFinished.push(f)
  }
  f.size_costs = f.size_costs || {}
  f.sizes[size] = Math.max(0, (f.sizes[size] || 0) + qty)
  f.size_costs[size] = f.sizes[size] ? r4((f.size_costs[size] || 0) + qty * cost) : 0
  if (!f.sizes[size]) { delete f.sizes[size]; delete f.size_costs[size] }
  f.units      = Math.max(0, f.units + qty)
  f.cost_total = f.units ? r4(f.cost_total + qty * cost) : 0
  if (price && !f.price) f.price = Number(price)
  if (f.units === 0 && f.status === 'back_room') store.houseFinished = store.houseFinished.filter(x => x !== f)
  return f
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
    product_name:    String(data.product_name || '').trim(),
    retail_price:    Number(data.retail_price) || 0,
    notes:           data.notes || '',
    created_at:      now(),
  }
  store.houseRuns.push(run)
  b.qty_on_hand = (Number(b.qty_on_hand) || 0) - used
  log(store, nextId, now, b.id, -used, `Run #${run.id}: ${run.design || 'untitled'}${mis ? ` (${mis} misprint)` : ''}`)
  if (good && run.product_name) bumpFinished(store, nextId, now, {
    name: run.product_name, style: b.style, color: b.color, size: b.size, qty: good, cost: run.cost_per_good, price: run.retail_price })
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
  if (run.product_name && run.qty_good) bumpFinished(store, nextId, now, {
    name: run.product_name, style: b?.style, color: b?.color, size: b?.size, qty: -run.qty_good, cost: run.cost_per_good })
  store.houseRuns = store.houseRuns.filter(r => r.id !== id)
  return true
}

function updateFinished(store, data) {
  ensure(store)
  const f = store.houseFinished.find(x => x.id === data.id)
  if (!f) return null
  if (data.price !== undefined && data.price !== '') f.price = r2(data.price)
  if (data.notes !== undefined) f.notes = data.notes
  if (Array.isArray(data.photos)) f.photos = data.photos.filter(Boolean)
  return f
}

// ── Hand-off to Ava Deck ─────────────────────────────────────────────────────
const LISTINGS_DIR = path.join(os.homedir(), 'ava', 'inbox', 'listings')
const FLAGS_FILE   = path.join(os.homedir(), 'ava', 'deck-app', 'flags.json')

function requestListing(store, now, id, dirs = {}) {
  ensure(store)
  const f = store.houseFinished.find(x => x.id === id)
  if (!f) return { error: 'Piece not found' }
  if (!f.photos.length) return { error: 'Add at least one photo first' }
  if (!(f.price > 0)) return { error: 'Set a retail price first' }
  const dir   = dirs.listings || LISTINGS_DIR
  const flags = dirs.flags || FLAGS_FILE
  fs.mkdirSync(dir, { recursive: true })
  const file = path.join(dir, `printflow-${f.id}.json`)
  const sizes = SIZE_ORDER.filter(s => f.sizes[s]).map(s => ({
    size: s, qty: f.sizes[s], cost_per_item: r2((f.size_costs?.[s] || 0) / f.sizes[s]) }))
  const req = {
    source: 'PrintFlow', piece_id: f.id, requested_at: now(),
    product_name: f.name, blank_style: f.style, color: f.color, sizes,
    retail_price: f.price, cost_per_item: f.units ? r2(f.cost_total / f.units) : 0,
    photos: f.photos, notes: f.notes,
    result_file: path.join(dir, `printflow-${f.id}.result.json`),
  }
  fs.writeFileSync(file, JSON.stringify(req, null, 2))
  // Flag in the Deck. The Deck builds the prompt itself from `action`; nothing here is free text it runs.
  let list = []
  try { list = JSON.parse(fs.readFileSync(flags, 'utf8')) } catch (_) {}
  const title = `Listing ready: ${f.name}`.slice(0, 80)
  list = list.filter(x => x.title !== title)
  list.push({ title, msg: `${f.units} pcs · ${f.color} · $${f.price.toFixed(2)} · from PrintFlow Back Room`, ts: Date.now() / 1000,
              action: { type: 'listing', file } })
  fs.writeFileSync(flags, JSON.stringify(list, null, 2))
  f.status = 'requested'; f.requested_at = now()
  return f
}

// Ava writes printflow-<id>.result.json ({status:'listed', url} or {status:'failed', error}) when she's done.
function syncResults(store, dirs = {}) {
  ensure(store)
  const dir = dirs.listings || LISTINGS_DIR
  let changed = false
  for (const f of store.houseFinished) {
    if (f.status !== 'requested') continue
    try {
      const r = JSON.parse(fs.readFileSync(path.join(dir, `printflow-${f.id}.result.json`), 'utf8'))
      if (r.status === 'listed') { f.status = 'listed'; f.shopify_url = r.url || ''; f.listed_at = r.listed_at || new Date().toISOString(); changed = true }
      else if (r.status === 'failed') { f.status = 'back_room'; f.notes = `Listing failed: ${r.error || 'unknown'}`; changed = true }
    } catch (_) {}
  }
  return changed
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
  ipcMain.handle('house:finished:list', () => { const st = s(); if (syncResults(st)) save(); return [...st.houseFinished].reverse() })
  ipcMain.handle('house:finished:update', (_, d) => { const r = updateFinished(s(), d); save(); return r })
  ipcMain.handle('house:finished:request', (_, id) => { const r = requestListing(s(), now, id); if (!r.error) save(); return r })
}

module.exports = { register, receive, createRun, deleteRun, adjust, updateBlank, summary, landed, updateFinished, requestListing, syncResults }
