# MoonBite Partners API image. Build context must be the REPO ROOT:
#   docker build -f apps/api/Dockerfile -t moonbite-api .
# Debian base (node:22-slim) so Prisma's query engine matches at build + runtime.

# ---- builder ----
FROM node:22-slim AS builder
WORKDIR /app

# Install workspace deps using only the manifests first (better layer caching).
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN npm ci

# Build shared, generate the Prisma client, compile the API.
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @moonbite/shared \
 && npx prisma generate --schema apps/api/prisma/schema.prisma \
 && npm run build -w @moonbite/api

# ---- runtime ----
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# node_modules carries the Prisma CLI (for db push on boot) + generated client.
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package.json ./packages/shared/package.json
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/apps/api/prisma ./apps/api/prisma
COPY apps/api/docker-entrypoint.sh ./apps/api/docker-entrypoint.sh
RUN chmod +x apps/api/docker-entrypoint.sh

EXPOSE 4000
CMD ["./apps/api/docker-entrypoint.sh"]
