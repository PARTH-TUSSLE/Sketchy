# =======================================================
# Dockerfile for sketchy-frontend (Next.js 15 App)
# =======================================================

FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# --- Builder Stage ---
FROM base AS builder
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy monorepo workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy packages and frontend source
COPY packages ./packages
COPY apps/sketchy-frontend ./apps/sketchy-frontend

# Install dependencies
RUN pnpm install --frozen-lockfile

# Build args for Next.js public env vars
ARG NEXT_PUBLIC_HTTP_URL
ARG NEXT_PUBLIC_WS_URL
ENV NEXT_PUBLIC_HTTP_URL=${NEXT_PUBLIC_HTTP_URL}
ENV NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL}
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Build shared packages and frontend application
RUN pnpm --filter @repo/common build
RUN pnpm --filter @repo/backend-common build
RUN pnpm --filter @repo/db build
RUN pnpm --filter sketchy-frontend build

# --- Runner Stage ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Copy static assets and standalone server output
COPY --from=builder /app/apps/sketchy-frontend/public ./apps/sketchy-frontend/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/sketchy-frontend/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/sketchy-frontend/.next/static ./apps/sketchy-frontend/.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "apps/sketchy-frontend/server.js"]
