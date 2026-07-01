import { Link } from 'react-router-dom'
import '../styles/Header.css'

function Header() {
  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <p className="logo-text">Blog de Jesús Flórez</p>
        </Link>
      </div>
    </header>
  )
}

export default Header
