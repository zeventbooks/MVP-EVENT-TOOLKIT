# Apps Script Project Configuration

**Last Updated:** 2025-12-01
**Status:** Production

---

## Production Deployment

There is **ONE** production Apps Script deployment. All production traffic routes through this deployment.

| Setting | Value |
|---------|-------|
| **Script ID** | `1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l` |
| **Project URL** | https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit |
| **Deployment URL** | https://script.google.com/macros/s/AKfycbxaTPh3FS4NHJblIcUrz4k01kWAdxsKzLNnYRf0TXe18lBditTm3hqbBoQ4ZxbGhhGuCA/exec |
| **Production Domain** | https://eventangle.com |

---

## Deployment Policy

> **CI-ONLY PRODUCTION DEPLOYMENT**
>
> Production deployments are **exclusively** performed through GitHub Actions.
> Manual deployments (clasp push, copy/paste) are prohibited for production.

See [PRODUCTION_DEPLOYMENT_POLICY.md](./PRODUCTION_DEPLOYMENT_POLICY.md) for full policy details.

### Who Can Deploy to Production

Only GitHub Actions CI/CD pipeline, triggered by:
- **Push to `main` branch** - After PR merge
- **Push to `release/*` branches** - Release deployments

### What CI Does

1. Runs all quality gates (lint, unit tests, contract tests, MVP guards)
2. Deploys to Apps Script via clasp
3. Updates Cloudflare Worker (if configured)
4. Triggers Stage 2 E2E testing

---

## Google Cloud Project

| Setting | Value |
|---------|-------|
| **Project ID** | `zeventbooks` |
| **Console** | https://console.cloud.google.com/home/dashboard?project=zeventbooks |
| **Service Accounts** | https://console.cloud.google.com/iam-admin/serviceaccounts?project=zeventbooks |

---

## Service Account (CI/CD)

| Setting | Value |
|---------|-------|
| **Email** | `apps-script-deployer@zeventbooks.iam.gserviceaccount.com` |
| **Purpose** | Automated CI/CD deployment only |
| **Required Scopes** | `script.projects`, `script.deployments`, `script.webapp.deploy` |

---

## Local Development (Dev/Stage Only)

For local development and testing against non-production environments:

```bash
# Pull latest from Apps Script
clasp pull

# Push to dev/staging (NOT production)
clasp push

# Create new deployment (for testing only)
clasp deploy -d "Dev test deployment"
```

**These commands are for development/staging only. Never use them for production.**

---

## Related Documentation

- [PRODUCTION_DEPLOYMENT_POLICY.md](./PRODUCTION_DEPLOYMENT_POLICY.md) - CI-only production policy
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Full deployment guide
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment runbook
