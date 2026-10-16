// Download reports: the Reports tab's date range as a PDF summary or an orders CSV.
// PDF uses the same printToPDF path as quotes. In-house runs (our own prints) get their own section.

const BILLED = ['done', 'shipped', 'invoiced']
const LABEL  = { new: 'New', art: 'Art Review', printing: 'Printing', done: 'Done', shipped: 'Shipped', invoiced: 'Invoiced' }
const money  = n => `$${(Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const esc    = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const day    = s => (s || '').slice(0, 10)

function inRange(d, from, to) {
  d = day(d)
  if (from && d < from) return false
  if (to && d > to) return false
  return true
}

function rows(store, { from, to }) {
  const clients = Object.fromEntries((store.clients || []).map(c => [c.id, c.name]))
  return (store.orders || [])
    .filter(o => inRange(o.created_at, from, to))
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    .map(o => {
      const cost = (o.garment_cost || 0) + (o.ink_cost || 0)
      return {
        date: day(o.created_at), invoice: o.invoice_number || '', title: o.title || '', client: clients[o.client_id] || '',
        status: LABEL[o.status] || o.status || '', paid: o.status === 'invoiced' ? (o.paid ? 'Yes' : 'No') : '',
        due: o.due_date || '', pieces: o.garment_qty || 0, sell: o.sell_price || 0,
        garment: o.garment_cost || 0, ink: o.ink_cost || 0, labor: o.labor_cost || 0,
        profit: (o.sell_price || 0) - cost, billed: BILLED.includes(o.status), rush: !!o.is_rush,
      }
    })
}

function houseRows(store, { from, to }) {
  return (store.houseRuns || []).filter(r => inRange(r.printed_on, from, to))
}

function toCSV(store, range) {
  const cell = v => { const s = String(v ?? ''); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const head = ['Date', 'Invoice #', 'Order', 'Client', 'Status', 'Paid', 'Due', 'Pieces', 'Sell', 'Garment cost', 'Ink cost', 'Labor', 'Profit']
  const out = [head.join(',')]
  for (const r of rows(store, range))
    out.push([r.date, r.invoice, r.title, r.client, r.status, r.paid, r.due, r.pieces,
      r.sell.toFixed(2), r.garment.toFixed(2), r.ink.toFixed(2), r.labor.toFixed(2), r.profit.toFixed(2)].map(cell).join(','))
  const runs = houseRows(store, range)
  if (runs.length) {
    out.push('', 'IN-HOUSE PRINT RUNS', ['Date', 'Product', 'Design', 'Blank', 'SKU', 'Good', 'Misprints', 'Cost per good piece', 'Total cost'].join(','))
    for (const r of runs)
      out.push([r.printed_on, r.product_name || '', r.design, r.blank_label, r.sku, r.qty_good, r.qty_misprint,
        r.cost_per_good.toFixed(2), r.total_cost.toFixed(2)].map(cell).join(','))
  }
  return out.join('\n') + '\n'
}

function toHTML(store, range) {
  const all    = rows(store, range)
  const billed = all.filter(r => r.billed)
  const revenue = billed.reduce((s, r) => s + r.sell, 0)
  const costs   = billed.reduce((s, r) => s + r.garment + r.ink, 0)
  const profit  = revenue - costs
  const pieces  = all.reduce((s, r) => s + r.pieces, 0)
  const unpaid  = (store.orders || []).filter(o => o.status === 'invoiced' && !o.paid).reduce((s, o) => s + (o.sell_price || 0), 0)
  const label   = range.from || range.to ? `${range.from || 'start'} → ${range.to || 'today'}` : 'All time'

  const byClient = {}
  for (const r of billed) {
    const c = byClient[r.client] = byClient[r.client] || { name: r.client || 'Unknown', orders: 0, pieces: 0, revenue: 0, profit: 0 }
    c.orders++; c.pieces += r.pieces; c.revenue += r.sell; c.profit += r.profit
  }
  const clients = Object.values(byClient).sort((a, b) => b.revenue - a.revenue)

  const runs  = houseRows(store, range)
  const hGood = runs.reduce((s, r) => s + r.qty_good, 0)
  const hMis  = runs.reduce((s, r) => s + r.qty_misprint, 0)
  const hCost = runs.reduce((s, r) => s + r.total_cost, 0)

  const stat = (k, v) => `<div class="stat"><div class="k">${k}</div><div class="v">${v}</div></div>`
  const table = (head, body, right = []) => `<table><thead><tr>${head.map((h, i) => `<th class="${right.includes(i) ? 'r' : ''}">${h}</th>`).join('')}</tr></thead><tbody>${
    body.map(row => `<tr>${row.map((c, i) => `<td class="${right.includes(i) ? 'r' : ''}">${c}</td>`).join('')}</tr>`).join('')}</tbody></table>`

  return `<!doctype html><html><head><meta charset="utf-8"><style>
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { font-family: -apple-system, Helvetica, Arial, sans-serif; color: #111; font-size: 10.5px; padding: 32px 36px }
    h1 { font-size: 20px } .sub { color: #666; margin: 4px 0 18px }
    h2 { font-size: 11px; letter-spacing: .12em; text-transform: uppercase; color: #15803d; margin: 22px 0 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px }
    .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px }
    .stat { border: 1px solid #e5e5e5; border-radius: 6px; padding: 8px 10px } .k { color: #777; font-size: 8.5px; text-transform: uppercase; letter-spacing: .1em } .v { font-size: 15px; font-weight: 700; margin-top: 2px }
    table { width: 100%; border-collapse: collapse } th { text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: .08em; color: #777; padding: 5px 6px; border-bottom: 1px solid #ccc }
    td { padding: 5px 6px; border-bottom: 1px solid #eee } .r { text-align: right } tr { page-break-inside: avoid }
    .note { color: #888; margin-top: 6px } .foot { color: #aaa; margin-top: 24px; font-size: 8.5px }
  </style></head><body>
    <h1>PrintFlow Report</h1><div class="sub">${esc(label)} · generated ${new Date().toLocaleString()}</div>
    <div class="stats">
      ${stat('Revenue (billed)', money(revenue))}${stat('Costs (garment + ink)', money(costs))}
      ${stat('Profit', money(profit))}${stat('Margin', revenue ? `${((profit / revenue) * 100).toFixed(1)}%` : '—')}
      ${stat('Orders', `${all.length} (${billed.length} billed)`)}${stat('Pieces', pieces)}
      ${stat('Unpaid invoices (all time)', money(unpaid))}${stat('Avg order', billed.length ? money(revenue / billed.length) : '—')}
    </div>
    <div class="note">Billed = Done, Shipped or Invoiced. Labor is operator earnings, not a cost.</div>
    ${clients.length ? `<h2>By client</h2>${table(['Client', 'Orders', 'Pieces', 'Revenue', 'Profit'],
      clients.map(c => [esc(c.name), c.orders, c.pieces, money(c.revenue), money(c.profit)]), [1, 2, 3, 4])}` : ''}
    <h2>Orders</h2>${all.length ? table(['Date', 'Order', 'Client', 'Status', 'Pcs', 'Sell', 'Cost', 'Profit'],
      all.map(r => [r.date, esc(r.title) + (r.rush ? ' ⚡' : ''), esc(r.client), r.status + (r.paid ? ` · ${r.paid === 'Yes' ? 'paid' : 'unpaid'}` : ''),
        r.pieces, money(r.sell), money(r.garment + r.ink), money(r.profit)]), [4, 5, 6, 7]) : '<div class="note">No orders in this range.</div>'}
    ${runs.length ? `<h2>In-house prints</h2>
      <div class="stats">${stat('Good pieces', hGood)}${stat('Misprints', `${hMis} (${hGood + hMis ? ((hMis / (hGood + hMis)) * 100).toFixed(1) : 0}%)`)}
      ${stat('Spent (blanks + ink)', money(hCost))}${stat('Avg cost / piece', hGood ? money(hCost / hGood) : '—')}</div>
      ${table(['Date', 'Product', 'Blank', 'Good', 'Mis', '$/pc', 'Total'],
        runs.map(r => [r.printed_on, esc(r.product_name || r.design || '—'), esc(r.blank_label), r.qty_good, r.qty_misprint, money(r.cost_per_good), money(r.total_cost)]), [3, 4, 5, 6])}` : ''}
    <div class="foot">PrintFlow · Dead Stock Cincy</div>
  </body></html>`
}

function register(ipcMain, { getStore, dialog, getWin, app, fs, path, BrowserWindow }) {
  ipcMain.handle('reports:export', async (_, { format, from, to } = {}) => {
    const store = getStore()
    const stamp = from || to ? `${from || 'start'}_to_${to || 'today'}` : 'all-time'
    const ext   = format === 'csv' ? 'csv' : 'pdf'
    const { filePath, canceled } = await dialog.showSaveDialog(getWin(), {
      defaultPath: `PrintFlow-Report-${stamp}.${ext}`,
      filters: [ext === 'csv' ? { name: 'CSV', extensions: ['csv'] } : { name: 'PDF Document', extensions: ['pdf'] }],
    })
    if (canceled || !filePath) return { ok: false }
    if (ext === 'csv') { fs.writeFileSync(filePath, toCSV(store, { from, to }), 'utf8'); return { ok: true, filePath } }
    const tmp = path.join(app.getPath('temp'), `pf-report-${Date.now()}.html`)
    fs.writeFileSync(tmp, toHTML(store, { from, to }), 'utf8')
    const w = new BrowserWindow({ show: false, webPreferences: { contextIsolation: true } })
    try {
      await w.loadURL(`file://${tmp}`)
      fs.writeFileSync(filePath, await w.webContents.printToPDF({ printBackground: true, pageSize: 'Letter' }))
    } finally {
      w.close(); try { fs.unlinkSync(tmp) } catch (_) {}
    }
    return { ok: true, filePath }
  })
}

module.exports = { register, toCSV, toHTML }
