import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { confirmSubscription, categoryLabels } from '../utils/newsletterApi'
import { setUtilityPageSeo } from '../utils/seo'
import '../styles/Newsletter.css'

function NewsletterConfirm() {
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [state, setState] = useState({ status: token ? 'loading' : 'error', message: 'El enlace de confirmación está incompleto.' })
  const requested = useRef(false)

  useEffect(() => {
    setUtilityPageSeo({
      title: 'Confirmar suscripción',
      description: 'Confirma tu suscripción al resumen semanal del blog.'
    })
  }, [])

  useEffect(() => {
    // StrictMode monta dos veces en desarrollo: confirmar una sola vez
    if (!token || requested.current) return
    requested.current = true

    confirmSubscription(token)
      .then((data) => setState({ status: 'success', categories: data.categories }))
      .catch((error) => setState({ status: 'error', message: error.message }))
  }, [token])

  return (
    <div className="newsletter-page">
      {state.status === 'loading' && <p className="newsletter-text">Confirmando tu suscripción…</p>}

      {state.status === 'success' && (
        <>
          <h1>¡Suscripción confirmada!</h1>
          <p className="newsletter-text">
            Cada lunes recibirás un resumen con los artículos nuevos de <strong>{categoryLabels(state.categories)}</strong>.
            Si una semana no hay nada nuevo en tus categorías, no te escribimos.
          </p>
          <p className="newsletter-text">
            Para que no termine en spam, agrega <strong>newsletter@jesusflorez.cloud</strong> a tus contactos.
          </p>
          <div className="newsletter-page-actions">
            <Link to="/">← Volver al blog</Link>
            <Link to={`/newsletter/preferencias?token=${encodeURIComponent(token)}`}>Gestionar suscripción</Link>
          </div>
        </>
      )}

      {state.status === 'error' && (
        <>
          <h1>No pudimos confirmar tu suscripción</h1>
          <p className="newsletter-text">{state.message}</p>
          <p className="newsletter-text">
            Los enlaces de confirmación vencen a los 7 días. Puedes suscribirte de nuevo desde cualquier artículo.
          </p>
          <div className="newsletter-page-actions">
            <Link to="/">← Volver al blog</Link>
          </div>
        </>
      )}
    </div>
  )
}

export default NewsletterConfirm
