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

## Quick start

```bash
# 1. install workspaces
npm install

# 2. copy env and fill it in
cp .env.example .env            # Windows: copy .env.example .env

# 3. start Postgres + Redis
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

## The payment flow (code map)

1. `POST /orders` → `PaymentsService.createInvoice` derives a fresh address from the
   merchant's **xpub** ([hd-address.service.ts](apps/api/src/mbite/hd-address.service.ts))
   and locks the amount + quote window.
2. [zmq-listener.service.ts](apps/api/src/payments/zmq-listener.service.ts) subscribes to
   the node's **ZMQ** `rawtx`/`rawblock` publishers and reconciles affected orders the
   instant they appear; `ConfirmationService` is a slow backstop poll for missed events.
3. `PaymentsService.reconcile` scans the address via
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
