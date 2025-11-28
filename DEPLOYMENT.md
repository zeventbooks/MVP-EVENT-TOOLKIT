# Deployment Runbook

A boring, step-by-step checklist for shipping a release.

---

## BASE_URL Toggle (Single Toggle: GAS vs EventAngle)

The same test suite runs against either GAS exec URL or eventangle.com by changing `BASE_URL`.

### Quick Reference

```bash
# Test against GAS directly (default in .env.example)
BASE_URL="https://script.google.com/macros/s/XXX/exec" npm run test:smoke

# Test against EventAngle (production via Cloudflare)
BASE_URL="https://www.eventangle.com/events" npm run test:smoke
```

### How It Works

- All API/E2E tests use `process.env.BASE_URL` (or config equivalent)
- Default `BASE_URL` in `.env.example` → Apps Script exec URL
- Tests auto-detect environment type (GAS vs Cloudflare)
- No code changes needed to switch targets

### Configuration

| File | Purpose |
|------|---------|
| `.env.example` | Template with GAS default |
| `tests/config/environments.js` | Environment detection logic |
| `tests/shared/config/test.config.js` | Test configuration using BASE_URL |

---

## 1. Pre-flight (Production Gate)

**Before any production deployment, run:**

```bash
BASE_URL="https://www.eventangle.com/events" npm run ci:all
```

**No green, no deploy.**

This unified gate runs all tests required for a production release:
1. `test:schemas` — schema synchronization validation
2. `test:api-contracts` — explicit API contract validation
3. `test:smoke` — smoke tests (requires Playwright)
4. `test:negative` — negative/edge-case tests

If any test fails, the chain stops immediately.

### Legacy Commands

For granular control, you can still run individual stages:

```bash
npm run test:ci:stage1   # Fast gate: lint + unit + contract
npm run test:ci:stage2   # E2E: API + frontend tests
```

---

## 2. Deploy to Apps Script

```bash
npm run deploy
```

Watch for the deployment URL in the output. It looks like:

```
https://script.google.com/macros/s/AKfycbx.../exec
```

Copy the deployment ID (the `AKfycbx...` part) - you'll need it for step 4.

---

## 3. Verify GAS Deployment

Hit the exec URL directly to confirm the new build is live:

```
https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?page=status&brand=root
```

Confirm:
- `"ok": true`
- `"buildId"` matches the version you just deployed (check `src/mvp/Config.gs` for BUILD_ID)

---

## 4. Update Cloudflare Worker

If the DEPLOYMENT_ID changed (it does on each deploy):

1. Edit `cloudflare-proxy/wrangler.toml`
2. Update `GAS_DEPLOYMENT_BASE_URL` in `[env.events.vars]`:

```toml
[env.events.vars]
# The full Google Apps Script exec URL - this is the production backend
GAS_DEPLOYMENT_BASE_URL = "https://script.google.com/macros/s/AKfycbx.../exec"
DEPLOYMENT_ID = "AKfycbx..."
```

3. Deploy the worker:

```bash
cd cloudflare-proxy && wrangler deploy --env events
```

**Important:** The `--env events` flag deploys to the production EventAngle routes:
- `eventangle.com/events*`
- `www.eventangle.com/events*`

All requests are proxied (not redirected), so `script.google.com` is never user-facing.

---

## 5. Verify eventangle.com

Hit these URLs in a browser to confirm the proxy is working:

**Page routes (HTML via proxy):**
- https://www.eventangle.com/events?page=admin - Admin panel
- https://www.eventangle.com/events?page=public - Public event listing
- https://www.eventangle.com/events?page=display - TV/kiosk display
- https://www.eventangle.com/events?page=poster - Printable poster
- https://www.eventangle.com/events?page=report - Analytics report
- https://www.eventangle.com/events?page=status&brand=root - Status/health

**Friendly URL routes:**
- https://www.eventangle.com/manage - Admin (via path)
- https://www.eventangle.com/display - Display (via path)
- https://www.eventangle.com/abc/events - Brand-specific public page

**Verify:** The browser address bar should always show `eventangle.com`, never `script.google.com`.

---

## 6. Run Smoke Tests

```bash
BASE_URL="https://www.eventangle.com/events" npm run test:health
BASE_URL="https://www.eventangle.com/events" npm run test:smoke
```

Both should pass. If they fail, check:
- DEPLOYMENT_ID mismatch between GAS and Cloudflare
- BUILD_ID mismatch between deployed code and local Config.gs

---

## Quick Reference

| Step | Command |
|------|---------|
| **Pre-flight (gate)** | `BASE_URL="https://www.eventangle.com/events" npm run ci:all` |
| Deploy GAS | `npm run deploy` |
| Deploy CF Worker | `cd cloudflare-proxy && wrangler deploy --env events` |
| Health check | `BASE_URL="https://www.eventangle.com/events" npm run test:health` |
| Smoke test | `BASE_URL="https://www.eventangle.com/events" npm run test:smoke` |

---

## Rollback

If something goes wrong:

1. In Apps Script: Deploy > Manage deployments > select previous version
2. Update `DEPLOYMENT_ID` in `cloudflare-proxy/wrangler.toml` to the old ID
3. Redeploy: `cd cloudflare-proxy && wrangler deploy --env events`
