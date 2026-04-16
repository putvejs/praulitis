import { useState, useEffect } from 'react'
import { Plus, Trash2, Clock, Pencil, Save, X } from 'lucide-react'
import { api } from '../api'
import { ConfirmModal } from '../components/Modal'

const DAYS = ["Pirmdiena", "Otrdiena", "Trešdiena", "Ceturtdiena", "Piektdiena", "Sestdiena", "Svētdiena"]
const EMPTY_SLOT = { day_of_week: 2, time_of_day: '18:00', location: 'Prauliena', is_active: true, note: '' }
const EMPTY_EX = { rehearsal_date: '', is_cancelled: true, note: '' }

export default function Schedule({ toast }) {
  const [slots, setSlots] = useState([])
  const [exceptions, setExceptions] = useState([])
  const [editSlot, setEditSlot] = useState(null)   // null | 'new' | slot object
  const [slotForm, setSlotForm] = useState(EMPTY_SLOT)
  const [exForm, setExForm] = useState(EMPTY_EX)
  const [confirm, setConfirm] = useState(null)     // { type: 'slot'|'ex', id }
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const data = await api.get('/schedule')
    if (data) { setSlots(data.slots); setExceptions(data.exceptions) }
  }

  function openNewSlot() {
    setSlotForm(EMPTY_SLOT)
    setEditSlot('new')
  }

  function openEditSlot(slot) {
    setSlotForm({
      day_of_week: slot.day_of_week,
      time_of_day: slot.time_of_day,
      location: slot.location || '',
      is_active: !!slot.is_active,
      note: slot.note || '',
    })
    setEditSlot(slot)
  }

  function setS(k, v) { setSlotForm(f => ({ ...f, [k]: v })) }
  function setE(k, v) { setExForm(f => ({ ...f, [k]: v })) }

  async function saveSlot() {
    if (!slotForm.time_of_day) { toast('Laiks ir obligāts', 'error'); return }
    setSaving(true)
    try {
      if (editSlot === 'new') {
        const row = await api.post('/schedule/slots', slotForm)
        if (row) { setSlots(s => [...s, row].sort((a, b) => a.day_of_week - b.day_of_week || a.time_of_day.localeCompare(b.time_of_day))); toast('Grafiks pievienots') }
      } else {
        const row = await api.put(`/schedule/slots/${editSlot.id}`, slotForm)
        if (row) { setSlots(s => s.map(x => x.id === editSlot.id ? row : x).sort((a, b) => a.day_of_week - b.day_of_week || a.time_of_day.localeCompare(b.time_of_day))); toast('Grafiks saglabāts') }
      }
      setEditSlot(null)
    } catch(e) { toast(e.message, 'error') }
    setSaving(false)
  }

  async function deleteSlot(id) {
    try {
      await api.del(`/schedule/slots/${id}`)
      setSlots(s => s.filter(x => x.id !== id))
      toast('Grafiks dzēsts')
    } catch(e) { toast(e.message, 'error') }
    setConfirm(null)
  }

  async function addException() {
    if (!exForm.rehearsal_date) { toast('Datums ir obligāts', 'error'); return }
    setSaving(true)
    try {
      const row = await api.post('/schedule/exceptions', exForm)
      if (row) { setExceptions(e => [row, ...e]); setExForm(EMPTY_EX); toast('Izņēmums pievienots') }
    } catch(e) { toast(e.message, 'error') }
    setSaving(false)
  }

  async function deleteException(id) {
    try {
      await api.del(`/schedule/exceptions/${id}`)
      setExceptions(e => e.filter(x => x.id !== id))
      toast('Izņēmums dzēsts')
    } catch(e) { toast(e.message, 'error') }
    setConfirm(null)
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Mēģinājumi</h1>
        <button className="btn btn-primary" onClick={openNewSlot}><Plus size={15} />Pievienot grafiku</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Regular schedule */}
        <div>
          {/* Add/edit slot form */}
          {editSlot && (
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="card-title">{editSlot === 'new' ? 'Jauns grafiks' : 'Rediģēt grafiku'}</span>
                <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setEditSlot(null)}><X size={15} /></button>
              </div>
              <div className="card-body">
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label required">Diena</label>
                    <select className="form-control" value={slotForm.day_of_week} onChange={e => setS('day_of_week', parseInt(e.target.value))}>
                      {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label required">Laiks</label>
                    <input type="time" className="form-control" value={slotForm.time_of_day} onChange={e => setS('time_of_day', e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Vieta</label>
                  <input className="form-control" value={slotForm.location} onChange={e => setS('location', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Piezīme</label>
                  <input className="form-control" value={slotForm.note} onChange={e => setS('note', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-check">
                    <input type="checkbox" checked={!!slotForm.is_active} onChange={e => setS('is_active', e.target.checked)} />
                    Aktīvs
                  </label>
                </div>
                <button className="btn btn-primary" onClick={saveSlot} disabled={saving}>
                  <Save size={14} />{saving ? 'Saglabā...' : 'Saglabāt'}
                </button>
              </div>
            </div>
          )}

          <div className="card">
            <div className="card-header"><span className="card-title">Regulārais grafiks</span></div>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr><th>Diena</th><th>Laiks</th><th>Vieta</th><th>Aktīvs</th><th className="col-shrink"></th></tr>
                </thead>
                <tbody>
                  {slots.map(s => (
                    <tr key={s.id}>
                      <td style={{ fontWeight: 500 }}>{s.day_name}</td>
                      <td><Clock size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />{s.time_of_day}</td>
                      <td className="text-muted">{s.location || '—'}</td>
                      <td>{s.is_active ? <span className="badge badge-success">Jā</span> : <span className="badge badge-neutral">Nē</span>}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEditSlot(s)}><Pencil size={13} /></button>
                          <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => setConfirm({ type: 'slot', id: s.id })}><Trash2 size={13} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {slots.length === 0 && <tr><td colSpan={5} className="text-muted" style={{ padding: 16 }}>Nav grafika</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Exceptions */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-header"><span className="card-title">Pievienot izņēmumu</span></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label required">Datums</label>
                <input type="date" className="form-control" value={exForm.rehearsal_date} onChange={e => setE('rehearsal_date', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Piezīme</label>
                <input className="form-control" value={exForm.note} onChange={e => setE('note', e.target.value)} placeholder="Piem. Svētku dēļ mēģinājuma nav" />
              </div>
              <div className="form-group">
                <label className="form-check">
                  <input type="checkbox" checked={!!exForm.is_cancelled} onChange={e => setE('is_cancelled', e.target.checked)} />
                  Mēģinājums atcelts
                </label>
              </div>
              <button className="btn btn-primary" onClick={addException} disabled={saving}>
                <Plus size={14} />{saving ? 'Saglabā...' : 'Pievienot'}
              </button>
            </div>
          </div>

          <div className="card">
            <div className="card-header"><span className="card-title">Izņēmumi</span></div>
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th>Datums</th><th>Piezīme</th><th>Atcelts</th><th className="col-shrink"></th></tr></thead>
                <tbody>
                  {exceptions.map(ex => (
                    <tr key={ex.id}>
                      <td style={{ fontWeight: 500 }}>{ex.rehearsal_date}</td>
                      <td className="text-muted">{ex.note || '—'}</td>
                      <td>{ex.is_cancelled ? <span className="badge badge-danger">Jā</span> : <span className="badge badge-warning">Mainīts</span>}</td>
                      <td>
                        <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => setConfirm({ type: 'ex', id: ex.id })}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                  {exceptions.length === 0 && <tr><td colSpan={4} className="text-muted" style={{ padding: 16 }}>Nav izņēmumu</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {confirm && (
        <ConfirmModal
          message={confirm.type === 'slot' ? 'Dzēst šo grafiku?' : 'Dzēst šo izņēmumu?'}
          onConfirm={() => confirm.type === 'slot' ? deleteSlot(confirm.id) : deleteException(confirm.id)}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
