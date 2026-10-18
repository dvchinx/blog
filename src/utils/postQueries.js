// Funciones puras sobre el catálogo de posts: sin import.meta.glob, así las
// puede importar también el prerender (Node).

// Filtrar posts por búsqueda. `contents` (Map path → markdown) es opcional:
// mientras no se ha cargado, solo se busca en los metadatos.
export function searchPosts(posts, searchTerm, contents) {
  if (!searchTerm) return posts

  const term = searchTerm.toLowerCase()
  return posts.filter((post) => {
    const { titulo, descripcion, etiquetas, path } = post.metadata
    return (
      titulo?.toLowerCase().includes(term) ||
      descripcion?.toLowerCase().includes(term) ||
      (etiquetas || []).some((tag) => String(tag).toLowerCase().includes(term)) ||
      contents?.get(path)?.toLowerCase().includes(term)
    )
  })
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
