const SITE_URL = 'https://blog.jesusflorez.cloud'
const SITE_NAME = 'Blog de Jesus Florez'

function upsertMeta(selector, attrs) {
  let element = document.head.querySelector(selector)

  if (!element) {
    element = document.createElement('meta')
    if (attrs.name) element.setAttribute('name', attrs.name)
    if (attrs.property) element.setAttribute('property', attrs.property)
    document.head.appendChild(element)
  }

  element.setAttribute('content', attrs.content)
}

function setCanonical(url) {
  let canonical = document.head.querySelector('link[rel="canonical"]')

  if (!canonical) {
    canonical = document.createElement('link')
    canonical.setAttribute('rel', 'canonical')
    document.head.appendChild(canonical)
  }

  canonical.setAttribute('href', url)
}

function setJsonLd(payload) {
  let script = document.getElementById('seo-json-ld')

  if (!script) {
    script = document.createElement('script')
    script.type = 'application/ld+json'
    script.id = 'seo-json-ld'
    document.head.appendChild(script)
  }

  script.textContent = JSON.stringify(payload)
}

export function getPostUrl(path) {
  return `${SITE_URL}${path}`
}

export function setHomeSeo() {
  const title = `${SITE_NAME} | Programacion competitiva y tecnologia`
  const description = 'Articulos sobre programacion competitiva, ICPC, CCPL, Python, Java y tecnologia para LATAM.'
  const canonical = `${SITE_URL}/`

  document.title = title
  setCanonical(canonical)

  upsertMeta('meta[name="description"]', { name: 'description', content: description })
  upsertMeta('meta[name="robots"]', { name: 'robots', content: 'index, follow' })

  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' })
  upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME })
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })

  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })

  setJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    url: `${SITE_URL}/`,
    inLanguage: 'es',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    },
    publisher: {
      '@type': 'Person',
      name: 'Jesus Florez',
      url: 'https://jesusflorez.cloud/portfolio'
    }
  })
}

export function setPostSeo(post) {
  if (!post) return

  const title = `${post.metadata.titulo} | ${SITE_NAME}`
  const description = post.metadata.descripcion || 'Articulo tecnico de programacion y tecnologia.'
  const canonical = getPostUrl(post.metadata.path)

  document.title = title
  setCanonical(canonical)

  upsertMeta('meta[name="description"]', { name: 'description', content: description })
  upsertMeta('meta[name="robots"]', { name: 'robots', content: 'index, follow' })

  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'article' })
  upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME })
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })

  if (post.metadata.imagenPortada) {
    upsertMeta('meta[property="og:image"]', { property: 'og:image', content: post.metadata.imagenPortada })
    upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: post.metadata.imagenPortada })
  }

  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })

  setJsonLd({
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.metadata.titulo,
    description,
    datePublished: post.metadata.fecha,
    dateModified: post.metadata.fecha,
    mainEntityOfPage: canonical,
    image: post.metadata.imagenPortada ? [post.metadata.imagenPortada] : undefined,
    author: {
      '@type': 'Person',
      name: post.metadata.nombreAutor || 'Jesus Florez'
    },
    publisher: {
      '@type': 'Person',
      name: 'Jesus Florez',
      url: 'https://jesusflorez.cloud'
    },
    keywords: Array.isArray(post.metadata.etiquetas) ? post.metadata.etiquetas.join(', ') : undefined,
    inLanguage: 'es'
  })
}

export const seoConfig = {
  siteUrl: SITE_URL,
  siteName: SITE_NAME
}
