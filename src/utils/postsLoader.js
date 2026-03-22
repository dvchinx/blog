import matter from 'gray-matter'

// Esta función carga todos los posts desde la carpeta posts
export async function loadPosts() {
  const postFiles = import.meta.glob('/src/posts/**/*.md', { query: '?raw', import: 'default' })
  const posts = []

  for (const path in postFiles) {
    const content = await postFiles[path]()
    const { data, content: markdown } = matter(content)
    
    // Extraer año, mes y slug del path: /src/posts/2026/01/nombre-post.md
    const pathParts = path.split('/')
    const year = pathParts[3]
    const month = pathParts[4]
    const slug = pathParts[5].replace('.md', '')
    
    posts.push({
      metadata: {
        ...data,
        year,
        month,
        slug,
        path: `/${year}/${month}/${slug}`
      },
      content: markdown
    })
  }

  // Ordenar por fecha (más reciente primero)
  return posts.sort((a, b) => {
    const dateA = new Date(a.metadata.fecha)
    const dateB = new Date(b.metadata.fecha)
    return dateB - dateA
  })
}

// Buscar un post específico por year/month/slug
export async function loadPost(year, month, slug) {
  try {
    const path = `/src/posts/${year}/${month}/${slug}.md`
    const postFiles = import.meta.glob('/src/posts/**/*.md', { query: '?raw', import: 'default' })
    
    if (postFiles[path]) {
      const content = await postFiles[path]()
      const { data, content: markdown } = matter(content)
      
      return {
        metadata: {
          ...data,
          year,
          month,
          slug,
          path: `/${year}/${month}/${slug}`
        },
        content: markdown
      }
    }
  } catch (error) {
    console.error('Error loading post:', error)
  }
  
  return null
}

// Filtrar posts por búsqueda
export function searchPosts(posts, searchTerm) {
  if (!searchTerm) return posts
  
  const term = searchTerm.toLowerCase()
  return posts.filter(post => 
    post.metadata.titulo?.toLowerCase().includes(term) ||
    post.metadata.descripcion?.toLowerCase().includes(term) ||
    post.content.toLowerCase().includes(term)
  )
}

// Obtener posts relacionados por categoria y etiquetas compartidas
export function getRelatedPosts(posts, currentPost, limit = 3) {
  if (!currentPost || !Array.isArray(posts)) return []

  const currentPath = currentPost.metadata.path
  const currentCategory = currentPost.metadata.categoria
  const currentTags = new Set(
    (currentPost.metadata.etiquetas || []).map((tag) => String(tag).toLowerCase())
  )

  const scored = posts
    .filter((post) => post.metadata.path !== currentPath)
    .map((post) => {
      let score = 0
      const postTags = (post.metadata.etiquetas || []).map((tag) => String(tag).toLowerCase())

      if (currentCategory && post.metadata.categoria === currentCategory) {
        score += 3
      }

      for (const tag of postTags) {
        if (currentTags.has(tag)) {
          score += 2
        }
      }

      if (post.metadata.nombreAutor && post.metadata.nombreAutor === currentPost.metadata.nombreAutor) {
        score += 1
      }

      return { post, score }
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score

      const dateA = new Date(a.post.metadata.fecha)
      const dateB = new Date(b.post.metadata.fecha)
      return dateB - dateA
    })

  return scored.slice(0, limit).map((item) => item.post)
}
