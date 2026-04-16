import { useState, useEffect, useCallback } from 'react'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import { ToastContainer } from './components/Toast'
import { api } from './api'
import Dashboard from './pages/Dashboard'
import Events from './pages/Events'
import Gallery from './pages/Gallery'
import Members from './pages/Members'
import Media from './pages/Media'
import Content from './pages/Content'
import Schedule from './pages/Schedule'
import Announcements from './pages/Announcements'
import UsersPage from './pages/Users'

const PAGES = { dashboard: Dashboard, events: Events, gallery: Gallery,
  members: Members, media: Media, content: Content,
  schedule: Schedule, announcements: Announcements, users: UsersPage }

export default function AdminApp() {
  const [page, setPage] = useState('dashboard')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState([])
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    api.get('/me').then(data => {
      if (data) setUser(data)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const toast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(t => [...t, { id, message, type }])
  }, [])

  const removeToast = useCallback((id) => {
    setToasts(t => t.filter(x => x.id !== id))
  }, [])

  function navigate(id) {
    setPage(id)
    setSidebarOpen(false)
  }

  if (loading) {
    return <div className="loading" style={{ height: '100vh' }}>Ielādē...</div>
  }

  const PageComponent = PAGES[page] || Dashboard

  return (
    <div className="admin-layout">
      {/* Mobile backdrop */}
      {sidebarOpen && <div className="sidebar-backdrop" onClick={() => setSidebarOpen(false)} />}

      <Sidebar page={page} setPage={navigate} open={sidebarOpen} />

      <main className="admin-main">
        {/* Mobile top bar */}
        <div className="admin-topbar">
          <button className="topbar-hamburger" onClick={() => setSidebarOpen(o => !o)} aria-label="Izvēlne">
            <Menu size={22} />
          </button>
          <span className="admin-topbar-title">🌿 Praulits</span>
        </div>

        <div className="admin-content">
          <PageComponent toast={toast} />
        </div>
      </main>
      <ToastContainer toasts={toasts} remove={removeToast} />
    </div>
  )
}
