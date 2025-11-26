# Deployment Runbook

A boring, step-by-step checklist for shipping a release.

---

## 1. Pre-flight

```bash
npm run test:ci:stage1
```

This runs lint + unit tests + contract tests. **Must pass before deploy.**

Optional but recommended:

```bash
npm run test:ci:stage2
```

This runs API and frontend E2E tests against the current deployment.

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
2. Update `DEPLOYMENT_ID` in `[env.events.vars]`:

```toml
[env.events.vars]
DEPLOYMENT_ID = "AKfycbx..."
```

3. Deploy the worker:

```bash
cd cloudflare-proxy && wrangler deploy --env events
```

---

## 5. Verify eventangle.com

Hit these URLs in a browser to confirm the proxy is working:

- https://www.eventangle.com/events?page=status&brand=root
- https://www.eventangle.com/manage
- https://www.eventangle.com/abc/events

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
| Pre-flight | `npm run test:ci:stage1` |
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
