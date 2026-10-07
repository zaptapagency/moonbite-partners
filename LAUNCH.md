# Launch runbook — MoonBite Partners

How to take the stack from "built" to "live". The app **enforces** the hard gates:
it refuses to boot in production with missing/placeholder secrets
([env.validation.ts](apps/api/src/config/env.validation.ts)) and `/ready` reports whether
it's fit to accept funds. Nothing here can be skipped by config alone.

## ⛔ Hard gates (must all be true before accepting real money)

1. **MBITE network params confirmed.** The `MBITE_*` params default to *placeholders*.
   Set them from MBITE's real chainparams, then verify a derived address resolves on the
   MBITE block explorer. `/ready` returns `mbiteParamsConfirmed: false` until you set
   `MBITE_BECH32_HRP` (and the rest).
2. **A real test payment** flows `AWAITING_PAYMENT → DETECTED → PAID → FULFILLED` against
   the live node (use a small amount first).
3. **Node reachable** over JSON-RPC with `txindex=1` and ZMQ publishers enabled.
4. **Secrets set** (below) — the API won't start otherwise.
5. **SMTP verified** — `/ready` shows `smtpMode: "smtp"`, not `"dev-log"`.
6. **Backups** configured for Postgres.

## 1. Generate + set secrets

```bash
sh scripts/generate-secrets.sh    # prints JWT_SECRET, DOWNLOAD_URL_SECRET, POSTGRES_PASSWORD
```

Set every value from [.env.production.example](.env.production.example) in your store:

| Where | Keys |
|---|---|
| **GitHub → Secrets** | `SSH_HOST` `SSH_USER` `SSH_KEY` (`SSH_PORT`), `JWT_SECRET` `DOWNLOAD_URL_SECRET` `POSTGRES_PASSWORD`, `SMTP_HOST` `SMTP_USER` `SMTP_PASS`, `MBITE_RPC_URL` `MBITE_RPC_USER` `MBITE_RPC_PASSWORD` |
| **GitHub → Variables** | `WEB_BASE_URL` `PUBLIC_BASE_URL` `CORS_ORIGINS` `SMTP_PORT` `MAIL_FROM` `STORAGE_BASE_URL` `DEPLOY_HEALTH_URL`, `MBITE_ZMQ_RAWTX` `MBITE_ZMQ_RAWBLOCK` `MBITE_BECH32_HRP` `MBITE_PUBKEYHASH` `MBITE_SCRIPTHASH` `MBITE_WIF` `MBITE_BIP32_PUBLIC` `MBITE_BIP32_PRIVATE` |
| **Build-time (web image)** | repo var `NEXT_PUBLIC_API_BASE_URL` = your public API URL |

## 2. Deploy

**Via CI (recommended):** push to the default branch → `verify → e2e → publish (GHCR) →
deploy (SSH) → smoke test → auto-rollback`. The deploy job is skipped until `SSH_HOST` is set.

**Manually on the host:**
```bash
# with .env holding the production values next to the compose file
API_IMAGE=ghcr.io/<owner>/<repo>-api:latest \
WEB_IMAGE=ghcr.io/<owner>/<repo>-web:latest \
docker compose -f docker-compose.prod.yml up -d
```
The API runs `prisma migrate deploy` on boot.

## 3. Verify live

```bash
curl -s https://api.yourdomain.com/health   # liveness → 200 {"status":"ok"}
curl -s https://api.yourdomain.com/ready     # go/no-go: all checks true?
```
`/ready` must show `mbiteNodeReachable`, `mbiteParamsConfirmed`, and `smtpOk` all `true`.
Then run the real test payment (gate #2) and process a test refund.

## 4. Post-launch

- Set a repo variable `DEPLOY_HEALTH_URL=https://api.yourdomain.com/ready` so CI also
  checks external reachability after each deploy.
- Monitor `/ready`; alert if it flips to `ready: false`.
- Rotate `JWT_SECRET` / `DOWNLOAD_URL_SECRET` on a schedule.
- Review the prohibited-goods policy enforcement and merchant KYC tiers (PLAN.md §5/§9).

## Still open (not launch-blocking, see PLAN.md)

Redis-backed rate-limit storage for multi-instance, metrics/Sentry, partial refunds,
USD price oracle, MWEB payment support.
