# Apps Script Project Configuration

**Last Updated:** 2025-12-05
**Status:** Production
**Owner:** zeventbook@gmail.com (REQUIRED)

---

## ⚠️ CRITICAL: Script Ownership Requirements

**All Apps Script projects MUST be owned by `zeventbook@gmail.com`.**

This prevents authentication issues where Google OAuth may switch to a personal account (e.g., mzdano) during `clasp push` or `clasp deploy` operations.

### Quick Ownership Check

1. Open the Script URL in browser
2. Go to **Project Settings** (gear icon)
3. Verify **Owner** shows `zeventbook@gmail.com`

If owner is NOT zeventbook@gmail.com, follow the [Ownership Migration](#ownership-migration) section below.

---

## Production Deployment

There is **ONE** production Apps Script deployment. All production traffic routes through this deployment.

| Setting | Value |
|---------|-------|
| **Script ID** | `1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l` |
| **Project URL** | https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit |
| **Deployment URL** | https://script.google.com/macros/s/AKfycbxaTPh3FS4NHJblIcUrz4k01kWAdxsKzLNnYRf0TXe18lBditTm3hqbBoQ4ZxbGhhGuCA/exec |
| **Production Domain** | https://eventangle.com |
| **Owner** | `zeventbook@gmail.com` ✓ |

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

## Staging Deployment

| Setting | Value |
|---------|-------|
| **Script ID** | `1gHiPuj7eXNk09dDyk17SJ6QsCJg7LMqXBRrkowljL3z2TaAKFIvBLhHJ` |
| **Project URL** | https://script.google.com/home/projects/1gHiPuj7eXNk09dDyk17SJ6QsCJg7LMqXBRrkowljL3z2TaAKFIvBLhHJ/edit |
| **Config File** | `.clasp-staging.json` |
| **Staging URL** | https://stg.eventangle.com |
| **Owner** | `zeventbook@gmail.com` (REQUIRED) |

### GitHub Secrets

| Secret | Purpose | Value |
|--------|---------|-------|
| `OAUTH_CREDENTIALS` | Production deployments | `~/.clasprc.json` content |
| `STAGING_SCRIPT_ID` | Staging Script ID | `1gHiPuj7eXNk09dDyk17SJ6QsCJg7LMqXBRrkowljL3z2TaAKFIvBLhHJ` |

Note: The same `OAUTH_CREDENTIALS` works for both prod and staging since both scripts are owned by zeventbook@gmail.com.

---

## Ownership Migration

If a Script is owned by the wrong account (e.g., mzdano instead of zeventbook):

### Option A: Transfer Ownership (Preferred)

1. Open the Script project in the browser
2. Click **Share** button
3. Add `zeventbook@gmail.com` as Editor
4. Current owner: **Settings** → **Transfer ownership** → select zeventbook@gmail.com
5. Accept the transfer from zeventbook@gmail.com inbox

### Option B: Create New Project (If Transfer Fails)

1. Log in to a **clean browser profile** with ONLY `zeventbook@gmail.com`
2. Go to https://script.google.com
3. Create **New project**
4. Name it appropriately (Production or Staging)
5. Copy the new Script ID
6. Update the relevant `.clasp*.json` file
7. Run `clasp push` to deploy code to the new project
8. Update `DEPLOYMENT_ID` secret in GitHub if needed

---

## Clasp Login Setup

### Step 1: Clean Existing Credentials

```bash
# Remove any stale credentials
rm ~/.clasprc.json

# Verify no old credential files
ls -la ~/.clasp*.json 2>/dev/null || echo "No stale files found"
```

### Step 2: Login as zeventbook@gmail.com

```bash
# Use a clean browser profile logged in ONLY as zeventbook@gmail.com
clasp login --no-localhost
```

**IMPORTANT:** When the OAuth screen opens:
- Verify the account shown is `zeventbook@gmail.com`
- If it shows mzdano or another account, cancel and use a private/incognito window

### Step 3: Verify Login

```bash
# List accessible scripts - should show zeventbook projects
clasp list

# Verify clasprc.json contains zeventbook token
cat ~/.clasprc.json | jq '.oauth2ClientSettings'
```

### Step 4: Update GitHub Secret

After successful login, copy the credentials to GitHub:

```bash
# Copy the entire clasprc.json content
cat ~/.clasprc.json

# Then update OAUTH_CREDENTIALS secret in GitHub:
# Settings → Secrets and variables → Actions → OAUTH_CREDENTIALS
```

---

## Ownership Verification

### Automated Verification

Run the automated ownership verification script:

```bash
npm run clasp:verify-ownership
```

This script checks:
- clasp login status
- Production config (.clasp.json)
- Staging config (.clasp-staging.json)
- API access via `clasp list`

### Manual Checklist

Run this checklist to verify proper ownership:

- [ ] **Local clasp login**: `clasp list` shows only zeventbook-owned projects
- [ ] **Production Script**: Open [Production URL](https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit) → Settings → Owner = zeventbook@gmail.com
- [ ] **Staging Script**: Open staging project → Settings → Owner = zeventbook@gmail.com
- [ ] **GitHub Secret**: `OAUTH_CREDENTIALS` contains zeventbook credentials
- [ ] **Test Push**: `clasp push` succeeds without auth errors
- [ ] **Test Deploy**: `clasp deployments` shows zeventbook deployments

---

## Acceptance Criteria for Ownership

1. `.clasp.json` (prod) points to Script ID owned by zeventbook@gmail.com
2. `.clasp-staging.json` (stg) points to Script ID owned by zeventbook@gmail.com
3. `clasp push` + `clasp deployments` from this repo shows only zeventbook deployments
4. Opening both staging and prod Apps Script projects in browser shows owner = zeventbook@gmail.com
5. GitHub Actions deployments succeed using zeventbook credentials

---

## Automated Environment Setup

The repository includes comprehensive automation for environment setup and validation.

### Quick Setup (New Developer)

```bash
# 1. Full environment check and auto-fix
npm run setup:clasp:fix

# 2. Verify ownership
npm run clasp:verify-ownership

# 3. Deploy to staging (automated)
npm run deploy:staging:auto
```

### Available Automation Commands

| Command | Description |
|---------|-------------|
| `npm run setup:clasp` | Interactive environment setup |
| `npm run setup:clasp:check` | Check environment (no changes) |
| `npm run setup:clasp:fix` | Auto-fix configuration issues |
| `npm run setup:clasp:ci` | CI mode (exit codes only) |
| `npm run clasp:verify-ownership` | Verify zeventbook ownership |
| `npm run validate:secrets` | Validate CI secrets requirements |
| `npm run validate:secrets:stage1` | Validate Stage 1 secrets |
| `npm run validate:secrets:stage2` | Validate Stage 2 secrets |
| `npm run deploy:staging:auto` | Automated staging deployment |
| `npm run deploy:staging:check` | Pre-flight check for staging |
| `npm run deploy:staging:verify` | Verify staging deployment |

### CI Environment Validation

The `validate-environment.yml` workflow automatically validates:

1. **Configuration Files** - `.clasp.json`, `.clasp-staging.json`, `appsscript.json`
2. **Stage 1 Secrets** - `OAUTH_CREDENTIALS`, `DEPLOYMENT_ID`, Cloudflare secrets
3. **Stage 2 Secrets** - Admin keys, spreadsheet IDs per brand

Runs automatically on:
- PRs that modify configuration files
- Pushes to main that modify configuration
- Manual trigger for debugging

### Self-Healing Features

The automation scripts include:

- **Auto-fix mode** - Repairs common configuration issues
- **Retry logic** - Handles transient API failures
- **Config restoration** - Always restores production config after staging operations
- **Clear error messages** - Provides actionable fix instructions

### Required GitHub Secrets

| Secret | Required | Purpose |
|--------|----------|---------|
| `OAUTH_CREDENTIALS` | ✅ Yes | Clasp authentication (zeventbook@gmail.com) |
| `DEPLOYMENT_ID` | Optional | Production deployment ID |
| `ADMIN_KEY_ROOT` | For Stage 2 | Root brand admin key |
| `ADMIN_KEY_ABC` | Optional | ABC brand admin key |
| `ADMIN_KEY_CBC` | Optional | CBC brand admin key |
| `ADMIN_KEY_CBL` | Optional | CBL brand admin key |
| `SPREADSHEET_ID` | Optional | Fallback spreadsheet ID |
| `CLOUDFLARE_API_TOKEN` | Optional | Cloudflare Worker updates |
| `CLOUDFLARE_ACCOUNT_ID` | Optional | Cloudflare Worker updates |

---

## Related Documentation

- [PRODUCTION_DEPLOYMENT_POLICY.md](./PRODUCTION_DEPLOYMENT_POLICY.md) - CI-only production policy
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Full deployment guide
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment runbook
- [STAGING_SETUP.md](./STAGING_SETUP.md) - Staging environment setup
