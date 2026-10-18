import { useState, useEffect, useMemo } from 'react'
import { Link, useSearchParams, useNavigate, useParams } from 'react-router-dom'
import { getAllPosts, loadSearchContents } from '../utils/postsLoader'
import { searchPosts } from '../utils/postQueries'
import { setHomeSeo, setCategorySeo } from '../utils/seo'
import { optimizeImage } from '../utils/images'
import NewsletterForm from './NewsletterForm'
import NotFound from './NotFound'
import '../styles/PostList.css'

const CATEGORY_LABELS = {
  all: 'Programación competitiva y tecnología',
  tech: 'Artículos de Tecnología',
  coding: 'Programación Competitiva'
}

const CATEGORY_SLUGS = {
  tech: 'tecnologia',
  coding: 'programacion-competitiva'
}

const POSTS_PER_PAGE = 9

function mapSlugToCode(slug) {
  if (!slug) return 'all'
  if (slug === 'tecnologia') return 'tech'
  if (slug === 'programacion-competitiva') return 'coding'
  return null
}

const pathFor = (code) => (code === 'all' ? '/' : `/categoria/${CATEGORY_SLUGS[code]}`)

function PostList() {
  const [searchParams] = useSearchParams()
  const { categoriaSlug } = useParams()
  const navigate = useNavigate()

  // La URL es la única fuente de verdad: /categoria/:slug y ?q=
  const searchTerm = searchParams.get('q')?.trim() || ''
  const legacyCategory = categoriaSlug ? null : searchParams.get('categoria')
  const selectedCategory = mapSlugToCode(categoriaSlug || legacyCategory) || 'all'
  const unknownCategory = Boolean(categoriaSlug) && !mapSlugToCode(categoriaSlug)

  const [searchInput, setSearchInput] = useState(searchTerm)
  const [syncedTerm, setSyncedTerm] = useState(searchTerm)
  const [pagination, setPagination] = useState({ key: '', number: 1 })
  const [searchContents, setSearchContents] = useState(null)

  // Mantener el input alineado con la URL (atrás/adelante del navegador)
  if (syncedTerm !== searchTerm) {
    setSyncedTerm(searchTerm)
    setSearchInput(searchTerm)
  }

  // Enlaces antiguos ?categoria=... → /categoria/:slug (nginx ya hace el 301;
  // esto cubre la navegación dentro de la app y el servidor de desarrollo)
  useEffect(() => {
    if (!legacyCategory || selectedCategory === 'all') return
    const qPart = searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : ''
    navigate(`${pathFor(selectedCategory)}${qPart}`, { replace: true })
  }, [legacyCategory, selectedCategory, searchTerm, navigate])

  useEffect(() => {
    if (unknownCategory) return
    // Una página de resultados de búsqueda no se indexa: suele ser contenido
    // duplicado y, sin resultados, Google la marca como soft 404
    const options = { noindex: Boolean(searchTerm) }
    if (selectedCategory === 'all') {
      setHomeSeo(options)
    } else {
      setCategorySeo(selectedCategory, options)
    }
  }, [selectedCategory, searchTerm, unknownCategory])

  // El texto completo de los artículos solo se descarga cuando hay una búsqueda
  useEffect(() => {
    if (!searchTerm || searchContents) return
    let active = true
    loadSearchContents()
      .then((contents) => active && setSearchContents(contents))
      .catch((error) => console.error('Error loading search index:', error))
    return () => {
      active = false
    }
  }, [searchTerm, searchContents])

  const displayedPosts = useMemo(() => {
    let filtered = getAllPosts()

    // Filtrar por categoría
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(post => post.metadata.categoria === selectedCategory)
    }

    // Aplicar búsqueda
    return searchPosts(filtered, searchTerm, searchContents)
  }, [selectedCategory, searchTerm, searchContents])

  if (unknownCategory) {
    return <NotFound />
  }

  const handleSearch = () => {
    const trimmedQuery = searchInput.trim()
    const basePath = pathFor(selectedCategory)

    navigate(trimmedQuery ? `${basePath}?q=${encodeURIComponent(trimmedQuery)}` : basePath)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleSearch()
    }
  }

  // Volver a la página 1 cuando cambian los filtros
  const filterKey = `${selectedCategory}|${searchTerm}`
  const currentPage = pagination.key === filterKey ? pagination.number : 1

  const totalPages = Math.ceil(displayedPosts.length / POSTS_PER_PAGE)
  const startIndex = (currentPage - 1) * POSTS_PER_PAGE
  const endIndex = startIndex + POSTS_PER_PAGE
  const currentPosts = displayedPosts.slice(startIndex, endIndex)

  const handlePageChange = (number) => {
    setPagination({ key: filterKey, number })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const getPageNumbers = (current, total) => {
    const siblingCount = 1
    const totalVisible = siblingCount * 2 + 5 // primera, última, actual, 2 elipsis

    if (total <= totalVisible) {
      return Array.from({ length: total }, (_, i) => i + 1)
    }

    const leftSibling = Math.max(current - siblingCount, 1)
    const rightSibling = Math.min(current + siblingCount, total)

    const showLeftEllipsis = leftSibling > 2
    const showRightEllipsis = rightSibling < total - 1

    const pages = [1]

    if (showLeftEllipsis) pages.push('left-ellipsis')

    for (let page = Math.max(leftSibling, 2); page <= Math.min(rightSibling, total - 1); page++) {
      pages.push(page)
    }

    if (showRightEllipsis) pages.push('right-ellipsis')

    pages.push(total)

    return pages
  }

  const categoryLink = (code) => {
    const qPart = searchTerm ? `?q=${encodeURIComponent(searchTerm)}` : ''
    return `${pathFor(code)}${qPart}`
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
            onKeyDown={handleKeyDown}
            className="search-input"
          />
          <button onClick={handleSearch} className="search-btn">
            Buscar
          </button>
        </div>

        <div className="category-filters">
          <Link
            className={`category-button ${selectedCategory === 'all' ? 'active' : ''}`}
            to={categoryLink('all')}
          >
            <span className="category-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
              </svg>
            </span>
            Todos
          </Link>
          <Link
            className={`category-button ${selectedCategory === 'tech' ? 'active' : ''}`}
            to={categoryLink('tech')}
          >
            <span className="category-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5"/>
                <path d="M9 18h6"/>
                <path d="M10 22h4"/>
              </svg>
            </span>
            Artículos de Tecnología
          </Link>
          <Link
            className={`category-button ${selectedCategory === 'coding' ? 'active' : ''}`}
            to={categoryLink('coding')}
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
          </Link>
        </div>
      </div>

      {displayedPosts.length === 0 ? (
        <div className="no-posts">
          <p>No se encontraron posts.</p>
        </div>
      ) : (
        <>
          <div className="posts-grid">
            {currentPosts.map((post, index) => (
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
                    <img
                      src={optimizeImage(post.metadata.imagenPortada)}
                      alt={post.metadata.titulo}
                      loading={index < 3 ? 'eager' : 'lazy'}
                      fetchPriority={index === 0 ? 'high' : undefined}
                      width="400"
                      height="200"
                    />
                  </div>
                )}
                <div className="post-card-content">
                  {post.metadata.etiquetas && post.metadata.etiquetas.length > 0 && (
                    <div className="post-tags">
                      {post.metadata.etiquetas.map((tag) => (
                        <span key={tag} className="tag">{tag}</span>
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
                {getPageNumbers(currentPage, totalPages).map((page, index) =>
                  typeof page === 'number' ? (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`pagination-number ${currentPage === page ? 'active' : ''}`}
                      aria-current={currentPage === page ? 'page' : undefined}
                      aria-label={`Página ${page}`}
                    >
                      {page}
                    </button>
                  ) : (
                    <span key={`${page}-${index}`} className="pagination-ellipsis">
                      …
                    </span>
                  )
                )}
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

      <NewsletterForm
        key={selectedCategory}
        variant="home"
        defaultCategories={selectedCategory === 'all' ? ['tech', 'coding'] : [selectedCategory]}
      />
    </div>
  )
}

export default PostList
