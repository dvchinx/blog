import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  getPreferences,
  updatePreferences,
  unsubscribe,
  NEWSLETTER_CATEGORIES,
  categoryLabels
} from '../utils/newsletterApi'
import { setUtilityPageSeo } from '../utils/seo'
import '../styles/Newsletter.css'

function NewsletterPreferences() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  // Enlace "Darme de baja" del correo: se muestra la confirmación primero.
  // La baja nunca ocurre al cargar la página (los escáneres de enlaces la abrirían).
  const wantsToLeave = searchParams.get('baja') === '1'

  const [status, setStatus] = useState(token ? 'loading' : 'invalid') // loading | ready | invalid | unsubscribed
  const [email, setEmail] = useState('')
  const [categories, setCategories] = useState([])
  const [saving, setSaving] = useState(false)
  const [feedback, setFeedback] = useState({ type: '', text: '' })

  useEffect(() => {
    setUtilityPageSeo({
      title: 'Preferencias del newsletter',
      description: 'Cambia las categorías de tu suscripción o date de baja.'
    })
  }, [])

  useEffect(() => {
    if (!token) return
    getPreferences(token)
      .then((data) => {
        setEmail(data.email)
        setCategories(data.categories)
        setStatus('ready')
      })
      .catch(() => setStatus('invalid'))
  }, [token])

  const toggleCategory = (code) => {
    setFeedback({ type: '', text: '' })
    setCategories((current) =>
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code]
    )
  }

  const handleSave = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      const data = await updatePreferences(token, categories)
      setCategories(data.categories)
      setFeedback({ type: 'success', text: `Listo. Recibirás el resumen de ${categoryLabels(data.categories)}.` })
    } catch (error) {
      setFeedback({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  const handleUnsubscribe = async () => {
    setSaving(true)
    try {
      await unsubscribe(token)
      setStatus('unsubscribed')
    } catch (error) {
      setFeedback({ type: 'error', text: error.message })
    } finally {
      setSaving(false)
    }
  }

  if (status === 'loading') {
    return <div className="newsletter-page"><p className="newsletter-text">Cargando tu suscripción…</p></div>
  }

  if (status === 'invalid') {
    return (
      <div className="newsletter-page">
        <h1>Enlace no válido</h1>
        <p className="newsletter-text">
          No encontramos una suscripción activa para este enlace. Es posible que ya te hayas dado de baja.
        </p>
        <div className="newsletter-page-actions">
          <Link to="/">← Volver al blog</Link>
        </div>
      </div>
    )
  }

  if (status === 'unsubscribed') {
    return (
      <div className="newsletter-page">
        <h1>Te diste de baja</h1>
        <p className="newsletter-text">
          No te llegarán más correos y ya borramos <strong>{email}</strong> de nuestra lista.
          Si cambias de opinión, puedes suscribirte de nuevo desde cualquier artículo.
        </p>
        <div className="newsletter-page-actions">
          <Link to="/">← Volver al blog</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="newsletter-page">
      {wantsToLeave ? (
        <>
          <h1>¿Darte de baja?</h1>
          <p className="newsletter-text">
            Dejarás de recibir el resumen semanal en <strong>{email}</strong> y borraremos tu correo de la lista.
          </p>
          <div className="newsletter-page-buttons">
            <button type="button" className="newsletter-button newsletter-button-danger" onClick={handleUnsubscribe} disabled={saving}>
              {saving ? 'Procesando…' : 'Sí, darme de baja'}
            </button>
            <Link to={`/newsletter/preferencias?token=${encodeURIComponent(token)}`} className="newsletter-secondary">
              Mejor cambio las categorías
            </Link>
          </div>
        </>
      ) : (
        <>
          <h1>Tu suscripción</h1>
          <p className="newsletter-text">
            Resumen semanal para <strong>{email}</strong>. Elige qué categorías quieres recibir:
          </p>

          <form onSubmit={handleSave} className="newsletter-form">
            <fieldset className="newsletter-categories">
              <legend className="visually-hidden">Categorías</legend>
              {NEWSLETTER_CATEGORIES.map(({ code, label }) => (
                <label key={code} className={`newsletter-chip newsletter-chip-${code}`}>
                  <input type="checkbox" checked={categories.includes(code)} onChange={() => toggleCategory(code)} />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>

            <div className="newsletter-page-buttons">
              <button type="submit" className="newsletter-button" disabled={saving || categories.length === 0}>
                {saving ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button type="button" className="newsletter-secondary" onClick={handleUnsubscribe} disabled={saving}>
                Darme de baja
              </button>
            </div>
          </form>
        </>
      )}

      {feedback.text && (
        <p className={feedback.type === 'error' ? 'newsletter-error' : 'newsletter-success'} role="status">
          {feedback.text}
        </p>
      )}
    </div>
  )
}

export default NewsletterPreferences
