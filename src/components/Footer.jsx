import '../styles/Footer.css'

function Footer() {
  const currentYear = new Date().getFullYear()
  
  return (
    <footer className="footer">
      <div className="footer-content">
        <p>&copy; {currentYear} Jesús Flórez. Todos los derechos reservados.</p>
        <div className="footer-links">
          <a href="https://github.com/dvchinx" target="_blank" rel="noopener noreferrer"><b>Contribuir</b></a>
          <a href="https://github.com/dvchinx" target="_blank" rel="noopener noreferrer"><b>GitHub</b></a>
          <a href="https://jesusflorez.cloud/portfolio" target="_blank" rel="noopener noreferrer"><b>Portafolio</b></a>
        </div>
      </div>
    </footer>
  )
}

export default Footer
