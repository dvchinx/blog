import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const siteUrl = 'https://blog.jesusflorez.cloud'
const repoRoot = process.cwd()
const postsRoot = path.join(repoRoot, 'src', 'posts')
const outputPath = path.join(repoRoot, 'public', 'sitemap.xml')

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

const markdownFiles = collectMarkdownFiles(postsRoot)

const urls = [
  {
    loc: `${siteUrl}/`,
    changefreq: 'daily',
    priority: '1.0',
    lastmod: new Date().toISOString().split('T')[0]
  }
]

for (const filePath of markdownFiles) {
  const content = fs.readFileSync(filePath, 'utf8')
  const stat = fs.statSync(filePath)
  const { data } = matter(content)

  urls.push({
    loc: `${siteUrl}${toSitePath(filePath)}`,
    changefreq: 'weekly',
    priority: '0.8',
    lastmod: resolveLastMod(data.fecha, stat.mtime)
  })
}

const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls
    .map((url) => {
      return [
        '  <url>',
        `    <loc>${escapeXml(url.loc)}</loc>`,
        `    <lastmod>${url.lastmod}</lastmod>`,
        `    <changefreq>${url.changefreq}</changefreq>`,
        `    <priority>${url.priority}</priority>`,
        '  </url>'
      ].join('\n')
    })
    .join('\n') +
  `\n</urlset>\n`

fs.writeFileSync(outputPath, xml, 'utf8')
console.log(`sitemap.xml generated with ${urls.length} URLs.`)
