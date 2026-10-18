import { defineConfig, normalizePath } from 'vite'
import react from '@vitejs/plugin-react'
import { POSTS_ROOT, parsePost } from './scripts/lib/posts.mjs'

const postsRoot = normalizePath(POSTS_ROOT)

/**
 * Turns each post into JS at build time:
 *   slug.md?meta → `export const metadata` (eager catalog: home, related posts)
 *   slug.md      → `export const content`  (lazy chunk, loaded only by PostView)
 * Two module ids for the same file keep the article bodies out of the main bundle.
 */
function blogPosts() {
  return {
    name: 'blog-posts',
    enforce: 'pre',
    transform(code, id) {
      const [file, query] = id.split('?')
      if (!file.startsWith(`${postsRoot}/`) || !file.endsWith('.md')) return null
      if (query && query !== 'meta') return null

      const { metadata, content } = parsePost(code, file)
      const js = query === 'meta'
        ? `export const metadata = ${JSON.stringify(metadata)}`
        : `export const content = ${JSON.stringify(content)}`
      return { code: js, map: null }
    }
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [blogPosts(), react()],
  server: {
    port: 5173,
    host: true,
    proxy: {
      // Servicio newsletter/ corriendo en local (cd newsletter && npm run dev)
      '/api/newsletter': 'http://localhost:3002'
    }
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Read by scripts/prerender.mjs to preload each article's chunks; deleted afterwards
    manifest: true,
    rollupOptions: {
      output: {
        // React rarely changes; a separate chunk stays cached across the
        // deploys that only add posts (which change the main chunk).
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) {
            return 'vendor'
          }
        }
      }
    }
  }
})
