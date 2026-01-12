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
