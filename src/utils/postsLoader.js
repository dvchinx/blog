import { reloadOnStaleChunk } from './staleChunk'

// El plugin blog-posts (vite.config.js) convierte cada .md en JS en build:
// `?meta` exporta solo el frontmatter, el módulo plano solo el cuerpo.
const metadataModules = import.meta.glob('/src/posts/**/*.md', {
  query: '?meta',
  import: 'metadata',
  eager: true
})
const contentModules = import.meta.glob('/src/posts/**/*.md', { import: 'content' })

// Catálogo completo (solo metadatos), ordenado por fecha (más reciente primero).
// Es síncrono: listar posts no descarga ningún artículo.
const catalog = Object.values(metadataModules)
  .map((metadata) => ({ metadata }))
  .sort((a, b) => new Date(b.metadata.fecha) - new Date(a.metadata.fecha))

const catalogByPath = new Map(catalog.map((post) => [post.metadata.path, post]))
const loadedPosts = new Map()
let searchContents = null

export function getAllPosts() {
  return catalog
}

export function findPost(year, month, slug) {
  return catalogByPath.get(`/${year}/${month}/${slug}`) || null
}

// Post completo (metadatos + markdown) si ya se cargó; si no, null.
export function getLoadedPost(path) {
  return loadedPosts.get(path) || null
}

// Carga el markdown de un post. Resuelve a null si el post no existe.
export async function loadPost(year, month, slug) {
  const entry = findPost(year, month, slug)
  if (!entry) return null

  const { path } = entry.metadata
  if (!loadedPosts.has(path)) {
    const content = await reloadOnStaleChunk(contentModules[`/src/posts${path}.md`], path)
    loadedPosts.set(path, { metadata: entry.metadata, content })
  }
  return loadedPosts.get(path)
}

// Markdown de todos los posts para la búsqueda de texto completo. Solo se
// descarga cuando alguien busca algo.
export function loadSearchContents() {
  if (!searchContents) {
    searchContents = Promise.all(
      catalog.map(async ({ metadata }) => [
        metadata.path,
        await contentModules[`/src/posts${metadata.path}.md`]()
      ])
    )
      .then((entries) => new Map(entries))
      .catch((error) => {
        searchContents = null
        throw error
      })
  }
  return searchContents
}
