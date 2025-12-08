# Production Rollback Procedures

This document describes rollback procedures for production deployments when Story 7 sanity checks fail or other deployment issues occur.

## Quick Reference

| Issue | Rollback Target | Command |
|-------|-----------------|---------|
| GAS HTML leak (blue banner) | Previous Worker | `wrangler deploy --env production` with old ID |
| API/RPC errors | Previous GAS deployment | Use Apps Script Editor |
| Worker routing broken | Previous Worker | Cloudflare Dashboard or wrangler |
| Everything broken | Both GAS + Worker | Full rollback (see below) |

## When to Rollback

Rollback is required when any of these conditions occur:

1. **Stage-2 production validation fails**
   - GAS HTML integrity check fails (blue banner visible)
   - UI smoke tests fail
   - API smoke tests fail

2. **Production sanity checks fail (Story 7)**
   - `/events` shows GAS blue banner
   - Admin UI not visible on `/admin`
   - Network calls bypass `/api/*` endpoints
   - QR codes not resolving correctly

3. **Error rate increase**
   - Worker error logs spike
   - GAS error logs spike
   - User reports increase

## Rollback Procedures

### Option A: Cloudflare Worker Rollback (Fast)

Use this when Worker routing is broken but GAS is working.

**Via Wrangler CLI:**

```bash
# 1. Check current deployment
wrangler deployments list --env production

# 2. Identify previous working version
# Note the deployment ID (e.g., abc123)

# 3. Rollback to previous version
wrangler rollback --env production <deployment-id>

# 4. Verify rollback
curl -s https://www.eventangle.com/events -I | grep x-worker-version
```

**Via Cloudflare Dashboard:**

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com)
2. Select account → Workers & Pages → eventangle-prod
3. Go to Deployments tab
4. Find previous working deployment
5. Click "Rollback to this deployment"

### Option B: GAS Deployment Rollback

Use this when GAS (API/data) is broken but Worker is working.

**Via Apps Script Editor:**

1. Go to [Google Apps Script](https://script.google.com/)
2. Open the Production project (Script ID: `1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l`)
3. Click Deploy → Manage deployments
4. Find previous working deployment
5. Click the three dots (⋮) → Use as active deployment

**After GAS Rollback:**

Update the Worker to use the old GAS deployment ID:

```bash
cd cloudflare-proxy

# Update wrangler.toml with old deployment ID
# Edit [env.production.vars] DEPLOYMENT_ID

# Redeploy worker
wrangler deploy --env production
```

### Option C: Full Rollback (Both GAS + Worker)

Use when everything is broken.

**Step 1: Rollback GAS**

```bash
# List recent deployments
clasp deployments

# Note the previous working deployment ID (AKfycb...)
```

Then in Apps Script Editor:
- Switch active deployment to the previous version

**Step 2: Update Worker with old GAS ID**

```bash
cd cloudflare-proxy

# Update wrangler.toml
sed -i 's/DEPLOYMENT_ID = ".*"/DEPLOYMENT_ID = "OLD_DEPLOYMENT_ID"/' wrangler.toml

# Deploy worker
wrangler deploy --env production
```

**Step 3: Verify**

```bash
# Check Worker
curl -s https://www.eventangle.com/events -I

# Should see:
# x-proxied-by: eventangle-worker
# x-worker-version: X.X.X

# Check GAS (Status API)
curl -s "https://www.eventangle.com/?p=status&brand=root" | jq
```

## Deployment IDs Reference

### Current Production Configuration

| Component | Location | ID/URL |
|-----------|----------|--------|
| GAS Script ID | `.clasp.json` | `1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l` |
| GAS Deployment ID | `wrangler.toml` | Check `[env.production.vars]` |
| Worker Name | Cloudflare | `eventangle-prod` |
| Production URL | DNS | `www.eventangle.com` |

### Finding Previous Deployment IDs

**GAS Deployment IDs:**

```bash
# Via clasp
clasp deployments

# Output shows all deployments with IDs
```

**Worker Deployment IDs:**

```bash
# Via wrangler
wrangler deployments list --env production
```

## Verification After Rollback

After any rollback, verify the following:

### 1. No GAS Blue Banner

```bash
# Should NOT contain "Google Apps Script user"
curl -s https://www.eventangle.com/events | grep -c "Google Apps Script user"
# Expected: 0
```

### 2. Worker Headers Present

```bash
curl -s https://www.eventangle.com/events -I | grep -E "x-proxied-by|x-worker-version"
# Expected:
# x-proxied-by: eventangle-worker
# x-worker-version: X.X.X
```

### 3. Status API Working

```bash
curl -s "https://www.eventangle.com/?p=status&brand=root" | jq
# Expected: {"ok": true, "buildId": "...", ...}
```

### 4. Admin UI Loads

```bash
curl -s https://www.eventangle.com/admin | grep -c "Create Event"
# Expected: > 0
```

### 5. Run Smoke Tests

```bash
BASE_URL="https://www.eventangle.com" npm run test:api:smoke
```

## Prevention Checklist

Before any production deployment:

- [ ] Stage-1 validation passes
- [ ] Staging deploy succeeds
- [ ] Stage-2 staging validation passes
- [ ] GAS HTML integrity check passes
- [ ] All smoke tests pass on staging
- [ ] Tag follows semver format (vX.Y.Z)

## Contact & Escalation

If rollback fails or issues persist:

1. Check Cloudflare Dashboard for Worker errors
2. Check Google Cloud Console for GAS errors
3. Review GitHub Actions logs for deployment details
4. Check `#deployment` channel for team updates

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment procedures
- [worker-routing.md](./worker-routing.md) - Worker routing architecture
- [ci-cd-architecture.md](./ci-cd-architecture.md) - CI/CD pipeline details
