import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

const siteUrl = 'https://blog.jesusflorez.cloud'
const repoRoot = process.cwd()
const postsRoot = path.join(repoRoot, 'src', 'posts')
const outputPath = path.join(repoRoot, 'public', 'llms.txt')

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

// ─── Build entries ────────────────────────────────────────────────────────────

const markdownFiles = collectMarkdownFiles(postsRoot)

const entries = markdownFiles.map((filePath) => {
  const content = fs.readFileSync(filePath, 'utf8')
  const { data } = matter(content)

  return {
    titulo: data.titulo || 'Sin título',
    descripcion: data.descripcion || '',
    categoria: data.categoria === 'coding' ? 'Programación competitiva' : 'Tecnología',
    fecha: data.fecha ? new Date(data.fecha) : new Date(0),
    url: `${siteUrl}${toSitePath(filePath)}`
  }
})

entries.sort((a, b) => b.fecha - a.fecha)

const tech = entries.filter((e) => e.categoria === 'Tecnología')
const coding = entries.filter((e) => e.categoria === 'Programación competitiva')

function formatSection(title, list) {
  if (list.length === 0) return ''
  const lines = list.map((e) => {
    const desc = e.descripcion ? `: ${e.descripcion}` : ''
    return `- [${e.titulo}](${e.url})${desc}`
  })
  return `## ${title}\n\n${lines.join('\n')}\n`
}

const content = `# Blog de Jesús Flórez

> Blog técnico sobre programación competitiva (ICPC, CCPL, Codeforces) y tecnología (Java, Python, Spring Boot, React, arquitectura de software) orientado a la comunidad LATAM.

Autor: Jesús Flórez (${siteUrl.replace('blog.', '')})
Sitio: ${siteUrl}
Idioma: Español

${formatSection('Tecnología', tech)}
${formatSection('Programación competitiva', coding)}
`

fs.writeFileSync(outputPath, content, 'utf8')
console.log(`✅  llms.txt generated — ${entries.length} entries`)
