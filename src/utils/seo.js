const SITE_URL = 'https://blog.jesusflorez.cloud'
const SITE_NAME = 'Blog de Jesús Flórez'
const DEFAULT_OG_IMAGE = `${SITE_URL}/og-default.png`
const AUTHOR_URL = 'https://jesusflorez.cloud'

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function removeMeta(selector) {
  const el = document.head.querySelector(selector)
  if (el) el.remove()
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

  script.textContent = JSON.stringify(Array.isArray(payload) ? payload : payload)
}

/**
 * Estimate word count from markdown content.
 * Strips code blocks, images and frontmatter before counting.
 */
function estimateWordCount(content = '') {
  const stripped = content
    .replace(/```[\s\S]*?```/g, '')   // fenced code blocks
    .replace(/`[^`]+`/g, '')          // inline code
    .replace(/!\[.*?\]\(.*?\)/g, '')  // images
    .replace(/\[.*?\]\(.*?\)/g, '')   // links (keep label)
    .replace(/#{1,6}\s/g, '')         // headings
    .replace(/[*_~>|-]/g, '')         // markdown symbols
    .trim()

  const words = stripped.split(/\s+/).filter(Boolean)
  return words.length
}

/**
 * Make sure an image URL is absolute.
 */
function absoluteImage(src) {
  if (!src) return DEFAULT_OG_IMAGE
  if (src.startsWith('http://') || src.startsWith('https://')) return src
  // relative public path → prepend site URL
  return `${SITE_URL}${src.startsWith('/') ? '' : '/'}${src}`
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function getPostUrl(path) {
  return `${SITE_URL}${path}`
}

// ─── Home page SEO ────────────────────────────────────────────────────────────

export function setHomeSeo() {
  const title = `${SITE_NAME} | Programación competitiva y tecnología`
  const description =
    'Artículos sobre programación competitiva, ICPC, CCPL, Python, Java y tecnología para LATAM.'
  const canonical = `${SITE_URL}/`
  const keywords =
    'programación competitiva, ICPC, CCPL, Codeforces, algoritmos, Python, Java, Spring Boot, React, tecnología, LATAM, Jesús Flórez'

  document.title = title
  setCanonical(canonical)

  upsertMeta('meta[name="description"]', { name: 'description', content: description })
  upsertMeta('meta[name="keywords"]', { name: 'keywords', content: keywords })
  upsertMeta('meta[name="robots"]', {
    name: 'robots',
    content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'
  })

  // Open Graph
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'website' })
  upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME })
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: DEFAULT_OG_IMAGE })
  upsertMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: '1200' })
  upsertMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: '630' })

  // Remove article-specific tags if navigating back from a post
  removeMeta('meta[property="article:published_time"]')
  removeMeta('meta[property="article:modified_time"]')
  removeMeta('meta[property="article:author"]')
  removeMeta('meta[property="article:section"]')

  // Twitter
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: DEFAULT_OG_IMAGE })

  setJsonLd({
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE_NAME,
    description,
    url: canonical,
    inLanguage: 'es',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    },
    publisher: {
      '@type': 'Person',
      name: 'Jesús Flórez',
      url: AUTHOR_URL
    }
  })
}

// ─── Post page SEO ────────────────────────────────────────────────────────────

export function setPostSeo(post) {
  if (!post) return

  const { metadata, content } = post

  const title = `${metadata.titulo} | ${SITE_NAME}`
  const description =
    metadata.descripcion || 'Artículo técnico de programación y tecnología.'
  const canonical = getPostUrl(metadata.path)
  const image = absoluteImage(metadata.imagenPortada)
  const author = metadata.nombreAutor || 'Jesús Flórez'
  const datePublished = metadata.fecha || new Date().toISOString().split('T')[0]
  const dateModified = metadata.fechaActualizacion || datePublished
  const tags = Array.isArray(metadata.etiquetas) ? metadata.etiquetas : []
  const section =
    metadata.categoria === 'coding' ? 'Programación competitiva' : 'Tecnología'
  const wordCount = estimateWordCount(content)
  const keywords = tags.join(', ')

  document.title = title
  setCanonical(canonical)

  // Basic meta
  upsertMeta('meta[name="description"]', { name: 'description', content: description })
  upsertMeta('meta[name="keywords"]', { name: 'keywords', content: keywords })
  upsertMeta('meta[name="author"]', { name: 'author', content: author })
  upsertMeta('meta[name="robots"]', {
    name: 'robots',
    content: 'index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1'
  })

  // Open Graph — article
  upsertMeta('meta[property="og:type"]', { property: 'og:type', content: 'article' })
  upsertMeta('meta[property="og:site_name"]', { property: 'og:site_name', content: SITE_NAME })
  upsertMeta('meta[property="og:title"]', { property: 'og:title', content: title })
  upsertMeta('meta[property="og:description"]', { property: 'og:description', content: description })
  upsertMeta('meta[property="og:url"]', { property: 'og:url', content: canonical })
  upsertMeta('meta[property="og:image"]', { property: 'og:image', content: image })
  upsertMeta('meta[property="og:image:width"]', { property: 'og:image:width', content: '1200' })
  upsertMeta('meta[property="og:image:height"]', { property: 'og:image:height', content: '630' })
  upsertMeta('meta[property="og:image:alt"]', {
    property: 'og:image:alt',
    content: metadata.titulo
  })
  upsertMeta('meta[property="og:locale"]', { property: 'og:locale', content: 'es_LA' })

  // Article-specific Open Graph
  upsertMeta('meta[property="article:published_time"]', {
    property: 'article:published_time',
    content: datePublished
  })
  upsertMeta('meta[property="article:modified_time"]', {
    property: 'article:modified_time',
    content: dateModified
  })
  upsertMeta('meta[property="article:author"]', {
    property: 'article:author',
    content: AUTHOR_URL
  })
  upsertMeta('meta[property="article:section"]', {
    property: 'article:section',
    content: section
  })

  // Twitter
  upsertMeta('meta[name="twitter:card"]', { name: 'twitter:card', content: 'summary_large_image' })
  upsertMeta('meta[name="twitter:title"]', { name: 'twitter:title', content: title })
  upsertMeta('meta[name="twitter:description"]', { name: 'twitter:description', content: description })
  upsertMeta('meta[name="twitter:image"]', { name: 'twitter:image', content: image })
  upsertMeta('meta[name="twitter:image:alt"]', {
    name: 'twitter:image:alt',
    content: metadata.titulo
  })

  // JSON-LD — BlogPosting + BreadcrumbList
  setJsonLd([
    {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      '@id': canonical,
      headline: metadata.titulo,
      description,
      url: canonical,
      datePublished,
      dateModified,
      wordCount,
      inLanguage: 'es',
      articleSection: section,
      keywords: tags.join(', '),
      image: {
        '@type': 'ImageObject',
        url: image,
        width: 1200,
        height: 630
      },
      author: {
        '@type': 'Person',
        name: author,
        url: AUTHOR_URL
      },
      publisher: {
        '@type': 'Person',
        name: 'Jesús Flórez',
        url: AUTHOR_URL
      },
      mainEntityOfPage: {
        '@type': 'WebPage',
        '@id': canonical
      },
      isPartOf: {
        '@type': 'Blog',
        name: SITE_NAME,
        url: `${SITE_URL}/`
      }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Blog',
          item: `${SITE_URL}/`
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: section,
          item: `${SITE_URL}/?categoria=${metadata.categoria || 'tech'}`
        },
        {
          '@type': 'ListItem',
          position: 3,
          name: metadata.titulo,
          item: canonical
        }
      ]
    }
  ])
}

export const seoConfig = {
  siteUrl: SITE_URL,
  siteName: SITE_NAME
}
