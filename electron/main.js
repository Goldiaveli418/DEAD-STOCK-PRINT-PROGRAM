const { app, BrowserWindow, ipcMain, dialog } = require('electron')
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
    client_id:    Number(data.client_id),
    title:        data.title,
    status:       data.status || 'new',
    is_rush:      data.is_rush ? 1 : 0,
    due_date:     data.due_date || '',
    notes:        data.notes || '',
    garment_cost: Number(data.garment_cost) || 0,
    ink_cost:     Number(data.ink_cost) || 0,
    sell_price:   Number(data.sell_price) || 0,
    created_at:   now(),
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
      client_id:    Number(data.client_id),
      title:        data.title,
      status:       data.status,
      is_rush:      data.is_rush ? 1 : 0,
      due_date:     data.due_date || '',
      notes:        data.notes || '',
      garment_cost: Number(data.garment_cost) || 0,
      ink_cost:     Number(data.ink_cost) || 0,
      sell_price:   Number(data.sell_price) || 0,
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

// ── Order items ───────────────────────────────────────────────────────────────
ipcMain.handle('orderItems:save', (_, { orderId, items }) => {
  store.orderItems = store.orderItems.filter(i => i.order_id !== orderId)
  let id = nextId(store.orderItems)
  for (const item of items) {
    store.orderItems.push({
      id: id++,
      order_id:      orderId,
      print_type_id: item.print_type_id ? Number(item.print_type_id) : null,
      description:   item.description || '',
      quantity:      Number(item.quantity) || 1,
      size_breakdown: item.size_breakdown || '',
      unit_price:    Number(item.unit_price) || 0,
    })
  }
  save()
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
  const asset = { id: nextId(store.assets), client_id: Number(data.client_id), name: data.name, file_path: data.file_path, notes: data.notes || '', created_at: now() }
  store.assets.push(asset)
  save()
  return asset
})

ipcMain.handle('assets:update', (_, data) => {
  const idx = store.assets.findIndex(a => a.id === data.id)
  if (idx !== -1) { store.assets[idx] = { ...store.assets[idx], name: data.name, file_path: data.file_path, notes: data.notes || '' }; save() }
  return store.assets[idx]
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
  return {
    totalOrders:  store.orders.length,
    activeOrders: active.length,
    totalClients: store.clients.length,
    revenue,
    costs,
    profit: revenue - costs,
    rushOrders,
    recentOrders,
  }
})
