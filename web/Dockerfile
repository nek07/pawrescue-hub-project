# Next.js в режиме standalone: в итоговый образ попадает только server.js
# и реально используемые зависимости (~150 МБ вместо ~1 ГБ node_modules).

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# HUSKY=0 — git-хуки в контейнере не нужны (prepare делает cd .. в корень репо)
RUN --mount=type=cache,target=/root/.npm HUSKY=0 npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Попадают в сборку: rewrites и NEXT_PUBLIC_* вшиваются на этапе build
ARG API_URL=http://api:8000
ARG SITE_URL=http://localhost:3000
ARG NEXT_PUBLIC_DEV_LOGIN=
ARG NEXT_PUBLIC_TELEGRAM_BOT_ID=
ENV API_URL=$API_URL \
    SITE_URL=$SITE_URL \
    NEXT_PUBLIC_DEV_LOGIN=$NEXT_PUBLIC_DEV_LOGIN \
    NEXT_PUBLIC_TELEGRAM_BOT_ID=$NEXT_PUBLIC_TELEGRAM_BOT_ID \
    NEXT_TELEMETRY_DISABLED=1
# public/ может отсутствовать (пустые папки git не хранит), а runtime её копирует
RUN mkdir -p public && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
USER node
EXPOSE 3000
CMD ["node", "server.js"]
