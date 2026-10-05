import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { config, CATEGORY_CODES } from './config.js'
import { newToken, parseCategories } from './db.js'
import { sendEmail, DailyLimitError } from './mailer.js'
import { confirmationEmail, alreadySubscribedEmail } from './templates.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// No reenviar correos de confirmación al mismo destinatario más seguido que esto
const RESEND_COOLDOWN_MINUTES = 10

const GENERIC_OK = {
  ok: true,
  message: 'Revisa tu bandeja de entrada (y la carpeta de spam) para confirmar tu suscripción.'
}

function normalizeCategories(value) {
  if (!Array.isArray(value)) return []
  return CATEGORY_CODES.filter((code) => value.includes(code))
}

function badRequest(res, message) {
  return res.status(400).json({ ok: false, message })
}

export function createApp(db) {
  const app = express()
  app.disable('x-powered-by')
  // personal-nginx es el único proxy delante del servicio
  app.set('trust proxy', 1)
  app.use(express.json({ limit: '10kb' }))
  // El POST one-click de Gmail/Outlook llega como application/x-www-form-urlencoded
  app.use(express.urlencoded({ extended: false, limit: '10kb' }))

  const router = express.Router()
  // Respuestas personales (preferencias con token): nunca en caché
  router.use((req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })

  const subscribeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { ok: false, message: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.' }
  })

  const tokenLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: { ok: false, message: 'Demasiadas peticiones. Espera unos minutos.' }
  })

  const findByToken = db.prepare('SELECT * FROM subscribers WHERE token = ?')
  const recentlyEmailed = (subscriber) => subscriber.last_email_at &&
    db.prepare(`SELECT ? > datetime('now', ?) AS recent`)
      .get(subscriber.last_email_at, `-${RESEND_COOLDOWN_MINUTES} minutes`).recent === 1

  async function sendTransactional(subscriber, template) {
    const email = template({ token: subscriber.token, categories: parseCategories(subscriber.categories) })
    await sendEmail(db, { to: subscriber.email, ...email })
    db.prepare("UPDATE subscribers SET last_email_at = datetime('now') WHERE id = ?").run(subscriber.id)
  }

  // ─── POST /subscribe ──────────────────────────────────────────────────────

  router.post('/subscribe', subscribeLimiter, async (req, res) => {
    const { email, categories, consent, website } = req.body || {}

    // Campo trampa: invisible para personas, los bots lo llenan
    if (website) return res.json(GENERIC_OK)

    const address = String(email || '').trim().toLowerCase()
    if (!EMAIL_RE.test(address) || address.length > 254) {
      return badRequest(res, 'Escribe un correo electrónico válido.')
    }

    const selected = normalizeCategories(categories)
    if (selected.length === 0) return badRequest(res, 'Elige al menos una categoría.')
    if (consent !== true) return badRequest(res, 'Debes aceptar la política de tratamiento de datos.')

    const existing = db.prepare('SELECT * FROM subscribers WHERE email = ?').get(address)

    try {
      if (!existing) {
        const { lastInsertRowid } = db.prepare(`
          INSERT INTO subscribers (email, categories, status, token, consent_at, policy_version)
          VALUES (?, ?, 'pending', ?, datetime('now'), ?)
        `).run(address, selected.join(','), newToken(), config.policyVersion)
        await sendTransactional(db.prepare('SELECT * FROM subscribers WHERE id = ?').get(lastInsertRowid), confirmationEmail)
      } else if (existing.status === 'pending') {
        db.prepare(`
          UPDATE subscribers SET categories = ?, consent_at = datetime('now'), policy_version = ? WHERE id = ?
        `).run(selected.join(','), config.policyVersion, existing.id)
        if (!recentlyEmailed(existing)) {
          await sendTransactional({ ...existing, categories: selected.join(',') }, confirmationEmail)
        }
      } else if (!recentlyEmailed(existing)) {
        // Ya activo: no cambiamos nada sin que el dueño del correo lo confirme;
        // le mandamos su enlace de preferencias.
        await sendTransactional(existing, alreadySubscribedEmail)
      }
    } catch (error) {
      console.error('[subscribe]', error.message)
      const message = error instanceof DailyLimitError
        ? 'Hoy ya no podemos enviar más correos. Inténtalo de nuevo mañana.'
        : 'No pudimos enviarte el correo de confirmación. Inténtalo de nuevo en unos minutos.'
      return res.status(503).json({ ok: false, message })
    }

    // Misma respuesta en todos los casos: no revela si el correo ya estaba registrado
    res.json(GENERIC_OK)
  })

  // ─── POST /confirm ────────────────────────────────────────────────────────

  router.post('/confirm', tokenLimiter, (req, res) => {
    const subscriber = findByToken.get(String(req.body?.token || ''))
    if (!subscriber) {
      return res.status(404).json({ ok: false, message: 'El enlace no es válido o la suscripción expiró.' })
    }

    if (subscriber.status === 'pending') {
      db.prepare("UPDATE subscribers SET status = 'active', confirmed_at = datetime('now') WHERE id = ?").run(subscriber.id)
    }

    res.json({ ok: true, categories: parseCategories(subscriber.categories) })
  })

  // ─── GET / POST /preferences ──────────────────────────────────────────────

  router.get('/preferences', tokenLimiter, (req, res) => {
    const subscriber = findByToken.get(String(req.query.token || ''))
    if (!subscriber || subscriber.status !== 'active') {
      return res.status(404).json({ ok: false, message: 'No encontramos una suscripción activa para este enlace.' })
    }

    res.json({ ok: true, email: subscriber.email, categories: parseCategories(subscriber.categories) })
  })

  router.post('/preferences', tokenLimiter, (req, res) => {
    const subscriber = findByToken.get(String(req.body?.token || ''))
    if (!subscriber || subscriber.status !== 'active') {
      return res.status(404).json({ ok: false, message: 'No encontramos una suscripción activa para este enlace.' })
    }

    const selected = normalizeCategories(req.body.categories)
    if (selected.length === 0) {
      return badRequest(res, 'Elige al menos una categoría, o date de baja si ya no quieres recibir correos.')
    }

    db.prepare('UPDATE subscribers SET categories = ? WHERE id = ?').run(selected.join(','), subscriber.id)
    res.json({ ok: true, categories: selected })
  })

  // ─── POST /unsubscribe ────────────────────────────────────────────────────
  // Lo usan la página de preferencias (token en el body, JSON) y el botón
  // nativo de Gmail/Outlook (token en la URL, RFC 8058). Solo POST: los
  // escáneres de enlaces de los correos hacen GET y no deben dar de baja a nadie.

  router.post('/unsubscribe', tokenLimiter, (req, res) => {
    const token = String(req.body?.token || req.query.token || '')
    // Ley 1581: al darse de baja se borran los datos, no solo se desactivan
    const { changes } = db.prepare('DELETE FROM subscribers WHERE token = ?').run(token)
    res.json({ ok: true, removed: changes > 0 })
  })

  router.get('/health', (req, res) => res.json({ status: 'ok' }))

  app.use('/api/newsletter', router)
  app.get('/health', (req, res) => res.json({ status: 'ok' }))

  app.use((req, res) => res.status(404).json({ ok: false, message: 'No encontrado' }))

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, next) => {
    if (error.type === 'entity.parse.failed') return badRequest(res, 'Petición inválida.')
    console.error('[error]', error)
    res.status(500).json({ ok: false, message: 'Error interno.' })
  })

  return app
}
