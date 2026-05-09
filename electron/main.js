const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const Database = require('better-sqlite3')

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged

let db
let win

function initDb() {
  const dbPath = path.join(app.getPath('userData'), 'printflow.db')
  db = new Database(dbPath)

  db.exec(`
    CREATE TABLE IF NOT EXISTS clients (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS print_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      base_cost REAL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      status TEXT DEFAULT 'new',
      is_rush INTEGER DEFAULT 0,
      due_date TEXT,
      notes TEXT,
      garment_cost REAL DEFAULT 0,
      ink_cost REAL DEFAULT 0,
      sell_price REAL DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS order_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      print_type_id INTEGER,
      description TEXT,
      quantity INTEGER DEFAULT 1,
      size_breakdown TEXT,
      unit_price REAL DEFAULT 0,
      FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      FOREIGN KEY (print_type_id) REFERENCES print_types(id)
    );

    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      client_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );
  `)

  // Seed default print types if empty
  const count = db.prepare('SELECT COUNT(*) as c FROM print_types').get()
  if (count.c === 0) {
    const insert = db.prepare('INSERT INTO print_types (name, description, base_cost) VALUES (?, ?, ?)')
    insert.run('DTG Chest', 'Left chest or small chest print', 3.50)
    insert.run('DTG Full Front', 'Full front garment print', 6.00)
    insert.run('DTG Full Back', 'Full back garment print', 6.00)
    insert.run('DTG Full Front + Back', 'Full front and back combo', 10.00)
    insert.run('DTG Sleeve', 'Sleeve print', 2.50)
    insert.run('DTG All-Over', 'All-over sublimation/DTG print', 14.00)
  }
}

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
  initDb()
  createWindow()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── Window controls ──────────────────────────────────────────────────────────
ipcMain.on('win:minimize', () => win.minimize())
ipcMain.on('win:maximize', () => win.isMaximized() ? win.unmaximize() : win.maximize())
ipcMain.on('win:close', () => win.close())

// ── File dialog ──────────────────────────────────────────────────────────────
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

// ── Clients ──────────────────────────────────────────────────────────────────
ipcMain.handle('clients:list', () => {
  return db.prepare(`
    SELECT c.*, COUNT(o.id) as order_count
    FROM clients c
    LEFT JOIN orders o ON o.client_id = c.id
    GROUP BY c.id
    ORDER BY c.name
  `).all()
})

ipcMain.handle('clients:create', (_, data) => {
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO clients (name, email, phone, notes) VALUES (?, ?, ?, ?)'
  ).run(data.name, data.email || null, data.phone || null, data.notes || null)
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(lastInsertRowid)
})

ipcMain.handle('clients:update', (_, data) => {
  db.prepare('UPDATE clients SET name=?, email=?, phone=?, notes=? WHERE id=?')
    .run(data.name, data.email || null, data.phone || null, data.notes || null, data.id)
  return db.prepare('SELECT * FROM clients WHERE id = ?').get(data.id)
})

ipcMain.handle('clients:delete', (_, id) => {
  db.prepare('DELETE FROM clients WHERE id = ?').run(id)
  return { ok: true }
})

// ── Orders ───────────────────────────────────────────────────────────────────
ipcMain.handle('orders:list', (_, clientId) => {
  const q = clientId
    ? 'SELECT o.*, c.name as client_name FROM orders o JOIN clients c ON c.id = o.client_id WHERE o.client_id = ? ORDER BY o.created_at DESC'
    : 'SELECT o.*, c.name as client_name FROM orders o JOIN clients c ON c.id = o.client_id ORDER BY o.created_at DESC'
  return clientId ? db.prepare(q).all(clientId) : db.prepare(q).all()
})

ipcMain.handle('orders:get', (_, id) => {
  const order = db.prepare('SELECT o.*, c.name as client_name FROM orders o JOIN clients c ON c.id = o.client_id WHERE o.id = ?').get(id)
  if (!order) return null
  order.items = db.prepare('SELECT oi.*, pt.name as print_type_name FROM order_items oi LEFT JOIN print_types pt ON pt.id = oi.print_type_id WHERE oi.order_id = ?').all(id)
  return order
})

ipcMain.handle('orders:create', (_, data) => {
  const { lastInsertRowid } = db.prepare(
    'INSERT INTO orders (client_id, title, status, is_rush, due_date, notes, garment_cost, ink_cost, sell_price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(data.client_id, data.title, data.status || 'new', data.is_rush ? 1 : 0, data.due_date || null, data.notes || null, data.garment_cost || 0, data.ink_cost || 0, data.sell_price || 0)
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(lastInsertRowid)
})

ipcMain.handle('orders:update', (_, data) => {
  db.prepare('UPDATE orders SET client_id=?, title=?, status=?, is_rush=?, due_date=?, notes=?, garment_cost=?, ink_cost=?, sell_price=? WHERE id=?')
    .run(data.client_id, data.title, data.status, data.is_rush ? 1 : 0, data.due_date || null, data.notes || null, data.garment_cost || 0, data.ink_cost || 0, data.sell_price || 0, data.id)
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(data.id)
})

ipcMain.handle('orders:delete', (_, id) => {
  db.prepare('DELETE FROM orders WHERE id = ?').run(id)
  return { ok: true }
})

// ── Order items ───────────────────────────────────────────────────────────────
ipcMain.handle('orderItems:save', (_, { orderId, items }) => {
  db.prepare('DELETE FROM order_items WHERE order_id = ?').run(orderId)
  const insert = db.prepare('INSERT INTO order_items (order_id, print_type_id, description, quantity, size_breakdown, unit_price) VALUES (?, ?, ?, ?, ?, ?)')
  for (const item of items) {
    insert.run(orderId, item.print_type_id || null, item.description || null, item.quantity || 1, item.size_breakdown || null, item.unit_price || 0)
  }
  return { ok: true }
})

// ── Print types ───────────────────────────────────────────────────────────────
ipcMain.handle('printTypes:list', () => {
  return db.prepare('SELECT * FROM print_types ORDER BY name').all()
})

ipcMain.handle('printTypes:create', (_, data) => {
  const { lastInsertRowid } = db.prepare('INSERT INTO print_types (name, description, base_cost) VALUES (?, ?, ?)')
    .run(data.name, data.description || null, data.base_cost || 0)
  return db.prepare('SELECT * FROM print_types WHERE id = ?').get(lastInsertRowid)
})

ipcMain.handle('printTypes:update', (_, data) => {
  db.prepare('UPDATE print_types SET name=?, description=?, base_cost=? WHERE id=?')
    .run(data.name, data.description || null, data.base_cost || 0, data.id)
  return db.prepare('SELECT * FROM print_types WHERE id = ?').get(data.id)
})

ipcMain.handle('printTypes:delete', (_, id) => {
  db.prepare('DELETE FROM print_types WHERE id = ?').run(id)
  return { ok: true }
})

// ── Assets ────────────────────────────────────────────────────────────────────
ipcMain.handle('assets:list', (_, clientId) => {
  const q = clientId
    ? 'SELECT a.*, c.name as client_name FROM assets a JOIN clients c ON c.id = a.client_id WHERE a.client_id = ? ORDER BY a.created_at DESC'
    : 'SELECT a.*, c.name as client_name FROM assets a JOIN clients c ON c.id = a.client_id ORDER BY a.created_at DESC'
  return clientId ? db.prepare(q).all(clientId) : db.prepare(q).all()
})

ipcMain.handle('assets:create', (_, data) => {
  const { lastInsertRowid } = db.prepare('INSERT INTO assets (client_id, name, file_path, notes) VALUES (?, ?, ?, ?)')
    .run(data.client_id, data.name, data.file_path, data.notes || null)
  return db.prepare('SELECT * FROM assets WHERE id = ?').get(lastInsertRowid)
})

ipcMain.handle('assets:update', (_, data) => {
  db.prepare('UPDATE assets SET name=?, file_path=?, notes=? WHERE id=?')
    .run(data.name, data.file_path, data.notes || null, data.id)
  return db.prepare('SELECT * FROM assets WHERE id = ?').get(data.id)
})

ipcMain.handle('assets:delete', (_, id) => {
  db.prepare('DELETE FROM assets WHERE id = ?').run(id)
  return { ok: true }
})

// ── Dashboard stats ───────────────────────────────────────────────────────────
ipcMain.handle('stats:get', () => {
  const totalOrders = db.prepare('SELECT COUNT(*) as c FROM orders').get().c
  const activeOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE status NOT IN ('shipped','invoiced')").get().c
  const totalClients = db.prepare('SELECT COUNT(*) as c FROM clients').get().c
  const revenue = db.prepare("SELECT COALESCE(SUM(sell_price),0) as total FROM orders WHERE status IN ('shipped','invoiced')").get().total
  const costs = db.prepare("SELECT COALESCE(SUM(garment_cost + ink_cost),0) as total FROM orders WHERE status IN ('shipped','invoiced')").get().total
  const rushOrders = db.prepare("SELECT COUNT(*) as c FROM orders WHERE is_rush=1 AND status NOT IN ('shipped','invoiced')").get().c
  const recentOrders = db.prepare("SELECT o.*, c.name as client_name FROM orders o JOIN clients c ON c.id=o.client_id ORDER BY o.created_at DESC LIMIT 5").all()
  return { totalOrders, activeOrders, totalClients, revenue, costs, profit: revenue - costs, rushOrders, recentOrders }
})
