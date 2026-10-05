import { test, before, after, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

// Config se lee al importar: definir el entorno antes de cargar los módulos
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'newsletter-test-'))
process.env.DATABASE_PATH = path.join(tmp, 'test.db')
process.env.RESEND_API_KEY = ''
process.env.SEND_DELAY_MS = '0'
process.env.DAILY_EMAIL_LIMIT = '100'
process.env.CONFIRMATION_RESERVE = '15'

const { openDatabase } = await import('../src/db.js')
const { createApp } = await import('../src/app.js')
const { processDigests } = await import('../src/digest.js')
const { localDay, daysAgo } = await import('../src/feed.js')

const db = openDatabase()
const app = createApp(db)
let server
let base

const realFetch = globalThis.fetch
let feedItems = []

before(async () => {
  server = app.listen(0)
  await new Promise((resolve) => server.once('listening', resolve))
  base = `http://127.0.0.1:${server.address().port}/api/newsletter`

  // Solo se intercepta la lectura del feed; las peticiones a la API van al servidor real
  globalThis.fetch = (url, options) => {
    if (String(url).endsWith('/feed.json')) {
      return Promise.resolve(new Response(JSON.stringify({ items: feedItems })))
    }
    return realFetch(url, options)
  }
})

after(() => {
  globalThis.fetch = realFetch
  server.close()
  db.close()
  fs.rmSync(tmp, { recursive: true, force: true })
})

beforeEach(() => {
  db.exec('DELETE FROM deliveries; DELETE FROM sent_posts; DELETE FROM issues; DELETE FROM subscribers; DELETE FROM daily_usage;')
})

let ip = 0
function post(pathname, body) {
  ip++
  return realFetch(`${base}${pathname}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `10.0.${Math.floor(ip / 250)}.${ip % 250}` },
    body: JSON.stringify(body)
  })
}

function feedItem(slug, categoria, fecha) {
  return {
    url: `https://blog.jesusflorez.cloud/${slug}`,
    title: `Post ${slug}`,
    summary: `Descripción ${slug}`,
    _blog: { categoria, fecha }
  }
}

async function subscribeAndConfirm(email, categories) {
  const res = await post('/subscribe', { email, categories, consent: true })
  assert.equal(res.status, 200)
  const { token } = db.prepare('SELECT token FROM subscribers WHERE email = ?').get(email)
  assert.equal((await post('/confirm', { token })).status, 200)
  // Confirmado "en el pasado" para que entre en un resumen creado ahora
  db.prepare("UPDATE subscribers SET confirmed_at = datetime('now', '-1 hour') WHERE token = ?").run(token)
  return token
}

test('suscripción: valida los datos', async () => {
  assert.equal((await post('/subscribe', { email: 'no-es-correo', categories: ['tech'], consent: true })).status, 400)
  assert.equal((await post('/subscribe', { email: 'a@b.co', categories: [], consent: true })).status, 400)
  assert.equal((await post('/subscribe', { email: 'a@b.co', categories: ['otra'], consent: true })).status, 400)
  assert.equal((await post('/subscribe', { email: 'a@b.co', categories: ['tech'] })).status, 400)
})

test('suscripción: el campo trampa responde ok sin guardar nada', async () => {
  const res = await post('/subscribe', { email: 'bot@spam.co', categories: ['tech'], consent: true, website: 'x' })
  assert.equal(res.status, 200)
  assert.equal(db.prepare('SELECT COUNT(*) FROM subscribers').pluck().get(), 0)
})

test('flujo completo: suscribir, confirmar, cambiar categorías, darse de baja', async () => {
  const res = await post('/subscribe', { email: 'Lector@Ejemplo.com ', categories: ['tech'], consent: true })
  assert.equal(res.status, 200)

  const row = db.prepare('SELECT * FROM subscribers').get()
  assert.equal(row.email, 'lector@ejemplo.com')
  assert.equal(row.status, 'pending')
  assert.equal(db.prepare('SELECT count FROM daily_usage').pluck().get(), 1)

  // Sin confirmar no hay preferencias
  assert.equal((await realFetch(`${base}/preferences?token=${row.token}`)).status, 404)

  assert.equal((await post('/confirm', { token: row.token })).status, 200)
  assert.equal(db.prepare('SELECT status FROM subscribers').pluck().get(), 'active')

  const prefs = await (await realFetch(`${base}/preferences?token=${row.token}`)).json()
  assert.deepEqual(prefs.categories, ['tech'])

  const updated = await post('/preferences', { token: row.token, categories: ['coding', 'tech'] })
  assert.deepEqual((await updated.json()).categories, ['tech', 'coding'])

  const removed = await (await post('/unsubscribe', { token: row.token })).json()
  assert.equal(removed.removed, true)
  assert.equal(db.prepare('SELECT COUNT(*) FROM subscribers').pluck().get(), 0)
})

test('suscribirse de nuevo estando activo no cambia las categorías', async () => {
  const token = await subscribeAndConfirm('activo@ejemplo.com', ['tech'])
  db.prepare("UPDATE subscribers SET last_email_at = datetime('now', '-1 day')").run()

  const res = await post('/subscribe', { email: 'activo@ejemplo.com', categories: ['coding'], consent: true })
  assert.equal(res.status, 200)

  const row = db.prepare('SELECT * FROM subscribers WHERE token = ?').get(token)
  assert.equal(row.categories, 'tech')
  assert.equal(row.status, 'active')
})

test('baja one-click (RFC 8058) con el token en la URL', async () => {
  const token = await subscribeAndConfirm('oneclick@ejemplo.com', ['tech'])
  const res = await realFetch(`${base}/unsubscribe?token=${token}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'List-Unsubscribe=One-Click'
  })
  assert.equal(res.status, 200)
  assert.equal(db.prepare('SELECT COUNT(*) FROM subscribers').pluck().get(), 0)
})

test('resumen: cada suscriptor recibe solo sus categorías y nada se repite', async () => {
  const today = localDay()
  feedItems = [
    feedItem('tech-1', 'tech', today),
    feedItem('coding-1', 'coding', daysAgo(3)),
    feedItem('viejo', 'tech', daysAgo(30)),
    feedItem('futuro', 'tech', daysAgo(-2))
  ]

  await subscribeAndConfirm('tech@ejemplo.com', ['tech'])
  await subscribeAndConfirm('ambos@ejemplo.com', ['tech', 'coding'])
  await subscribeAndConfirm('coding@ejemplo.com', ['coding'])

  const first = await processDigests(db, { force: true })
  assert.equal(first.status, 'completed')
  assert.equal(first.posts, 2) // ni el viejo ni el futuro
  assert.equal(first.sent, 3)

  const sentPosts = db.prepare('SELECT url FROM sent_posts ORDER BY url').pluck().all()
  assert.deepEqual(sentPosts.map((url) => url.split('/').pop()), ['coding-1', 'tech-1'])

  // Otra corrida sin artículos nuevos no envía nada
  const second = await processDigests(db, { force: true })
  assert.equal(second.status, 'no-new-posts')
})

test('resumen: quien no tiene artículos de sus categorías no recibe correo', async () => {
  feedItems = [feedItem('solo-tech', 'tech', localDay())]
  await subscribeAndConfirm('coding@ejemplo.com', ['coding'])

  const result = await processDigests(db, { force: true })
  assert.equal(result.sent, 0)
  assert.equal(result.skipped, 1)
})

test('resumen: se pausa en el límite diario y se retoma sin repetir', async () => {
  feedItems = [feedItem('limite', 'tech', localDay())]
  for (let i = 0; i < 4; i++) await subscribeAndConfirm(`s${i}@ejemplo.com`, ['tech'])

  // 4 confirmaciones ya usadas; dejar cupo para solo 2 resúmenes (límite 100 − reserva 15 = 85)
  db.prepare('UPDATE daily_usage SET count = 83').run()

  const first = await processDigests(db, { force: true })
  assert.equal(first.status, 'paused')
  assert.equal(first.sent, 2)

  // "Al día siguiente"
  db.prepare('DELETE FROM daily_usage').run()
  const second = await processDigests(db)
  assert.equal(second.status, 'completed')
  assert.equal(second.issueId, first.issueId)
  assert.equal(second.sent, 2)
  assert.equal(db.prepare("SELECT COUNT(*) FROM deliveries WHERE status = 'sent'").pluck().get(), 4)
})
