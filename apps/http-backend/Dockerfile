# =======================================================
# Dockerfile for http-backend (Express HTTP API Service)
# =======================================================

FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

# --- Builder Stage ---
FROM base AS builder
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Copy monorepo workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./

# Copy shared packages and app source
COPY packages ./packages
COPY apps/http-backend ./apps/http-backend

# Install workspace dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma client & build shared packages and http-backend
RUN pnpm --filter @repo/common build
RUN pnpm --filter @repo/backend-common build
RUN pnpm --filter @repo/db build
RUN pnpm --filter http-backend build

# --- Runner Stage ---
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT_HTTP=8380

RUN apk add --no-cache openssl

# Security: run as non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nodejs

# Copy built workspace and node_modules
COPY --from=builder --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-lock.yaml ./pnpm-lock.yaml
COPY --from=builder --chown=nodejs:nodejs /app/pnpm-workspace.yaml ./pnpm-workspace.yaml
COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=nodejs:nodejs /app/packages ./packages
COPY --from=builder --chown=nodejs:nodejs /app/apps/http-backend ./apps/http-backend

USER nodejs

EXPOSE 8380

CMD ["node", "apps/http-backend/dist/index.js"]
