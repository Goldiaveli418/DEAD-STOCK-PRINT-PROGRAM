import React, { useState } from 'react'
import Sidebar from './components/Sidebar.jsx'
import TitleBar from './components/TitleBar.jsx'
import Dashboard from './components/Dashboard.jsx'
import Clients from './components/Clients.jsx'
import Orders from './components/Orders.jsx'
import Assets from './components/Assets.jsx'
import Pricing from './components/Pricing.jsx'

export default function App() {
  const [page, setPage] = useState('dashboard')
  const [clientFilter, setClientFilter] = useState(null)

  function goToOrders(clientId) {
    setClientFilter(clientId)
    setPage('orders')
  }

  function goToAssets(clientId) {
    setClientFilter(clientId)
    setPage('assets')
  }

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#080a0f]">
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar page={page} setPage={(p) => { setPage(p); setClientFilter(null) }} />
        <main className="flex-1 overflow-hidden">
          {page === 'dashboard' && <Dashboard onGoToOrders={goToOrders} />}
          {page === 'clients'   && <Clients onGoToOrders={goToOrders} onGoToAssets={goToAssets} />}
          {page === 'orders'    && <Orders clientFilter={clientFilter} onClearFilter={() => setClientFilter(null)} />}
          {page === 'assets'    && <Assets clientFilter={clientFilter} onClearFilter={() => setClientFilter(null)} />}
          {page === 'pricing'   && <Pricing />}
        </main>
      </div>
    </div>
  )
}
