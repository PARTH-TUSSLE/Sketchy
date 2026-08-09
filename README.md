# Sketchy

A real-time collaborative whiteboard where multiple users draw shapes together on a shared canvas.

## Architecture

Turborepo + pnpm monorepo:

| App / Package | Purpose |
|---|---|
| `apps/sketchy-frontend` | Next.js 15 (App Router) frontend, canvas engine, auth UI |
| `apps/http-backend` | Express 5 REST API (port 8380): signup/signin/rooms/chats/shapes |
| `apps/ws-backend` | WebSocket server (`ws`, port 8381): realtime broadcast + persistence |
| `packages/db` | Prisma schema + client (`@repo/db/client`) |
| `packages/common` | Shared zod schemas (`@repo/common/types`) |
| `packages/backend-common` | Shared JWT secret + password hashing (`@repo/backend-common/config`) |

## Prerequisites

- Node.js 18+
- pnpm 9+
- A PostgreSQL database (e.g. Neon) with a `DATABASE_URL`

## Setup

```sh
pnpm install
pnpm --filter @repo/db exec prisma migrate deploy
pnpm --filter @repo/db build     # generate + compile the client
```

## Environment variables

Create a root `.env` (and a `packages/db/.env` with the database URL). Never commit real secrets.

```env
# .env (root) — required, at least 32 chars
JWT_SECRET=change-me-to-a-long-random-string
```

```env
# packages/db/.env
DATABASE_URL=postgresql://user:pass@host/db?sslmode=require
```

## Running locally

```sh
# all in watch mode
pnpm dev

# or individually
pnpm --filter ws-backend dev        # ws://localhost:8381
pnpm --filter http-backend dev      # http://localhost:8380
pnpm --filter sketchy-frontend dev  # http://localhost:3000
```

Open http://localhost:3000/signup, create an account, then visit `/canvas/<roomId>`.

## Common tasks

```sh
pnpm build         # compile all packages + apps
pnpm lint          # run ESLint everywhere
pnpm check-types   # run tsc --noEmit everywhere
pnpm test          # run the node:test unit suites
```

## Documentation

The full knowledge base lives in the Obsidian vault under `vaults/projects/Sketchy`
(`Home.md` is the entry point; `Technical Debt.md` and `Known Issues.md` track status).
