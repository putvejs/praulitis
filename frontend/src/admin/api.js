const BASE = '/api/admin'

function handleUnauth() {
  window.location.href = '/login?next=/admin'
}

async function request(method, path, body, isFormData = false) {
  const opts = { method, credentials: 'same-origin' }
  if (body) {
    if (isFormData) {
      opts.body = body
    } else {
      opts.headers = { 'Content-Type': 'application/json' }
      opts.body = JSON.stringify(body)
    }
  }
  const res = await fetch(`${BASE}${path}`, opts)
  if (res.status === 401) { handleUnauth(); return null }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }))
    throw new Error(err.error || `HTTP ${res.status}`)
  }
  return res.json()
}

export const api = {
  get:       (path)             => request('GET',    path),
  post:      (path, body)       => request('POST',   path, body),
  put:       (path, body)       => request('PUT',    path, body),
  del:       (path)             => request('DELETE', path),
  delBody:   (path, body)       => request('DELETE', path, body),
  upload:    (path, formData)   => request('POST',   path, formData, true),
  uploadPut: (path, formData)   => request('PUT',    path, formData, true),
}
