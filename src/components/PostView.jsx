import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { loadPost } from '../utils/postsLoader'
import '../styles/PostView.css'

function PostView() {
  const { year, month, slug } = useParams()
  const [post, setPost] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    async function fetchPost() {
      try {
        const postData = await loadPost(year, month, slug)
        if (postData) {
          setPost(postData)
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
    <article className="post-view">
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
          components={{
            h1: ({node, ...props}) => <h2 {...props} />,
            h2: ({node, ...props}) => <h3 {...props} />,
            h3: ({node, ...props}) => <h4 {...props} />,
            code: ({node, inline, ...props}) => 
              inline ? 
                <code className="inline-code" {...props} /> : 
                <code className="code-block" {...props} />,
            pre: ({node, ...props}) => <pre className="pre-block" {...props} />,
            a: ({node, ...props}) => <a target="_blank" rel="noopener noreferrer" {...props} />,
            img: ({node, ...props}) => <img loading="lazy" {...props} />
          }}
        >
          {post.content}
        </ReactMarkdown>
      </div>
    </article>
  )
}

export default PostView
