import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { loadPosts, searchPosts } from '../utils/postsLoader'
import '../styles/PostList.css'

function PostList() {
  const [allPosts, setAllPosts] = useState([])
  const [displayedPosts, setDisplayedPosts] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)
  
  const POSTS_PER_PAGE = 9

  useEffect(() => {
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
  }, [])

  useEffect(() => {
    const filtered = searchPosts(allPosts, searchTerm)
    setDisplayedPosts(filtered)
    setCurrentPage(1)
  }, [searchTerm, allPosts])

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
        <h2>Explora el Blog</h2>
        <input
          type="text"
          placeholder="Buscar posts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
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
                className="post-card"
              >
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
