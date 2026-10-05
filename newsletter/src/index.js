import cron from 'node-cron'
import { config } from './config.js'
import { openDatabase, purgeStalePending } from './db.js'
import { createApp } from './app.js'
import { processDigests } from './digest.js'

const db = openDatabase()
const app = createApp(db)

let running = false

async function dailyJob() {
  if (running) return
  running = true
  try {
    const purged = purgeStalePending(db)
    if (purged) console.log(`[cron] ${purged} suscripciones sin confirmar eliminadas`)

    const result = await processDigests(db)
    console.log('[cron] resumen:', JSON.stringify(result))
  } catch (error) {
    console.error('[cron] error:', error)
  } finally {
    running = false
  }
}

cron.schedule(config.digestCron, dailyJob, { timezone: config.timezone })

if (!config.resendApiKey) {
  console.warn('⚠️  RESEND_API_KEY no está definida: los correos se guardan en data/outbox/ en lugar de enviarse')
}

const server = app.listen(config.port, () => {
  console.log(`📬 newsletter escuchando en :${config.port} — cron "${config.digestCron}" (${config.timezone})`)
})

function shutdown() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}

process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
