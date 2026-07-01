/**
 * Build-time prerendering: generates static HTML (real title, meta tags,
 * JSON-LD and article body) for every route, so crawlers that don't execute
 * JavaScript (GPTBot, ClaudeBot, PerplexityBot, Google's first crawl pass)
 * see real content instead of the empty CSR shell.
 *
 * React still mounts on top of this via ReactDOM.createRoot(...).render(...)
 * (not hydrateRoot), so it simply replaces the DOM on load for real browsers
 * — no hydration-mismatch risk.
 */
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeRaw from 'rehype-raw'
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism.js'
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism/index.js'
import { detectCodeLanguage } from '../src/utils/detectCodeLanguage.js'
import { getRelatedPosts } from '../src/utils/postsLoader.js'
import {
  buildPostSeoData,
  CATEGORY_INFO,
  SITE_URL,
  SITE_NAME,
  AUTHOR_URL,
  DEFAULT_OG_IMAGE
} from '../src/utils/seo.js'

const e = React.createElement
const repoRoot = process.cwd()
const distDir = path.join(repoRoot, 'dist')
const postsRoot = path.join(repoRoot, 'src', 'posts')
const template = fs.readFileSync(path.join(distDir, 'index.html'), 'utf8')

// ─── Load all posts (plain fs, no import.meta.glob — that's Vite-only) ───────

function collectMarkdownFiles(dirPath, acc = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) collectMarkdownFiles(fullPath, acc)
    else if (entry.name.endsWith('.md')) acc.push(fullPath)
  }
  return acc
}

const posts = collectMarkdownFiles(postsRoot)
  .map((filePath) => {
    const raw = fs.readFileSync(filePath, 'utf8')
    const { data, content } = matter(raw)
    const rel = path.relative(postsRoot, filePath).split(path.sep)
    const [year, month, file] = rel
    const slug = file.replace(/\.md$/i, '')
    return {
      metadata: { ...data, year, month, slug, path: `/${year}/${month}/${slug}` },
      content
    }
  })
  .sort((a, b) => new Date(b.metadata.fecha) - new Date(a.metadata.fecha))

// ─── HTML string helpers ──────────────────────────────────────────────────────

function escapeHtml(str = '') {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function escapeAttr(str = '') {
  return escapeHtml(str).replace(/"/g, '&quot;')
}

function setTagContent(html, attrMatch, content) {
  const tagRe = new RegExp(`<meta[^>]*${attrMatch}[^>]*>`, 'i')
  const match = html.match(tagRe)
  if (!match) return html
  const newTag = match[0].replace(/content="[^"]*"/, `content="${escapeAttr(content)}"`)
  return html.replace(match[0], newTag)
}

function applyHead(html, seo) {
  let out = html
  out = out.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(seo.title)}</title>`)
  out = out.replace(/<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${escapeAttr(seo.canonical)}" />`)
  out = setTagContent(out, 'name="description"', seo.description)
  if (seo.keywords) out = setTagContent(out, 'name="keywords"', seo.keywords)
  out = setTagContent(out, 'property="og:type"', seo.ogType || 'website')
  out = setTagContent(out, 'property="og:title"', seo.title)
  out = setTagContent(out, 'property="og:description"', seo.description)
  out = setTagContent(out, 'property="og:url"', seo.canonical)
  out = setTagContent(out, 'property="og:image"', seo.image || DEFAULT_OG_IMAGE)
  out = setTagContent(out, 'name="twitter:title"', seo.title)
  out = setTagContent(out, 'name="twitter:description"', seo.description)
  out = setTagContent(out, 'name="twitter:image"', seo.image || DEFAULT_OG_IMAGE)

  const extraTags = (seo.extraMeta || [])
    .map((tag) => `    <meta property="${tag.property}" content="${escapeAttr(tag.content)}" />`)
    .join('\n')

  if (extraTags) {
    out = out.replace('</head>', `${extraTags}\n  </head>`)
  }

  out = out.replace(
    /<script type="application\/ld\+json" id="seo-json-ld">[\s\S]*?<\/script>/,
    `<script type="application/ld+json" id="seo-json-ld">\n      ${JSON.stringify(seo.jsonLd)}\n    </script>`
  )

  return out
}

function setRootContent(html, bodyHtml) {
  return html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`)
}

function writePage(routePath, html) {
  const dir = routePath === '/' ? distDir : path.join(distDir, routePath.replace(/^\//, ''))
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8')
}

// ─── Markdown → static article HTML (mirrors PostView's renderer) ───────────

function renderArticleHtml(markdown) {
  const components = {
    pre: (props) => e(React.Fragment, null, props.children),
    h1: (props) => e('h2', props),
    h2: (props) => e('h3', props),
    h3: (props) => e('h4', props),
    code: ({ inline, className, children }) => {
      const code = String(children).replace(/\n$/, '')
      const hasLineBreaks = code.includes('\n')
      if (inline || !hasLineBreaks) {
        return e('code', { className: 'inline-code' }, code)
      }
      const match = /language-(\w+)/.exec(className || '')
      const language = match?.[1] || detectCodeLanguage(code)
      return e(
        SyntaxHighlighter,
        { language, style: vscDarkPlus, PreTag: 'div' },
        code
      )
    },
    a: (props) => e('a', { ...props, target: '_blank', rel: 'noopener noreferrer' }),
    img: (props) => e('img', { ...props, loading: 'lazy' })
  }

  return renderToStaticMarkup(
    e(ReactMarkdown, { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeRaw], components }, markdown)
  )
}

function formatDate(dateStr) {
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString('es-ES', { year: 'numeric', month: 'long', day: 'numeric' })
}

// ─── Post cards (reused for home / category listings) ────────────────────────

function renderPostCard(post) {
  const { metadata } = post
  const categoria = metadata.categoria || 'tech'
  const image = metadata.imagenPortada
    ? `<div class="post-card-image"><img src="${escapeAttr(metadata.imagenPortada)}" alt="${escapeAttr(metadata.titulo)}" loading="lazy" width="400" height="200" /></div>`
    : ''
  const tags = Array.isArray(metadata.etiquetas) && metadata.etiquetas.length
    ? `<div class="post-tags">${metadata.etiquetas.map((t) => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>`
    : ''
  const description = metadata.descripcion
    ? `<p class="post-description">${escapeHtml(metadata.descripcion)}</p>`
    : ''

  return `<a href="${metadata.path}" class="post-card post-card-${categoria}">
    ${image}
    <div class="post-card-content">
      ${tags}
      <h3 class="post-title">${escapeHtml(metadata.titulo)}</h3>
      ${description}
      <div class="post-meta">
        <span class="post-author">${escapeHtml(metadata.nombreAutor || '')}</span>
        <span class="post-date-separator">•</span>
        <span class="post-date">${formatDate(metadata.fecha)}</span>
      </div>
    </div>
  </a>`
}

function renderPostGrid(list) {
  return `<div class="posts-grid">${list.map(renderPostCard).join('\n')}</div>`
}

// ─── Page builders ─────────────────────────────────────────────────────────

function buildHomePage() {
  const title = `${SITE_NAME} | Programación competitiva y tecnología`
  const description = 'Artículos sobre programación competitiva, ICPC, CCPL, Python, Java y tecnología para LATAM.'
  const canonical = `${SITE_URL}/`

  const seo = {
    title,
    description,
    canonical,
    image: DEFAULT_OG_IMAGE,
    jsonLd: {
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
      publisher: { '@type': 'Person', name: 'Jesús Flórez', url: AUTHOR_URL }
    }
  }

  const body = `<div class="post-list-container">
    <div class="search-section"><h1>Programación competitiva y tecnología</h1></div>
    ${renderPostGrid(posts)}
  </div>`

  const html = setRootContent(applyHead(template, seo), body)
  writePage('/', html)
}

function buildCategoryPage(code) {
  const info = CATEGORY_INFO[code]
  const canonical = `${SITE_URL}/categoria/${info.slug}`
  const list = posts.filter((p) => p.metadata.categoria === code)

  const seo = {
    title: info.title,
    description: info.description,
    canonical,
    image: DEFAULT_OG_IMAGE,
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'CollectionPage',
        name: info.title,
        description: info.description,
        url: canonical,
        isPartOf: { '@type': 'Blog', name: SITE_NAME, url: `${SITE_URL}/` }
      },
      {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Blog', item: `${SITE_URL}/` },
          { '@type': 'ListItem', position: 2, name: info.label, item: canonical }
        ]
      }
    ]
  }

  const body = `<div class="post-list-container">
    <div class="search-section"><h1>${escapeHtml(info.label)}</h1></div>
    ${renderPostGrid(list)}
  </div>`

  const html = setRootContent(applyHead(template, seo), body)
  writePage(`/categoria/${info.slug}`, html)
}

function buildAuthorPage() {
  const title = `Jesús Flórez | ${SITE_NAME}`
  const description = 'Jesús Flórez — desarrollador de software y autor del blog, especializado en programación competitiva y tecnología para LATAM.'
  const canonical = `${SITE_URL}/autor/jesus-florez`
  const authorPosts = posts.filter((p) => p.metadata.nombreAutor === 'Jesús Flórez')

  const seo = {
    title,
    description,
    canonical,
    image: `${SITE_URL}/authors/jesus-florez.jpeg`,
    ogType: 'profile',
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'ProfilePage',
      url: canonical,
      mainEntity: {
        '@type': 'Person',
        name: 'Jesús Flórez',
        url: AUTHOR_URL,
        image: `${SITE_URL}/authors/jesus-florez.jpeg`,
        jobTitle: 'Desarrollador de software',
        sameAs: ['https://github.com/dvchinx', 'https://www.linkedin.com/in/dvchinx/', AUTHOR_URL]
      }
    }
  }

  const body = `<div class="author-page">
    <header class="author-header">
      <img src="/authors/jesus-florez.jpeg" alt="Jesús Flórez" class="author-photo" width="96" height="96" />
      <div>
        <h1>Jesús Flórez</h1>
        <p class="author-bio">${escapeHtml(description)}</p>
      </div>
    </header>
    <section class="author-posts">
      <h2>Artículos publicados</h2>
      <ul class="author-posts-list">
        ${authorPosts.map((p) => `<li><a href="${p.metadata.path}">${escapeHtml(p.metadata.titulo)}</a></li>`).join('\n')}
      </ul>
    </section>
  </div>`

  const html = setRootContent(applyHead(template, seo), body)
  writePage('/autor/jesus-florez', html)
}

function buildPostPage(post) {
  const seoData = buildPostSeoData(post)
  const { metadata, content } = post
  const categoria = metadata.categoria || 'tech'
  const categoriaSlug = categoria === 'coding' ? 'programacion-competitiva' : 'tecnologia'

  const seo = {
    title: seoData.title,
    description: seoData.description,
    canonical: seoData.canonical,
    image: seoData.image,
    ogType: 'article',
    keywords: seoData.keywords,
    jsonLd: seoData.jsonLd,
    extraMeta: [
      { property: 'article:published_time', content: seoData.datePublished },
      { property: 'article:modified_time', content: seoData.dateModified },
      { property: 'article:author', content: AUTHOR_URL },
      { property: 'article:section', content: seoData.section }
    ]
  }

  const cover = metadata.imagenPortada
    ? `<div class="post-cover-image"><img src="${escapeAttr(metadata.imagenPortada)}" alt="${escapeAttr(metadata.titulo)}" width="1200" height="360" /></div>`
    : ''

  const tags = Array.isArray(metadata.etiquetas) && metadata.etiquetas.length
    ? `<div class="post-tags-view">${metadata.etiquetas.map((t) => `<span class="tag-view">${escapeHtml(t)}</span>`).join('')}</div>`
    : ''

  const avatar = metadata.fotoAutor
    ? `<img src="${escapeAttr(metadata.fotoAutor)}" alt="${escapeAttr(metadata.nombreAutor)}" class="author-avatar" width="40" height="40" />`
    : ''

  const related = getRelatedPosts(posts, post, 3)
  const relatedHtml = related.length
    ? `<section class="related-posts" aria-label="Articulos relacionados">
        <h2 class="related-posts-title">Articulos relacionados</h2>
        <div class="related-posts-grid">
          ${related.map((r) => `<a href="${r.metadata.path}" class="related-post-card">
            <div class="related-post-body">
              <h3>${escapeHtml(r.metadata.titulo)}</h3>
              ${r.metadata.descripcion ? `<p>${escapeHtml(r.metadata.descripcion)}</p>` : ''}
            </div>
          </a>`).join('\n')}
        </div>
      </section>`
    : ''

  const body = `<article class="post-view post-view-${categoria}">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <ol>
        <li><a href="/">Blog</a></li>
        <li><a href="/categoria/${categoriaSlug}">${seoData.section}</a></li>
        <li aria-current="page">${escapeHtml(metadata.titulo)}</li>
      </ol>
    </nav>
    <a href="/" class="back-link">← Volver al blog</a>
    ${cover}
    <header class="post-header">
      ${tags}
      <h1 class="post-title">${escapeHtml(metadata.titulo)}</h1>
      <div class="post-author-info">
        ${avatar}
        <div class="author-details">
          <a href="/autor/jesus-florez" class="author-name">${escapeHtml(metadata.nombreAutor || '')}</a>
          <time class="post-date">${formatDate(metadata.fecha)}</time>
        </div>
      </div>
    </header>
    <div class="post-content">${renderArticleHtml(content)}</div>
    ${relatedHtml}
  </article>`

  const html = setRootContent(applyHead(template, seo), body)
  writePage(metadata.path, html)
}

// ─── Run ──────────────────────────────────────────────────────────────────────

buildHomePage()
buildCategoryPage('tech')
buildCategoryPage('coding')
buildAuthorPage()
for (const post of posts) buildPostPage(post)

console.log(`✅  prerendered ${posts.length} posts + home + 2 category pages + author page`)
