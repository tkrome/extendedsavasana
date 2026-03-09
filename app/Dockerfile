FROM node:22-alpine AS base

# Install dependencies only when needed
FROM base AS deps
# libc6-compat for Alpine; python3/make/g++ to compile better-sqlite3 native bindings
RUN apk add --no-cache libc6-compat python3 make g++
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

# Build the application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Production runtime image — minimal
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Create data directory for SQLite and ensure nextjs user owns it.
# Named volumes inherit the container's directory permissions on first mount.
RUN mkdir -p /data && chown nextjs:nodejs /data

COPY --from=builder /app/public ./public

# Leverage Next.js standalone output
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV DATA_DIR=/data

CMD ["node", "server.js"]
