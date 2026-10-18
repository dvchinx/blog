# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A static blog platform built with React + Vite that serves Markdown-based posts with dynamic routing, search, filtering, and SEO optimization. Posts are stored as Markdown files with YAML frontmatter in a date-based directory structure and rendered with syntax highlighting, code language detection, and related post recommendations.

## Tech Stack

- **Frontend**: React 19, Vite 7.2, React Router 7.12
- **Content Processing**: gray-matter (frontmatter parsing, build time only), react-markdown, remark-gfm, rehype-raw
- **Code Highlighting**: react-syntax-highlighter PrismLight with only the languages posts use (`src/utils/codeHighlighter.js`)
- **Deployment**: Docker multistage build (Node 20 → Nginx Alpine), containerized with gzip compression and security headers
- **Linting**: ESLint 9.39 with React hooks and refresh rules

## Key Commands

```bash
npm run dev          # Start dev server on http://localhost:5173
npm run build        # Build for production (runs prebuild automatically to generate sitemap)
npm run preview      # Preview production build locally
npm run lint         # Run ESLint on all .js/.jsx files
```

The **prebuild** script (triggered before `npm run build`) generates `public/sitemap.xml` from post metadata via `scripts/generate-sitemap.mjs`.

## Architecture & Data Flow

### Post Storage & Loading

Posts live in `/src/posts/YYYY/MM/slug.md` with required frontmatter:

```yaml
---
titulo: "Title"
seoTitulo: "SEO title"
fecha: "2026-02-20"
nombreAutor: "Author Name"
categoria: "tech"  # or "coding"
fotoAutor: "/authors/photo.jpeg"  # optional
descripcion: "Brief description"  # optional
imagenPortada: "https://..."  # optional
etiquetas: ["tag1", "tag2"]  # optional
keywords: "..."  # optional (used in metadata, not displayed)
---
```

**Build-time parsing**: the `blog-posts` plugin in `vite.config.js` turns each `.md` into JS using `scripts/lib/posts.mjs` (also used by the prerender). `slug.md?meta` exports only the frontmatter (+ year/month/slug/path); plain `slug.md` exports only the markdown body as its own lazy chunk. The browser never ships gray-matter or a Buffer polyfill.

**Load mechanism** (`src/utils/postsLoader.js`):
- `getAllPosts()` – synchronous metadata catalog (eager `?meta` glob), newest first; listing pages download no article bodies
- `findPost(year, month, slug)` / `getLoadedPost(path)` – sync lookups (catalog / already-loaded post)
- `loadPost(year, month, slug)` – loads one article's markdown chunk (cached); resolves `null` for unknown posts
- `loadSearchContents()` – downloads every body for full-text search, only when there is a `?q=`

Pure helpers in `src/utils/postQueries.js` (importable from Node): `searchPosts(posts, term, contents?)` and `getRelatedPosts(posts, currentPost, limit)` – ranks by category match (+3), shared tags (+2), author match (+1), then by date.

### Route Structure

- `/` → PostList component (displays all posts with pagination, search, category filter)
- `/:year/:month/:slug` → PostView component (single post with related posts)

Posts render via React Router params; routes are generated from the file system, not hardcoded.

### Rendering Pipeline

**PostView.jsx** (lazy route chunk, see `src/routes.js`; `main.jsx` preloads it and the article's markdown before the first render so React replaces the prerendered HTML with identical content — no loading flash, no layout shift):
- Loads post markdown + all posts for related posts
- Passes markdown to `<ReactMarkdown>` with:
  - `remarkGfm` (tables, strikethrough, tasklists)
  - `rehypeRaw` (allows raw HTML in markdown)
  - Custom code block renderer that:
    - Uses the ```lang hint, else regex heuristics in `detectCodeLanguage()` (`resolveCodeLanguage()` in `codeHighlighter.js`)
    - Falls back to 'text' if unrecognized
    - Uses `react-syntax-highlighter` (vscDarkPlus theme)
- Generates dynamic SEO meta tags via `setPostSeo()` before rendering

**PostList.jsx**:
- Loads all posts, applies search + category filters
- Renders paginated grid (9 posts per page)
- Updates URL params (`?q=`, `?categoria=`) without full page reload
- Category slug mapping: `tecnologia` ↔ `tech`, `programacion-competitiva` ↔ `coding`

### SEO & Meta Tags

`src/utils/seo.js` dynamically injects/updates Open Graph, Twitter Card, and JSON-LD structured data:
- `setHomeSeo()` – homepage defaults
- `setPostSeo(post)` – per-post metadata using title, description, date, author, image
- Helper functions: `upsertMeta()`, `removeMeta()`, `setCanonical()`, `setJsonLd()`

Posts without `imagenPortada` default to `/og-default.png`. Canonical URLs follow the pattern `https://blog.jesusflorez.cloud/{year}/{month}/{slug}`.

## Newsletter

`newsletter/` is a separate Node/Express service (own Dockerfile, SQLite, Resend) deployed as the `newsletter` container from Personal-Suite's `deploy/docker-compose.yml`; nginx routes `blog.jesusflorez.cloud/api/newsletter/` to it. It sends a weekly digest built from `public/feed.json` (JSON Feed generated by `scripts/generate-feed.mjs`, with cover image and `_blog.categoria`). Frontend pieces: `NewsletterForm` (end of each post and on PostList), `/newsletter/confirmar`, `/newsletter/preferencias` (noindex) and `/privacidad`, all prerendered so nginx serves them with 200. Privacy text lives in `src/utils/privacyPolicy.js`; bump `policyVersion` in `newsletter/src/config.js` when it changes. See `newsletter/README.md`.

## File Organization

```
src/
├── components/
│   ├── Header.jsx        (search bar, nav to author suite)
│   ├── Footer.jsx        (copyright, social links)
│   ├── PostList.jsx      (paginated grid, search, category filter)
│   └── PostView.jsx      (single post, markdown rendering, related posts)
├── posts/                (content directory - YYYY/MM/slug.md structure)
├── utils/
│   ├── postsLoader.js    (metadata catalog + lazy article bodies)
│   ├── postQueries.js    (search, related posts — pure)
│   ├── codeHighlighter.js (PrismLight + registered languages, shared with prerender)
│   └── seo.js            (dynamic meta tag management)
├── styles/               (per-component CSS: App.css, Header.css, PostList.css, PostView.css, Footer.css, index.css)
├── App.jsx              (Routes wrapper)
├── routes.js            (lazy PostView with preload)
└── main.jsx             (entry point - preloads the article route, then renders BrowserRouter)

public/
├── authors/             (author photos)
└── sitemap.xml          (auto-generated by prebuild script)

scripts/
└── generate-sitemap.mjs (reads posts, generates XML with lastmod from fecha)

Dockerfile              (multistage: Node 20 build → Nginx Alpine)
nginx.conf              (prerendered routes, real 404s, 301s for renamed posts/legacy URLs, caching, security headers)
```

## Development Patterns

**Frontmatter Parsing**: `gray-matter` parses YAML frontmatter at build time and the result is serialized to JSON, so quote dates (`fecha: "2026-02-20"`) to keep them as strings.

**Dynamic Imports**: Posts are loaded at runtime via Vite's `import.meta.glob()` with `query: '?raw'` to import raw markdown files. This enables dynamic post addition without rebuild (though sidebar caches on first visit).

**Code Language Detection**: a ```lang hint wins; otherwise `detectCodeLanguage()` guesses from regex heuristics. A language not registered in `codeHighlighter.js` renders as plain text.

**Routing**: React Router handles client-side navigation. Every route is prerendered to a flat `<ruta>.html`; nginx serves it with `try_files $uri $uri.html =404`, so unknown URLs get a real 404 (never a soft 404). **Renaming or moving a post** breaks its indexed URL: add the old → new path to the `$renamed_post` map in `nginx.conf`.

**Image Handling**: Frontmatter `imagenPortada` expects full URLs (e.g., Unsplash links). Author photos are stored in `public/authors/` with path like `/authors/jesus-florez.jpeg`. The favicon is `public/favicon.png` (stable URL; nginx also answers `/favicon.ico` with it). Unsplash covers are requested with `auto=format` via `optimizeImage()` (`src/utils/images.js`).

**Caching & Performance**:
- Static assets (.js, .css, etc.) cached for 1 year (Nginx: `Cache-Control: public, immutable`)
- index.html never cached (forces fresh fetch)
- Gzip enabled for all text-like content types

## Adding a New Post

1. Create file: `src/posts/2026/MM/post-slug.md`
2. Add required frontmatter (titulo, fecha, nombreAutor, categoria)
3. Write markdown content below frontmatter
4. No build needed—post auto-discovers on next dev reload via `import.meta.glob()`

Categories must be `"tech"` or `"coding"` (these map to UI labels "Tecnología" and "Programación Competitiva"). Dates in frontmatter and directory structure can differ but should align for consistency.

## Deployment

Docker image builds via multistage:
1. **Builder**: Node 20 Alpine, installs deps, runs `npm run build` (which triggers `npm run prebuild`)
2. **Production**: Nginx Alpine, copies dist/ and nginx.conf, exposes port 80

```bash
docker build -t dvchinx/blog .
docker run -d -p 8080:80 dvchinx/blog
```

The build process automatically generates `public/sitemap.xml` before creating the production bundle.

## Common Modifications

**Update SEO defaults**: Edit site URL and defaults in `src/utils/seo.js` (SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE).

**Adjust post pagination**: Change `POSTS_PER_PAGE` constant in `src/components/PostList.jsx`.

**Add syntax highlighting language**: Import and register it in `src/utils/codeHighlighter.js` (plus an alias if the ``` name differs); optionally add a heuristic to `src/utils/detectCodeLanguage.js`.

**Modify category labels**: Update mapping in `src/components/PostList.jsx` `mapSlugToCode()` function and corresponding UI labels.

**Change styling**: Edit CSS files in `src/styles/` (each component has its own CSS file).
EOF
