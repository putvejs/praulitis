import { useState, useEffect, useRef } from 'react'
import { Plus, Pencil, Trash2, UserCheck, UserX, UserCheck2, UserMinus } from 'lucide-react'
import { api } from '../api'
import Modal, { ConfirmModal } from '../components/Modal'

const EMPTY = { name: '', role: '', bio: '', sort_order: 0, is_active: true, joined_year: '' }

export default function Members({ toast }) {
  const [members, setMembers] = useState([])
  const [modal, setModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [photoFile, setPhotoFile] = useState(null)
  const [photoPreview, setPhotoPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(new Set())
  const fileRef = useRef()

  useEffect(() => { load() }, [])

  async function load() {
    const data = await api.get('/members')
    if (data) setMembers(data)
  }

  function openNew() { setForm(EMPTY); setPhotoFile(null); setPhotoPreview(null); setModal({ mode: 'new' }) }
  function openEdit(m) {
    setForm({ name: m.name, role: m.role || '', bio: m.bio || '', sort_order: m.sort_order || 0, is_active: !!m.is_active, joined_year: m.joined_year || '' })
    setPhotoFile(null)
    setPhotoPreview(m.photo_filename ? `/static/uploads/photos/${m.photo_filename}` : null)
    setModal({ mode: 'edit', id: m.id, existing_photo: m.photo_filename })
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function onPhoto(e) {
    const file = e.target.files[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function save() {
    if (!form.name.trim()) { toast('Vārds ir obligāts', 'error'); return }
    setSaving(true)
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v === true ? '1' : v === false ? '0' : String(v ?? '')))
    if (photoFile) fd.append('photo', photoFile)
    try {
      if (modal.mode === 'new') {
        const row = await api.upload('/members', fd)
        if (row) { setMembers(m => [...m, row].sort((a, b) => a.sort_order - b.sort_order || a.name.localeCompare(b.name))); toast('Dalībnieks izveidots'); setModal(null) }
      } else {
        const row = await api.uploadPut(`/members/${modal.id}`, fd)
        if (row) { setMembers(m => m.map(x => x.id === modal.id ? row : x)); toast('Dalībnieks saglabāts'); setModal(null) }
      }
    } catch(e) { toast(e.message, 'error') }
    setSaving(false)
  }

  async function del(id) {
    await api.del(`/members/${id}`)
    setMembers(m => m.filter(x => x.id !== id))
    toast('Dalībnieks dzēsts')
    setConfirm(null)
  }

  function toggleSelect(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSelected(s => s.size === members.length ? new Set() : new Set(members.map(m => m.id)))
  }
  async function bulkSetActive(is_active) {
    const ids = [...selected]
    await api.put('/members/bulk', { ids, is_active })
    setMembers(m => m.map(x => selected.has(x.id) ? { ...x, is_active: is_active ? 1 : 0 } : x))
    toast(`${ids.length} dalībnieki ${is_active ? 'aktivizēti' : 'deaktivizēti'}`)
    setSelected(new Set())
  }

  function initials(name) {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Dalībnieki</h1>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} />Jauns dalībnieks</button>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selected.size} izvēlēti</span>
          <button className="btn btn-secondary btn-sm" onClick={() => bulkSetActive(true)}><UserCheck size={13} />Aktivizēt</button>
          <button className="btn btn-secondary btn-sm" onClick={() => bulkSetActive(false)}><UserMinus size={13} />Deaktivizēt</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Atcelt</button>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={members.length > 0 && selected.size === members.length} onChange={toggleAll} />
                </th>
                <th style={{ width: 48 }}></th>
                <th>Vārds</th>
                <th>Loma / Instruments</th>
                <th>Pievienojās</th>
                <th>Aktīvs</th>
                <th>Kārta</th>
                <th className="col-shrink"></th>
              </tr>
            </thead>
            <tbody>
              {members.length === 0 && (
                <tr><td colSpan={8}><div className="empty-state">Nav dalībnieku</div></td></tr>
              )}
              {members.map(m => (
                <tr key={m.id} className={selected.has(m.id) ? 'row-selected' : ''}>
                  <td><input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleSelect(m.id)} /></td>
                  <td>
                    {m.photo_filename
                      ? <img className="member-photo" src={`/static/uploads/photos/${m.photo_filename}`} alt="" />
                      : <div className="member-initials">{initials(m.name)}</div>}
                  </td>
                  <td style={{ fontWeight: 500 }}>{m.name}</td>
                  <td className="text-muted">{m.role || '—'}</td>
                  <td className="text-muted">{m.joined_year || '—'}</td>
                  <td>
                    {m.is_active
                      ? <span className="badge badge-success"><UserCheck size={11} />Jā</span>
                      : <span className="badge badge-neutral"><UserX size={11} />Nē</span>}
                  </td>
                  <td className="text-muted">{m.sort_order}</td>
                  <td className="col-shrink">
                    <div className="actions">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(m)}><Pencil size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => setConfirm(m.id)}><Trash2 size={14} /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <Modal
          title={modal.mode === 'new' ? 'Jauns dalībnieks' : 'Rediģēt dalībnieku'}
          onClose={() => setModal(null)} size="md"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Atcelt</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saglabā...' : 'Saglabāt'}</button>
            </>
          }>
          <div style={{ display: 'flex', gap: 16, marginBottom: 14, alignItems: 'flex-start' }}>
            <div style={{ flexShrink: 0, textAlign: 'center' }}>
              {photoPreview
                ? <img src={photoPreview} style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border)' }} alt="" />
                : <div className="member-initials" style={{ width: 72, height: 72, fontSize: 20 }}>{form.name ? initials(form.name) : '?'}</div>}
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => fileRef.current?.click()}>Mainīt foto</button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onPhoto} />
            </div>
            <div style={{ flex: 1 }}>
              <div className="form-group">
                <label className="form-label required">Vārds, uzvārds</label>
                <input className="form-control" value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
              </div>
              <div className="form-group">
                <label className="form-label">Loma / Instruments</label>
                <input className="form-control" value={form.role} onChange={e => set('role', e.target.value)} placeholder="Dziedātāja · Vijolniece" />
              </div>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Biogrāfija</label>
            <textarea className="form-control" rows={3} value={form.bio} onChange={e => set('bio', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Pievienojās (gads)</label>
              <input type="number" className="form-control" value={form.joined_year} onChange={e => set('joined_year', e.target.value)} placeholder="2018" />
            </div>
            <div className="form-group">
              <label className="form-label">Kārtas nr.</label>
              <input type="number" className="form-control" value={form.sort_order} onChange={e => set('sort_order', parseInt(e.target.value) || 0)} />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 14 }}>
              <label className="form-check">
                <input type="checkbox" checked={!!form.is_active} onChange={e => set('is_active', e.target.checked)} />
                Aktīvs
              </label>
            </div>
          </div>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal message="Dzēst šo dalībnieku?" onConfirm={() => del(confirm)} onCancel={() => setConfirm(null)} />
      )}
    </div>
  )
}
