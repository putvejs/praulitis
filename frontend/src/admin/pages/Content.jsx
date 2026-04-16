import { useState, useEffect, useRef } from 'react'
import { Save, Upload, Image } from 'lucide-react'
import { api } from '../api'

const LABELS = {
  home_intro:    'Ievads (mājaslapa)',
  hero_quote:    'Varoņattēls — citāts',
  hero_location: 'Varoņattēls — vieta',
  about_history: 'Par kopu / Vēsture',
  contact_text:  'Kontaktinformācija',
}

// Keys rendered as image upload, not textarea
const IMAGE_KEYS = ['hero_image']

export default function Content({ toast }) {
  const [blocks, setBlocks] = useState([])
  const [values, setValues] = useState({})
  const [saving, setSaving] = useState({})
  const [heroImageUrl, setHeroImageUrl] = useState(null)
  const [uploadingHero, setUploadingHero] = useState(false)
  const heroFileRef = useRef(null)

  useEffect(() => { load() }, [])

  async function load() {
    const data = await api.get('/content')
    if (data) {
      setBlocks(data)
      const v = {}
      data.forEach(b => { v[b.key] = b.content })
      setValues(v)
      if (v.hero_image) setHeroImageUrl(v.hero_image)
    }
  }

  async function saveBlock(key) {
    setSaving(s => ({ ...s, [key]: true }))
    try {
      await api.put('/content', { [key]: values[key] })
      toast('Saturs saglabāts')
    } catch(e) { toast(e.message, 'error') }
    setSaving(s => ({ ...s, [key]: false }))
  }

  async function saveAll() {
    setSaving(s => ({ ...s, all: true }))
    try {
      await api.put('/content', values)
      toast('Viss saturs saglabāts')
    } catch(e) { toast(e.message, 'error') }
    setSaving(s => ({ ...s, all: false }))
  }

  async function uploadHeroImage(file) {
    if (!file) return
    setUploadingHero(true)
    try {
      const form = new FormData()
      form.append('image', file)
      const res = await fetch('/api/admin/content/hero-image', {
        method: 'POST', body: form, credentials: 'include'
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Kļūda')
      setHeroImageUrl(data.url)
      setValues(v => ({ ...v, hero_image: data.url }))
      toast('Attēls augšupielādēts')
    } catch(e) { toast(e.message, 'error') }
    setUploadingHero(false)
  }

  const textBlocks = blocks.filter(b => !IMAGE_KEYS.includes(b.key))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Teksts</h1>
        <button className="btn btn-primary" onClick={saveAll} disabled={saving.all}>
          <Save size={15} />{saving.all ? 'Saglabā...' : 'Saglabāt visu'}
        </button>
      </div>

      {/* Hero image upload */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title"><Image size={14} style={{ marginRight: 6 }} />Varoņattēls — fotoattēls</span>
        </div>
        <div className="card-body" style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
          <div style={{ width: 120, height: 160, borderRadius: 8, overflow: 'hidden', background: '#1c3a2e', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {heroImageUrl
              ? <img src={heroImageUrl} alt="Hero" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ color: 'rgba(196,123,30,.4)', fontSize: 32 }}>✦</span>}
          </div>
          <div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              Augšupielādējiet attēlu, kas tiks rādīts mājas lapas galvenajā sadaļā. Ieteicamais formāts: vertikāls (3:4).
            </p>
            <input
              ref={heroFileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => uploadHeroImage(e.target.files[0])}
            />
            <button className="btn btn-secondary" onClick={() => heroFileRef.current?.click()} disabled={uploadingHero}>
              <Upload size={14} />{uploadingHero ? 'Augšupielādē...' : 'Izvēlēties attēlu'}
            </button>
          </div>
        </div>
      </div>

      {/* Text content blocks */}
      {textBlocks.map(block => (
        <div key={block.key} className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">{LABELS[block.key] || block.key}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {block.updated_at && (
                <span className="text-muted" style={{ fontSize: 11 }}>Mainīts: {block.updated_at.slice(0, 16).replace('T', ' ')}</span>
              )}
              <button className="btn btn-secondary btn-sm" onClick={() => saveBlock(block.key)} disabled={saving[block.key]}>
                <Save size={12} />{saving[block.key] ? 'Saglabā...' : 'Saglabāt'}
              </button>
            </div>
          </div>
          <div className="card-body">
            <textarea
              className="form-control"
              rows={5}
              value={values[block.key] || ''}
              onChange={e => setValues(v => ({ ...v, [block.key]: e.target.value }))}
              style={{ fontFamily: 'inherit', lineHeight: 1.6 }}
            />
          </div>
        </div>
      ))}

      {blocks.length === 0 && (
        <div className="card"><div className="card-body"><div className="loading">Ielādē...</div></div></div>
      )}
    </div>
  )
}
