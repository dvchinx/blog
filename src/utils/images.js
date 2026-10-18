// Pide a Unsplash el formato más ligero que acepte el navegador (WebP/AVIF)
// en lugar del JPEG original. Solo para mostrar: og:image y el sitemap usan
// la URL original, que todas las redes sociales entienden.
export function optimizeImage(src) {
  if (typeof src !== 'string' || !src.startsWith('https://images.unsplash.com/')) return src

  try {
    const url = new URL(src)
    if (!url.searchParams.has('auto')) url.searchParams.set('auto', 'format')
    if (!url.searchParams.has('q')) url.searchParams.set('q', '75')
    return url.toString()
  } catch {
    return src
  }
}
