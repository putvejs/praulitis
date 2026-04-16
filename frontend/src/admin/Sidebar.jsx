import {
  LayoutDashboard, CalendarDays, Image, Users, Music,
  FileText, Bell, Clock, ExternalLink, LogOut, GripVertical, UserCog
} from 'lucide-react'

const NAV = [
  {
    label: 'Saturs',
    items: [
      { id: 'dashboard',     label: 'Kopsavilkums',  icon: LayoutDashboard },
      { id: 'events',        label: 'Pasākumi',       icon: CalendarDays },
      { id: 'gallery',       label: 'Galerija',       icon: Image },
      { id: 'media',         label: 'Mediji',         icon: Music },
      { id: 'members',       label: 'Dalībnieki',     icon: Users },
      { id: 'content',       label: 'Teksts',         icon: FileText },
    ]
  },
  {
    label: 'Organizācija',
    items: [
      { id: 'announcements', label: 'Paziņojumi',     icon: Bell },
      { id: 'schedule',      label: 'Mēģinājumi',     icon: Clock },
      { id: 'users',         label: 'Lietotāji',      icon: UserCog },
    ]
  }
]

export default function Sidebar({ page, setPage, open }) {
  return (
    <aside className={`admin-sidebar${open ? ' open' : ''}`}>
      <div className="sidebar-logo">
        <div className="sidebar-logo-title">🌿 Praulits</div>
        <div className="sidebar-logo-sub">Administrācija</div>
      </div>

      {NAV.map(section => (
        <div key={section.label} className="sidebar-section">
          <div className="sidebar-section-label">{section.label}</div>
          {section.items.map(item => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                className={`nav-item ${page === item.id ? 'active' : ''}`}
                onClick={() => setPage(item.id)}
              >
                <Icon size={16} />
                {item.label}
              </button>
            )
          })}
        </div>
      ))}

      <div className="sidebar-bottom">
        <a href="/" target="_blank" rel="noreferrer" className="nav-item" style={{ display: 'flex' }}>
          <ExternalLink size={15} />
          Skatīt lapu
        </a>
        <a href="/logout" className="nav-item" style={{ display: 'flex' }}>
          <LogOut size={15} />
          Iziet
        </a>
      </div>
    </aside>
  )
}
