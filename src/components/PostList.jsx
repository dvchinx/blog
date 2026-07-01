import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate, useParams } from 'react-router-dom'
import { loadPosts, searchPosts } from '../utils/postsLoader'
import { setHomeSeo, setCategorySeo } from '../utils/seo'
import '../styles/PostList.css'

const CATEGORY_LABELS = {
  all: 'Programación competitiva y tecnología',
  tech: 'Artículos de Tecnología',
  coding: 'Programación Competitiva'
}

function mapSlugToCode(slug) {
  if (!slug) return 'all'
  if (slug === 'tecnologia') return 'tech'
  if (slug === 'programacion-competitiva') return 'coding'
  return 'all'
}

function PostList() {
  const [searchParams] = useSearchParams()
  const { categoriaSlug } = useParams()
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
    // Leer parámetro ?q= de la URL
    const queryParam = searchParams.get('q')
    if (queryParam) {
      setSearchInput(queryParam)
      setSearchTerm(queryParam)
    } else {
      setSearchInput('')
      setSearchTerm('')
    }

    // La categoría puede venir de la ruta /categoria/:slug (preferida, indexable)
    // o del parámetro legacy ?categoria= (compatibilidad con enlaces antiguos)
    const categoriaParam = categoriaSlug || searchParams.get('categoria')
    const category = mapSlugToCode(categoriaParam)
    setSelectedCategory(category)

    // Canonicalizar enlaces antiguos ?categoria=... hacia la nueva ruta /categoria/:slug
    if (!categoriaSlug && searchParams.get('categoria') && category !== 'all') {
      const slug = category === 'tech' ? 'tecnologia' : 'programacion-competitiva'
      const q = searchParams.get('q')
      navigate(`/categoria/${slug}${q ? `?q=${encodeURIComponent(q)}` : ''}`, { replace: true })
      return
    }

    if (category === 'all') {
      setHomeSeo()
    } else {
      setCategorySeo(category)
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
  }, [searchParams, categoriaSlug, navigate])

  const handleSearch = () => {
    const trimmedQuery = searchInput.trim()
    const basePath = selectedCategory === 'all'
      ? '/'
      : `/categoria/${selectedCategory === 'tech' ? 'tecnologia' : 'programacion-competitiva'}`

    navigate(trimmedQuery ? `${basePath}?q=${encodeURIComponent(trimmedQuery)}` : basePath)
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
        <h1>{CATEGORY_LABELS[selectedCategory]}</h1>
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
          {(() => {
            const slugFor = (code) => {
              if (code === 'tech') return 'tecnologia'
              if (code === 'coding') return 'programacion-competitiva'
              return ''
            }

            const pathFor = (code) => (code === 'all' ? '/' : `/categoria/${slugFor(code)}`)

            const handleCategoryClick = (code) => {
              const currentQ = searchParams.get('q')
              const qPart = currentQ ? `?q=${encodeURIComponent(currentQ)}` : ''
              navigate(`${pathFor(code)}${qPart}`)
            }

            const hrefFor = (code) => {
              const currentQ = searchParams.get('q')
              const qPart = currentQ ? `?q=${encodeURIComponent(currentQ)}` : ''
              return `https://blog.jesusflorez.cloud${pathFor(code)}${qPart}`
            }

            return (
              <>
                <a
                  className={`category-button ${selectedCategory === 'all' ? 'active' : ''}`}
                  href={hrefFor('all')}
                  onClick={(e) => { e.preventDefault(); handleCategoryClick('all') }}
                >
                  <span className="category-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
                    </svg>
                  </span>
                  Todos
                </a>
                <a
                  className={`category-button ${selectedCategory === 'tech' ? 'active' : ''}`}
                  href={hrefFor('tech')}
                  onClick={(e) => { e.preventDefault(); handleCategoryClick('tech') }}
                >
                  <span className="category-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
                      <path d="M9 18h6"/>
                      <path d="M10 22h4"/>
                    </svg>
                  </span>
                  Artículos de Tecnología
                </a>
                <a
                  className={`category-button ${selectedCategory === 'coding' ? 'active' : ''}`}
                  href={hrefFor('coding')}
                  onClick={(e) => { e.preventDefault(); handleCategoryClick('coding') }}
                >
                  <span className="category-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                      <path d="M4 22h16"/>
                      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                    </svg>
                  </span>
                  Ejercicios de Programación
                </a>
              </>
            )
          })()}
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
                      <span className="badge-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
                          <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
                          <path d="M4 22h16"/>
                          <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
                          <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
                          <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
                        </svg>
                      </span>
                      <span className="badge-text">ICPC</span>
                    </>
                  ) : (
                    <>
                      <span className="badge-icon">
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
                          <path d="M9 18h6"/>
                          <path d="M10 22h4"/>
                        </svg>
                      </span>
                      <span className="badge-text">TECH</span>
                    </>
                  )}
                </div>
                {post.metadata.imagenPortada && (
                  <div className="post-card-image">
                    <img src={post.metadata.imagenPortada} alt={post.metadata.titulo} loading="lazy" width="400" height="200" />
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
                      <img src={post.metadata.fotoAutor} alt={post.metadata.nombreAutor} className="author-avatar-small" width="24" height="24" />
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
