import { useState, useEffect } from 'react'
import { CalendarDays, Image, Users, Music, Bell, AlertCircle } from 'lucide-react'
import { api } from '../api'

const STATS = [
  { key: 'events',        label: 'Pasākumi',       icon: CalendarDays },
  { key: 'photos',        label: 'Fotogrāfijas',   icon: Image },
  { key: 'members',       label: 'Aktīvie dalībn.', icon: Users },
  { key: 'media',         label: 'Mediji',          icon: Music },
  { key: 'announcements', label: 'Paziņojumi',      icon: Bell },
  { key: 'pending_photos',label: 'Slēptie foto',    icon: AlertCircle },
]

export default function Dashboard() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    api.get('/stats').then(d => d && setStats(d))
  }, [])

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Kopsavilkums</h1>
      </div>

      {stats ? (
        <div className="stats-grid">
          {STATS.map(({ key, label, icon: Icon }) => (
            <div key={key} className="stat-card">
              <div className="stat-icon"><Icon size={22} /></div>
              <div className="stat-value">{stats[key] ?? 0}</div>
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="loading">Ielādē...</div>
      )}

      <div className="card">
        <div className="card-body" style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Laipni lūgti Praulits administrācijā. Izmantojiet kreisās puses izvēlni, lai pārvaldītu saturu.
        </div>
      </div>
    </div>
  )
}
