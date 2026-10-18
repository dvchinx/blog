/**
 * Node-side post parsing shared by the Vite plugin (vite.config.js) and the
 * build scripts. Frontmatter is parsed here at build time so the browser
 * bundle never ships gray-matter, js-yaml or a Buffer polyfill.
 */
import fs from 'node:fs'
import path from 'node:path'
import matter from 'gray-matter'

export const POSTS_ROOT = path.join(process.cwd(), 'src', 'posts')

/** /abs/src/posts/2026/01/slug.md → { year, month, slug, path } */
export function routeFromFile(filePath) {
  const [year, month, file] = path.relative(POSTS_ROOT, filePath).split(path.sep)
  const slug = file.replace(/\.md$/i, '')
  return { year, month, slug, path: `/${year}/${month}/${slug}` }
}

export function parsePost(raw, filePath) {
  const { data, content } = matter(raw)
  return {
    metadata: { ...data, ...routeFromFile(filePath) },
    content
  }
}

function collectMarkdownFiles(dirPath, acc = []) {
  for (const entry of fs.readdirSync(dirPath, { withFileTypes: true })) {
    const fullPath = path.join(dirPath, entry.name)
    if (entry.isDirectory()) collectMarkdownFiles(fullPath, acc)
    else if (entry.name.endsWith('.md')) acc.push(fullPath)
  }
  return acc
}

/** Every post, newest first — same order as the client catalog. */
export function loadAllPosts() {
  return collectMarkdownFiles(POSTS_ROOT)
    .map((filePath) => parsePost(fs.readFileSync(filePath, 'utf8'), filePath))
    .sort((a, b) => new Date(b.metadata.fecha) - new Date(a.metadata.fecha))
}
