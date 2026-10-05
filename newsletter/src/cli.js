/**
 * Utilidades de administración. En el VPS:
 *   docker compose exec newsletter node src/cli.js <comando>
 *
 *   stats                   Suscriptores y estado de los resúmenes
 *   preview [tech,coding]   Guarda data/preview.html con el próximo resumen (no envía nada)
 *   test-email <correo>     Envía el próximo resumen a <correo> (prueba de Resend/DNS)
 *   digest [--force]        Corre el job diario ahora; --force arma el resumen aunque no sea lunes
 *   backup <archivo>        Copia consistente de la base de datos (la usa deploy/backup.sh)
 */
import fs from 'node:fs'
import path from 'node:path'
import { config, CATEGORY_CODES } from './config.js'
import { openDatabase, emailsSentToday } from './db.js'
import { pendingPosts, postsForSubscriber, processDigests } from './digest.js'
import { digestEmail } from './templates.js'
import { sendEmail } from './mailer.js'

const db = openDatabase()
const [command, ...args] = process.argv.slice(2)

async function previewEmail(categories) {
  const posts = postsForSubscriber(await pendingPosts(db), categories)
  if (posts.length === 0) {
    console.log('No hay artículos pendientes para el próximo resumen.')
    return null
  }
  return { posts, email: digestEmail({ token: 'TOKEN-DE-PRUEBA', categories, posts }) }
}

switch (command) {
  case 'stats': {
    const subs = db.prepare('SELECT status, COUNT(*) AS n FROM subscribers GROUP BY status').all()
    const byCategory = CATEGORY_CODES.map((code) => [code, db.prepare(
      "SELECT COUNT(*) FROM subscribers WHERE status = 'active' AND (',' || categories || ',') LIKE ?"
    ).pluck().get(`%,${code},%`)])
    const issues = db.prepare(`
      SELECT i.id, i.created_at, i.completed_at, json_array_length(i.posts) AS posts,
        (SELECT COUNT(*) FROM deliveries d WHERE d.issue_id = i.id AND d.status = 'sent') AS sent
      FROM issues i ORDER BY i.id DESC LIMIT 5
    `).all()

    console.log('Suscriptores:', Object.fromEntries(subs.map((row) => [row.status, row.n])))
    console.log('Activos por categoría:', Object.fromEntries(byCategory))
    console.log(`Correos enviados hoy (UTC): ${emailsSentToday(db)}/${config.dailyEmailLimit}`)
    console.log('Últimos resúmenes:')
    console.table(issues)
    break
  }

  case 'preview': {
    const categories = args[0] ? args[0].split(',') : CATEGORY_CODES
    const preview = await previewEmail(categories)
    if (!preview) break
    const file = path.join(path.dirname(config.databasePath), 'preview.html')
    fs.writeFileSync(file, preview.email.html, 'utf8')
    console.log(`Asunto: ${preview.email.subject}`)
    console.log(`${preview.posts.length} artículos → ${file}`)
    break
  }

  case 'test-email': {
    const to = args[0]
    if (!to) {
      console.error('Uso: test-email <correo>')
      process.exitCode = 1
      break
    }
    const preview = await previewEmail(CATEGORY_CODES)
    if (!preview) break
    const result = await sendEmail(db, { to, ...preview.email, subject: `[Prueba] ${preview.email.subject}` })
    console.log('Enviado:', result.id)
    break
  }

  case 'digest': {
    const result = await processDigests(db, { force: args.includes('--force') })
    console.log(result)
    break
  }

  case 'backup': {
    const target = args[0]
    if (!target) {
      console.error('Uso: backup <archivo>')
      process.exitCode = 1
      break
    }
    await db.backup(target)
    console.log(`Backup guardado en ${target}`)
    break
  }

  default:
    console.log('Comandos: stats | preview [tech,coding] | test-email <correo> | digest [--force] | backup <archivo>')
}

db.close()
