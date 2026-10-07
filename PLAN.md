# MoonBite Partner Program — God-Level Plan
### A merchant platform for selling digital products for MBITE (and crypto)

> **Status:** Draft v1 · **Owner:** usafdar@aqtardev.com · **Date:** 2026-10-07
> **One-line vision:** Let any creator sell digital goods and get paid in MoonBite (MBITE), with instant on-chain settlement, no chargebacks, and automated delivery.

---

## 0. What MoonBite actually is (grounding facts)

MoonBite (ticker **MBITE**) is a **proof-of-work cryptocurrency**, not a marketplace. Key properties that shape every design decision below:

| Property | Value | Implication for us |
|---|---|---|
| Consensus | PoW, CPU-minable | Standard UTXO chain; we integrate like we'd integrate Bitcoin/Litecoin |
| Block time | ~2 minutes | Fast-ish confirmations; 2–3 confs ≈ 4–6 min is a reasonable "paid" threshold |
| Block reward | 10 MBITE/block | — |
| Max supply | ~33 million, halving schedule, **no premine** | Fair-launch asset; narrative = "grassroots money" |
| Privacy | Optional **MWEB** (amounts can be concealed) | Payment detection must handle both transparent and MWEB paths |
| Security | Timelocked wallet vaults | Use for treasury/cold storage |
| Infra | Full node + block explorer available | We can run our own node + explorer, no third-party dependency required |

**Strategic consequence:** MBITE has no fiat on-ramp ecosystem, no Stripe-equivalent, and a volatile/illiquid price. The platform must **own the payment rail end-to-end** (node, address generation, confirmation tracking, pricing) and solve volatility and liquidity itself.

---

## 1. Vision, positioning & the core bet

**Product:** A hosted platform ("MoonBite Partners") where **merchants** list **digital products** (software licenses, ebooks, courses, game items, templates, API credits, downloads) and **buyers** pay in **MBITE**. On payment confirmation, the product is delivered automatically.

**Why this can win:**
- **Zero chargebacks** — crypto payments are final; huge for digital goods where fraud/chargeback abuse is the #1 merchant pain.
- **Global from day one** — no bank, no card network, no country gating.
- **Utility for MBITE** — gives the coin a real spending use case → demand → mining community loyalty. This is a flywheel, not just a store.
- **Fair-launch alignment** — "no premine" coin + "no-middleman" marketplace is a coherent brand.

**The core bet:** MBITE's mining community is the initial demand side (people who hold MBITE and want to spend it). Merchants follow where spenders are. **We must seed the demand side first.**

**Explicit non-goals (v1):**
- Not physical goods (shipping/logistics out of scope).
- Not a custodial exchange / not fiat on-ramp (regulatory landmine — see §9).
- Not investment products. MBITE's own site disclaims investment status; we inherit that posture.

---

## 2. Three architecture options (pick one deliberately)

| Option | What it is | Pros | Cons | Recommended? |
|---|---|---|---|---|
| **A. Payment plugin/gateway** | A "Pay with MBITE" button + API merchants embed in *their own* store (like BTCPay Server) | Fast to ship, non-custodial, low liability | No network effect, no marketplace discovery, we're invisible | For later |
| **B. Hosted marketplace** | We host listings, checkout, delivery, accounts | Network effects, discovery, we control UX & brand | More build, we hold more responsibility, some custody questions | ✅ **v1 core** |
| **C. Hybrid** | Marketplace **+** embeddable gateway for merchants who have their own site | Best of both, maximal reach | Most surface area | ✅ **target end-state** |

**Recommendation:** Build **B** first (own the marketplace and the demand loop), expose the payment layer as an API/plugin (**A**) in Phase 3 to reach **C**.

**Custody stance (critical decision):** Default to **non-custodial / direct-to-merchant settlement** — each merchant provides an MBITE xpub (extended public key); we derive a fresh address per order; funds land in the merchant's own wallet. The platform never holds buyer funds. This minimizes regulatory exposure (we're software, not a money transmitter) and theft risk. Platform fee is collected via a separate fee output or periodic invoicing. *(The alternative — custodial escrow — enables refunds/dispute holds but turns us into a money services business. Avoid in v1.)*

---

## 3. System architecture

```
                          ┌─────────────────────────────┐
                          │        Buyers (web)          │
                          └──────────────┬──────────────┘
                                         │
                 ┌───────────────────────▼────────────────────────┐
                 │              Web App (Next.js)                  │
                 │  catalog · product page · checkout · library    │
                 └───────┬─────────────────────────┬──────────────┘
                         │ REST/tRPC               │
         ┌───────────────▼───────┐     ┌───────────▼────────────┐
         │   Core API (Nest/Node)│     │  Merchant Dashboard     │
         │  catalog, orders,      │     │  listings, payouts,     │
         │  entitlements, fees    │     │  analytics, API keys    │
         └───┬───────────┬────────┘     └─────────────────────────┘
             │           │
   ┌─────────▼──┐   ┌─────▼──────────────┐      ┌──────────────────────┐
   │ PostgreSQL │   │  Payment Service    │◄────►│  MBITE Full Node(s)  │
   │ (orders,   │   │  - HD addr derive   │ RPC  │  + ZMQ notifications  │
   │ products,  │   │  - invoice lifecycle│      │  + block explorer     │
   │ users)     │   │  - confirmation svc │      └──────────────────────┘
   └────────────┘   │  - price oracle     │
                    └──────────┬──────────┘      ┌──────────────────────┐
                               │                 │  Delivery Service     │
                    ┌──────────▼───────────┐     │  license keys, signed │
                    │ Redis (invoice state,│────►│  download URLs, course│
                    │ rate limits, queues) │     │  access, webhooks     │
                    └──────────────────────┘     └──────────────────────┘
```

**Why these pieces:**
- **MBITE full node** (2 for redundancy) is the source of truth. Subscribe to **ZMQ** for new tx/blocks → near-instant payment detection without polling.
- **Payment Service** is the crown jewel: generates a unique address per invoice from each merchant's **xpub** (BIP32 HD derivation), watches for incoming tx, counts confirmations, resolves the fiat/USD-equivalent price at purchase time, and fires an event when "paid."
- **MWEB handling:** transparent payments detect via address watch; for MWEB (concealed-amount) payments, require the buyer's wallet to share a payment proof, or restrict v1 checkout to transparent addresses and add MWEB support in Phase 2. **Decision flag — confirm whether MWEB payments must be accepted at launch.**
- **Delivery Service** turns "paid" into "product in buyer's hands": issue license key, mint a short-lived signed download URL, grant course/API access, or call a merchant webhook.

---

## 4. The payment flow (the heart of it)

```
1. Buyer clicks "Buy" → order created, status = AWAITING_PAYMENT
2. Payment Service derives fresh address from merchant xpub (index = order id)
3. Price oracle locks MBITE amount: amount_mbite = price_usd / mbite_usd_rate
   → quote valid for a fixed window (e.g. 15 min) to bound volatility
4. Buyer shown: address + exact MBITE amount + QR + countdown timer
5. Node (via ZMQ) sees tx to that address for >= amount → status = DETECTED (0-conf)
6. After N confirmations (default 2 ≈ ~4 min) → status = PAID
7. Delivery Service delivers product → status = FULFILLED
8. Platform fee recorded; merchant settlement already direct (non-custodial)
```

**Hard problems and how we solve them:**

| Problem | Solution |
|---|---|
| **Price volatility** between quote and payment | Lock a quote for a short window (15 min). If paid late/underpaid, mark UNDERPAID and offer top-up or refund-to-sender. |
| **No reliable MBITE/USD price** (illiquid) | Build a **price oracle** aggregating any available market data; if none exists, let merchants price **directly in MBITE** (v1 safe default) and show USD as an estimate only. **Decide: price-in-MBITE vs price-in-USD.** |
| **Under/overpayment** | Tolerance band (±1–2%); underpay → partial/refund flow; overpay → deliver + record credit. |
| **Confirmation wait UX** | Show live progress bar (0-conf "detected" → confirmed); deliver low-risk/low-value items at 0-conf, high-value at 2+ confs. |
| **Refunds** (non-custodial) | Refund = merchant-initiated send back to buyer's return address, collected at checkout. Platform provides the tooling, not the funds. |
| **Dust / fee estimation** | Node provides fee estimates; enforce minimum order value above dust threshold. |

---

## 5. Merchant / Partner program design

This is literally what you asked for — the "partner (merchant)" side.

### 5.1 Onboarding
1. Sign up → verify email.
2. **Provide settlement xpub** (merchant's own MBITE wallet extended public key) — non-custodial payout.
3. Agree to Partner Terms (prohibited-goods policy, see §9).
4. **Tiered verification (progressive KYC):**
   - *Starter* — email only; low monthly volume cap; no payout holds needed (non-custodial anyway).
   - *Verified* — business/identity check; higher caps, featured placement, lower fee.
   - *Elite* — full KYB; API/gateway access, priority support.

### 5.2 Partner tiers & economics

| Tier | Platform fee | Monthly cap | Perks |
|---|---|---|---|
| Starter | 5% | low | basic listing, standard support |
| Verified | 3% | high | search boost, promo slots, analytics+ |
| Elite | 1.5% + (optional SaaS fee) | unlimited | embeddable gateway/API, webhooks, priority |

**Fee collection (non-custodial):** add a platform-fee output to each payment transaction (buyer pays merchant amount + fee to platform address), **or** net it via monthly invoice. Transaction-level fee split is cleaner and trustless → **recommended**.

**Referral/affiliate layer:** partners earn MBITE for referring buyers or other merchants → amplifies the demand flywheel (§1).

### 5.3 Merchant dashboard features
- Product CRUD (title, media, price, delivery method, stock/unlimited, variants).
- Delivery config: upload license key pool · upload file for signed delivery · set webhook · course access rules.
- Orders & fulfillment log, confirmation status, refunds tool.
- Payout/settlement view (since non-custodial: on-chain tx history to their xpub addresses).
- Analytics: sales, conversion, MBITE vs USD trend, top products.
- API keys + webhook config (Elite).

---

## 6. Digital product types & delivery mechanisms

| Product type | Delivery mechanism |
|---|---|
| Software license keys | Pull from merchant-uploaded key pool; one key per paid order; low stock alerts |
| Downloadable files (ebooks, assets, templates) | Short-lived **signed URL** (S3/R2), watermark optional, download-count limits |
| Courses / memberships | Grant access on the platform or SSO token to merchant's LMS |
| API credits / SaaS top-ups | Call merchant webhook with buyer id + amount |
| Game items / in-game currency | Webhook to game backend |
| Subscriptions | Recurring MBITE invoices (Phase 3 — hard in crypto; start with fixed-term passes) |

**Anti-piracy / integrity:** signed URLs expire fast, per-order unique keys, download throttling, optional watermarking. We're not building heavy DRM in v1 — digital-goods sellers accept some leakage; the chargeback-free upside outweighs it.

---

## 7. Technology stack (recommended)

- **Frontend:** Next.js (React) + TypeScript, Tailwind. SSR for SEO on product pages (discovery matters).
- **Backend:** Node.js (NestJS) + TypeScript — one language across the stack.
- **DB:** PostgreSQL (orders, products, users, entitlements). **Redis** (invoice state machine, queues, rate limits).
- **Chain:** Self-hosted **MBITE full node(s)** with RPC + **ZMQ**; own **block explorer** instance for support/debugging.
- **Wallet/keys:** BIP32 HD derivation from merchant xpubs; platform treasury in **timelocked vault** cold storage (§8).
- **Infra:** Docker + a single orchestrator (start simple: Docker Compose → Kubernetes later); object storage (Cloudflare R2/S3) for deliverable files.
- **Queue/jobs:** BullMQ (Redis) for confirmation polling fallback, delivery, webhooks, email.
- **Observability:** structured logs, Prometheus/Grafana, alerting on node health & stuck invoices.

**Build vs borrow:** evaluate **BTCPay Server** — if MBITE is a Bitcoin/Litecoin-derived codebase, BTCPay (which already supports many altcoins via plugins) could give us the gateway layer for free and cut months off Phase 1. **Action item: confirm MBITE's codebase lineage and BTCPay compatibility before writing a custom payment service.**

---

## 8. Security (non-negotiable for a crypto product)

- **Custody:** non-custodial by default (§2) → biggest risk surface removed.
- **Keys:** merchants hold private keys; we only store **xpubs** (watch-only, cannot spend). Platform treasury (fees) in **timelocked vault / cold wallet**, multisig for any hot float.
- **Node hardening:** nodes on private network, RPC not public, firewalled, read paths only exposed via our service.
- **App security:** signed/expiring download URLs, rate limiting, OWASP top-10 review, secrets in a vault (not env files in repo), per-merchant API key scoping + rotation.
- **Payment integrity:** verify tx amount, address ownership, and confirmation depth server-side only — never trust client. Guard against 0-conf double-spend by gating high-value delivery on confirmations.
- **Abuse:** velocity limits, anomaly detection on new merchants, prohibited-goods scanning, takedown workflow.
- **Audits:** third-party security review of the payment service before public launch; bug bounty at scale.

---

## 9. Legal, compliance & policy (do not skip)

> Not legal advice — budget for a crypto-literate lawyer in the target jurisdiction early.

- **Money transmission:** non-custodial settlement is the key mitigation — we facilitate peer-to-peer payment and provide software; we don't hold or transmit customer funds. Custodial escrow would likely trigger MSB/MTL registration. Keep it non-custodial.
- **KYC/AML:** tiered (§5.1). Even non-custodial, higher tiers and higher volumes warrant identity checks and sanctions screening.
- **Prohibited goods policy:** no illegal content, no malware, no regulated/age-gated goods without controls, no "investment"/securities-like products. Clear, enforced, with takedown.
- **Consumer terms:** crypto payments are final — disclose prominently; define the refund policy (merchant-driven).
- **Tax:** merchants responsible for their own; platform issues records/exports. Platform fee income is our taxable revenue.
- **Disclaimers:** inherit MBITE's "not an investment" posture; we sell goods, not tokens.
- **Data/privacy:** GDPR/CCPA basics; minimize PII; MWEB privacy is a feature, not a shield for illegal use.

---

## 10. Phased roadmap

### Phase 0 — Foundations & validation (≈ weeks 1–3)
- Confirm MBITE codebase lineage + **BTCPay compatibility** (build-vs-borrow decision).
- Stand up MBITE full node + explorer; prove address derivation from an xpub and ZMQ payment detection with a testnet/small mainnet tx.
- Lock the strategic decisions (custody = non-custodial, pricing = MBITE-native v1, MWEB = Phase 2).
- Validate demand: talk to MBITE community (where do holders want to spend?) + recruit 5–10 pilot merchants.

### Phase 1 — MVP marketplace (≈ weeks 4–12)
- Auth, merchant onboarding (xpub), product CRUD (license keys + file download first).
- Payment service: invoice lifecycle, address derivation, confirmation tracking, quote window.
- Checkout with QR + countdown; buyer library; automated delivery (keys + signed URLs).
- Platform fee via tx-level split. Basic merchant dashboard + analytics.
- **Launch target:** private beta with pilot merchants and the mining community.

### Phase 2 — Trust, breadth & UX (≈ months 4–6)
- MWEB payment support; more product types (courses, API credits, webhooks).
- Price oracle + USD display; refund tooling; referral/affiliate program.
- Tiered KYC/verification; search, categories, reviews, discovery.
- Security audit → **public launch**.

### Phase 3 — Platform & scale (months 6–12)
- Embeddable **"Pay with MBITE" gateway/API + plugins** (WooCommerce/Shopify) → reach **Hybrid (Option C)**.
- Subscriptions/recurring, multi-crypto support (accept other coins, settle in MBITE), mobile.
- Partner marketing programs, featured placements, grants to top merchants.

---

## 11. Monetization

1. **Transaction fee** (1.5–5% by tier) — primary.
2. **SaaS fee** for Elite gateway/API access — predictable MRR.
3. **Promoted listings / featured placement** — once GMV justifies it.
4. **Value-add services** — premium analytics, white-label gateway.
- *(Optional, later)* small FX spread if/when we offer in-platform MBITE liquidity — adds custody/regulatory weight, so gate carefully.

---

## 12. Success metrics (KPIs)

- **Flywheel:** # active merchants · # products listed · # unique paying buyers · repeat-purchase rate.
- **Volume:** GMV (in MBITE and USD-equiv) · take-rate revenue · avg order value.
- **Payment health:** payment success rate · avg time-to-confirmation · underpaid/expired invoice rate · delivery success rate.
- **MBITE utility (north star):** % of circulating activity flowing through spend vs pure holding/mining.

---

## 13. Top risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **MBITE price volatility** kills merchant pricing | High | Quote windows, price-in-MBITE default, fast settlement, optional auto-convert later |
| **Thin liquidity** — merchants can't offload MBITE | High | Target merchants who *want* MBITE (community-aligned); affiliate incentives; later FX |
| **Low initial demand** (chicken-and-egg) | High | Seed demand side first via mining community; subsidize early merchants; referral program |
| **Regulatory reclassification** as money transmitter | High | Strict non-custodial architecture; crypto counsel; geo-gating if needed |
| **Fraud / illegal goods** | Med | Prohibited-goods policy, KYC tiers, monitoring, takedowns |
| **Node/payment-detection failure** | Med | Redundant nodes, ZMQ + polling fallback, alerting, idempotent delivery |
| **0-conf double-spend** on instant delivery | Med | Confirmation gating by order value |
| **Over-building before validation** | Med | Phase 0 pilot; consider BTCPay to avoid custom payment code early |

---

## 14. Immediate next actions

1. **Confirm MBITE codebase lineage** (Bitcoin/Litecoin fork?) → decides BTCPay reuse vs custom payment service.
2. **Lock the 3 strategic decisions:** custody (recommend non-custodial), pricing (recommend MBITE-native for v1), MWEB-at-launch (recommend Phase 2).
3. **Stand up a MBITE full node + explorer**; prove xpub-derived address watching + ZMQ detection end-to-end on one real payment.
4. **Recruit 5–10 pilot merchants** from the MBITE community and define the pilot product set.
5. **Engage crypto-literate legal counsel** for the jurisdiction(s) in scope.
6. Scaffold the repo (Next.js + NestJS + Postgres + Redis + node RPC client) and ship the invoice lifecycle as the first vertical slice.

---

### Open questions for you (these change the build)
- **Custodial or non-custodial** settlement? *(Plan assumes non-custodial.)*
- Price products **in MBITE** or **in USD** (needs a reliable oracle)? *(Plan defaults to MBITE-native for v1.)*
- Must we **accept MWEB** (private) payments at launch, or is Phase 2 fine?
- Is this an **official MoonBite project** (coordinated with the coin's team) or an **independent** build on top of it?
- Which **digital product categories** are you targeting first (software keys? courses? creator downloads?)?
