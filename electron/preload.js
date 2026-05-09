const { contextBridge, ipcRenderer } = require('electron')

const invoke = (ch, ...args) => ipcRenderer.invoke(ch, ...args)
const send = (ch) => ipcRenderer.send(ch)

contextBridge.exposeInMainWorld('api', {
  // Window
  minimize: () => send('win:minimize'),
  maximize: () => send('win:maximize'),
  close:    () => send('win:close'),

  // File dialog
  openFile: () => invoke('dialog:openFile'),

  // Clients
  clients: {
    list:   ()     => invoke('clients:list'),
    create: (d)    => invoke('clients:create', d),
    update: (d)    => invoke('clients:update', d),
    delete: (id)   => invoke('clients:delete', id),
  },

  // Orders
  orders: {
    list:   (cid)  => invoke('orders:list', cid),
    get:    (id)   => invoke('orders:get', id),
    create: (d)    => invoke('orders:create', d),
    update: (d)    => invoke('orders:update', d),
    delete: (id)   => invoke('orders:delete', id),
  },

  // Order items
  orderItems: {
    save: (d) => invoke('orderItems:save', d),
  },

  // Print types / pricing
  printTypes: {
    list:   ()   => invoke('printTypes:list'),
    create: (d)  => invoke('printTypes:create', d),
    update: (d)  => invoke('printTypes:update', d),
    delete: (id) => invoke('printTypes:delete', id),
  },

  // Assets
  assets: {
    list:   (cid) => invoke('assets:list', cid),
    create: (d)   => invoke('assets:create', d),
    update: (d)   => invoke('assets:update', d),
    delete: (id)  => invoke('assets:delete', id),
  },

  // Stats
  stats: { get: () => invoke('stats:get') },
})
