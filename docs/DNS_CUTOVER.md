# DNS Cutover: Worker-Only Routing

## EPIC 6 - Story 6.1: Confirm Prod Worker Parity & DNS Cutover

This document describes the DNS cutover process to route all eventangle.com traffic through the Cloudflare Worker, effectively decommissioning GAS (Google Apps Script) as the primary backend.

## Overview

### Before Cutover
```
eventangle.com → Cloudflare Worker → GAS (for HTML, data)
                                   ↘ Worker templates (for some routes)
```

### After Cutover
```
eventangle.com → Cloudflare Worker → Worker templates (HTML)
                                   → Google Sheets API (data)
                                   → GAS (only for shortlinks, legacy RPC)
```

## Prerequisites

Before executing the DNS cutover:

1. **Staging validation passes** - Stage-2 smoke tests must pass on staging
2. **Production parity confirmed** - Run `Prod Parity Check` workflow
3. **Secrets configured** - All production secrets must be set:
   - `GOOGLE_CLIENT_EMAIL`
   - `GOOGLE_PRIVATE_KEY`
   - `SHEETS_SPREADSHEET_ID`
   - `ADMIN_TOKEN`
4. **Rollback plan ready** - Review [ROLLBACK.md](./ROLLBACK.md)

## Cutover Process

### Step 1: Run Production Parity Check

1. Go to GitHub Actions → "Prod Parity Check" workflow
2. Click "Run workflow"
3. Wait for all checks to pass:
   - Staging baseline: PASSED
   - Production health: PASSED
   - API parity: PASSED
   - UI parity: PASSED

If any check fails, **DO NOT PROCEED**. Fix the issue first.

### Step 2: Verify Configuration

Confirm `BACKEND_MODE = "worker"` is set in `cloudflare-proxy/wrangler.toml`:

```toml
[env.production.vars]
BACKEND_MODE = "worker"
```

### Step 3: Deploy to Production

```bash
cd cloudflare-proxy
wrangler deploy --env production
```

Or trigger via CI/CD:
1. Merge to main branch
2. Stage-1 CI runs
3. Stage-2 validates staging
4. Approve production deployment
5. Production deploy executes

### Step 4: Verify Cutover

Run these verification commands:

```bash
# 1. Check Worker headers
curl -s -I https://www.eventangle.com/events | grep -iE "x-proxied-by|x-worker|x-backend"
# Expected: x-proxied-by: eventangle-worker

# 2. Check no GAS HTML leak (blue banner)
curl -s https://www.eventangle.com/events | grep -c "Google Apps Script user"
# Expected: 0

# 3. Check API status
curl -s https://www.eventangle.com/api/status | jq
# Expected: {"ok": true, "backendMode": "worker", ...}

# 4. Check events endpoint
curl -s https://www.eventangle.com/api/v2/events | jq '.ok'
# Expected: true

# 5. Run smoke tests
BASE_URL="https://www.eventangle.com" npm run test:api:smoke
```

### Step 5: Monitor

After cutover, monitor for:

- Error rate in Cloudflare dashboard
- Worker CPU/memory usage
- Response latency
- User reports

## What Changes

### Routes Now Handled by Worker

| Route | Before | After |
|-------|--------|-------|
| `/events` | Worker template | Worker template |
| `/admin` | Worker template | Worker template |
| `/display` | Worker template | Worker template |
| `/poster` | Worker template | Worker template |
| `/report` | Worker template | Worker template |
| `/api/status` | Worker | Worker |
| `/api/v2/events` | Worker → Sheets | Worker → Sheets |
| `/api/v2/events/:id` | Worker → Sheets | Worker → Sheets |
| `/api/v2/events/:id/bundle/*` | Worker → Sheets | Worker → Sheets |

### Routes Still Proxied to GAS

These routes continue to use GAS through the Worker proxy:

| Route | Reason |
|-------|--------|
| `/r`, `/redirect` | Shortlink token resolution |
| `/api/rpc` | Legacy RPC calls (createEvent, recordResult, etc.) |

**Note**: Even these routes go through the Worker - they're just proxied to GAS for execution.

### GAS URLs Now Unused

With `BACKEND_MODE = "worker"`, the following GAS URLs are no longer directly accessed:

- `script.google.com/macros/s/{DEPLOYMENT_ID}/exec?p=admin`
- `script.google.com/macros/s/{DEPLOYMENT_ID}/exec?p=public`
- `script.google.com/macros/s/{DEPLOYMENT_ID}/exec?p=display`
- `script.google.com/macros/s/{DEPLOYMENT_ID}/exec?p=poster`
- `script.google.com/macros/s/{DEPLOYMENT_ID}/exec?p=status`

These URLs may still work if accessed directly, but all production traffic flows through the Worker.

## Rollback

If issues occur after cutover:

### Quick Rollback (Worker Version)

```bash
npm run rollback:prod
```

### Backend Mode Rollback

To revert to GAS-first routing:

1. Edit `cloudflare-proxy/wrangler.toml`:
   ```toml
   [env.production.vars]
   BACKEND_MODE = "gas"  # or "mixed"
   ```

2. Deploy:
   ```bash
   cd cloudflare-proxy
   wrangler deploy --env production
   ```

3. Verify:
   ```bash
   curl -s https://www.eventangle.com/api/status | jq '.backendMode'
   # Expected: "gas" or "mixed"
   ```

## Backend Modes Reference

| Mode | Behavior | Use Case |
|------|----------|----------|
| `gas` | All routes use GAS | Emergency rollback |
| `mixed` | Per-route selection | Gradual migration |
| `worker` | All routes use Worker | **Production (current)** |

## Troubleshooting

### GAS HTML Leak (Blue Banner)

If you see "Google Apps Script user" or a blue banner:

1. Check `BACKEND_MODE` is `worker`
2. Verify Worker templates are bundled correctly
3. Check for errors in Worker logs
4. Rollback if needed

### API Errors

If API endpoints return errors:

1. Check Cloudflare Worker logs
2. Verify secrets are configured (`GOOGLE_*`, `ADMIN_TOKEN`)
3. Check Google Sheets API quotas
4. Test with `?backend=gas` on staging to isolate issue

### Shortlinks Not Working

Shortlinks (`/r/...`) still require GAS:

1. Verify GAS deployment is still running
2. Check `PROD_WEB_APP_URL` is correct in wrangler.toml
3. Test shortlink resolution manually

## Related Documentation

- [ROLLBACK.md](./ROLLBACK.md) - Rollback procedures
- [worker-routing.md](./worker-routing.md) - Worker routing architecture
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment procedures
- [cloudflare-proxy/src/config/backendConfig.js](../cloudflare-proxy/src/config/backendConfig.js) - Backend routing logic

## Timeline

| Date | Event |
|------|-------|
| Story 0.1 | Versioned backend routing introduced |
| Story 4.2 | Staging switched to mixed mode |
| Story 5.2 | Stage-2 smoke tests for production gate |
| **Story 6.1** | **Production DNS cutover to Worker-only** |
| Story 6.2+ | Full GAS decommission (remove GAS code) |
