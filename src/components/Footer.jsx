import { Link } from 'react-router-dom'
import '../styles/Footer.css'

function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="footer">
      <div className="footer-content">
        <p>&copy; {currentYear} Jesús Flórez. Todos los derechos reservados.</p>
        <div className="footer-links">
          <Link to="/autor/jesus-florez"><b>Autor</b></Link>
          <a href="https://github.com/dvchinx/blog" target="_blank" rel="noopener noreferrer"><b>Contribuir</b></a>
          <a href="https://jesusflorez.cloud" target="_blank" rel="noopener noreferrer"><b>Suite</b></a>
        </div>
      </div>
    </footer>
  )
}

export default Footer
