import fs from 'node:fs'
import path from 'node:path'
import { config } from './config.js'
import { emailsSentToday, recordEmailSent } from './db.js'

export class DailyLimitError extends Error {
  constructor() {
    super('Se alcanzó el límite diario de correos')
    this.name = 'DailyLimitError'
  }
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Sin RESEND_API_KEY (desarrollo local) los correos no salen: se guardan
 * como .html en data/outbox/ para revisarlos en el navegador.
 */
function writeToOutbox({ to, subject, html }) {
  const dir = path.join(path.dirname(config.databasePath), 'outbox')
  fs.mkdirSync(dir, { recursive: true })
  const name = `${Date.now()}-${to.replace(/[^a-z0-9]+/gi, '_')}.html`
  fs.writeFileSync(path.join(dir, name), html, 'utf8')
  console.log(`[mailer] (sin API key) "${subject}" → ${to} guardado en outbox/${name}`)
  return { id: `outbox:${name}` }
}

async function postToResend(payload, idempotencyKey) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.resendApiKey}`,
        'Content-Type': 'application/json',
        ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {})
      },
      body: JSON.stringify(payload)
    })

    if (response.ok) return response.json()

    const body = await response.text()

    // 429 = límite de peticiones por segundo; reintentar con espera creciente
    if (response.status === 429 && attempt < 4) {
      const retryAfter = Number(response.headers.get('retry-after')) || attempt
      await sleep(retryAfter * 1000)
      continue
    }

    const error = new Error(`Resend respondió ${response.status}: ${body}`)
    error.status = response.status
    throw error
  }
}

/**
 * Envía un correo respetando el límite diario.
 * `budget` es cuántos correos del día puede usar quien llama (los resúmenes
 * usan menos que el total para dejar espacio a las confirmaciones).
 */
export async function sendEmail(db, { to, subject, html, text, headers, idempotencyKey }, budget = config.dailyEmailLimit) {
  if (emailsSentToday(db) >= budget) throw new DailyLimitError()

  const payload = {
    from: config.mailFrom,
    to: [to],
    subject,
    html,
    text,
    ...(config.mailReplyTo ? { reply_to: config.mailReplyTo } : {}),
    ...(headers ? { headers } : {})
  }

  const result = config.resendApiKey
    ? await postToResend(payload, idempotencyKey)
    : writeToOutbox({ to, subject, html })

  recordEmailSent(db)
  return result
}
