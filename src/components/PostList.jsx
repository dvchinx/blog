import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { loadPosts, searchPosts } from '../utils/postsLoader'
import { setHomeSeo } from '../utils/seo'
import '../styles/PostList.css'

function PostList() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const [allPosts, setAllPosts] = useState([])
  const [displayedPosts, setDisplayedPosts] = useState([])
  const [searchInput, setSearchInput] = useState('')
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState('all')

  const POSTS_PER_PAGE = 9

  useEffect(() => {
    setHomeSeo()

    // Leer parámetro ?q= de la URL
    const queryParam = searchParams.get('q')
    if (queryParam) {
      setSearchInput(queryParam)
      setSearchTerm(queryParam)
    } else {
      setSearchInput('')
      setSearchTerm('')
    }

    async function fetchPosts() {
      try {
        const posts = await loadPosts()
        setAllPosts(posts)
        setDisplayedPosts(posts)
      } catch (error) {
        console.error('Error loading posts:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [searchParams])

  const handleSearch = () => {
    const trimmedQuery = searchInput.trim()
    if (trimmedQuery) {
      navigate(`/?q=${encodeURIComponent(trimmedQuery)}`)
    } else {
      navigate('/')
    }
  }

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  useEffect(() => {
    let filtered = allPosts

    // Filtrar por categoría
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(post => post.metadata.categoria === selectedCategory)
    }

    // Aplicar búsqueda
    if (searchTerm) {
      filtered = searchPosts(filtered, searchTerm)
    }

    setDisplayedPosts(filtered)
    setCurrentPage(1)
  }, [searchTerm, allPosts, selectedCategory])

  const totalPages = Math.ceil(displayedPosts.length / POSTS_PER_PAGE)
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE
  const endIndex = startIndex + POSTS_PER_PAGE
  const currentPosts = displayedPosts.slice(startIndex, endIndex)

  const handlePageChange = (page) => {
    setCurrentPage(page)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (loading) {
    return <div className="loading">Cargando posts...</div>
  }

  return (
    <div className="post-list-container">
      <div className="search-section">
        <h1>Programación competitiva y tecnología</h1>
        <div className="search-bar-container">
          <input
            type="text"
            placeholder="Buscar posts..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyPress={handleKeyPress}
            className="search-input"
          />
          <button onClick={handleSearch} className="search-btn">
            Buscar
          </button>
        </div>

        <div className="category-filters">
          <button
            className={`category-button ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('all')}
          >
            <span className="category-icon">📚</span>
            Todos
          </button>
          <button
            className={`category-button ${selectedCategory === 'tech' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('tech')}
          >
            <span className="category-icon">💡</span>
            Artículos de Tecnología
          </button>
          <button
            className={`category-button ${selectedCategory === 'coding' ? 'active' : ''}`}
            onClick={() => setSelectedCategory('coding')}
          >
            <span className="category-icon">🏆</span>
            Ejercicios de Programación
          </button>
        </div>
      </div>

      {displayedPosts.length === 0 ? (
        <div className="no-posts">
          <p>No se encontraron posts.</p>
        </div>
      ) : (
        <>
          <div className="posts-grid">
            {currentPosts.map((post) => (
              <Link
                key={post.metadata.path}
                to={post.metadata.path}
                className={`post-card post-card-${post.metadata.categoria || 'tech'}`}
              >
                <div className="post-category-badge">
                  {post.metadata.categoria === 'coding' ? (
                    <>
                      <span className="badge-icon">🏆</span>
                      <span className="badge-text">ICPC</span>
                    </>
                  ) : (
                    <>
                      <span className="badge-icon">💡</span>
                      <span className="badge-text">TECH</span>
                    </>
                  )}
                </div>
                {post.metadata.imagenPortada && (
                  <div className="post-card-image">
                    <img src={post.metadata.imagenPortada} alt={post.metadata.titulo} />
                  </div>
                )}
                <div className="post-card-content">
                  {post.metadata.etiquetas && post.metadata.etiquetas.length > 0 && (
                    <div className="post-tags">
                      {post.metadata.etiquetas.map((tag, index) => (
                        <span key={index} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}
                  <h3 className="post-title">{post.metadata.titulo}</h3>
                  {post.metadata.descripcion && (
                    <p className="post-description">{post.metadata.descripcion}</p>
                  )}
                  <div className="post-meta">
                    {post.metadata.fotoAutor && (
                      <img src={post.metadata.fotoAutor} alt={post.metadata.nombreAutor} className="author-avatar-small" />
                    )}
                    <span className="post-author">{post.metadata.nombreAutor}</span>
                    <span className="post-date-separator">•</span>
                    <span className="post-date">
                      {new Date(post.metadata.fecha).toLocaleDateString('es-ES', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="pagination-button"
              >
                ← Anterior
              </button>

              <div className="pagination-numbers">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="pagination-button"
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default PostList
