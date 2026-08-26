import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { setNotFoundSeo } from '../utils/seo'
import '../styles/NotFound.css'

function NotFound() {
  useEffect(() => {
    setNotFoundSeo()
  }, [])

  return (
    <div className="not-found-page">
      <p className="not-found-code">404</p>
      <h1>Esta página no existe</h1>
      <p className="not-found-message">
        El enlace que seguiste está roto o el artículo cambió de dirección. Puedes volver al
        inicio o buscar lo que necesitas entre los artículos publicados.
      </p>
      <div className="not-found-actions">
        <Link to="/">← Volver al blog</Link>
        <Link to="/categoria/tecnologia">Tecnología</Link>
        <Link to="/categoria/programacion-competitiva">Programación Competitiva</Link>
      </div>
    </div>
  )
}

export default NotFound
