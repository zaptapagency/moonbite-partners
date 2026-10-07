# MoonBite Partners

A merchant platform for selling **digital products** for **MBITE** (MoonBite cryptocurrency).
Non-custodial settlement, zero chargebacks, automated delivery on payment confirmation.

> Full strategy, architecture and roadmap: **[PLAN.md](./PLAN.md)**.

## Monorepo layout

```
.
├── apps/
│   ├── api/          NestJS API — catalog, orders, payments, delivery
│   │   ├── prisma/   data model (schema.prisma) + seed
│   │   └── src/
│   │       ├── mbite/        MBITE node RPC client + HD address derivation  ← payment core
│   │       ├── payments/     invoice lifecycle, confirmation poller, delivery
│   │       ├── orders/       create-order + checkout-status endpoints
│   │       ├── products/     catalog
│   │       └── merchants/    onboarding + settlement xpub
│   └── web/          Next.js storefront — catalog, product, live checkout
├── packages/
│   └── shared/       types + the OrderStatus state machine (shared api ↔ web)
├── docker-compose.yml  Postgres + Redis (+ MBITE node placeholder)
└── .env.example
```

## Prerequisites

- Node.js ≥ 20 (tested on 24)
- Docker (for Postgres + Redis)
- A **MoonBite full node** reachable over JSON-RPC (see `docker-compose.yml` and PLAN.md Phase 0).
  The app runs without one, but payments stay in `AWAITING_PAYMENT` until a node is connected.

## Run the whole stack with Docker (one command)

```bash
npm run stack:up      # builds images, starts Postgres + Redis + api + web
# API  → http://localhost:4000/health
# Web  → http://localhost:3000
npm run stack:down    # stop everything
```

The API container applies the DB schema on boot (`prisma db push`). No MBITE node is
required — the stack runs without one (payments stay `AWAITING_PAYMENT`; `/health` reports
the node as unreachable but still returns `200`). This is exactly what CI builds and
smoke-tests (see [.github/workflows/ci.yml](.github/workflows/ci.yml)).

### Published images (GHCR)

On every push to the default branch, after `verify` + `e2e` pass, CI pushes:

- `ghcr.io/<owner>/<repo>-api`
- `ghcr.io/<owner>/<repo>-web`

tagged `latest`, the branch name, and `sha-<commit>`. Pull and run the published API, e.g.:

```bash
docker pull ghcr.io/<owner>/<repo>-api:latest
```

The web image bakes `NEXT_PUBLIC_API_BASE_URL` at build time (the browser's API URL).
To target a non-local API, set a repo variable `NEXT_PUBLIC_API_BASE_URL` (CI reads it) or
rebuild with `--build-arg NEXT_PUBLIC_API_BASE_URL=https://api.example.com`.

### Deploy (SSH → Docker host)

After `publish`, the `deploy` job SSHes into a Docker host and rolls out the exact
commit's images via [docker-compose.prod.yml](docker-compose.prod.yml) (which **pulls**
GHCR images — no building on the server). It **auto-skips** unless `SSH_HOST` is set, so
the pipeline works before you have a server.

Configure these in repo **Settings → Secrets and variables → Actions** (the GitHub
`production` environment can also require a reviewer before deploys run):

| Secret | Purpose |
|---|---|
| `SSH_HOST`, `SSH_USER`, `SSH_KEY` | SSH target + private key (`SSH_PORT` optional, default 22) |
| `JWT_SECRET` | API token signing secret |
| `POSTGRES_PASSWORD` | DB password (in-stack Postgres) |

The job logs the server into GHCR using the ephemeral `GITHUB_TOKEN` (valid for the run),
pulls the `sha-<commit>` tags, and `docker compose up -d`. Deploy to a managed DB instead
by pointing `DATABASE_URL`/`REDIS_URL` at external services in the prod compose.

## Local dev (hot reload)

```bash
# 1. install workspaces
npm install

# 2. copy env and fill it in
cp .env.example .env            # Windows: copy .env.example .env

# 3. start Postgres + Redis only
npm run infra:up

# 4. create the DB schema + Prisma client, then seed demo data
npm run db:generate
npm run db:migrate
npm run db:seed -w @moonbite/api

# 5. run api (:4000) + web (:3000) together
npm run dev
```

Open http://localhost:3000, click a product → **Pay with MBITE**. You'll get a derived
address and a live-updating checkout. Once a MBITE node is wired up and the payment
confirms, the order auto-advances to `FULFILLED` and the license key is issued.

### Merchant dashboard

http://localhost:3000/dashboard — sign in with the seeded account
(`demo@moonbite.example` / `password123`) or register a new one. From there a merchant can
set their settlement xpub, create products, watch orders, and process refunds (record the
refund txid for on-chain verification). Auth is JWT (`Authorization: Bearer <token>`,
`POST /auth/register` · `/auth/login`); merchant-scoped endpoints live under
[merchants.controller.ts](apps/api/src/merchants/merchants.controller.ts) and are guarded by
[jwt-auth.guard.ts](apps/api/src/auth/jwt-auth.guard.ts).

**Rate limiting** (`@nestjs/throttler`): a global per-IP default (`THROTTLE_LIMIT`/`THROTTLE_TTL`)
plus tighter limits on auth — **5 logins/min** and **10 registrations/hour** per IP — to blunt
brute-force and account spam. Set `TRUST_PROXY=1` behind a proxy so limits key off the real
client IP. The default store is in-memory/per-instance; use a Redis storage adapter when
running multiple API instances.

## The payment flow (code map)

1. `POST /orders` → `PaymentsService.createInvoice` derives a fresh address from the
   merchant's **xpub** ([hd-address.service.ts](apps/api/src/mbite/hd-address.service.ts))
   and locks the amount + quote window.
2. [zmq-listener.service.ts](apps/api/src/payments/zmq-listener.service.ts) subscribes to
   the node's **ZMQ** `rawtx`/`rawblock` publishers and **enqueues** affected orders the
   instant they appear; `ConfirmationService` is a slow backstop sweep for missed events.
   Both only enqueue — a **BullMQ** worker
   ([reconcile.processor.ts](apps/api/src/queue/reconcile.processor.ts), backed by Redis)
   does the actual chain checks with retries + exponential backoff, so a flaky node never
   blocks the producers.
3. `PaymentsService.reconcile` (run by the worker) scans the address via
   [mbite-rpc.client.ts](apps/api/src/mbite/mbite-rpc.client.ts), counts confirmations,
   and moves the order `DETECTED → PAID` (state machine in
   [packages/shared/src/order-status.ts](packages/shared/src/order-status.ts)).
4. On `PAID`, `DeliveryService.fulfill` issues the entitlement → `FULFILLED`.

### Refunds (non-custodial)

The platform holds only watch-only xpubs, so it cannot send funds. Refunds are a
request → merchant-sends → platform-verifies flow (see
[refunds.service.ts](apps/api/src/refunds/refunds.service.ts)):

1. `POST /orders/:id/refunds` → opens a `REQUESTED` refund to the buyer's return address.
2. The merchant sends MBITE back from their own wallet, then
   `POST /refunds/:id/submit` with the `txid` (→ `SUBMITTED`).
3. `RefundsService.verify` checks the tx on-chain
   ([refund-verification.ts](apps/api/src/refunds/refund-verification.ts)); once it pays
   the return address in full with enough confirmations → `CONFIRMED`, the order flips to
   `REFUNDED`, and the entitlement is revoked. The backstop poller re-verifies as
   confirmations accrue.

## ⚠️ Before going live (do not skip)

- **Confirm MBITE network params** in `hd-address.service.ts` (currently PLACEHOLDER /
  Litecoin-like). Wrong params = funds sent to the wrong network. Verify a derived
  address on the MBITE block explorer first.
- **Confirm the node RPC surface** matches `mbite-rpc.client.ts` (assumes Bitcoin-style RPC).
- Non-custodial: we store only merchant **xpubs** (watch-only) — never private keys.
- See PLAN.md §8 (security) and §9 (legal/compliance).
