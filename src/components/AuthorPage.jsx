import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { loadPosts } from '../utils/postsLoader'
import { setAuthorSeo } from '../utils/seo'
import '../styles/AuthorPage.css'

const AUTHOR_NAME = 'Jesús Flórez'

function AuthorPage() {
  const [posts, setPosts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setAuthorSeo()

    async function fetchPosts() {
      try {
        const allPosts = await loadPosts()
        setPosts(allPosts.filter((post) => post.metadata.nombreAutor === AUTHOR_NAME))
      } catch (error) {
        console.error('Error loading posts:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchPosts()
  }, [])

  return (
    <div className="author-page">
      <Link to="/" className="back-link">← Volver al blog</Link>

      <header className="author-header">
        <img
          src="/authors/jesus-florez.jpeg"
          alt={AUTHOR_NAME}
          className="author-photo"
          width="96"
          height="96"
        />
        <div>
          <h1>{AUTHOR_NAME}</h1>
          <p className="author-bio">
            Desarrollador de software y autor de este blog, enfocado en programación competitiva
            (ICPC, CCPL, Codeforces) y tecnología (Java, Python, Spring Boot, React y arquitectura
            de software) para la comunidad LATAM.
          </p>
          <div className="author-social">
            <a href="https://github.com/dvchinx" target="_blank" rel="noopener noreferrer me">GitHub</a>
            <a href="https://www.linkedin.com/in/dvchinx/" target="_blank" rel="noopener noreferrer me">LinkedIn</a>
            <a href="https://jesusflorez.cloud" target="_blank" rel="noopener noreferrer me">jesusflorez.cloud</a>
          </div>
        </div>
      </header>

      <section className="author-posts">
        <h2>Artículos publicados</h2>
        {loading ? (
          <p>Cargando artículos...</p>
        ) : (
          <ul className="author-posts-list">
            {posts.map((post) => (
              <li key={post.metadata.path}>
                <Link to={post.metadata.path}>{post.metadata.titulo}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

export default AuthorPage
