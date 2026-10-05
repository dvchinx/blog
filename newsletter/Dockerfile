# better-sqlite3 es un módulo nativo: se compila en una etapa con toolchain
# y solo node_modules pasa a la imagen final.
FROM node:22-alpine AS deps

WORKDIR /app
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci --omit=dev

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production \
    DATABASE_PATH=/app/data/newsletter.db

COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./
COPY src/ ./src/

RUN mkdir -p /app/data && chown -R node:node /app/data
USER node

EXPOSE 3002

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3002/health || exit 1

CMD ["node", "src/index.js"]
