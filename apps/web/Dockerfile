# MoonBite Partners web image (Next.js standalone). Build context = REPO ROOT:
#   docker build -f apps/web/Dockerfile -t moonbite-web .
#
# NEXT_PUBLIC_* are inlined at BUILD time, so the API base URL the *browser*
# uses is baked here (default http://localhost:4000, where the api port is
# published in docker-compose). Override with --build-arg for other hosts.

# ---- builder ----
FROM node:22-slim AS builder
WORKDIR /app
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL

COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web
RUN npm run build -w @moonbite/shared \
 && npm run build -w @moonbite/web

# ---- runtime ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
WORKDIR /app

# Next standalone output already includes the traced node_modules + server.
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
