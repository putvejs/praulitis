import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, KeyRound } from 'lucide-react'
import { api } from '../api'
import Modal, { ConfirmModal } from '../components/Modal'

const ROLES = ['member', 'admin']
const EMPTY = { username: '', email: '', display_name: '', role: 'member', password: '' }

export default function Users({ toast }) {
  const [users, setUsers]     = useState([])
  const [modal, setModal]     = useState(null)
  const [form, setForm]       = useState(EMPTY)
  const [confirm, setConfirm] = useState(null)
  const [pwModal, setPwModal] = useState(null)
  const [newPw, setNewPw]     = useState('')
  const [saving, setSaving]   = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const data = await api.get('/users')
    if (data) setUsers(data)
  }

  function openNew() { setForm(EMPTY); setModal({ mode: 'new' }) }
  function openEdit(u) {
    setForm({ username: u.username, email: u.email || '', display_name: u.display_name || '', role: u.role, password: '' })
    setModal({ mode: 'edit', id: u.id })
  }
  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function save() {
    if (!form.username.trim()) { toast('Lietotājvārds ir obligāts', 'error'); return }
    if (modal.mode === 'new' && form.password.length < 8) { toast('Parolei jābūt vismaz 8 rakstzīmēm', 'error'); return }
    setSaving(true)
    try {
      const payload = { username: form.username.trim(), email: form.email.trim(), display_name: form.display_name.trim(), role: form.role }
      if (modal.mode === 'new') {
        const row = await api.post('/users', { ...payload, password: form.password })
        if (row) { setUsers(u => [...u, row]); toast('Lietotājs izveidots'); setModal(null) }
      } else {
        const row = await api.put(`/users/${modal.id}`, payload)
        if (row) { setUsers(u => u.map(x => x.id === modal.id ? row : x)); toast('Lietotājs saglabāts'); setModal(null) }
      }
    } catch(e) { toast(e.message, 'error') }
    setSaving(false)
  }

  async function del(uid) {
    try {
      await api.del(`/users/${uid}`)
      setUsers(u => u.filter(x => x.id !== uid))
      toast('Lietotājs dzēsts')
    } catch(e) { toast(e.message, 'error') }
    setConfirm(null)
  }

  async function resetPw() {
    if (newPw.length < 8) { toast('Parolei jābūt vismaz 8 rakstzīmēm', 'error'); return }
    try {
      await api.post(`/users/${pwModal}/reset-password`, { password: newPw })
      toast('Parole nomainīta')
      setPwModal(null); setNewPw('')
    } catch(e) { toast(e.message, 'error') }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Lietotāji</h1>
        <button className="btn btn-primary" onClick={openNew}><Plus size={15} />Jauns lietotājs</button>
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Lietotājvārds</th>
                <th>E-pasts</th>
                <th>Vārds</th>
                <th>Loma</th>
                <th>Reģistrēts</th>
                <th className="col-shrink"></th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr><td colSpan={6}><div className="empty-state">Nav lietotāju</div></td></tr>
              )}
              {users.map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 500 }}>{u.username}</td>
                  <td className="text-muted">{u.email || '—'}</td>
                  <td className="text-muted">{u.display_name || '—'}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-warning' : 'badge-neutral'}`}>
                      {u.role}
                    </span>
                  </td>
                  <td className="text-muted" style={{ fontSize: 12 }}>{u.created_at ? u.created_at.slice(0, 10) : '—'}</td>
                  <td className="col-shrink">
                    <div className="actions">
                      <button className="btn btn-ghost btn-icon btn-sm" title="Mainīt paroli"
                        onClick={() => { setPwModal(u.id); setNewPw('') }}>
                        <KeyRound size={14} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm" onClick={() => openEdit(u)}>
                        <Pencil size={14} />
                      </button>
                      <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => setConfirm(u.id)}>
                        <Trash2 size={14} />
                      </button>
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
          title={modal.mode === 'new' ? 'Jauns lietotājs' : 'Rediģēt lietotāju'}
          onClose={() => setModal(null)} size="md"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => setModal(null)}>Atcelt</button>
              <button className="btn btn-primary" onClick={save} disabled={saving}>
                {saving ? 'Saglabā...' : 'Saglabāt'}
              </button>
            </>
          }>
          <div className="form-group">
            <label className="form-label required">Lietotājvārds</label>
            <input className="form-control" value={form.username} onChange={e => set('username', e.target.value)} autoFocus />
          </div>
          <div className="form-group">
            <label className="form-label">E-pasts</label>
            <input type="email" className="form-control" value={form.email} onChange={e => set('email', e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Vārds (attēlošanai)</label>
            <input className="form-control" value={form.display_name} onChange={e => set('display_name', e.target.value)} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Loma</label>
              <select className="form-control" value={form.role} onChange={e => set('role', e.target.value)}>
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            {modal.mode === 'new' && (
              <div className="form-group">
                <label className="form-label required">Parole</label>
                <input type="password" className="form-control" value={form.password}
                  onChange={e => set('password', e.target.value)} placeholder="min. 8 rakstzīmes" />
              </div>
            )}
          </div>
        </Modal>
      )}

      {pwModal && (
        <Modal
          title="Mainīt paroli"
          onClose={() => { setPwModal(null); setNewPw('') }} size="sm"
          footer={
            <>
              <button className="btn btn-secondary" onClick={() => { setPwModal(null); setNewPw('') }}>Atcelt</button>
              <button className="btn btn-primary" onClick={resetPw}>Saglabāt</button>
            </>
          }>
          <div className="form-group">
            <label className="form-label required">Jaunā parole</label>
            <input type="password" className="form-control" value={newPw}
              onChange={e => setNewPw(e.target.value)} placeholder="min. 8 rakstzīmes" autoFocus />
          </div>
        </Modal>
      )}

      {confirm && (
        <ConfirmModal message="Dzēst šo lietotāju?" onConfirm={() => del(confirm)} onCancel={() => setConfirm(null)} />
      )}
    </div>
  )
}
