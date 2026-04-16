import { useEffect } from 'react'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

const ICONS = {
  success: <CheckCircle size={16} />,
  error:   <XCircle size={16} />,
  info:    <Info size={16} />,
}

export function ToastContainer({ toasts, remove }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onRemove={() => remove(t.id)} />
      ))}
    </div>
  )
}

function Toast({ toast, onRemove }) {
  useEffect(() => {
    const timer = setTimeout(onRemove, 3500)
    return () => clearTimeout(timer)
  }, [])

  return (
    <div className={`toast toast-${toast.type}`}>
      {ICONS[toast.type]}
      <span style={{ flex: 1 }}>{toast.message}</span>
      <button onClick={onRemove} className="modal-close" style={{ marginLeft: 4 }}>
        <X size={14} />
      </button>
    </div>
  )
}
