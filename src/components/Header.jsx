import { useState } from 'react'
import { Link } from 'react-router-dom'
import '../styles/Header.css'

function Header() {
  const [searchQuery, setSearchQuery] = useState('')

  const handleSearch = (query) => {
    const trimmedQuery = query.trim()
    if (trimmedQuery) {
      window.location.href = `https://blog.jesusflorez.cloud/?q=${encodeURIComponent(trimmedQuery)}`
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch(searchQuery)
    }
  }

  const handleSearchClick = () => {
    handleSearch(searchQuery)
  }

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <h1>Blog de Jesús Flórez</h1>
        </Link>
        <div className="search-bar-header">
          <input
            type="text"
            placeholder="Buscar posts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={handleKeyPress}
            className="search-input-header"
          />
          <button onClick={handleSearchClick} className="search-button">
            Buscar
          </button>
        </div>
        <nav className="nav">
          <a href="https://jesusflorez.cloud" className="nav-link">Acceso a la suite</a>
        </nav>
      </div>
    </header>
  )
}

export default Header
