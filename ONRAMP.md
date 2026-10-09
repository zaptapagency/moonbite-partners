# Fiat On-Ramp — Design

> **As of:** 2026-10-09 · Companion to [PLAN.md](PLAN.md) / [ROADMAP.md](ROADMAP.md).
> **Goal:** let a buyer pay with a **card** and have the merchant receive **MBITE** — removing the "must already own MBITE" barrier that caps mainstream growth.

## 0. The hard truth (read this first)

A fiat on-ramp for MoonBite is **not** a drop-in widget. Three facts collide:

1. **MBITE isn't on any on-ramp.** Transak / MoonPay / Stripe Crypto sell BTC/ETH/USDC — not a thin new coin. No third party will deliver MBITE for a card.
2. **"Non-custodial" and "pay with a card" are in tension.** Today funds go buyer-wallet → merchant-wallet; we never touch them. A card payment must land *somewhere* (a processor, then us) before it can become MBITE. The moment we hold buyer fiat and hand out MBITE, **we are selling crypto for money** = money transmission + crypto brokerage.
3. **Cards bring chargebacks back.** The thing crypto killed returns — and we'd be delivering *irreversible* MBITE against a *reversible* card charge. That fraud exposure is ours.

So: **a real fiat→MBITE on-ramp means the platform runs a liquidity desk, holds MBITE inventory, carries price + chargeback risk, and takes on money-services regulation.** There is no version that avoids this. The design below minimizes it by *partnering with licensed providers* rather than becoming a bank.

## 1. Architecture options

| Option | Buyer pays | Merchant gets | Custody / regulation | Verdict |
|---|---|---|---|---|
| **A. Generic on-ramp widget** | card → USDC | — | can't reach MBITE | ❌ impossible for MBITE |
| **B. Liquidity desk** | card → us | **MBITE** (we send from float) | we hold fiat+MBITE = MSB/broker | ✅ only true fiat→MBITE path |
| **C. Fiat→stablecoin settlement** | card → USDC | **USDC** (not MBITE) | lighter if a licensed partner holds funds | ✅ pragmatic first step |
| **D. Custodial buyer wallet + card top-up** | card → balance | spends balance | full custodial MSB | ❌ heaviest, avoid |

**Recommendation:** ship **C first** (fiat buyers settle merchants in USDC via a licensed partner — low lift, no MBITE inventory), then add **B** (the liquidity desk that delivers MBITE) once MBITE has real market liquidity to source from. Don't build D.

## 2. Recommended architecture — the Liquidity Desk (Option B)

```
 Buyer (card)                                           Merchant
     │  1. "Buy with card"                                  ▲
     ▼                                                      │ 4. MBITE from our float
┌─────────────────┐   2. fiat settled    ┌──────────────────┴───────────┐
│ Licensed on-ramp│──────────────────────▶│  MoonBite Liquidity Desk     │
│/PSP (Stripe,    │   (USDC/USD to us)    │  - quote engine (+spread)    │
│ Transak…)       │                       │  - MBITE hot float (hot/cold)│
│  does KYC+card  │                       │  - instant settle to merchant│
└─────────────────┘                       │  - risk / holdback / limits  │
     ▲                                     └───────────────┬──────────────┘
     │ 0. KYC, 3DS, fraud score                            │ 5. async rebalance
     │                                                     ▼
     └──────────────────────────────────────────  DEX / exchange (buy MBITE with the USDC)
```

**Flow:**
0. Buyer chooses "pay with card." A **licensed on-ramp/PSP does the card charge, KYC and fraud/3DS** (we never see card data).
1–2. The partner settles **USDC/USD to the platform** for the order's quoted value.
3. Quote engine already **locked an MBITE amount** at checkout (price + spread).
4. The desk **immediately sends MBITE from its hot float to the merchant's own address** — merchant stays non-custodial, delivery proceeds exactly as the crypto path (same `createInvoice`/reconcile pipeline, just a different funding source).
5. The desk **rebalances asynchronously** — buys MBITE on a DEX/exchange with the collected USDC to refill the float. Spread covers price drift, slippage, and margin.

**Why this preserves most of the model:** the *merchant* is still non-custodial (MBITE to their wallet, no chargebacks on their side). Only the *platform* takes on the desk role for card buyers. Crypto-native buyers keep the pure non-custodial path untouched.

## 3. Economics (the quote + spread)

Buyer card price = `MBITE_amount × MBITE/USD × (1 + spread) + processor_fee`.

| Cost component | Typical | Who |
|---|---|---|
| Card / PSP fee | ~2.9% + $0.30 | passed to buyer |
| On-ramp/KYC fee | ~1–4% | passed to buyer |
| **Spread** (our margin + price-risk buffer) | **2–5%** | our revenue |
| MBITE sourcing slippage | variable (thin book!) | absorbed by spread |

The **spread must exceed expected MBITE price drift during rebalance + slippage**, or the desk loses money per trade. Thin MBITE liquidity → wider spread → worse buyer price. This is the core economic constraint, and it's why **C (stablecoin settlement) is the safer first step** until MBITE depth exists.

## 4. Chargebacks & fraud (the card tax)

We deliver irreversible MBITE against a reversible charge. Controls:
- **Lean on the partner's fraud stack** (3DS, risk scoring, KYC) — pick providers that assume chargeback liability where possible.
- **Delivery holdback for card orders:** gate high-value/first-time card purchases behind a short settlement/verification window (crypto-native orders stay instant).
- **Per-buyer / per-day limits**, velocity checks, deny-lists.
- **Reserve** to cover disputed-but-delivered orders; price it into the spread.

## 5. Compliance — partner, don't become a bank

Running the desk ourselves = MSB registration (FinCEN), state **money-transmitter licenses** (the expensive part), KYC/AML, sanctions screening, audits. Instead:
- **Use a licensed on-ramp/PSP as the regulated front** (they own card + KYC + much of the money-transmission surface).
- Consider **crypto-broker / liquidity-as-a-service** partners for the USDC→MBITE leg, or a licensed-entity wrapper (BaaS).
- **Geo-gate** to supported jurisdictions; block the rest.
- Keep the MBITE treasury in **multisig + timelocked cold storage**, hot float minimal.
- Get **crypto-literate counsel before launch** — this is the gating item, not code.

## 6. Data model + API surface (additive)

- `PaymentRoute` on an order: `CRYPTO_NATIVE` | `FIAT_ONRAMP`.
- `Quote` (for fiat orders): `fiatAmount`, `fiatCurrency`, `mbiteAmount`, `spreadBps`, `mbitePerUsd`, `expiresAt`, `provider`, `providerRef`.
- `FloatLedger`: MBITE in/out of the hot float + rebalance trades, for reconciliation.
- Endpoints: `POST /onramp/quote` (lock a fiat quote), `POST /onramp/session` (hand off to the partner's hosted widget), `POST /onramp/webhook` (partner settlement callback → trigger desk payout from float), `GET /onramp/status/:id`.
- Reuse the existing delivery/reconcile pipeline: a FIAT order is marked funded by the **webhook** (partner settled) instead of on-chain detection; delivery/entitlement/receipt are identical.

## 7. Phased rollout

| Phase | Scope | Risk |
|---|---|---|
| **F0 — Spike** | Pick a PSP/on-ramp partner; confirm they'll settle USDC/USD to us + assume card/KYC. Legal opinion on our role. | none (research) |
| **F1 — Stablecoin settlement (Option C)** | Card buyers → merchant settles in **USDC** (no MBITE inventory). Quote engine + webhook + holdback. | medium — custody via partner |
| **F2 — Liquidity desk (Option B)** | Add MBITE float + DEX/exchange rebalance → deliver **MBITE** for card orders. | high — inventory, price & chargeback risk, licensing |
| **F3 — Scale** | Multi-currency, better rates via deeper MBITE liquidity, auto-hedging the float. | — |

## 8. Risks & mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **No MBITE liquidity to source** | High | Start with C (USDC settle); seed a market/DEX pool before F2 |
| **Chargeback fraud on delivered MBITE** | High | Partner fraud stack, holdbacks, limits, reserve |
| **Regulatory (unlicensed money transmission)** | High | Licensed partner as front; counsel; geo-gating |
| **Spread < price drift → desk loses money** | Med | Dynamic spread from volatility; cap order size; hedge |
| **Float exhaustion mid-day** | Med | Float monitoring + auto top-up + circuit-breaker to crypto-only |
| **Dilutes "non-custodial" brand** | Med | Keep crypto path pure & default; fiat is an opt-in convenience |

## 9. Decision required (yours, not code)

1. **Settle card buyers in USDC (C) or deliver MBITE (B)?** → B is the thesis-pure answer but needs MBITE liquidity + licensing; C ships sooner.
2. **Which licensed partner** fronts card + KYC (and will they settle to us)?
3. **Are we willing to hold a MBITE float** and the price/chargeback/regulatory risk that comes with it?
4. **Jurisdictions** to support at launch.

Answer #1 and #3 and the build path is clear. The engineering (quote engine, webhook funding, float ledger) is modest and reuses the existing delivery pipeline — **the hard parts are liquidity, licensing, and fraud, not code.**
