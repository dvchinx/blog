import { config } from './config.js'
import { parseCategories } from './db.js'
import { fetchPosts, localDay, daysAgo } from './feed.js'
import { sendEmail, DailyLimitError } from './mailer.js'
import { digestEmail, listUnsubscribeHeaders } from './templates.js'

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function localWeekday(date) {
  const name = new Intl.DateTimeFormat('en-US', { timeZone: config.timezone, weekday: 'short' }).format(date)
  return WEEKDAYS.indexOf(name)
}

/** Artículos publicados que todavía no salieron en ningún resumen. */
export async function pendingPosts(db, now = new Date()) {
  const posts = await fetchPosts()
  const sent = new Set(db.prepare('SELECT url FROM sent_posts').pluck().all())
  const today = localDay(now)
  const oldest = daysAgo(config.digestMaxAgeDays, now)

  return posts
    .filter((post) => post.fecha <= today && post.fecha >= oldest && !sent.has(post.url))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))
}

export function postsForSubscriber(posts, categories) {
  return posts.filter((post) => categories.includes(post.categoria))
}

async function createIssue(db, now) {
  const posts = await pendingPosts(db, now)
  if (posts.length === 0) return null

  const insert = db.transaction(() => {
    const { lastInsertRowid } = db.prepare('INSERT INTO issues (posts) VALUES (?)').run(JSON.stringify(posts))
    const markSent = db.prepare('INSERT INTO sent_posts (url, issue_id) VALUES (?, ?)')
    for (const post of posts) markSent.run(post.url, lastInsertRowid)
    return db.prepare('SELECT * FROM issues WHERE id = ?').get(lastInsertRowid)
  })

  return insert()
}

async function sendIssue(db, issue) {
  const posts = JSON.parse(issue.posts)
  const summary = { issueId: issue.id, posts: posts.length, sent: 0, skipped: 0, failed: 0 }

  // Solo quienes confirmaron antes de armar el resumen: así un envío que se
  // retoma al día siguiente no mezcla suscriptores nuevos a mitad de camino.
  const recipients = db.prepare(`
    SELECT s.* FROM subscribers s
    WHERE s.status = 'active'
      AND s.confirmed_at <= ?
      AND NOT EXISTS (SELECT 1 FROM deliveries d WHERE d.issue_id = ? AND d.subscriber_id = s.id)
    ORDER BY s.id
  `).all(issue.created_at, issue.id)

  const record = db.prepare('INSERT INTO deliveries (issue_id, subscriber_id, status, resend_id) VALUES (?, ?, ?, ?)')
  const budget = config.dailyEmailLimit - config.confirmationReserve
  let paused = false

  for (const subscriber of recipients) {
    const categories = parseCategories(subscriber.categories)
    const ownPosts = postsForSubscriber(posts, categories)

    if (ownPosts.length === 0) {
      record.run(issue.id, subscriber.id, 'skipped', null)
      summary.skipped++
      continue
    }

    const email = digestEmail({ token: subscriber.token, categories, posts: ownPosts })

    try {
      const result = await sendEmail(db, {
        to: subscriber.email,
        ...email,
        headers: listUnsubscribeHeaders(subscriber.token),
        idempotencyKey: `digest-${issue.id}-${subscriber.id}`
      }, budget)
      record.run(issue.id, subscriber.id, 'sent', result.id)
      summary.sent++
    } catch (error) {
      if (error instanceof DailyLimitError) {
        paused = true
        break
      }
      // 4xx de Resend (dirección inválida, rebotada…): reintentar no sirve.
      // Cualquier otro error (red, 5xx) corta la corrida y se retoma mañana.
      if (error.status >= 400 && error.status < 500) {
        console.error(`[digest] ${subscriber.email}: ${error.message}`)
        record.run(issue.id, subscriber.id, 'failed', null)
        summary.failed++
        continue
      }
      console.error(`[digest] envío interrumpido: ${error.message}`)
      paused = true
      break
    }

    await sleep(config.sendDelayMs)
  }

  if (!paused) {
    db.prepare("UPDATE issues SET completed_at = datetime('now') WHERE id = ?").run(issue.id)
  }

  summary.status = paused ? 'paused' : 'completed'
  return summary
}

/**
 * Lo llama el cron todos los días. Retoma un resumen a medias si lo hay;
 * si no, y es el día del resumen (o `force`), arma uno nuevo con los
 * artículos que aún no se han enviado.
 */
export async function processDigests(db, { now = new Date(), force = false } = {}) {
  let issue = db.prepare('SELECT * FROM issues WHERE completed_at IS NULL ORDER BY id LIMIT 1').get()

  if (!issue) {
    if (!force && localWeekday(now) !== config.digestWeekday) return { status: 'not-digest-day' }
    issue = await createIssue(db, now)
    if (!issue) return { status: 'no-new-posts' }
  }

  return sendIssue(db, issue)
}
