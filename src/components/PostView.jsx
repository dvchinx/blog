import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import { loadPost, loadPosts, getRelatedPosts } from '../utils/postsLoader'
import { setPostSeo } from '../utils/seo'
import '../styles/PostView.css'

function PostView() {
  const { year, month, slug } = useParams()
  const [post, setPost] = useState(null)
  const [relatedPosts, setRelatedPosts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchPost() {
      try {
        const [postData, postsCatalog] = await Promise.all([
          loadPost(year, month, slug),
          loadPosts()
        ])

        if (postData) {
          setPost(postData)
          setRelatedPosts(getRelatedPosts(postsCatalog, postData, 3))
        } else {
          setError(true)
        }
      } catch (err) {
        console.error('Error loading post:', err)
        setError(true)
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [year, month, slug])

  useEffect(() => {
    if (post) {
      setPostSeo(post)
    }
  }, [post])

  if (loading) {
    return <div className="loading">Cargando post...</div>
  }

  if (error || !post) {
    return (
      <div className="error-container">
        <h2>Post no encontrado</h2>
        <p>El post que buscas no existe.</p>
        <Link to="/" className="back-link">← Volver al blog</Link>
      </div>
    )
  }

  return (
    <article className={`post-view post-view-${post.metadata.categoria || 'tech'}`}>
      <Link to="/" className="back-link">← Volver al blog</Link>
      
      {post.metadata.imagenPortada && (
        <div className="post-cover-image">
          <img src={post.metadata.imagenPortada} alt={post.metadata.titulo} />
        </div>
      )}
      
      <header className="post-header">
        {post.metadata.etiquetas && post.metadata.etiquetas.length > 0 && (
          <div className="post-tags-view">
            {post.metadata.etiquetas.map((tag, index) => (
              <span key={index} className="tag-view">{tag}</span>
            ))}
          </div>
        )}
        
        <h1 className="post-title">{post.metadata.titulo}</h1>
        
        <div className="post-author-info">
          {post.metadata.fotoAutor && (
            <img 
              src={post.metadata.fotoAutor} 
              alt={post.metadata.nombreAutor}
              className="author-avatar"
            />
          )}
          <div className="author-details">
            <span className="author-name">{post.metadata.nombreAutor}</span>
            <time className="post-date">
              {new Date(post.metadata.fecha).toLocaleDateString('es-ES', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </time>
          </div>
        </div>
      </header>

      <div className="post-content">
        <ReactMarkdown 
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
          components={{
            h1: ({...props}) => <h2 {...props} />,
            h2: ({...props}) => <h3 {...props} />,
            h3: ({...props}) => <h4 {...props} />,
            code: ({inline, ...props}) => 
              inline ? 
                <code className="inline-code" {...props} /> : 
                <code className="code-block" {...props} />,
            pre: ({...props}) => <pre className="pre-block" {...props} />,
            a: ({...props}) => <a target="_blank" rel="noopener noreferrer" {...props} />,
            img: ({...props}) => <img loading="lazy" {...props} />
          }}
        >
          {post.content}
        </ReactMarkdown>
      </div>

      {relatedPosts.length > 0 && (
        <section className="related-posts" aria-label="Articulos relacionados">
          <h2 className="related-posts-title">Articulos relacionados</h2>
          <div className="related-posts-grid">
            {relatedPosts.map((relatedPost) => (
              <Link
                key={relatedPost.metadata.path}
                to={relatedPost.metadata.path}
                className="related-post-card"
              >
                {relatedPost.metadata.imagenPortada && (
                  <img
                    src={relatedPost.metadata.imagenPortada}
                    alt={relatedPost.metadata.titulo}
                    className="related-post-image"
                    loading="lazy"
                  />
                )}
                <div className="related-post-body">
                  <h3>{relatedPost.metadata.titulo}</h3>
                  {relatedPost.metadata.descripcion && (
                    <p>{relatedPost.metadata.descripcion}</p>
                  )}
                  <span className="related-post-date">
                    {new Date(relatedPost.metadata.fecha).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </article>
  )
}

export default PostView
