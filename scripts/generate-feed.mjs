import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const siteUrl = 'https://blog.jesusflorez.cloud'
const siteName = 'Blog de Jesús Flórez'
const siteDescription = 'Artículos sobre programación competitiva, ICPC, CCPL, Python, Java y tecnología para LATAM.'
const repoRoot = process.cwd()
const postsRoot = path.join(repoRoot, 'src', 'posts')
const outputPath = path.join(repoRoot, 'public', 'feed.xml')
const jsonOutputPath = path.join(repoRoot, 'public', 'feed.json')

// ─── Helpers ──────────────────────────────────────────────────────────────────

function collectMarkdownFiles(dirPath, acc = []) {
  const entries = fs.readdirSync(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name)

    if (entry.isDirectory()) {
      collectMarkdownFiles(fullPath, acc)
      continue
    }

    if (entry.isFile() && entry.name.endsWith('.md')) {
      acc.push(fullPath)
    }
  }

  return acc
}

function toSitePath(filePath) {
  const relative = path.relative(postsRoot, filePath)
  const normalized = relative.split(path.sep).join('/')
  return `/${normalized.replace(/\.md$/i, '')}`
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function absoluteUrl(src) {
  if (!src) return ''
  if (/^https?:\/\//.test(src)) return src
  return `${siteUrl}${src.startsWith('/') ? '' : '/'}${src}`
}

function toRfc822(dateStr) {
  const date = dateStr ? new Date(dateStr) : new Date()
  return (Number.isNaN(date.getTime()) ? new Date() : date).toUTCString()
}

// ─── Build feed items ─────────────────────────────────────────────────────────

const markdownFiles = collectMarkdownFiles(postsRoot)

const items = markdownFiles
  .map((filePath) => {
    const content = fs.readFileSync(filePath, 'utf8')
    const { data } = matter(content)
    const loc = `${siteUrl}${toSitePath(filePath)}`
    const section = data.categoria === 'coding' ? 'Programación competitiva' : 'Tecnología'

    return {
      title: data.titulo || 'Sin título',
      link: loc,
      description: data.descripcion || '',
      pubDate: toRfc822(data.fecha),
      sortDate: data.fecha ? new Date(data.fecha) : new Date(0),
      author: data.nombreAutor || 'Jesús Flórez',
      category: section,
      categoria: data.categoria === 'coding' ? 'coding' : 'tech',
      fecha: data.fecha ? String(data.fecha).slice(0, 10) : '',
      image: absoluteUrl(data.imagenPortada),
      tags: Array.isArray(data.etiquetas) ? data.etiquetas : []
    }
  })
  .sort((a, b) => b.sortDate - a.sortDate)
  .slice(0, 50) // most recent 50 posts

const itemsXml = items
  .map(
    (item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="true">${escapeXml(item.link)}</guid>
      <pubDate>${item.pubDate}</pubDate>
      <description>${escapeXml(item.description)}</description>
      <category>${escapeXml(item.category)}</category>
      <dc:creator>${escapeXml(item.author)}</dc:creator>
    </item>`
  )
  .join('\n')

const lastBuildDate = new Date().toUTCString()

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>${escapeXml(siteName)}</title>
    <link>${siteUrl}/</link>
    <description>${escapeXml(siteDescription)}</description>
    <language>es</language>
    <lastBuildDate>${lastBuildDate}</lastBuildDate>
    <atom:link href="${siteUrl}/feed.xml" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>
`

fs.writeFileSync(outputPath, xml, 'utf8')
console.log(`✅  feed.xml generated — ${items.length} items`)

// ─── JSON Feed 1.1 ────────────────────────────────────────────────────────────
// Lo consume el servicio de newsletter (newsletter/src/feed.js) para armar el
// resumen semanal: trae la portada y el código de categoría que el RSS no tiene.

const jsonFeed = {
  version: 'https://jsonfeed.org/version/1.1',
  title: siteName,
  home_page_url: `${siteUrl}/`,
  feed_url: `${siteUrl}/feed.json`,
  description: siteDescription,
  language: 'es',
  items: items.map((item) => ({
    id: item.link,
    url: item.link,
    title: item.title,
    summary: item.description,
    ...(item.image ? { image: item.image } : {}),
    date_published: item.sortDate.toISOString(),
    authors: [{ name: item.author }],
    tags: item.tags,
    _blog: { categoria: item.categoria, fecha: item.fecha }
  }))
}

fs.writeFileSync(jsonOutputPath, `${JSON.stringify(jsonFeed, null, 2)}\n`, 'utf8')
console.log(`✅  feed.json generated — ${items.length} items`)
