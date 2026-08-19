# =====================================================
# SecChangeLog - Production Deployment Build
# =====================================================

FROM oven/bun:1 AS base
WORKDIR /app

# -----------------------------------------------------------
# Dependencies
# -----------------------------------------------------------
FROM base AS deps
COPY package.json bun.lock ./
RUN rm -rf ~/.bun/install/cache && bun install --frozen-lockfile

# -----------------------------------------------------------
# Build
# -----------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN bun run db:generate && bun run build

# -----------------------------------------------------------
# Runtime
# -----------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/scripts ./scripts

COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["docker-entrypoint.sh"]