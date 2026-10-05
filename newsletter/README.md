# Newsletter del blog

Servicio Node/Express que gestiona las suscripciones y envía un **resumen semanal** (lunes 8:00, hora de Colombia) con los artículos nuevos de las categorías que eligió cada suscriptor.

- Suscriptores en **SQLite** (`/app/data/newsletter.db`, volumen `newsletter_data`).
- Correos vía **Resend** (API HTTP, sin SDK).
- Artículos leídos de `feed.json`, que genera `scripts/generate-feed.mjs` en el build del blog.

## Flujo

1. El formulario (`src/components/NewsletterForm.jsx`) hace `POST /api/newsletter/subscribe` → queda `pending` y sale un correo de confirmación (doble opt-in).
2. `/newsletter/confirmar?token=…` → `POST /confirm` → `active`.
3. Cron diario a las 8:00: si hay un resumen a medias lo retoma; si es lunes arma uno nuevo con los artículos aún no enviados (máximo 14 días de antigüedad). Cada suscriptor recibe solo sus categorías; si no hay nada para él, no recibe correo.
4. Cada correo trae `List-Unsubscribe` + `List-Unsubscribe-Post` (baja one-click de Gmail/Outlook) y enlaces a `/newsletter/preferencias`.
5. Darse de baja **borra** la fila (Ley 1581). Las suscripciones sin confirmar se borran a los 7 días.

### Límite de Resend (plan gratuito: 100 correos/día)

Se cuentan los correos enviados por día (UTC). Los resúmenes usan hasta `DAILY_EMAIL_LIMIT − CONFIRMATION_RESERVE` (100 − 15); al llegar al tope el envío se pausa y el cron lo retoma al día siguiente sin repetir a nadie (tabla `deliveries` + `Idempotency-Key`).

## API (`/api/newsletter`)

| Método | Ruta | Body / query |
|---|---|---|
| POST | `/subscribe` | `{ email, categories: ['tech'\|'coding'], consent: true, website: '' }` |
| POST | `/confirm` | `{ token }` |
| GET | `/preferences` | `?token=` |
| POST | `/preferences` | `{ token, categories }` |
| POST | `/unsubscribe` | `{ token }` o `?token=` (one-click RFC 8058) |

## Desarrollo local

```bash
cd newsletter
cp .env.example .env     # sin RESEND_API_KEY los correos se guardan en data/outbox/
npm install
npm run dev              # :3002 — Vite (npm run dev en la raíz) le hace proxy a /api/newsletter
npm test
```

## Operación en el VPS

```bash
cd deploy
docker compose exec newsletter node src/cli.js stats
docker compose exec newsletter node src/cli.js preview          # escribe data/preview.html
docker compose exec newsletter node src/cli.js test-email tu@correo.com
docker compose exec newsletter node src/cli.js digest --force   # enviar el resumen ya
```

Variables: `RESEND_API_KEY` (obligatoria, en el `.env` de deploy), `MAIL_FROM`, `MAIL_REPLY_TO`, `SITE_URL`, `FEED_URL`, `DIGEST_CRON`, `DIGEST_WEEKDAY`, `DIGEST_MAX_AGE_DAYS`, `DAILY_EMAIL_LIMIT`, `CONFIRMATION_RESERVE` — ver `src/config.js`.
