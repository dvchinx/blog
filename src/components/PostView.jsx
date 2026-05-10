import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { loadPost, loadPosts, getRelatedPosts } from '../utils/postsLoader'
import { setPostSeo } from '../utils/seo'
import '../styles/PostView.css'

function detectCodeLanguage(code) {
  if (/^\s*(import |export |const |let |var |function |class |async function|\(|\{)/m.test(code)) {
    return 'javascript'
  }

  if (/^\s*(def |class |from |import |print\(|if __name__ == ['"]__main__['"])/m.test(code)) {
    return 'python'
  }

  if (/^\s*(public class |public static void main|System\.out\.println|package )/m.test(code)) {
    return 'java'
  }

  if (/^\s*(#include|using namespace |int main\(|cout <<)/m.test(code)) {
    return 'cpp'
  }

  if (/^\s*[-\w]+:\s*.+$/m.test(code) || /^\s*[-\w]+:\s*$/m.test(code)) {
    return 'yaml'
  }

  if (/^\s*(\$ |npm |yarn |pnpm |git |cd |ls |mkdir |curl )/m.test(code)) {
    return 'bash'
  }

  return 'text'
}

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
            pre: ({ children }) => <>{children}</>,
            h1: ({...props}) => <h2 {...props} />,
            h2: ({...props}) => <h3 {...props} />,
            h3: ({...props}) => <h4 {...props} />,
            code: ({inline, className, children, ...props}) => {
              const match = /language-(\w+)/.exec(className || '')
              const code = String(children).replace(/\n$/, '')
              const hasLineBreaks = code.includes('\n')
              
              // Si es inline o no tiene saltos de línea, mostrar como código inline
              if (inline || !hasLineBreaks) {
                return <code className="inline-code" {...props}>{children}</code>
              }

              // Si es bloque de código con saltos de línea, usar SyntaxHighlighter
              const language = match?.[1] || detectCodeLanguage(code)
              return (
                <SyntaxHighlighter
                  language={language}
                  style={vscDarkPlus}
                  PreTag="div"
                  customStyle={{
                    margin: '1.75rem 0',
                    padding: '1.25rem 1.5rem',
                    borderRadius: 'var(--radius)',
                    border: '1px solid #2d2d2d',
                    background: '#1e1e1e',
                    fontSize: '0.875rem',
                    lineHeight: 1.7,
                    overflowX: 'auto'
                  }}
                  codeTagProps={{
                    style: {
                      fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace"
                    }
                  }}
                  {...props}
                >
                  {code}
                </SyntaxHighlighter>
              )
            },
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
