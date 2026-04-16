import { useState, useEffect, useRef, useCallback } from 'react'
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd'
import { Upload, Pencil, Trash2, GripVertical, EyeOff, Eye } from 'lucide-react'
import { api } from '../api'
import Modal, { ConfirmModal } from '../components/Modal'

export default function Gallery({ toast }) {
  const [photos, setPhotos] = useState([])
  const [events, setEvents] = useState([])
  const [editModal, setEditModal] = useState(null)
  const [uploadModal, setUploadModal] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [form, setForm] = useState({})
  const [drag, setDrag] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const [bulkEventId, setBulkEventId] = useState('')
  const fileRef = useRef()
  const uploadRef = useRef()

  useEffect(() => { load() }, [])

  async function load() {
    const [p, e] = await Promise.all([api.get('/gallery'), api.get('/events-select')])
    if (p) setPhotos(p)
    if (e) setEvents(e)
  }

  function openEdit(photo) {
    setForm({ caption: photo.caption || '', album: photo.album || '', event_id: photo.event_id || '', is_public: !!photo.is_public, sort_order: photo.sort_order || 0 })
    setEditModal(photo)
  }

  async function saveEdit() {
    setSaving(true)
    try {
      const row = await api.put(`/gallery/${editModal.id}`, { ...form, event_id: form.event_id || null })
      if (row) { setPhotos(p => p.map(x => x.id === editModal.id ? row : x)); toast('Foto atjaunināts'); setEditModal(null) }
    } catch(e) { toast(e.message, 'error') }
    setSaving(false)
  }

  async function del(id) {
    await api.del(`/gallery/${id}`)
    setPhotos(p => p.filter(x => x.id !== id))
    toast('Foto dzēsts')
    setConfirm(null)
  }

  async function handleUpload(files) {
    if (!files.length) return
    setUploading(true)
    const all = Array.from(files)
    let uploaded = 0
    let failed = 0
    for (const f of all) {
      try {
        const fd = new FormData()
        fd.append('photos', f)
        fd.append('is_public', '1')
        const res = await api.upload('/gallery/upload', fd)
        if (res && res.uploaded > 0) uploaded++
        else failed++
      } catch(e) { failed++ }
      setUploading(`${uploaded + failed}/${all.length}`)
    }
    setUploading(false)
    setUploadModal(false)
    load()
    if (failed === 0) toast(`Augšupielādētas ${uploaded} fotogrāfijas`)
    else toast(`${uploaded} augšupielādētas, ${failed} neizdevās`, failed > 0 ? 'error' : 'success')
  }

  const longPressTimer = useRef(null)
  const lastSelected = useRef(null)

  function toggleSelect(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSelected(s => s.size === photos.length ? new Set() : new Set(photos.map(p => p.id)))
  }

  const onItemPointerDown = useCallback((id) => {
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null
      lastSelected.current = id
      setSelected(s => { const n = new Set(s); n.add(id); return n })
    }, 400)
  }, [])

  const onItemPointerUp = useCallback(() => {
    if (longPressTimer.current) { clearTimeout(longPressTimer.current); longPressTimer.current = null }
  }, [])

  const onItemClick = useCallback((id, e) => {
    if (longPressTimer.current) return
    // Desktop: Shift+click = range, Ctrl/Cmd+click = toggle, plain click = toggle (if in selection mode)
    if (e.shiftKey && lastSelected.current !== null) {
      const ids = photos.map(p => p.id)
      const a = ids.indexOf(lastSelected.current)
      const b = ids.indexOf(id)
      const range = ids.slice(Math.min(a, b), Math.max(a, b) + 1)
      setSelected(s => { const n = new Set(s); range.forEach(rid => n.add(rid)); return n })
    } else if (e.ctrlKey || e.metaKey) {
      lastSelected.current = id
      setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
    } else {
      // plain click — toggle if already in selection mode, else ignore
      if (selected.size > 0) {
        lastSelected.current = id
        setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
      }
    }
  }, [photos, selected])
  async function bulkPublish(is_public) {
    const ids = [...selected]
    try {
      await api.put('/gallery/bulk', { ids, is_public })
      setPhotos(p => p.map(x => selected.has(x.id) ? { ...x, is_public: is_public ? 1 : 0 } : x))
      toast(`${ids.length} foto ${is_public ? 'publicētas' : 'paslēptas'}`)
      setSelected(new Set())
    } catch(e) { toast(e.message, 'error') }
  }
  async function bulkAssignEvent(event_id) {
    const ids = [...selected]
    try {
      await api.put('/gallery/bulk', { ids, event_id: event_id || null })
      const evTitle = events.find(e => String(e.id) === String(event_id))?.title || null
      setPhotos(p => p.map(x => selected.has(x.id) ? { ...x, event_id: event_id || null, event_title: evTitle } : x))
      toast(`${ids.length} foto piešķirtas pasākumam`)
      setSelected(new Set())
      setBulkEventId('')
    } catch(e) { toast(e.message, 'error') }
  }
  async function bulkDelete() {
    const ids = [...selected]
    try {
      await api.delBody('/gallery/bulk', { ids })
      setPhotos(p => p.filter(x => !selected.has(x.id)))
      toast(`${ids.length} foto dzēstas`)
      setSelected(new Set())
    } catch(e) { toast(e.message, 'error') }
    setConfirm(null)
  }

  async function onDragEnd(result) {
    if (!result.destination) return
    const items = Array.from(photos)
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)
    const reordered = items.map((p, i) => ({ ...p, sort_order: i }))
    setPhotos(reordered)
    await api.post('/gallery/reorder', reordered.map(p => ({ id: p.id, sort_order: p.sort_order })))
  }

  function DropZone({ onFiles }) {
    const [over, setOver] = useState(false)
    return (
      <div
        className={`upload-area ${over ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setOver(true) }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); onFiles(e.dataTransfer.files) }}
        onClick={() => uploadRef.current?.click()}
      >
        <Upload size={28} style={{ margin: '0 auto 8px', display: 'block' }} />
        <strong>Pievienot fotogrāfijas</strong>
        <p>Klikšķiniet vai velciet šeit</p>
        <p style={{ marginTop: 8, fontSize: 11 }}>JPG, PNG, WEBP, GIF</p>
        <input ref={uploadRef} type="file" multiple accept="image/*" style={{ display: 'none' }}
          onChange={e => onFiles(e.target.files)} />
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Galerija <span className="text-muted" style={{ fontSize: 14, fontWeight: 400 }}>({photos.length})</span></h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {photos.length > 0 && (
            <button className="btn btn-secondary" onClick={toggleAll}>
              {selected.size === photos.length ? 'Noņemt visus' : 'Izvēlēties visus'}
            </button>
          )}
          <button className="btn btn-primary" onClick={() => setUploadModal(true)}><Upload size={15} />Augšupielādēt</button>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selected.size} izvēlētas</span>
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

      {photos.length === 0 ? (
        <div className="card"><div className="card-body"><div className="empty-state"><Upload size={32} /><strong>Nav fotogrāfiju</strong><p>Augšupielādējiet fotogrāfijas, noklikšķinot uz pogas augšā.</p></div></div></div>
      ) : (
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="gallery" direction="horizontal">
            {(provided) => (
              <div className="gallery-grid" ref={provided.innerRef} {...provided.droppableProps}>
                {photos.map((photo, index) => (
                  <Draggable key={photo.id} draggableId={String(photo.id)} index={index}>
                    {(prov, snapshot) => (
                      <div ref={prov.innerRef} {...prov.draggableProps}
                        className={`gallery-item${selected.has(photo.id) ? ' is-selected' : ''}`}
                        style={{ ...prov.draggableProps.style, opacity: snapshot.isDragging ? .85 : 1 }}
                        onPointerDown={() => onItemPointerDown(photo.id)}
                        onPointerUp={onItemPointerUp}
                        onPointerCancel={onItemPointerUp}
                        onClick={(e) => onItemClick(photo.id, e)}>
                        <img src={photo.url || `/static/uploads/photos/${photo.filename}`} alt={photo.caption || ''} loading="lazy" />
                        <div className="gallery-drag-handle" {...prov.dragHandleProps}>
                          <GripVertical size={16} />
                        </div>
                        {/* onPointerDown stops drag starting; onChange on input handles toggle */}
                        <div className="gallery-item-select" onPointerDown={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(photo.id)} onChange={() => { lastSelected.current = photo.id; toggleSelect(photo.id) }} />
                        </div>
                        {!photo.is_public && (
                          <div className="gallery-item-badge"><span className="badge badge-warning"><EyeOff size={10} /></span></div>
                        )}
                        <div className="gallery-item-overlay">
                          <div className="gallery-item-actions">
                            <button className="btn btn-primary btn-icon btn-sm" onClick={() => openEdit(photo)}><Pencil size={12} /></button>
                            <button className="btn btn-danger btn-icon btn-sm" onClick={() => setConfirm(photo.id)}><Trash2 size={12} /></button>
                          </div>
                        </div>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {uploadModal && (
        <Modal title="Augšupielādēt fotogrāfijas" onClose={() => setUploadModal(false)} size="md"
          footer={<button className="btn btn-secondary" onClick={() => setUploadModal(false)}>Aizvērt</button>}>
          {uploading
            ? <div className="loading">Augšupielādē {typeof uploading === 'string' ? uploading : ''}...</div>
            : <DropZone onFiles={handleUpload} />
          }
        </Modal>
      )}

      {editModal && (
        <Modal title="Rediģēt fotogrāfiju" onClose={() => setEditModal(null)} size="sm"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setEditModal(null)}>Atcelt</button>
              <button className="btn btn-primary" onClick={saveEdit} disabled={saving}>{saving ? 'Saglabā...' : 'Saglabāt'}</button>
            </>
          }>
          <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
            <img src={editModal.url || `/static/uploads/photos/${editModal.filename}`} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="form-group">
                <label className="form-label">Albums</label>
                <input className="form-control" value={form.album} onChange={e => setForm(f => ({ ...f, album: e.target.value }))} />
              </div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Apraksts</label>
            <input className="form-control" value={form.caption} onChange={e => setForm(f => ({ ...f, caption: e.target.value }))} />
          </div>
          <div className="form-group">
            <label className="form-label">Pasākums</label>
            <select className="form-control" value={form.event_id} onChange={e => setForm(f => ({ ...f, event_id: e.target.value }))}>
              <option value="">— Nav saistīts —</option>
              {events.map(ev => <option key={ev.id} value={ev.id}>{ev.title} ({ev.event_date})</option>)}
            </select>
          </div>
          <label className="form-check">
            <input type="checkbox" checked={!!form.is_public} onChange={e => setForm(f => ({ ...f, is_public: e.target.checked }))} />
            Publiska
          </label>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          message={confirm === 'bulk'
            ? `Dzēst ${selected.size} fotogrāfijas? Šo darbību nevar atcelt.`
            : 'Dzēst šo fotogrāfiju? Šo darbību nevar atcelt.'}
          onConfirm={() => confirm === 'bulk' ? bulkDelete() : del(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
