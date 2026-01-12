import { Link } from 'react-router-dom'
import '../styles/Header.css'

function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <h1>Blog de Jesús Flórez</h1>
        </Link>
        <nav className="nav">
          <a href="https://jesusflorez.cloud" className="nav-link">Acceso a la suite</a>
        </nav>
      </div>
    </header>
  )
}

export default Header
