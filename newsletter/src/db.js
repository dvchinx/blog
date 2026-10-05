import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import Database from 'better-sqlite3'
import { config } from './config.js'

export function openDatabase(filePath = config.databasePath) {
  if (filePath !== ':memory:') {
    fs.mkdirSync(path.dirname(filePath), { recursive: true })
  }

  const db = new Database(filePath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')

  db.exec(`
    CREATE TABLE IF NOT EXISTS subscribers (
      id             INTEGER PRIMARY KEY,
      email          TEXT NOT NULL UNIQUE COLLATE NOCASE,
      categories     TEXT NOT NULL,              -- "tech,coding"
      status         TEXT NOT NULL CHECK (status IN ('pending', 'active')),
      token          TEXT NOT NULL UNIQUE,
      consent_at     TEXT NOT NULL,
      policy_version TEXT NOT NULL,
      created_at     TEXT NOT NULL DEFAULT (datetime('now')),
      confirmed_at   TEXT,
      last_email_at  TEXT
    );

    CREATE TABLE IF NOT EXISTS issues (
      id           INTEGER PRIMARY KEY,
      posts        TEXT NOT NULL,                -- JSON con los artículos del resumen
      created_at   TEXT NOT NULL DEFAULT (datetime('now')),
      completed_at TEXT
    );

    -- Un artículo enviado en un resumen nunca vuelve a salir en otro
    CREATE TABLE IF NOT EXISTS sent_posts (
      url      TEXT PRIMARY KEY,
      issue_id INTEGER NOT NULL REFERENCES issues(id)
    );

    -- Qué suscriptores ya fueron procesados en cada resumen. Permite retomar
    -- un envío cortado (reinicio, límite diario) sin repetir correos.
    CREATE TABLE IF NOT EXISTS deliveries (
      issue_id      INTEGER NOT NULL REFERENCES issues(id),
      subscriber_id INTEGER NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
      status        TEXT NOT NULL CHECK (status IN ('sent', 'skipped', 'failed')),
      resend_id     TEXT,
      processed_at  TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (issue_id, subscriber_id)
    );

    -- Correos enviados por día (UTC) para no pasar el límite de Resend
    CREATE TABLE IF NOT EXISTS daily_usage (
      day   TEXT PRIMARY KEY,
      count INTEGER NOT NULL DEFAULT 0
    );
  `)

  return db
}

export function newToken() {
  return crypto.randomBytes(24).toString('base64url')
}

export function parseCategories(value) {
  return String(value || '').split(',').filter(Boolean)
}

function utcDay() {
  return new Date().toISOString().slice(0, 10)
}

export function emailsSentToday(db) {
  const row = db.prepare('SELECT count FROM daily_usage WHERE day = ?').get(utcDay())
  return row ? row.count : 0
}

export function recordEmailSent(db) {
  db.prepare(`
    INSERT INTO daily_usage (day, count) VALUES (?, 1)
    ON CONFLICT(day) DO UPDATE SET count = count + 1
  `).run(utcDay())
}

/** Suscripciones nunca confirmadas: se borran a los 7 días. */
export function purgeStalePending(db) {
  return db.prepare(`
    DELETE FROM subscribers
    WHERE status = 'pending' AND created_at < datetime('now', '-7 days')
  `).run().changes
}
