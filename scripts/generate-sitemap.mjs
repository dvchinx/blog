import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const siteUrl = 'https://blog.jesusflorez.cloud'
const repoRoot = process.cwd()
const postsRoot = path.join(repoRoot, 'src', 'posts')
const outputPath = path.join(repoRoot, 'public', 'sitemap.xml')

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

function resolveLastMod(frontmatterDate, fallbackMtime) {
  if (frontmatterDate) {
    const parsed = new Date(frontmatterDate)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0]
    }
  }

  return fallbackMtime.toISOString().split('T')[0]
}

function isAbsoluteUrl(src) {
  return typeof src === 'string' && (src.startsWith('http://') || src.startsWith('https://'))
}

function absoluteImage(src) {
  if (!src) return null
  if (isAbsoluteUrl(src)) return src
  return `${siteUrl}${src.startsWith('/') ? '' : '/'}${src}`
}

// ─── Build URL list ───────────────────────────────────────────────────────────

const markdownFiles = collectMarkdownFiles(postsRoot)

// Parse all posts to determine the most recent publication date for the home page
const postEntries = markdownFiles.map((filePath) => {
  const content = fs.readFileSync(filePath, 'utf8')
  const stat = fs.statSync(filePath)
  const { data } = matter(content)

  return {
    filePath,
    stat,
    data,
    loc: `${siteUrl}${toSitePath(filePath)}`,
    lastmod: resolveLastMod(data.fecha, stat.mtime),
    priority: data.categoria === 'tech' ? '0.9' : '0.8'
  }
})

// Sort entries by date desc to find the most recent for the home lastmod
const sortedByDate = [...postEntries].sort((a, b) => {
  return new Date(b.lastmod) - new Date(a.lastmod)
})

const homeLastMod = sortedByDate.length > 0 ? sortedByDate[0].lastmod : new Date().toISOString().split('T')[0]

// ─── Build XML ────────────────────────────────────────────────────────────────

const homeEntry = `  <url>
    <loc>${escapeXml(`${siteUrl}/`)}</loc>
    <lastmod>${homeLastMod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>`

const postXmlEntries = postEntries.map(({ data, loc, lastmod, priority }) => {
  const image = absoluteImage(data.imagenPortada)
  const title = data.titulo ? escapeXml(data.titulo) : null
  const description = data.descripcion ? escapeXml(data.descripcion) : null

  const imageBlock = image
    ? `\n    <image:image>\n      <image:loc>${escapeXml(image)}</image:loc>${title ? `\n      <image:title>${title}</image:title>` : ''}${description ? `\n      <image:caption>${description}</image:caption>` : ''}\n    </image:image>`
    : ''

  return `  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${priority}</priority>${imageBlock}
  </url>`
})

const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset\n` +
  `  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
  `  xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
  [homeEntry, ...postXmlEntries].join('\n') +
  `\n</urlset>\n`

fs.writeFileSync(outputPath, xml, 'utf8')
console.log(`✅  sitemap.xml generated — ${1 + postEntries.length} URLs (${postEntries.length} posts)`)
