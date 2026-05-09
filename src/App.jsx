import React, { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar.jsx'
import TitleBar from './components/TitleBar.jsx'
import Dashboard from './components/Dashboard.jsx'
import Clients from './components/Clients.jsx'
import Orders from './components/Orders.jsx'
import Assets from './components/Assets.jsx'
import Pricing from './components/Pricing.jsx'
import Production from './components/Production.jsx'
import Schedule from './components/Schedule.jsx'
import Inventory from './components/Inventory.jsx'
import Reports from './components/Reports.jsx'
import GlobalSearch from './components/GlobalSearch.jsx'

export default function App() {
  const [page, setPage]             = useState('dashboard')
  const [clientFilter, setClientFilter] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)

  function goToOrders(clientId) { setClientFilter(clientId); setPage('orders') }
  function goToAssets(clientId) { setClientFilter(clientId); setPage('assets') }

  async function handleExport() {
    await window.api.store.export()
  }

  // Cmd+K / Ctrl+K global shortcut
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setSearchOpen(s => !s)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#080a0f]">
      <TitleBar onSearch={() => setSearchOpen(true)} onExport={handleExport} />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar page={page} setPage={(p) => { setPage(p); setClientFilter(null) }} />
        <main className="flex-1 overflow-hidden">
          {page === 'dashboard'  && <Dashboard onGoToOrders={goToOrders} />}
          {page === 'clients'    && <Clients onGoToOrders={goToOrders} onGoToAssets={goToAssets} />}
          {page === 'orders'     && <Orders clientFilter={clientFilter} onClearFilter={() => setClientFilter(null)} />}
          {page === 'production' && <Production />}
          {page === 'schedule'   && <Schedule />}
          {page === 'assets'     && <Assets clientFilter={clientFilter} onClearFilter={() => setClientFilter(null)} />}
          {page === 'inventory'  && <Inventory />}
          {page === 'reports'    && <Reports />}
          {page === 'pricing'    && <Pricing />}
        </main>
      </div>

      {searchOpen && (
        <GlobalSearch
          onNavigate={(p) => { setPage(p); setClientFilter(null) }}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </div>
  )
}
