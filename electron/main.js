const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron')
const path = require('path')
const fs = require('fs')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let win
let dataPath
let store = { clients: [], orders: [], orderItems: [], printTypes: [], assets: [] }

// ── JSON store helpers ────────────────────────────────────────────────────────
function load() {
  try {
    if (fs.existsSync(dataPath)) {
      store = JSON.parse(fs.readFileSync(dataPath, 'utf8'))
      store.clients    = store.clients    || []
      store.orders     = store.orders     || []
      store.orderItems = store.orderItems || []
      store.printTypes = store.printTypes || []
      store.assets     = store.assets     || []
    }
  } catch (_) {}
}

function save() {
  fs.writeFileSync(dataPath, JSON.stringify(store, null, 2), 'utf8')
}

function nextId(arr) {
  return arr.length === 0 ? 1 : Math.max(...arr.map(x => x.id)) + 1
}

function now() {
  return new Date().toISOString()
}

function seedPrintTypes() {
  if (store.printTypes.length === 0) {
    store.printTypes = [
      { id: 1, name: 'DTG All-Over',        description: 'All-over sublimation/DTG print',  base_cost: 14.00 },
      { id: 2, name: 'DTG Chest',           description: 'Left chest or small chest print', base_cost: 3.50  },
      { id: 3, name: 'DTG Full Back',       description: 'Full back garment print',          base_cost: 6.00  },
      { id: 4, name: 'DTG Full Front',      description: 'Full front garment print',         base_cost: 6.00  },
      { id: 5, name: 'DTG Full Front + Back', description: 'Full front and back combo',      base_cost: 10.00 },
      { id: 6, name: 'DTG Sleeve',          description: 'Sleeve print',                     base_cost: 2.50  },
    ]
    save()
  }
}

// ── Window ────────────────────────────────────────────────────────────────────
function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    frame: false,
    titleBarStyle: 'hidden',
    backgroundColor: '#080a0f',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }
}

app.whenReady().then(() => {
  dataPath = path.join(app.getPath('userData'), 'printflow.json')
  load()
  seedPrintTypes()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── Shell ─────────────────────────────────────────────────────────────────────
ipcMain.handle('shell:openPath', (_, p) => shell.openPath(p))

// ── Window controls ───────────────────────────────────────────────────────────
ipcMain.on('win:minimize', () => win.minimize())
ipcMain.on('win:maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize())
ipcMain.on('win:close', () => win.close())

// ── File dialog ───────────────────────────────────────────────────────────────
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(win, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images & Designs', extensions: ['png', 'jpg', 'jpeg', 'svg', 'pdf', 'ai', 'psd', 'eps', 'tiff', 'tif'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  })
  return result.canceled ? [] : result.filePaths
})

// ── Clients ───────────────────────────────────────────────────────────────────
ipcMain.handle('clients:list', () => {
  return store.clients
    .map(c => ({
      ...c,
      order_count: store.orders.filter(o => o.client_id === c.id).length,
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
})

ipcMain.handle('clients:create', (_, data) => {
  const client = { id: nextId(store.clients), name: data.name, email: data.email || '', phone: data.phone || '', notes: data.notes || '', created_at: now() }
  store.clients.push(client)
  save()
  return client
})

ipcMain.handle('clients:update', (_, data) => {
  const idx = store.clients.findIndex(c => c.id === data.id)
  if (idx !== -1) { store.clients[idx] = { ...store.clients[idx], name: data.name, email: data.email || '', phone: data.phone || '', notes: data.notes || '' }; save() }
  return store.clients[idx]
})

ipcMain.handle('clients:delete', (_, id) => {
  store.clients     = store.clients.filter(c => c.id !== id)
  const orderIds    = store.orders.filter(o => o.client_id === id).map(o => o.id)
  store.orders      = store.orders.filter(o => o.client_id !== id)
  store.orderItems  = store.orderItems.filter(i => !orderIds.includes(i.order_id))
  store.assets      = store.assets.filter(a => a.client_id !== id)
  save()
  return { ok: true }
})

// ── Orders ────────────────────────────────────────────────────────────────────
ipcMain.handle('orders:list', (_, clientId) => {
  const clientMap = Object.fromEntries(store.clients.map(c => [c.id, c.name]))
  return store.orders
    .filter(o => clientId ? o.client_id === clientId : true)
    .map(o => ({ ...o, client_name: clientMap[o.client_id] || '' }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
})

ipcMain.handle('orders:get', (_, id) => {
  const order = store.orders.find(o => o.id === id)
  if (!order) return null
  const clientMap  = Object.fromEntries(store.clients.map(c => [c.id, c.name]))
  const ptMap      = Object.fromEntries(store.printTypes.map(p => [p.id, p.name]))
  return {
    ...order,
    client_name: clientMap[order.client_id] || '',
    items: store.orderItems
      .filter(i => i.order_id === id)
      .map(i => ({ ...i, print_type_name: ptMap[i.print_type_id] || '' })),
  }
})

ipcMain.handle('orders:create', (_, data) => {
  const order = {
    id: nextId(store.orders),
    client_id:         Number(data.client_id),
    title:             data.title,
    status:            data.status || 'new',
    is_rush:           data.is_rush ? 1 : 0,
    due_date:          data.due_date || '',
    notes:             data.notes || '',
    shirt_brand:       data.shirt_brand || '',
    shirt_color:       data.shirt_color || '',
    garment_qty:       Number(data.garment_qty) || 0,
    customer_supplied: data.customer_supplied ? 1 : 0,
    garment_cost:        data.customer_supplied ? 0 : (Number(data.garment_cost) || 0),
    client_garment_cost: Number(data.client_garment_cost) || 0,
    ink_cost:            Number(data.ink_cost) || 0,
    client_ink_cost:     Number(data.client_ink_cost) || 0,
    labor_cost:          Number(data.labor_cost) || 0,
    sell_price:          Number(data.sell_price) || 0,
    operator_split:      Number(data.operator_split) || 50,
    house_split:         Number(data.house_split) || 50,
    created_at:          now(),
  }
  store.orders.push(order)
  save()
  return order
})

ipcMain.handle('orders:update', (_, data) => {
  const idx = store.orders.findIndex(o => o.id === data.id)
  if (idx !== -1) {
    store.orders[idx] = {
      ...store.orders[idx],
      client_id:         Number(data.client_id),
      title:             data.title,
      status:            data.status,
      is_rush:           data.is_rush ? 1 : 0,
      due_date:          data.due_date || '',
      notes:             data.notes || '',
      shirt_brand:       data.shirt_brand || '',
      shirt_color:       data.shirt_color || '',
      garment_qty:       Number(data.garment_qty) || 0,
      customer_supplied: data.customer_supplied ? 1 : 0,
      garment_cost:        data.customer_supplied ? 0 : (Number(data.garment_cost) || 0),
      client_garment_cost: Number(data.client_garment_cost) || 0,
      ink_cost:            Number(data.ink_cost) || 0,
      client_ink_cost:     Number(data.client_ink_cost) || 0,
      labor_cost:          Number(data.labor_cost) || 0,
      sell_price:          Number(data.sell_price) || 0,
      operator_split:      Number(data.operator_split) || 50,
      house_split:         Number(data.house_split) || 50,
    }
    save()
  }
  return store.orders[idx]
})

ipcMain.handle('orders:delete', (_, id) => {
  store.orders     = store.orders.filter(o => o.id !== id)
  store.orderItems = store.orderItems.filter(i => i.order_id !== id)
  save()
  return { ok: true }
})

ipcMain.handle('orders:duplicate', (_, orderId) => {
  const order = store.orders.find(o => o.id === orderId)
  if (!order) return null
  const newOrder = {
    ...order,
    id:         nextId(store.orders),
    status:     'new',
    sell_price: 0,
    paid:       0,
    created_at: now(),
  }
  store.orders.push(newOrder)
  const srcItems = store.orderItems.filter(i => i.order_id === orderId)
  let id = nextId(store.orderItems)
  for (const item of srcItems) {
    store.orderItems.push({ ...item, id: id++, order_id: newOrder.id, completed: 0, production_notes: '' })
  }
  save()
  return newOrder
})

ipcMain.handle('orders:setPaid', (_, { id, paid }) => {
  const idx = store.orders.findIndex(o => o.id === id)
  if (idx !== -1) { store.orders[idx] = { ...store.orders[idx], paid: paid ? 1 : 0 }; save() }
  return { ok: true }
})

// ── Order items ───────────────────────────────────────────────────────────────
ipcMain.handle('orderItems:save', (_, { orderId, items }) => {
  store.orderItems = store.orderItems.filter(i => i.order_id !== orderId)
  let id = nextId(store.orderItems)
  for (const item of items) {
    store.orderItems.push({
      id: id++,
      order_id:               orderId,
      print_type_id:          item.print_type_id ? Number(item.print_type_id) : null,
      description:            item.description || '',
      quantity:               Number(item.quantity) || 1,
      size_breakdown:         item.size_breakdown || '',
      ink_cost_breakdown:        item.ink_cost_breakdown || '',
      client_ink_breakdown:      item.client_ink_breakdown || '',
      shirt_brand:               item.shirt_brand || '',
      shirt_color:               item.shirt_color || '',
      garment_cost_per_piece:    Number(item.garment_cost_per_piece) || 0,
      client_garment_per_piece:  Number(item.client_garment_per_piece) || 0,
      labor_base:                Number(item.labor_base) || 7,
      prints_on_garment:         Number(item.prints_on_garment) || 1,
      customer_supplied:         item.customer_supplied ? 1 : 0,
      asset_path:                item.asset_path || '',
      asset_name:                item.asset_name || '',
      item_assets:               item.item_assets || '',
      work_file_path:            item.work_file_path || '',
    })
  }
  save()
  return { ok: true }
})

ipcMain.handle('orderItems:setComplete', (_, { id, completed }) => {
  const idx = store.orderItems.findIndex(i => i.id === id)
  if (idx !== -1) {
    store.orderItems[idx] = { ...store.orderItems[idx], completed: completed ? 1 : 0 }
    save()
  }
  return { ok: true }
})

ipcMain.handle('orderItems:listActive', () => {
  const activeStatuses = ['new', 'art', 'printing', 'done']
  const activeOrders = store.orders.filter(o => activeStatuses.includes(o.status))
  const clientMap = Object.fromEntries(store.clients.map(c => [c.id, c.name]))
  const ptMap = Object.fromEntries(store.printTypes.map(p => [p.id, p.name]))
  return activeOrders
    .sort((a, b) => {
      if (a.due_date && b.due_date) return a.due_date.localeCompare(b.due_date)
      if (a.due_date) return -1
      if (b.due_date) return 1
      return b.created_at.localeCompare(a.created_at)
    })
    .map(o => ({
      ...o,
      client_name: clientMap[o.client_id] || '',
      items: store.orderItems
        .filter(i => i.order_id === o.id)
        .map(i => ({ ...i, print_type_name: ptMap[i.print_type_id] || '' })),
    }))
})

ipcMain.handle('orderItems:setNotes', (_, { id, notes }) => {
  const idx = store.orderItems.findIndex(i => i.id === id)
  if (idx !== -1) { store.orderItems[idx] = { ...store.orderItems[idx], production_notes: notes }; save() }
  return { ok: true }
})

// ── Print types ───────────────────────────────────────────────────────────────
ipcMain.handle('printTypes:list', () => {
  return [...store.printTypes].sort((a, b) => a.name.localeCompare(b.name))
})

ipcMain.handle('printTypes:create', (_, data) => {
  const pt = { id: nextId(store.printTypes), name: data.name, description: data.description || '', base_cost: Number(data.base_cost) || 0 }
  store.printTypes.push(pt)
  save()
  return pt
})

ipcMain.handle('printTypes:update', (_, data) => {
  const idx = store.printTypes.findIndex(p => p.id === data.id)
  if (idx !== -1) { store.printTypes[idx] = { ...store.printTypes[idx], name: data.name, description: data.description || '', base_cost: Number(data.base_cost) || 0 }; save() }
  return store.printTypes[idx]
})

ipcMain.handle('printTypes:delete', (_, id) => {
  store.printTypes = store.printTypes.filter(p => p.id !== id)
  save()
  return { ok: true }
})

// ── Assets ────────────────────────────────────────────────────────────────────
ipcMain.handle('assets:list', (_, clientId) => {
  const clientMap = Object.fromEntries(store.clients.map(c => [c.id, c.name]))
  return store.assets
    .filter(a => clientId ? a.client_id === clientId : true)
    .map(a => ({ ...a, client_name: clientMap[a.client_id] || '' }))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
})

ipcMain.handle('assets:create', (_, data) => {
  const asset = {
    id: nextId(store.assets),
    client_id:      Number(data.client_id),
    name:           data.name,
    file_path:      data.file_path || '',
    notes:          data.notes || '',
    shirt_color:    data.shirt_color || '',
    shirt_brand:    data.shirt_brand || '',
    ink_costs:      data.ink_costs || '',
    work_file_path: data.work_file_path || '',
    created_at:     now(),
  }
  store.assets.push(asset)
  save()
  return asset
})

ipcMain.handle('assets:update', (_, data) => {
  const idx = store.assets.findIndex(a => a.id === data.id)
  if (idx !== -1) {
    store.assets[idx] = {
      ...store.assets[idx],
      name:           data.name,
      file_path:      data.file_path || '',
      notes:          data.notes || '',
      shirt_color:    data.shirt_color ?? store.assets[idx].shirt_color ?? '',
      shirt_brand:    data.shirt_brand ?? store.assets[idx].shirt_brand ?? '',
      ink_costs:      data.ink_costs ?? store.assets[idx].ink_costs ?? '',
      work_file_path: data.work_file_path ?? store.assets[idx].work_file_path ?? '',
    }
    save()
  }
  return store.assets[idx]
})

ipcMain.handle('assets:syncInkCosts', (_, { file_path, ink_costs, shirt_color, shirt_brand }) => {
  const idx = store.assets.findIndex(a => a.file_path === file_path)
  if (idx !== -1) {
    store.assets[idx] = { ...store.assets[idx], ink_costs, shirt_color: shirt_color || store.assets[idx].shirt_color, shirt_brand: shirt_brand || store.assets[idx].shirt_brand }
    save()
    return { ok: true, updated: true }
  }
  return { ok: true, updated: false }
})

ipcMain.handle('assets:delete', (_, id) => {
  store.assets = store.assets.filter(a => a.id !== id)
  save()
  return { ok: true }
})

// ── Dashboard stats ───────────────────────────────────────────────────────────
ipcMain.handle('stats:get', () => {
  const billed      = store.orders.filter(o => ['shipped', 'invoiced'].includes(o.status))
  const active      = store.orders.filter(o => !['shipped', 'invoiced'].includes(o.status))
  const revenue     = billed.reduce((s, o) => s + o.sell_price, 0)
  const costs       = billed.reduce((s, o) => s + o.garment_cost + o.ink_cost, 0)
  const rushOrders  = active.filter(o => o.is_rush === 1).length
  const clientMap   = Object.fromEntries(store.clients.map(c => [c.id, c.name]))
  const recentOrders = [...store.orders]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 5)
    .map(o => ({ ...o, client_name: clientMap[o.client_id] || '' }))
  const clientMap2  = Object.fromEntries(store.clients.map(c => [c.id, c.name]))
  const outstanding = store.orders
    .filter(o => o.status === 'invoiced' && !o.paid)
    .reduce((s, o) => s + (o.sell_price || 0), 0)
  const todayMs  = new Date().setHours(0, 0, 0, 0)
  const dueSoonOrders = store.orders
    .filter(o => !['shipped', 'invoiced'].includes(o.status) && o.due_date)
    .map(o => {
      const diffDays = Math.round((new Date(o.due_date) - todayMs) / 86400000)
      return { ...o, client_name: clientMap2[o.client_id] || '', diffDays }
    })
    .filter(o => o.diffDays <= 3)
    .sort((a, b) => a.diffDays - b.diffDays)
    .slice(0, 8)
  return {
    totalOrders:  store.orders.length,
    activeOrders: active.length,
    totalClients: store.clients.length,
    revenue,
    costs,
    profit: revenue - costs,
    rushOrders,
    outstanding,
    dueSoonOrders,
    recentOrders,
  }
})

// ── Store export ──────────────────────────────────────────────────────────────
ipcMain.handle('store:export', async () => {
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    defaultPath: `printflow-backup-${new Date().toISOString().slice(0, 10)}.json`,
    filters: [{ name: 'JSON Backup', extensions: ['json'] }],
  })
  if (canceled || !filePath) return { ok: false }
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2), 'utf8')
  return { ok: true, filePath }
})

// ── Global search ─────────────────────────────────────────────────────────────
ipcMain.handle('search:all', (_, query) => {
  if (!query || query.trim().length < 2) return { clients: [], orders: [], assets: [] }
  const q = query.toLowerCase()
  const clientMap = Object.fromEntries(store.clients.map(c => [c.id, c.name]))
  return {
    clients: store.clients
      .filter(c => c.name.toLowerCase().includes(q) || (c.email || '').toLowerCase().includes(q))
      .slice(0, 5),
    orders: store.orders
      .filter(o => o.title.toLowerCase().includes(q) || (clientMap[o.client_id] || '').toLowerCase().includes(q))
      .slice(0, 5)
      .map(o => ({ ...o, client_name: clientMap[o.client_id] || '' })),
    assets: store.assets
      .filter(a => a.name.toLowerCase().includes(q) || (a.shirt_color || '').toLowerCase().includes(q) || (a.shirt_brand || '').toLowerCase().includes(q))
      .slice(0, 5)
      .map(a => ({ ...a, client_name: clientMap[a.client_id] || '' })),
  }
})

// ── Invoice helpers ───────────────────────────────────────────────────────────
const INVOICE_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']

function parseAssets(item) {
  try {
    const a = JSON.parse(item.item_assets || '[]')
    return Array.isArray(a) && a.length > 0 ? a : null
  } catch (_) { return null }
}

function calcItemTotals(item) {
  const qty = Number(item.quantity) || 0
  let clientInkTotal = 0
  let laborTotal     = 0
  const sizes = (() => { try { return JSON.parse(item.size_breakdown || '{}') } catch { return {} } })()

  const assets = parseAssets(item)
  if (assets) {
    for (const asset of assets) {
      const ink = asset.client_ink_costs || {}
      clientInkTotal += INVOICE_SIZES.reduce((s, k) => s + (Number(sizes[k]) || 0) * (Number(ink[k]) || 0), 0)
      laborTotal     += qty * (Number(asset.labor_base) || 7)
    }
  } else {
    try {
      const ink = JSON.parse(item.client_ink_breakdown || '{}')
      clientInkTotal = INVOICE_SIZES.reduce((s, k) => s + (Number(sizes[k]) || 0) * (Number(ink[k]) || 0), 0)
    } catch (_) {}
    const laborBase = Number(item.labor_base) || 7
    const prints    = Number(item.prints_on_garment) || 1
    laborTotal = qty * (laborBase + 3 * Math.max(0, prints - 1))
  }

  const garmentTotal = item.customer_supplied ? 0 : (Number(item.client_garment_per_piece) || 0) * qty
  const itemTotal    = garmentTotal + clientInkTotal + laborTotal
  return { qty, clientInkTotal, laborTotal, garmentTotal, itemTotal }
}

// ── PDF ───────────────────────────────────────────────────────────────────────
function generateInvoiceHTML(order, items) {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  let runningTotal = 0

  const itemCards = items.map((item, i) => {
    const { qty, clientInkTotal, laborTotal, garmentTotal, itemTotal, laborPerPc } = calcItemTotals(item)
    runningTotal += itemTotal

    // Size grid
    let sizeRows = ''
    try {
      const sizes = JSON.parse(item.size_breakdown || '{}')
      const active = INVOICE_SIZES.filter(k => Number(sizes[k]) > 0)
      if (active.length) {
        sizeRows = `<table class="sz-tbl">
          <tr>${active.map(k => `<th>${k}</th>`).join('')}<th>Total</th></tr>
          <tr>${active.map(k => `<td>${sizes[k]}</td>`).join('')}<td><b>${qty}</b></td></tr>
        </table>`
      }
    } catch (_) {}

    const garmentLabel = [item.shirt_brand, item.shirt_color].filter(Boolean).join(' · ')
    const printLabel   = [item.description, item.print_type_name].filter(Boolean).join(' — ')

    const garmentRow = !item.customer_supplied && garmentTotal > 0
      ? `<tr><td>Garment</td><td class="r">$${Number(item.client_garment_per_piece || 0).toFixed(2)}/pc × ${qty}</td><td class="r">$${garmentTotal.toFixed(2)}</td></tr>`
      : item.customer_supplied ? `<tr><td>Garment</td><td class="r" colspan="2" style="color:#888">Customer supplied</td></tr>` : ''

    // Per-location ink + labor rows
    let locationRows = ''
    const assets = parseAssets(item)
    if (assets && assets.length > 0) {
      const sizesObj = (() => { try { return JSON.parse(item.size_breakdown || '{}') } catch { return {} } })()
      for (const asset of assets) {
        const locName   = (asset.name || (asset.file_path || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '') || 'Print').replace(/</g, '&lt;')
        const ink       = asset.client_ink_costs || {}
        const locInk    = INVOICE_SIZES.reduce((s, k) => s + (Number(sizesObj[k]) || 0) * (Number(ink[k]) || 0), 0)
        const locLabor  = qty * (Number(asset.labor_base) || 7)
        const locPerPc  = Number(asset.labor_base) || 7
        if (locInk > 0) {
          locationRows += `<tr><td>Ink — ${locName}</td><td class="r">per size</td><td class="r">$${locInk.toFixed(2)}</td></tr>`
        }
        locationRows += `<tr><td>Labor — ${locName}</td><td class="r">$${locPerPc.toFixed(2)}/pc × ${qty}</td><td class="r">$${locLabor.toFixed(2)}</td></tr>`
      }
    } else {
      if (clientInkTotal > 0) locationRows += `<tr><td>Ink</td><td class="r">per size</td><td class="r">$${clientInkTotal.toFixed(2)}</td></tr>`
      locationRows += `<tr><td>Print Labor</td><td class="r">$${laborTotal.toFixed(2)}</td><td class="r">$${laborTotal.toFixed(2)}</td></tr>`
    }

    return `<div class="item-card">
      <div class="item-hdr">
        <div class="item-num">${String(i + 1).padStart(2, '0')}</div>
        <div class="item-info">
          <div class="item-garment">${garmentLabel || 'Garment'}</div>
          ${printLabel ? `<div class="item-print">${printLabel}</div>` : ''}
        </div>
        <div class="item-ttl">$${itemTotal.toFixed(2)}</div>
      </div>

      ${sizeRows ? `<div class="sz-wrap">${sizeRows}</div>` : ''}

      <table class="cost-tbl">
        <thead><tr><th>Description</th><th class="r">Rate</th><th class="r">Amount</th></tr></thead>
        <tbody>
          ${garmentRow}
          ${locationRows}
        </tbody>
        <tfoot>
          <tr class="item-sub"><td colspan="2"><b>Item Subtotal</b></td><td class="r"><b>$${itemTotal.toFixed(2)}</b></td></tr>
        </tfoot>
      </table>
    </div>`
  }).join('')

  const grandTotal = order.sell_price > 0 ? Number(order.sell_price) : runningTotal

  const notesBlock = order.notes
    ? `<div class="notes-box"><b>Notes:</b> ${order.notes.replace(/</g, '&lt;')}</div>` : ''

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Helvetica Neue',Arial,sans-serif;font-size:12px;color:#1a1a1a;padding:40px 48px;background:#fff;max-width:860px;margin:0 auto}

/* Header */
.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:16px;border-bottom:3px solid #111;margin-bottom:24px}
.brand-name{font-size:24px;font-weight:800;letter-spacing:-1px;color:#111}
.brand-name em{color:#22c55e;font-style:normal}
.brand-sub{font-size:10px;color:#999;text-transform:uppercase;letter-spacing:1px;margin-top:2px}
.meta{text-align:right;line-height:1.8;color:#555;font-size:12px}
.meta strong{color:#111;font-size:14px}
.rush{display:inline-block;background:#fee2e2;color:#dc2626;font-weight:700;padding:1px 7px;border-radius:4px;font-size:11px}

/* Order info bar */
.info-bar{display:grid;grid-template-columns:repeat(4,1fr);gap:0;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin-bottom:28px}
.info-cell{padding:10px 14px;border-right:1px solid #e5e7eb}
.info-cell:last-child{border-right:none}
.info-cell label{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:#9ca3af;margin-bottom:3px}
.info-cell span{font-size:13px;font-weight:700;color:#111}

/* Item cards */
.item-card{border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin-bottom:16px}
.item-hdr{display:flex;align-items:center;gap:12px;background:#111;color:#fff;padding:10px 14px}
.item-num{font-size:11px;font-weight:700;background:#22c55e;color:#000;border-radius:4px;padding:2px 7px;letter-spacing:.5px;white-space:nowrap}
.item-info{flex:1;min-width:0}
.item-garment{font-weight:600;font-size:13px}
.item-print{font-size:11px;color:#9ca3af;margin-top:1px}
.item-ttl{font-size:15px;font-weight:800;color:#22c55e;white-space:nowrap}

/* Size grid */
.sz-wrap{padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb}
.sz-tbl{width:auto;border-collapse:collapse}
.sz-tbl th{background:none;color:#6b7280;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:2px 10px 2px 0;text-align:center;border-bottom:1px solid #e5e7eb}
.sz-tbl td{font-size:13px;font-weight:600;color:#111;padding:3px 10px 0 0;text-align:center;border:none}

/* Cost table */
.cost-tbl{width:100%;border-collapse:collapse}
.cost-tbl thead th{background:#f3f4f6;color:#6b7280;font-size:10px;text-transform:uppercase;letter-spacing:.5px;padding:7px 14px;border-bottom:1px solid #e5e7eb}
.cost-tbl tbody td{padding:8px 14px;border-bottom:1px solid #f3f4f6;color:#374151;font-size:12px}
.cost-tbl tfoot td{padding:9px 14px;background:#f9fafb;font-size:12px}
.cost-tbl .r{text-align:right}
.item-sub td{border-top:2px solid #e5e7eb!important}

/* Grand total */
.grand-total{display:flex;justify-content:flex-end;margin-bottom:20px}
.grand-box{border:2px solid #111;border-radius:8px;padding:14px 24px;text-align:right;min-width:220px}
.grand-label{font-size:10px;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;margin-bottom:4px}
.grand-amount{font-size:26px;font-weight:800;color:#111}

.notes-box{background:#f9fafb;border-left:4px solid #22c55e;padding:10px 14px;border-radius:0 6px 6px 0;font-size:12px;color:#374151;line-height:1.6;margin-bottom:20px}
.footer{padding-top:14px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;text-align:center}
@media print{body{padding:20px}}
</style></head><body>

<div class="hdr">
  <div>
    <div class="brand-name">Dead Stock<em>.</em></div>
    <div class="brand-sub">DTG Print Services</div>
  </div>
  <div class="meta">
    <div><strong>${order.client_name}</strong></div>
    <div>Date: ${date}</div>
    ${order.due_date ? `<div>Due: ${order.due_date}</div>` : ''}
    ${order.is_rush === 1 ? '<div><span class="rush">⚡ RUSH</span></div>' : ''}
  </div>
</div>

<div class="info-bar">
  <div class="info-cell"><label>Order</label><span>${order.title}</span></div>
  <div class="info-cell"><label>Total Garments</label><span>${order.garment_qty || 0} pcs</span></div>
  <div class="info-cell"><label>Items</label><span>${items.length}</span></div>
  <div class="info-cell"><label>Status</label><span style="text-transform:capitalize">${order.status || 'New'}</span></div>
</div>

${itemCards}

${notesBlock}

<div class="grand-total">
  <div class="grand-box">
    <div class="grand-label">Total</div>
    <div class="grand-amount">$${grandTotal.toFixed(2)}</div>
  </div>
</div>

<div class="footer">Quote generated ${date} · Valid for 30 days · Thank you for your business</div>
</body></html>`
}

// ── Plain text quote ──────────────────────────────────────────────────────────
function generateQuoteText(order, items) {
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const line  = (char, len = 48) => char.repeat(len)

  let runningTotal = 0
  const blocks = items.map((item, i) => {
    const { qty, clientInkTotal, laborTotal, garmentTotal, itemTotal } = calcItemTotals(item)
    runningTotal += itemTotal

    const garmentLabel = [item.shirt_brand, item.shirt_color].filter(Boolean).join(' · ')
    const printLabel   = [item.description, item.print_type_name].filter(Boolean).join(' — ')

    let sizeLine = ''
    try {
      const sizes = JSON.parse(item.size_breakdown || '{}')
      const parts = INVOICE_SIZES.filter(k => Number(sizes[k]) > 0).map(k => `${k}:${sizes[k]}`).join('  ')
      if (parts) sizeLine = `Sizes:     ${parts}  (${qty} pcs total)\n`
    } catch (_) {}

    const pad = (label, val) => `  ${label.padEnd(18)}${val}`

    const garmentRow = !item.customer_supplied && garmentTotal > 0
      ? pad('Garment:', `$${Number(item.client_garment_per_piece || 0).toFixed(2)}/pc × ${qty} = $${garmentTotal.toFixed(2)}`)
      : item.customer_supplied ? pad('Garment:', 'Customer supplied') : null

    const assets = parseAssets(item)
    let locationLines = ''
    if (assets && assets.length > 0) {
      const sizesObj = (() => { try { return JSON.parse(item.size_breakdown || '{}') } catch { return {} } })()
      locationLines = assets.map(asset => {
        const locName  = asset.name || (asset.file_path || '').split(/[\\/]/).pop().replace(/\.[^.]+$/, '') || 'Print'
        const ink      = asset.client_ink_costs || {}
        const locInk   = INVOICE_SIZES.reduce((s, k) => s + (Number(sizesObj[k]) || 0) * (Number(ink[k]) || 0), 0)
        const locPerPc = Number(asset.labor_base) || 7
        const locLabor = qty * locPerPc
        const lines = []
        if (locInk > 0) lines.push(pad(`Ink (${locName}):`, `$${locInk.toFixed(2)}`))
        lines.push(pad(`Labor (${locName}):`, `$${locPerPc.toFixed(2)}/pc × ${qty} = $${locLabor.toFixed(2)}`))
        return lines.join('\n')
      }).join('\n')
    } else {
      locationLines = [
        clientInkTotal > 0 ? pad('Ink:', `$${clientInkTotal.toFixed(2)}`) : null,
        pad('Labor:', `$${laborTotal.toFixed(2)}`),
      ].filter(Boolean).join('\n')
    }

    return [
      `ITEM ${i + 1}${garmentLabel ? ' — ' + garmentLabel : ''}`,
      printLabel,
      sizeLine.trimEnd(),
      garmentRow,
      locationLines,
      `  ${line('-', 44)}`,
      `  ITEM TOTAL       $${itemTotal.toFixed(2)}`,
    ].filter(Boolean).join('\n')
  })

  const grandTotal = order.sell_price > 0 ? Number(order.sell_price) : runningTotal

  return [
    `QUOTE — ${order.title.toUpperCase()}`,
    line('='),
    `Client:    ${order.client_name}`,
    `Date:      ${date}`,
    order.due_date ? `Due:       ${order.due_date}` : null,
    order.is_rush === 1 ? '⚡ RUSH ORDER' : null,
    line('-'),
    '',
    blocks.join('\n\n'),
    '',
    line('='),
    `TOTAL GARMENTS   ${order.garment_qty || 0} pcs`,
    `TOTAL            $${grandTotal.toFixed(2)}`,
    line('='),
    order.notes ? `\nNotes: ${order.notes}` : null,
  ].filter(s => s !== null).join('\n')
}

ipcMain.handle('invoice:pdf', async (_, { order, items }) => {
  const { filePath, canceled } = await dialog.showSaveDialog(win, {
    defaultPath: `Quote-${(order.title || 'Order').replace(/[^a-z0-9]/gi, '-')}.pdf`,
    filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
  })
  if (canceled || !filePath) return { ok: false }

  const html = generateInvoiceHTML(order, items)
  const tmpPath = path.join(app.getPath('temp'), `pf-invoice-${Date.now()}.html`)
  fs.writeFileSync(tmpPath, html, 'utf8')

  const { BrowserWindow: BW } = require('electron')
  const pdfWin = new BW({ show: false, webPreferences: { contextIsolation: true } })
  await pdfWin.loadURL(`file://${tmpPath}`)
  const pdfBuf = await pdfWin.webContents.printToPDF({ marginsType: 1, printBackground: true, pageSize: 'Letter' })
  pdfWin.close()
  try { fs.unlinkSync(tmpPath) } catch (_) {}
  fs.writeFileSync(filePath, pdfBuf)

  return { ok: true, filePath }
})

ipcMain.handle('invoice:text', (_, { order, items }) => {
  return generateQuoteText(order, items)
})
