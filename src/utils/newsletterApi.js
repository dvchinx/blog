// Cliente del servicio newsletter/ (mismo dominio: nginx enruta /api/newsletter/).
// En desarrollo Vite lo redirige a localhost:3002 (ver vite.config.js).
const API_BASE = '/api/newsletter'

export const NEWSLETTER_CATEGORIES = [
  { code: 'tech', label: 'Tecnología' },
  { code: 'coding', label: 'Programación Competitiva' }
]

async function request(path, options = {}) {
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    })
  } catch {
    throw new Error('No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.')
  }

  const data = await response.json().catch(() => ({}))
  if (!response.ok || data.ok === false) {
    const error = new Error(data.message || 'Algo salió mal. Inténtalo de nuevo en unos minutos.')
    error.status = response.status
    throw error
  }
  return data
}

const post = (path, body) => request(path, { method: 'POST', body: JSON.stringify(body) })

export const subscribe = (payload) => post('/subscribe', payload)
export const confirmSubscription = (token) => post('/confirm', { token })
export const getPreferences = (token) => request(`/preferences?token=${encodeURIComponent(token)}`)
export const updatePreferences = (token, categories) => post('/preferences', { token, categories })
export const unsubscribe = (token) => post('/unsubscribe', { token })

export function categoryLabels(codes = []) {
  const labels = NEWSLETTER_CATEGORIES.filter((c) => codes.includes(c.code)).map((c) => c.label)
  if (labels.length <= 1) return labels.join('')
  return `${labels.slice(0, -1).join(', ')} y ${labels.at(-1)}`
}
