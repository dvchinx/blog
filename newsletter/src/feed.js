import { config, CATEGORY_CODES } from './config.js'

/** Fecha 'YYYY-MM-DD' de `date` en la zona horaria del blog. */
export function localDay(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: config.timezone }).format(date)
}

export function daysAgo(days, from = new Date()) {
  return localDay(new Date(from.getTime() - days * 24 * 60 * 60 * 1000))
}

/**
 * Lee el feed.json que genera el build del blog (scripts/generate-feed.mjs)
 * y lo normaliza a { url, title, description, image, categoria, fecha }.
 */
export async function fetchPosts(feedUrl = config.feedUrl) {
  const response = await fetch(feedUrl, { signal: AbortSignal.timeout(15000) })
  if (!response.ok) throw new Error(`No se pudo leer el feed (${response.status}) en ${feedUrl}`)

  const feed = await response.json()

  return (feed.items || [])
    .map((item) => ({
      url: item.url,
      title: item.title,
      description: item.summary || '',
      image: item.image || '',
      categoria: item._blog?.categoria,
      fecha: item._blog?.fecha
    }))
    .filter((post) => post.url && post.title && post.fecha && CATEGORY_CODES.includes(post.categoria))
}
