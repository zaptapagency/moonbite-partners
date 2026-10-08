# MoonBite Partners — Sequenced Roadmap

> **As of:** 2026-10-08 · Companion to [PLAN.md](PLAN.md) (strategy) and [LAUNCH.md](LAUNCH.md) (go-live runbook).
> Durations are indicative (team of 2–4); each phase has a **gate** — do not start the next phase until the gate's exit criteria are met.

## North Star & guardrail metrics

- **North Star:** **GMV** (gross merchandise value transacted) — and, as the MBITE-utility proxy, the **% of circulating MBITE activity that is *spend* vs. hold/mine**.
- **Guardrails (must stay healthy at every phase):** payment success rate ≥ 98%, delivery success rate ≥ 99%, chargeback/loss rate ≈ 0 (non-custodial), `/ready` = true in prod.

## The decision that gates "billion-dollar" (Phase 2)

MBITE is a thin, illiquid single coin. **Crypto-only on MBITE caps the ceiling at a niche.** The pivotal choice in Phase 2 is **multi-asset + fiat/stablecoin settlement**. Everything past Phase 2 assumes that choice is made; if you stay MBITE-only, treat Phases 3–4 targets as ~10–50× smaller.

---

## Phase 0 — Go-live (≈ 2–4 weeks) · *status: ~95% built*

**Goal:** process one real sale end-to-end on mainnet MBITE.

| Workstream | Deliverable |
|---|---|
| Chain params | Confirm real MBITE params + address type; verify via `derive:address` vs node (LAUNCH.md) |
| Node | Full node: `txindex=1`, RPC, ZMQ publishers |
| Infra | Managed Postgres/Redis/object storage, TLS, domain, real SMTP |
| Secrets | `generate-secrets.sh` → GitHub/host; env validation passes |

**Gate (all true):** `/ready` → `ready:true` · one live test payment `AWAITING→DETECTED→PAID→FULFILLED` · one test refund confirmed on-chain.

**Metrics:** time-to-confirm (target < 10 min at 2 confs) · payment success on test txns = 100% · delivery success = 100%.

---

## Phase 1 — Pilot / private beta (≈ 4–8 weeks)

**Goal:** prove real humans will sell and buy, and that delivery + retention hold.

**Deliverables:** onboard 10–50 hand-picked sellers (seed from the MBITE mining community); concierge support; basic merchant analytics; polish onboarding; instrument funnel analytics; prohibited-goods review in the loop.

**Gate:** ≥ 25 active sellers · ≥ 250 completed orders · **repeat-purchase rate ≥ 15%** · payment success ≥ 98% · zero unresolved delivery failures · qualitative "would be disappointed without it" ≥ 40% (Sean Ellis PMF signal).

**Metrics & targets:**
| Metric | Target |
|---|---|
| Active sellers | 25+ |
| Completed orders / wk | 50+ by end of phase |
| GMV (cumulative) | first real GMV; trend up WoW |
| Buyer conversion (visit→paid) | ≥ 2% |
| Seller time-to-first-sale | < 7 days |
| Avg time-to-confirm | < 10 min |

---

## Phase 2 — Product-market fit (≈ 3–6 months) · **the pivot**

**Goal:** repeatable, compounding GMV growth — unlock demand liquidity.

**Deliverables (priority order):**
1. **Multi-asset + fiat/stablecoin settlement** (BTC/ETH/USDC + on-ramp; merchant auto-settle to stablecoin) — *the lever*.
2. **USD pricing** via a price oracle (buyers think in dollars).
3. Discovery: search, categories, ratings/reviews, seller storefronts.
4. Compliance baseline: KYC/KYB tiers, sanctions screening, enforced policy + takedowns, real ToS.
5. Partial refunds, dispute flow, subscriptions.

**Gate:** **MoM GMV growth ≥ 20% for 3 consecutive months** · repeat-purchase rate ≥ 30% · seller 90-day retention ≥ 50% · take-rate revenue covers variable costs · security audit passed.

**Metrics & targets:**
| Metric | Target |
|---|---|
| GMV (monthly) | $100k → $1M |
| MoM GMV growth | ≥ 20% sustained |
| Repeat-purchase rate | ≥ 30% |
| Seller 90-day retention | ≥ 50% |
| Take rate (effective) | 3–5% |
| Payment success rate | ≥ 99% |
| % paid in stablecoin/fiat-settled | tracked (de-risks MBITE volatility) |

---

## Phase 3 — Scale (≈ 6–12 months)

**Goal:** GMV from ~$1M/mo toward $100M/yr; build the moat.

**Deliverables:** embeddable **"Pay with crypto" gateway/API + plugins** (reach beyond our marketplace); network-effect loops (referrals/affiliates, exclusive supply); ops hardening (Redis-backed rate limiting, HA Postgres, horizontal workers, metrics/Sentry/on-call, multi-region); compliance at scale (SOC2, tax, bug bounty); mobile.

**Gate:** GMV run-rate ≥ $100M/yr · **LTV:CAC ≥ 3:1** · gross margin ≥ 60% · uptime ≥ 99.9% · net revenue retention (sellers) ≥ 100%.

**Metrics & targets:**
| Metric | Target |
|---|---|
| GMV (annualized run-rate) | $100M |
| Net revenue | $3–5M (3–5% take) |
| LTV:CAC | ≥ 3:1 |
| Gross margin | ≥ 60% |
| Uptime | ≥ 99.9% |
| Active sellers / buyers | 1k+ / 100k+ |

---

## Phase 4 — Category leader (12+ months)

**Goal:** $1B+ GMV; durable defensibility.

**Deliverables:** international expansion + localization; exclusive/first-party supply; data & reputation moat; brand; platform ecosystem (3rd-party apps on top).

**Gate (the "billion-dollar" shape):** **GMV ≥ $1–5B/yr** → **net revenue ~$50–150M** → ~$1B valuation at typical marketplace multiples · strong two-sided network effects (organic growth share rising) · category brand recognition.

**Metrics & targets:**
| Metric | Target |
|---|---|
| GMV (annual) | $1–5B |
| Net revenue | $50–150M |
| Organic / referral share of new users | majority |
| Market position | top-1/2 in category |

---

## Sequencing & dependencies

```
Phase 0 (go-live) ─▶ Phase 1 (pilot) ─▶ Phase 2 (PMF + multi-asset) ─▶ Phase 3 (scale) ─▶ Phase 4 ($1B)
   gate: /ready        gate: retention        gate: 20% MoM ×3         gate: LTV:CAC 3:1   gate: GMV $1B+
```
- **Hard blocker today:** Phase 0 chain-param confirmation (only external artifact needed; tooling is built).
- **Biggest strategic risk:** skipping the Phase 2 multi-asset pivot — it's the difference between a niche and a billion-dollar path.
- **Don't scale before PMF:** Phase 3 spend only after the Phase 2 gate; scaling an unretentive marketplace burns cash.

## What's already built toward this (so the roadmap starts from reality)

Payment rail + order state machine, all four delivery types, non-custodial refunds, auth + dashboard + rate-limiting, migrations, SMTP (verify/reset/receipts), buyer receipts, Docker + CI→GHCR→deploy→smoke→auto-rollback, launch-gated config + `/ready` probe, address-type config + param-verification CLI. **84 tests; both apps build.** This is a Phase-0-complete codebase awaiting the go-live gate.
