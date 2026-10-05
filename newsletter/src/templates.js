import { config, CATEGORIES, CATEGORY_CODES } from './config.js'

const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif"

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function confirmUrl(token) {
  return `${config.siteUrl}/newsletter/confirmar?token=${encodeURIComponent(token)}`
}

export function preferencesUrl(token) {
  return `${config.siteUrl}/newsletter/preferencias?token=${encodeURIComponent(token)}`
}

export function unsubscribeUrl(token) {
  return `${config.siteUrl}/newsletter/preferencias?token=${encodeURIComponent(token)}&baja=1`
}

/** Cabeceras RFC 8058: Gmail y Outlook muestran su propio botón "Cancelar suscripción". */
export function listUnsubscribeHeaders(token) {
  return {
    'List-Unsubscribe': `<${config.apiUrl}/unsubscribe?token=${encodeURIComponent(token)}>`,
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click'
  }
}

function trackedUrl(url) {
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}utm_source=newsletter&utm_medium=email&utm_campaign=resumen-semanal`
}

export function categoryList(codes) {
  const labels = codes.map((code) => CATEGORIES[code]?.label).filter(Boolean)
  if (labels.length <= 1) return labels.join('')
  return `${labels.slice(0, -1).join(', ')} y ${labels.at(-1)}`
}

function button(href, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
    <tr><td style="background:#1a1a1a;border-radius:8px;">
      <a href="${escapeHtml(href)}" style="display:inline-block;padding:12px 24px;font-family:${FONT};font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`
}

function layout({ preheader, body, footer }) {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Blog de Jesús Flórez</title>
</head>
<body style="margin:0;padding:0;background:#f8f8f6;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f8f8f6;">
    <tr><td align="center" style="padding:32px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">
        <tr><td style="padding:0 4px 20px;font-family:${FONT};">
          <a href="${config.siteUrl}" style="font-size:16px;font-weight:700;color:#1a1a1a;text-decoration:none;letter-spacing:-0.01em;">Blog de Jesús Flórez</a>
        </td></tr>
        <tr><td style="background:#ffffff;border:1px solid #e8e8e4;border-radius:12px;padding:32px;font-family:${FONT};font-size:15px;line-height:1.6;color:#2b2b2b;">
          ${body}
        </td></tr>
        <tr><td style="padding:20px 4px;font-family:${FONT};font-size:12px;line-height:1.6;color:#9b9b9b;">
          ${footer}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

// ─── Confirmación de suscripción ──────────────────────────────────────────────

export function confirmationEmail({ token, categories }) {
  const url = confirmUrl(token)
  const topics = categoryList(categories)

  const html = layout({
    preheader: 'Confirma tu correo para empezar a recibir el resumen semanal.',
    body: `
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#1a1a1a;">Confirma tu suscripción</h1>
      <p style="margin:0 0 12px;">Pediste recibir el resumen semanal del blog con los artículos nuevos de <strong>${escapeHtml(topics)}</strong>.</p>
      <p style="margin:0;">Para empezar, confirma que este correo es tuyo:</p>
      ${button(url, 'Confirmar suscripción')}
      <p style="margin:0;font-size:13px;color:#9b9b9b;">Si el botón no funciona, copia este enlace en tu navegador:<br>
        <a href="${escapeHtml(url)}" style="color:#9b9b9b;word-break:break-all;">${escapeHtml(url)}</a></p>`,
    footer: 'Si no pediste esta suscripción, ignora este correo: no te llegará nada más y tus datos se borran en 7 días.'
  })

  const text = `Confirma tu suscripción

Pediste recibir el resumen semanal del Blog de Jesús Flórez con los artículos nuevos de ${topics}.

Confirma tu correo aquí:
${url}

Si no pediste esta suscripción, ignora este correo: no te llegará nada más y tus datos se borran en 7 días.`

  return { subject: 'Confirma tu suscripción al blog', html, text }
}

// ─── Ya estaba suscrito ───────────────────────────────────────────────────────

export function alreadySubscribedEmail({ token, categories }) {
  const url = preferencesUrl(token)
  const topics = categoryList(categories)

  const html = layout({
    preheader: 'Ya tienes una suscripción activa con este correo.',
    body: `
      <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#1a1a1a;">Ya estás suscrito</h1>
      <p style="margin:0 0 12px;">Alguien (probablemente tú) intentó suscribir este correo de nuevo. Ya recibes el resumen semanal de <strong>${escapeHtml(topics)}</strong>.</p>
      <p style="margin:0;">Si quieres cambiar las categorías o darte de baja:</p>
      ${button(url, 'Gestionar mi suscripción')}`,
    footer: 'Si no fuiste tú, puedes ignorar este correo: tu suscripción sigue igual.'
  })

  const text = `Ya estás suscrito

Ya recibes el resumen semanal del Blog de Jesús Flórez con los artículos de ${topics}.

Para cambiar las categorías o darte de baja:
${url}`

  return { subject: 'Ya estás suscrito al blog', html, text }
}

// ─── Resumen semanal ──────────────────────────────────────────────────────────

// Solo el primer artículo de cada categoría lleva portada: con 5–7 artículos
// por semana, una imagen grande por artículo hace el correo interminable.
function postCard(post, index) {
  const url = trackedUrl(post.url)
  const image = index === 0 && post.image
    ? `<a href="${escapeHtml(url)}"><img src="${escapeHtml(post.image)}" alt="" width="536" style="display:block;width:100%;max-width:536px;height:auto;border-radius:8px;margin:0 0 14px;border:0;"></a>`
    : ''

  const divider = index > 0 ? 'border-top:1px solid #f0f0ed;padding-top:20px;' : ''

  return `<tr><td style="padding:0 0 20px;${divider}">
    ${image}
    <a href="${escapeHtml(url)}" style="font-size:${index === 0 ? 18 : 16}px;font-weight:700;line-height:1.35;color:#1a1a1a;text-decoration:none;">${escapeHtml(post.title)}</a>
    ${post.description ? `<p style="margin:8px 0 10px;color:#3d3d3d;">${escapeHtml(post.description)}</p>` : ''}
    <a href="${escapeHtml(url)}" style="font-size:14px;font-weight:600;color:#1a1a1a;">Leer artículo →</a>
  </td></tr>`
}

function categorySection(code, posts) {
  const { label, color, bg } = CATEGORIES[code]
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:8px 0 18px;">
        <span style="display:inline-block;padding:4px 10px;border-radius:999px;background:${bg};color:${color};font-size:12px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;">${escapeHtml(label)}</span>
      </td></tr>
      ${posts.map(postCard).join('')}
    </table>
    <div style="height:12px;line-height:12px;">&nbsp;</div>`
}

function digestSubject(posts) {
  const first = `«${posts[0].title}»`
  if (posts.length === 1) return `Nuevo en el blog: ${first}`
  const others = posts.length - 1
  return `Nuevo en el blog: ${first} y ${others} ${others === 1 ? 'artículo más' : 'artículos más'}`
}

/** `posts` ya viene filtrado por las categorías del suscriptor. */
export function digestEmail({ token, categories, posts }) {
  const grouped = CATEGORY_CODES
    .map((code) => [code, posts.filter((post) => post.categoria === code)])
    .filter(([, list]) => list.length > 0)

  const count = posts.length
  const intro = count === 1
    ? 'Desde el último resumen se publicó un artículo nuevo en el blog:'
    : `Desde el último resumen se publicaron ${count} artículos nuevos en el blog:`

  const html = layout({
    preheader: posts.map((post) => post.title).join(' · '),
    body: `
      <h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#1a1a1a;">Resumen semanal</h1>
      <p style="margin:0 0 24px;color:#3d3d3d;">${intro}</p>
      ${grouped.map(([code, list]) => categorySection(code, list)).join('')}`,
    footer: `Recibes este correo porque te suscribiste al resumen de ${escapeHtml(categoryList(categories))} en
      <a href="${config.siteUrl}" style="color:#9b9b9b;">blog.jesusflorez.cloud</a>.<br>
      <a href="${escapeHtml(preferencesUrl(token))}" style="color:#9b9b9b;">Cambiar categorías</a> ·
      <a href="${escapeHtml(unsubscribeUrl(token))}" style="color:#9b9b9b;">Darme de baja</a> ·
      <a href="${config.siteUrl}/privacidad" style="color:#9b9b9b;">Política de privacidad</a>`
  })

  const textSections = grouped
    .map(([code, list]) => `== ${CATEGORIES[code].label} ==\n\n${list
      .map((post) => `${post.title}\n${post.description ? `${post.description}\n` : ''}${trackedUrl(post.url)}`)
      .join('\n\n')}`)
    .join('\n\n')

  const text = `Resumen semanal — Blog de Jesús Flórez

${intro}

${textSections}

--
Recibes este correo porque te suscribiste al resumen de ${categoryList(categories)}.
Cambiar categorías: ${preferencesUrl(token)}
Darme de baja: ${unsubscribeUrl(token)}`

  return { subject: digestSubject(posts), html, text }
}
