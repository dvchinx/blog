import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { PRIVACY_SECTIONS, PRIVACY_UPDATED_AT } from '../utils/privacyPolicy'
import { setUtilityPageSeo, PRIVACY_TITLE, PRIVACY_DESCRIPTION } from '../utils/seo'
import '../styles/Newsletter.css'

function PrivacyPolicy() {
  useEffect(() => {
    setUtilityPageSeo({
      title: PRIVACY_TITLE,
      description: PRIVACY_DESCRIPTION,
      path: '/privacidad'
    })
  }, [])

  return (
    <div className="newsletter-page privacy-page">
      <Link to="/" className="back-link">← Volver al blog</Link>
      <h1>Política de tratamiento de datos personales</h1>
      <p className="privacy-updated">Última actualización: {PRIVACY_UPDATED_AT}</p>

      {PRIVACY_SECTIONS.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          {section.paragraphs.map((text) => <p key={text}>{text}</p>)}
        </section>
      ))}
    </div>
  )
}

export default PrivacyPolicy
