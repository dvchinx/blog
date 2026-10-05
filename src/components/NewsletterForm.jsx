import { useId, useState } from 'react'
import { Link } from 'react-router-dom'
import { subscribe, NEWSLETTER_CATEGORIES } from '../utils/newsletterApi'
import '../styles/Newsletter.css'

/**
 * Formulario de suscripción al resumen semanal.
 * `defaultCategories` marca de entrada las categorías más probables según la
 * página (la del artículo que se está leyendo, o ambas en la portada).
 */
function NewsletterForm({ defaultCategories = ['tech', 'coding'], variant = 'home' }) {
  const id = useId()
  const [email, setEmail] = useState('')
  const [categories, setCategories] = useState(defaultCategories)
  const [consent, setConsent] = useState(false)
  const [website, setWebsite] = useState('')
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [message, setMessage] = useState('')

  const toggleCategory = (code) => {
    setCategories((current) =>
      current.includes(code) ? current.filter((c) => c !== code) : [...current, code]
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (categories.length === 0) {
      setStatus('error')
      setMessage('Elige al menos una categoría.')
      return
    }
    if (!consent) {
      setStatus('error')
      setMessage('Debes aceptar la política de tratamiento de datos.')
      return
    }

    setStatus('loading')
    try {
      const data = await subscribe({ email, categories, consent, website })
      setStatus('success')
      setMessage(data.message)
    } catch (error) {
      setStatus('error')
      setMessage(error.message)
    }
  }

  if (status === 'success') {
    return (
      <section className={`newsletter newsletter-${variant}`} aria-live="polite">
        <h2 className="newsletter-title">¡Ya casi! Revisa tu correo</h2>
        <p className="newsletter-text">{message}</p>
      </section>
    )
  }

  return (
    <section className={`newsletter newsletter-${variant}`} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="newsletter-title">
        {variant === 'post' ? '¿Te gustó? Recibe los próximos artículos en tu correo' : 'Recibe los artículos nuevos en tu correo'}
      </h2>
      <p className="newsletter-text">
        Un resumen cada lunes con lo publicado en la semana. Sin spam: te das de baja con un clic.
      </p>

      <form className="newsletter-form" onSubmit={handleSubmit} noValidate>
        <fieldset className="newsletter-categories">
          <legend className="newsletter-legend">Quiero recibir</legend>
          {NEWSLETTER_CATEGORIES.map(({ code, label }) => (
            <label key={code} className={`newsletter-chip newsletter-chip-${code}`}>
              <input
                type="checkbox"
                checked={categories.includes(code)}
                onChange={() => toggleCategory(code)}
              />
              <span>{label}</span>
            </label>
          ))}
        </fieldset>

        <div className="newsletter-row">
          <label htmlFor={`${id}-email`} className="visually-hidden">Correo electrónico</label>
          <input
            id={`${id}-email`}
            type="email"
            className="newsletter-input"
            placeholder="tu@correo.com"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button type="submit" className="newsletter-button" disabled={status === 'loading'}>
            {status === 'loading' ? 'Enviando…' : 'Suscribirme'}
          </button>
        </div>

        {/* Campo trampa para bots: oculto para personas y lectores de pantalla */}
        <div className="newsletter-hp" aria-hidden="true">
          <label>
            No llenes este campo
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
        </div>

        <label className="newsletter-consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>
            Autorizo el tratamiento de mi correo para recibir el newsletter, según la{' '}
            <Link to="/privacidad">política de tratamiento de datos</Link>.
          </span>
        </label>

        {status === 'error' && (
          <p className="newsletter-error" role="alert">{message}</p>
        )}
      </form>
    </section>
  )
}

export default NewsletterForm
