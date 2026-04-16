import { useState, useEffect } from 'react'
import { Plus, Trash2, Pin } from 'lucide-react'
import { api } from '../api'
import { ConfirmModal } from '../components/Modal'

const EMPTY = { title: '', body: '', is_pinned: false }

export default function Announcements({ toast }) {
  const [items, setItems] = useState([])
  const [form, setForm] = useState(EMPTY)
  const [confirm, setConfirm] = useState(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    const data = await api.get('/announcements')
    if (data) setItems(data)
  }

  function set(k, v) { setForm(f => ({ ...f, [k]: v })) }

  async function create() {
    if (!form.title.trim() || !form.body.trim()) { toast('Aizpildiet visus laukus', 'error'); return }
    setSaving(true)
    try {
      const row = await api.post('/announcements', form)
      if (row) { setItems(i => [row, ...i]); setForm(EMPTY); toast('Paziņojums pievienots') }
    } catch(e) { toast(e.message, 'error') }
    setSaving(false)
  }

  async function del(id) {
    await api.del(`/announcements/${id}`)
    setItems(i => i.filter(x => x.id !== id))
    toast('Paziņojums dzēsts')
    setConfirm(null)
  }

  function fmtDate(dt) {
    if (!dt) return ''
    return dt.slice(0, 16).replace('T', ' ')
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Paziņojumi</h1>
      </div>

      {/* Create form */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header"><span className="card-title">Jauns paziņojums</span></div>
        <div className="card-body">
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label className="form-label required">Virsraksts</label>
              <input className="form-control" value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 14 }}>
              <label className="form-check">
                <input type="checkbox" checked={!!form.is_pinned} onChange={e => set('is_pinned', e.target.checked)} />
                <Pin size={13} style={{ color: 'var(--accent)' }} /> Piesprausts
              </label>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label required">Teksts</label>
            <textarea className="form-control" rows={3} value={form.body} onChange={e => set('body', e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={create} disabled={saving}>
            <Plus size={14} />{saving ? 'Saglabā...' : 'Publicēt'}
          </button>
        </div>
      </div>

      {/* List */}
      <div className="card">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th style={{ width: 28 }}></th><th>Virsraksts</th><th>Teksts</th><th>Datums</th><th className="col-shrink"></th></tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr><td colSpan={5}><div className="empty-state">Nav paziņojumu</div></td></tr>
              )}
              {items.map(item => (
                <tr key={item.id}>
                  <td>{item.is_pinned ? <Pin size={14} className="pinned-icon" /> : null}</td>
                  <td style={{ fontWeight: 500 }}>{item.title}</td>
                  <td className="text-muted">
                    <span className="truncate" style={{ display: 'block', maxWidth: 300 }}>{item.body}</span>
                  </td>
                  <td className="text-muted" style={{ whiteSpace: 'nowrap', fontSize: 12 }}>{fmtDate(item.created_at)}</td>
                  <td className="col-shrink">
                    <button className="btn btn-ghost btn-icon btn-sm text-danger" onClick={() => setConfirm(item.id)}><Trash2 size={14} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {confirm && (
        <ConfirmModal message="Dzēst šo paziņojumu?" onConfirm={() => del(confirm)} onCancel={() => setConfirm(null)} />
      )}
    </div>
  )
}
