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
      work_file_path:            item.work_file_path || '',
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

// ── Invoice PDF ───────────────────────────────────────────────────────────────
function generateInvoiceHTML(order, items) {
  const SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })

  const itemRows = items.map((item, i) => {
    let sizesHtml = '—'
    try {
      const s = JSON.parse(item.size_breakdown || '{}')
      const parts = SIZES.filter(k => Number(s[k]) > 0).map(k => `<span>${k}:&nbsp;<b>${s[k]}</b></span>`).join(' ')
      if (parts) sizesHtml = parts
    } catch (_) {}

    // Client-facing price: sum of client ink + client garment per item
    let clientCharge = 0
    const qty = Number(item.quantity) || 0
    try {
      const clientInk = JSON.parse(item.client_ink_breakdown || '{}')
      const sizes = JSON.parse(item.size_breakdown || '{}')
      clientCharge += SIZES.reduce((s, k) => s + (Number(sizes[k]) || 0) * (Number(clientInk[k]) || 0), 0)
    } catch (_) {}
    clientCharge += (Number(item.client_garment_per_piece) || 0) * qty

    const garment = [item.shirt_brand, item.shirt_color ? `(${item.shirt_color})` : ''].filter(Boolean).join(' ')
    const print   = [item.description, item.print_type_name].filter(Boolean).join(' — ')
    const priceCell = clientCharge > 0 ? `$${clientCharge.toFixed(2)}` : '—'

    return `<tr class="${i % 2 === 1 ? 'alt' : ''}">
      <td class="c">${i + 1}</td>
      <td>${garment || '—'}</td>
      <td>${print || '—'}</td>
      <td class="sz">${sizesHtml}</td>
      <td class="c">${item.quantity}</td>
      <td class="c">${priceCell}</td>
    </tr>`
  }).join('')

  const priceRow = order.sell_price > 0 ? `
    <tr class="price-row">
      <td colspan="5" style="text-align:right;padding-right:12px"><b>Total</b></td>
      <td class="c"><b>$${Number(order.sell_price).toFixed(2)}</b></td>
    </tr>` : ''

  const notesBlock = order.notes ? `
    <div class="section">
      <div class="label">Notes</div>
      <div class="notes-box">${order.notes.replace(/</g, '&lt;')}</div>
    </div>` : ''

  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:Arial,Helvetica,sans-serif;font-size:12px;color:#1a1a1a;padding:48px;background:#fff}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;padding-bottom:18px;border-bottom:2px solid #22c55e;margin-bottom:28px}
.brand{font-size:20px;font-weight:700;letter-spacing:-0.5px}.brand em{color:#22c55e;font-style:normal}
.meta{text-align:right;line-height:1.75;color:#555}.meta strong{color:#111}
.rush{color:#ef4444;font-weight:700}
.order-info{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;background:#f7f7f7;border-radius:6px;padding:14px 18px;margin-bottom:24px}
.oi-block label{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:#999;margin-bottom:2px}
.oi-block span{font-size:13px;font-weight:600;color:#111}
.label{font-size:9px;text-transform:uppercase;letter-spacing:.8px;color:#999;margin-bottom:6px}
.section{margin-bottom:22px}
table{width:100%;border-collapse:collapse}
th{background:#111;color:#fff;font-size:10px;text-transform:uppercase;letter-spacing:.7px;padding:8px 10px;text-align:left}
th.c,td.c{text-align:center}
td{padding:8px 10px;border-bottom:1px solid #eee;vertical-align:top;line-height:1.45}
tr.alt td{background:#fafafa}
.sz span{white-space:nowrap;margin-right:5px;font-size:11px;color:#555}
tr.price-row td{border-top:2px solid #22c55e;border-bottom:none;padding-top:10px}
.notes-box{background:#f7f7f7;border-left:3px solid #22c55e;padding:10px 14px;border-radius:0 4px 4px 0;line-height:1.6;color:#444}
.footer{margin-top:36px;padding-top:14px;border-top:1px solid #eee;font-size:10px;color:#bbb;text-align:center}
</style></head><body>

<div class="hdr">
  <div>
    <div class="brand">Dead Stock<em>.</em></div>
    <div style="font-size:11px;color:#888;margin-top:3px">DTG Print Services</div>
  </div>
  <div class="meta">
    <div><strong>${order.client_name}</strong></div>
    <div>Date: ${date}</div>
    ${order.due_date ? `<div>Due: ${order.due_date}</div>` : ''}
    ${order.is_rush === 1 ? '<div class="rush">⚡ Rush Order</div>' : ''}
  </div>
</div>

<div class="order-info">
  <div class="oi-block"><label>Order</label><span>${order.title}</span></div>
  <div class="oi-block"><label>Total Garments</label><span>${order.garment_qty || 0} pcs</span></div>
  <div class="oi-block"><label>Status</label><span style="text-transform:capitalize">${order.status || 'New'}</span></div>
</div>

<div class="section">
  <div class="label">Line Items</div>
  <table>
    <thead><tr>
      <th class="c" style="width:32px">#</th>
      <th style="width:20%">Garment</th>
      <th>Print</th>
      <th style="width:28%">Sizes</th>
      <th class="c" style="width:44px">Qty</th>
      <th class="c" style="width:60px">Price</th>
    </tr></thead>
    <tbody>${itemRows}${priceRow}</tbody>
  </table>
</div>

${notesBlock}

<div class="footer">Generated ${date} · Quote valid for 30 days · Thank you for your business</div>
</body></html>`
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
