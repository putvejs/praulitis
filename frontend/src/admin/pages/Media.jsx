import { useState, useEffect, useRef } from 'react'
import { Plus, Trash2, Music, Video, Link, FileAudio, FileVideo, Eye, EyeOff, Pencil } from 'lucide-react'
import { api } from '../api'
import Modal, { ConfirmModal } from '../components/Modal'

const EMPTY = { title: '', media_type: 'audio', youtube_url: '', description: '', event_id: '', is_public: true }

export default function Media({ toast }) {
  const [items, setItems] = useState([])
  const [events, setEvents] = useState([])
  const [tab, setTab] = useState('audio')
  const [modal, setModal] = useState(false)      // 'new' | item object
  const [editItem, setEditItem] = useState(null) // item being edited
  const [confirm, setConfirm] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [mediaFile, setMediaFile] = useState(null)
  const [thumbFile, setThumbFile] = useState(null)
  const [detectedDuration, setDetectedDuration] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(null) // 0-100 or null
  const [selected, setSelected] = useState(new Set())
  const [bulkEventId, setBulkEventId] = useState('')
  const fileRef = useRef()
  const thumbRef = useRef()

  useEffect(() => { load() }, [])

  async function load() {
    const [m, e] = await Promise.all([api.get('/media'), api.get('/events-select')])
    if (m) setItems(m)
    if (e) setEvents(e)
  }

  function openNew() {
    setForm({ ...EMPTY, media_type: tab })
    setMediaFile(null); setThumbFile(null); setDetectedDuration(null)
    setEditItem(null); setModal('new')
  }

  function openEdit(item) {
    setForm({
      title: item.title || '',
      media_type: item.media_type,
      youtube_url: item.youtube_url || '',
      description: item.description || '',
      event_id: item.event_id || '',
      is_public: !!item.is_public,
    })
    setThumbFile(null); setDetectedDuration(null)
    setEditItem(item); setModal('edit')
  }

  function toggleSelect(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSelected(s => s.size === filtered.length ? new Set() : new Set(filtered.map(x => x.id)))
  }
  async function bulkPublish(is_public) {
    const ids = [...selected]
    try {
      await api.put('/media/bulk', { ids, is_public })
      setItems(m => m.map(x => selected.has(x.id) ? { ...x, is_public: is_public ? 1 : 0 } : x))
      toast(`${ids.length} mediji ${is_public ? 'publicēti' : 'paslēpti'}`)
      setSelected(new Set())
    } catch(e) { toast(e.message, 'error') }
  }
  async function bulkAssignEvent(event_id) {
    const ids = [...selected]
    try {
      await api.put('/media/bulk', { ids, event_id: event_id || null })
      const evTitle = events.find(e => String(e.id) === String(event_id))?.title || null
      setItems(m => m.map(x => selected.has(x.id) ? { ...x, event_id: event_id || null, event_title: evTitle } : x))
      toast(`${ids.length} mediji piešķirti pasākumam`)
      setSelected(new Set())
      setBulkEventId('')
    } catch(e) { toast(e.message, 'error') }
  }
  async function bulkDelete() {
    const ids = [...selected]
    try {
      await api.delBody('/media/bulk', { ids })
      setItems(m => m.filter(x => !selected.has(x.id)))
      toast(`${ids.length} mediji dzēsti`)
      setSelected(new Set())
    } catch(e) { toast(e.message, 'error') }
    setConfirm(null)
  }

  function handleMediaFileChange(file) {
    setMediaFile(file)
    setDetectedDuration(null)
    if (!file) return
    if (form.media_type === 'audio') {
      const url = URL.createObjectURL(file)
      const el = new Audio(url)
      el.addEventListener('loadedmetadata', () => {
        if (isFinite(el.duration)) setDetectedDuration(Math.round(el.duration))
        URL.revokeObjectURL(url)
      })
    } else if (form.media_type === 'video') {
      const url = URL.createObjectURL(file)
      const el = document.createElement('video')
      el.preload = 'metadata'
      el.muted = true
      el.addEventListener('loadedmetadata', () => {
        if (isFinite(el.duration)) setDetectedDuration(Math.round(el.duration))
        // Seek to 2s (or 10% in) to capture a representative frame
        el.currentTime = Math.min(2, el.duration * 0.1)
      })
      el.addEventListener('seeked', () => {
        const canvas = document.createElement('canvas')
        canvas.width = el.videoWidth
        canvas.height = el.videoHeight
        canvas.getContext('2d').drawImage(el, 0, 0)
        canvas.toBlob(blob => {
          if (blob) {
            const thumbFile = new File([blob], 'thumb.jpg', { type: 'image/jpeg' })
            setThumbFile(thumbFile)
          }
          URL.revokeObjectURL(url)
        }, 'image/jpeg', 0.85)
      })
      el.src = url
    }
  }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function saveNew() {
    if (!form.title.trim()) { toast('Nosaukums ir obligāts', 'error'); return }
    setSaving(true)
    try {
      let presignedFilename = null
      if (mediaFile) {
        const ext = mediaFile.name.split('.').pop().toLowerCase()
        try {
          const presign = await api.post('/media/presign', { media_type: form.media_type, ext })
          if (presign && presign.url) {
            setUploadProgress(0)
            await new Promise((resolve, reject) => {
              const xhr = new XMLHttpRequest()
              xhr.upload.addEventListener('progress', e => {
                if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100))
              })
              xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) resolve()
                else reject(new Error(`S3 upload failed: ${xhr.status}`))
              })
              xhr.addEventListener('error', () => reject(new Error('Upload network error')))
              xhr.open('PUT', presign.url)
              xhr.setRequestHeader('Content-Type', presign.content_type)
              xhr.send(mediaFile)
            })
            presignedFilename = presign.filename
          }
        } catch (e) {
          // Presign not available (local mode) — fall through to server upload
          if (!e.message.includes('Direct upload')) throw e
        }
      }
      setUploadProgress(null)
      const fd = new FormData()
      Object.entries(form).forEach(([k, v]) => fd.append(k, v === true ? '1' : v === false ? '0' : String(v ?? '')))
      if (presignedFilename) {
        fd.append('presigned_filename', presignedFilename)
      } else if (mediaFile) {
        fd.append('file', mediaFile)
      }
      if (detectedDuration) fd.append('duration_sec', String(detectedDuration))
      if (thumbFile) fd.append('thumbnail', thumbFile)
      const row = await api.upload('/media', fd)
      if (row) { setItems(m => [row, ...m]); toast('Medijs pievienots'); setModal(false) }
    } catch(e) { toast(e.message, 'error') }
    setSaving(false)
  }

  async function saveEdit() {
    if (!form.title.trim()) { toast('Nosaukums ir obligāts', 'error'); return }
    setSaving(true)
    try {
      let row
      if (thumbFile || detectedDuration) {
        const fd = new FormData()
        Object.entries(form).forEach(([k, v]) => fd.append(k, v === true ? '1' : v === false ? '0' : String(v ?? '')))
        if (thumbFile) fd.append('thumbnail', thumbFile)
        if (detectedDuration) fd.append('duration_sec', String(detectedDuration))
        row = await api.uploadPut(`/media/${editItem.id}`, fd)
      } else {
        row = await api.put(`/media/${editItem.id}`, form)
      }
      if (row) {
        setItems(m => m.map(x => x.id === editItem.id ? row : x))
        toast('Medijs saglabāts'); setModal(false)
      }
    } catch(e) { toast(e.message, 'error') }
    setSaving(false)
  }

  async function del(id) {
    try {
      await api.del(`/media/${id}`)
      setItems(m => m.filter(x => x.id !== id))
      toast('Medijs dzēsts')
    } catch(e) { toast(e.message, 'error') }
    setConfirm(null)
  }

  function fmtDur(sec) {
    if (!sec) return '—'
    const m = Math.floor(sec / 60), s = sec % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  const filtered = items.filter(x => x.media_type === tab)

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Mediji</h1>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} />Pievienot</button>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selected.size} izvēlēti</span>
          <button className="btn btn-secondary btn-sm" onClick={() => bulkPublish(true)}><Eye size={13} />Publicēt</button>
          <button className="btn btn-secondary btn-sm" onClick={() => bulkPublish(false)}><EyeOff size={13} />Paslēpt</button>
          <select className="form-select" style={{ height: 30, fontSize: 12, padding: '0 8px' }}
            value={bulkEventId} onChange={e => setBulkEventId(e.target.value)}>
            <option value="">— Pasākums —</option>
            <option value="0">Noņemt pasākumu</option>
            {events.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
          {bulkEventId !== '' && (
            <button className="btn btn-secondary btn-sm" onClick={() => bulkAssignEvent(bulkEventId === '0' ? null : bulkEventId)}>Piešķirt</button>
          )}
          <button className="btn btn-danger btn-sm" onClick={() => setConfirm('bulk')}><Trash2 size={13} />Dzēst</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Atcelt</button>
        </div>
      )}

      <div className="tabs">
        <button className={`tab-btn ${tab === 'audio' ? 'active' : ''}`} onClick={() => setTab('audio')}><Music size={13} style={{ marginRight: 6 }} />Audio ({items.filter(x => x.media_type === 'audio').length})</button>
        <button className={`tab-btn ${tab === 'video' ? 'active' : ''}`} onClick={() => setTab('video')}><Video size={13} style={{ marginRight: 6 }} />Video ({items.filter(x => x.media_type === 'video').length})</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={filtered.length > 0 && selected.size === filtered.length} onChange={toggleAll} />
                </th>
                <th>Nosaukums</th>
                <th>Avots</th>
                <th>Ilgums</th>
                <th>Pasākums</th>
                <th>Publisks</th>
                <th className="col-shrink"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7}><div className="empty-state">Nav {tab === 'audio' ? 'audio' : 'video'} ierakstu</div></td></tr>
              )}
              {filtered.map(item => (
                <tr key={item.id} className={selected.has(item.id) ? 'row-selected' : ''}>
                  <td><input type="checkbox" checked={selected.has(item.id)} onChange={() => toggleSelect(item.id)} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {item.thumbnail_filename
                        ? <img className="photo-preview" src={item.thumbnail_url || `/static/uploads/photos/${item.thumbnail_filename}`} alt="" />
                        : <div style={{ width: 48, height: 48, borderRadius: 4, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', flexShrink: 0 }}>
                            {tab === 'audio' ? <FileAudio size={18} /> : <FileVideo size={18} />}
                          </div>
                      }
                      <span style={{ fontWeight: 500 }}>{item.title}</span>
                    </div>
                  </td>
                  <td className="text-muted" style={{ fontSize: 12 }}>
                    {item.youtube_url ? <span className="badge badge-neutral"><Link size={10} /> YouTube</span>
                      : item.filename ? <span className="badge badge-neutral">Fails</span> : '—'}
                  </td>
                  <td className="text-muted">{fmtDur(item.duration_sec)}</td>
                  <td className="text-muted">{item.event_title || '—'}</td>
                  <td>{item.is_public ? <span className="badge badge-success">Jā</span> : <span className="badge badge-neutral">Nē</span>}</td>
                  <td className="col-shrink">
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(item)}><Pencil size={13} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => setConfirm(item.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add new modal */}
      {modal === 'new' && (
        <Modal title="Pievienot mediju" onClose={() => setModal(false)} size="md"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(false)} disabled={saving}>Atcelt</button>
              <button className="btn btn-primary" onClick={saveNew} disabled={saving}>
                {uploadProgress !== null ? `Augšupielādē ${uploadProgress}%` : saving ? 'Saglabā...' : 'Saglabāt'}
              </button>
            </>
          }>
          <div className="form-group">
            <label className="form-label required">Nosaukums</label>
            <input className="form-control" value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Veids</label>
              <select className="form-control" value={form.media_type} onChange={e => set('media_type', e.target.value)}>
                <option value="audio">Audio</option>
                <option value="video">Video</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Pasākums</label>
              <select className="form-control" value={form.event_id} onChange={e => set('event_id', e.target.value)}>
                <option value="">— Nav saistīts —</option>
                {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
              </select>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">YouTube URL</label>
            <input className="form-control" value={form.youtube_url} onChange={e => set('youtube_url', e.target.value)} placeholder="https://youtube.com/..." />
          </div>
          {uploadProgress !== null && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>Augšupielāde S3... {uploadProgress}%</div>
              <div style={{ height: 6, borderRadius: 3, background: 'var(--border)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--accent)', transition: 'width 0.2s' }} />
              </div>
            </div>
          )}
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Fails ({form.media_type === 'audio' ? 'MP3, M4A, OGG' : 'MP4, MOV, WEBM'})</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <button className="btn btn-secondary btn-sm" onClick={() => fileRef.current?.click()}>Izvēlēties</button>
                <span className="text-muted" style={{ fontSize: 12 }}>{mediaFile ? mediaFile.name : 'Nav izvēlēts'}</span>
              </div>
              <input ref={fileRef} type="file" accept={form.media_type === 'audio' ? 'audio/*,.mp3,.m4a,.ogg,.opus' : 'video/*,.mp4,.mov,.webm'} style={{ display: 'none' }} onChange={e => handleMediaFileChange(e.target.files[0])} />
            </div>
            {form.media_type === 'video' && (
              <div className="form-group">
                <label className="form-label">Sīktēls</label>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button className="btn btn-secondary btn-sm" onClick={() => thumbRef.current?.click()}>Izvēlēties</button>
                  <span className="text-muted" style={{ fontSize: 12 }}>{thumbFile ? thumbFile.name : 'Nav'}</span>
                </div>
                <input ref={thumbRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setThumbFile(e.target.files[0])} />
              </div>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Apraksts</label>
            <textarea className="form-control" rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <label className="form-check">
            <input type="checkbox" checked={!!form.is_public} onChange={e => set('is_public', e.target.checked)} />
            Publisks
          </label>
        </Modal>
      )}

      {/* Edit modal — no file replacement, only metadata */}
      {modal === 'edit' && editItem && (
        <Modal title="Rediģēt mediju" onClose={() => setModal(false)} size="md"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(false)}>Atcelt</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Saglabā...' : 'Saglabāt'}</button>
            </>
          }>
          <div className="form-group">
            <label className="form-label required">Nosaukums</label>
            <input className="form-control" value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">Pasākums</label>
            <select className="form-control" value={form.event_id} onChange={e => set('event_id', e.target.value)}>
              <option value="">— Nav saistīts —</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">YouTube URL</label>
            <input className="form-control" value={form.youtube_url} onChange={e => set('youtube_url', e.target.value)} placeholder="https://youtube.com/..." />
          </div>
          <div className="form-group">
            <label className="form-label">Apraksts</label>
            <textarea className="form-control" rows={2} value={form.description} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Sīktēls</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {(thumbFile || editItem.thumbnail_filename) && (
                  <img src={thumbFile ? URL.createObjectURL(thumbFile) : (editItem.thumbnail_url || `/static/uploads/photos/${editItem.thumbnail_filename}`)}
                    alt="" style={{ width: 48, height: 36, objectFit: 'cover', borderRadius: 3 }} />
                )}
                <button className="btn btn-secondary btn-sm" onClick={() => thumbRef.current?.click()}>
                  {editItem.thumbnail_filename || thumbFile ? 'Mainīt' : 'Izvēlēties'}
                </button>
                {thumbFile && <span className="text-muted" style={{ fontSize: 12 }}>{thumbFile.name}</span>}
              </div>
              <input ref={thumbRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => setThumbFile(e.target.files[0])} />
            </div>
            <div className="form-group">
              <label className="form-label">Ilgums (sek.)</label>
              <input className="form-control" type="number" min="0"
                value={detectedDuration ?? editItem.duration_sec ?? ''}
                onChange={e => setDetectedDuration(e.target.value ? parseInt(e.target.value) : null)} />
            </div>
          </div>
          <label className="form-check">
            <input type="checkbox" checked={!!form.is_public} onChange={e => set('is_public', e.target.checked)} />
            Publisks
          </label>
          {editItem.filename && editItem.media_type === 'video' && (
            <div style={{ marginTop: 14, padding: '10px 12px', background: 'var(--accent-light)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                HLS: {editItem.hls_status === 'done' ? '✓ Gatavs' : editItem.hls_status === 'processing' ? '⏳ Apstrādā...' : editItem.hls_status === 'error' ? '✗ Kļūda' : '—'}
              </span>
              <button className="btn btn-secondary btn-sm" disabled={editItem.hls_status === 'processing'}
                onClick={async () => {
                  try {
                    await api.post(`/media/${editItem.id}/process`, {})
                    setEditItem(x => ({ ...x, hls_status: 'processing' }))
                    toast('HLS apstrāde sākta (fona process)')
                  } catch(e) { toast(e.message, 'error') }
                }}>
                {editItem.hls_status === 'done' ? 'Pārgenerēt HLS' : 'Ģenerēt HLS'}
              </button>
            </div>
          )}
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          message={confirm === 'bulk'
            ? `Dzēst ${selected.size} medijus? Šo darbību nevar atcelt.`
            : 'Dzēst šo mediju? Šo darbību nevar atcelt.'}
          onConfirm={() => confirm === 'bulk' ? bulkDelete() : del(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
