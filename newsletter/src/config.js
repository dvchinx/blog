function int(name, fallback) {
  const value = Number.parseInt(process.env[name] ?? '', 10)
  return Number.isNaN(value) ? fallback : value
}

const siteUrl = (process.env.SITE_URL || 'https://blog.jesusflorez.cloud').replace(/\/$/, '')

export const config = {
  port: int('PORT', 3002),
  databasePath: process.env.DATABASE_PATH || './data/newsletter.db',

  siteUrl,
  // Público por defecto; en Docker conviene la URL interna (http://blog/feed.json)
  feedUrl: process.env.FEED_URL || `${siteUrl}/feed.json`,
  // Base pública de esta API, usada en la cabecera List-Unsubscribe
  apiUrl: (process.env.API_URL || `${siteUrl}/api/newsletter`).replace(/\/$/, ''),

  resendApiKey: process.env.RESEND_API_KEY || '',
  mailFrom: process.env.MAIL_FROM || 'Blog de Jesús Flórez <newsletter@jesusflorez.cloud>',
  mailReplyTo: process.env.MAIL_REPLY_TO || '',

  timezone: process.env.TZ_DIGEST || 'America/Bogota',
  // Todos los días a las 8:00 se retoma cualquier resumen pendiente;
  // los lunes, además, se arma uno nuevo.
  digestCron: process.env.DIGEST_CRON || '0 8 * * *',
  digestWeekday: int('DIGEST_WEEKDAY', 1), // 0 = domingo, 1 = lunes
  // Un artículo más viejo que esto nunca entra al resumen, aunque no se haya enviado
  digestMaxAgeDays: int('DIGEST_MAX_AGE_DAYS', 14),

  // Plan gratuito de Resend: 100 correos/día. Los resúmenes dejan un margen
  // para que las confirmaciones de suscripción sigan saliendo ese mismo día.
  dailyEmailLimit: int('DAILY_EMAIL_LIMIT', 100),
  confirmationReserve: int('CONFIRMATION_RESERVE', 15),
  sendDelayMs: int('SEND_DELAY_MS', 600),

  policyVersion: '2026-10-05'
}

export const CATEGORIES = {
  tech: { label: 'Tecnología', color: '#4338ca', bg: '#eef2ff' },
  coding: { label: 'Programación Competitiva', color: '#c2410c', bg: '#fff7ed' }
}

export const CATEGORY_CODES = Object.keys(CATEGORIES)
