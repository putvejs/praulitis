import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Eye, EyeOff } from 'lucide-react'
import { api } from '../api'
import Modal, { ConfirmModal } from '../components/Modal'

const TYPE_LABELS = { concert: 'Koncerts', festival: 'Festivāls', rehearsal: 'Mēģinājums', workshop: 'Seminārs' }
const EMPTY = { title: '', event_date: '', event_time: '', end_date: '', location: '', description: '', event_type: 'concert', is_public: true, slug: '' }

export default function Events({ toast }) {
  const [events, setEvents] = useState([])
  const [modal, setModal] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [selected, setSelected] = useState(new Set())

  useEffect(() => { load() }, [])

  async function load() {
    const data = await api.get('/events')
    if (data) setEvents(data)
  }

  function openNew() { setForm(EMPTY); setModal({ mode: 'new' }) }
  function openEdit(ev) { setForm({ ...ev, is_public: !!ev.is_public }); setModal({ mode: 'edit', id: ev.id }) }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  function toggleSelect(id) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function toggleAll() {
    setSelected(s => s.size === events.length ? new Set() : new Set(events.map(e => e.id)))
  }

  async function bulkPublish(is_public) {
    const ids = [...selected]
    await api.put('/events/bulk', { ids, is_public })
    setEvents(ev => ev.map(e => selected.has(e.id) ? { ...e, is_public: is_public ? 1 : 0 } : e))
    toast(`${ids.length} pasākumi ${is_public ? 'publicēti' : 'paslēpti'}`)
    setSelected(new Set())
  }

  async function save() {
    if (!form.title || !form.event_date) { toast('Aizpildiet obligātos laukus', 'error'); return }
    setSaving(true)
    try {
      if (modal.mode === 'new') {
        const row = await api.post('/events', form)
        if (row) { setEvents(e => [row, ...e]); toast('Pasākums izveidots'); setModal(null) }
      } else {
        const row = await api.put(`/events/${modal.id}`, form)
        if (row) { setEvents(e => e.map(x => x.id === modal.id ? row : x)); toast('Pasākums saglabāts'); setModal(null) }
      }
    } catch(e) { toast(e.message, 'error') }
    setSaving(false)
  }

  async function del(id) {
    await api.del(`/events/${id}`)
    setEvents(e => e.filter(x => x.id !== id))
    toast('Pasākums dzēsts')
    setConfirm(null)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Pasākumi</h1>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} />Jauns pasākums</button>
      </div>

      {selected.size > 0 && (
        <div className="bulk-bar">
          <span className="bulk-count">{selected.size} izvēlēti</span>
          <button className="btn btn-secondary btn-sm" onClick={() => bulkPublish(true)}><Eye size={13} />Publicēt</button>
          <button className="btn btn-secondary btn-sm" onClick={() => bulkPublish(false)}><EyeOff size={13} />Paslēpt</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>Atcelt</button>
        </div>
      )}

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={events.length > 0 && selected.size === events.length}
                    onChange={toggleAll} />
                </th>
                <th>Nosaukums</th>
                <th>Datums</th>
                <th>Veids</th>
                <th>Vieta</th>
                <th>Publisks</th>
                <th className="col-shrink"></th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 && (
                <tr><td colSpan={7} className="empty-state">Nav pasākumu</td></tr>
              )}
              {events.map(ev => (
                <tr key={ev.id} className={selected.has(ev.id) ? 'row-selected' : ''}>
                  <td><input type="checkbox" checked={selected.has(ev.id)} onChange={() => toggleSelect(ev.id)} /></td>
                  <td><span className="truncate">{ev.title}</span></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{ev.event_date}</td>
                  <td><span className="badge badge-neutral">{TYPE_LABELS[ev.event_type] || ev.event_type}</span></td>
                  <td className="text-muted">{ev.location || '—'}</td>
                  <td>{ev.is_public ? <span className="badge badge-success">Jā</span> : <span className="badge badge-neutral">Nē</span>}</td>
                  <td className="col-shrink">
                    <div className="actions">
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(ev)}><Pencil size={14} /></button>
                      <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => setConfirm(ev.id)}><Trash2 size={14} /></button>
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
          title={modal.mode === 'new' ? 'Jauns pasākums' : 'Rediģēt pasākumu'}
          onClose={() => setModal(null)}
          size="lg"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Atcelt</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Saglabā...' : 'Saglabāt'}</button>
            </>
          }
        >
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label required">Nosaukums</label>
              <input className="form-control" value={form.title} onChange={e => set('title', e.target.value)} autoFocus />
            </div>
            <div className="form-group">
              <label className="form-label">Veids</label>
              <select className="form-control" value={form.event_type} onChange={e => set('event_type', e.target.value)}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label required">Datums</label>
              <input type="date" className="form-control" value={form.event_date} onChange={e => set('event_date', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Laiks</label>
              <input type="time" className="form-control" value={form.event_time || ''} onChange={e => set('event_time', e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">Beigu datums</label>
              <input type="date" className="form-control" value={form.end_date || ''} onChange={e => set('end_date', e.target.value)} />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Vieta</label>
            <input className="form-control" value={form.location || ''} onChange={e => set('location', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Apraksts</label>
            <textarea className="form-control" rows={4} value={form.description || ''} onChange={e => set('description', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">URL slug</label>
              <input className="form-control" value={form.slug || ''} onChange={e => set('slug', e.target.value)} placeholder="Auto no nosaukuma" />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 14 }}>
              <label className="form-check">
                <input type="checkbox" checked={!!form.is_public} onChange={e => set('is_public', e.target.checked)} />
                Publisks
              </label>
            </div>
          </div>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal
          message="Dzēst šo pasākumu? Šo darbību nevar atcelt."
          onConfirm={() => del(confirm)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
