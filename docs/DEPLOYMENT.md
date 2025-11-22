# Deployment Guide

**Last Updated:** 2025-11-22
**Status:** MVP v1.0 - Focus Group Ready

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Configuration](#project-configuration)
3. [Environment URLs](#environment-urls)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [GitHub Secrets](#github-secrets)
6. [Setup Requirements](#setup-requirements)
7. [QA Environment Setup](#qa-environment-setup)
8. [Local Development](#local-development)
9. [Verification](#verification)
10. [Troubleshooting](#troubleshooting)

---

## Quick Start: Running Tests Locally

### Stage 1 (Fast Gate - Must Pass Before Deploy)

```bash
npm run test:ci:stage1
```

This runs:
- `npm run lint` - ESLint code quality
- `npm run test:unit` - Unit tests (~512 tests)
- `npm run test:contract` - Contract tests (~155 tests)

**If Stage 1 is red, do not merge.**

### Stage 2 (E2E Browser Tests)

```bash
# Install Playwright first (one time)
npx playwright install

# Run Stage 2
npm run test:ci:stage2
```

This runs:
- `npm run test:api` - API integration tests
- `npm run test:fe` - Frontend E2E (smoke + pages + flows)

Requires `BASE_URL` environment variable pointing to deployed app.

---

## Current Live Build

| Field | Value |
|-------|-------|
| **BUILD_ID** | Check Admin footer or `?p=status&brand=root` |
| **Deployment URL** | https://script.google.com/macros/s/AKfycbxaTPh3FS4NHJblIcUrz4k01kWAdxsKzLNnYRf0TXe18lBditTm3hqbBoQ4ZxbGhhGuCA/exec |
| **Custom Domain** | eventangle.com |

To check current version:
```bash
curl "DEPLOYMENT_URL?p=status&brand=root" | jq '.value.version'
```

---

## Deployment Options

### Option 1: GitHub Actions (Recommended)

Push to `main` branch - automatic deployment:

```bash
git add .
git commit -m "feat: your changes"
git push origin main
```

### Option 2: Clasp CLI

```bash
npm run push    # Push code to Apps Script
npm run deploy  # Create new deployment
```

### Option 3: Manual Deploy

1. Open [Apps Script Editor](https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit)
2. Copy/paste all `.gs` and `.html` files
3. Deploy → New deployment → Web app
4. Execute as: **Me** | Access: **Anyone**

---

## Project Configuration

### Google Cloud Project

| Setting | Value |
|---------|-------|
| **Project ID** | `zeventbooks` |
| **Console** | https://console.cloud.google.com/home/dashboard?project=zeventbooks |
| **Service Accounts** | https://console.cloud.google.com/iam-admin/serviceaccounts?project=zeventbooks |

### Apps Script Project

| Setting | Value |
|---------|-------|
| **Script ID** | `1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l` |
| **Project URL** | https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit |
| **Deployment URL** | https://script.google.com/macros/s/AKfycbxaTPh3FS4NHJblIcUrz4k01kWAdxsKzLNnYRf0TXe18lBditTm3hqbBoQ4ZxbGhhGuCA/exec |

### Service Account

| Setting | Value |
|---------|-------|
| **Email** | `apps-script-deployer@zeventbooks.iam.gserviceaccount.com` |
| **Unique ID** | `103062520768864288562` |
| **Purpose** | Automated CI/CD deployment |
| **Required Scopes** | `script.projects`, `script.deployments`, `script.webapp.deploy` |

---

## Environment URLs

| Environment | URL | Purpose | Status |
|-------------|-----|---------|--------|
| **QA** | `https://qa.zeventbooks.com` | Testing & validation | Active |
| **Dev** | `https://dev.zeventbooks.com` | Development | Planned |
| **Production** | `https://app.zeventbooks.com` | Live application | Planned |

### Brand-Specific Access

```
# QA environment examples
https://qa.zeventbooks.com?p=events&brand=root
https://qa.zeventbooks.com?p=events&brand=abc
https://qa.zeventbooks.com?p=events&brand=cbc
```

---

## CI/CD Pipeline

### Pipeline Flow

```
Push to main
    │
    ▼
┌─────────────────┐
│   Lint + Test   │  Unit tests, ESLint
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Contract Tests  │  API schema validation
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│     Deploy      │  Clasp push + deploy
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Verify Deploy  │  Health check
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   E2E Tests     │  Smoke → Pages → Flows
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Quality Gate   │  All must pass
└─────────────────┘
```

### Quality Gate Requirements

All of these must pass:
- Lint
- Unit Tests (>80% coverage)
- Contract Tests
- Deploy (main branch only)
- E2E Smoke Tests
- E2E Page Tests
- E2E Flow Tests

---

## GitHub Secrets

Configure at: https://github.com/zeventbooks/MVP-EVENT-TOOLKIT/settings/secrets/actions

| Secret | Purpose |
|--------|---------|
| `APPS_SCRIPT_SERVICE_ACCOUNT_JSON` | Service account key (complete JSON file) |
| `SCRIPT_ID` | `1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l` |
| `ADMIN_KEY_ROOT` | Admin API key for testing |

---

## Setup Requirements

### 1. Enable Apps Script API (GCP Console)

1. Go to: https://console.cloud.google.com/apis/library?project=zeventbooks
2. Search: "Apps Script API"
3. Click **ENABLE**

### 2. Enable Apps Script API (User Settings)

**CRITICAL - Project owner must do this:**

1. Go to: https://script.google.com/home/usersettings
2. Find: "Google Apps Script API"
3. Toggle **ON**

This is required for service account deployments to work.

### 3. Grant Service Account Access

1. Open Apps Script project: https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit
2. Click **Share** (top right)
3. Add: `apps-script-deployer@zeventbooks.iam.gserviceaccount.com`
4. Role: **Editor**
5. Uncheck "Notify people"
6. Click **Share**

---

## QA Environment Setup

### Hostinger Redirect Setup (30 minutes)

1. **Get Deployment URL**
   - From GitHub Actions job summary, OR
   - From Apps Script: Deploy → Manage deployments

2. **Create Redirect in Hostinger**
   - Log into https://hpanel.hostinger.com
   - Go to **Domains** → **zeventbooks.com** → **Redirects**
   - Click **Create Redirect**
   - Configure:
     - Type: 301 or 302
     - Source: `qa.zeventbooks.com`
     - Destination: `[YOUR_APPS_SCRIPT_URL]`
     - Include path: Yes

3. **Test It**
   ```bash
   curl -I https://qa.zeventbooks.com
   # Should show redirect to Apps Script URL
   ```

4. **Run Stage 2**
   - Go to GitHub Actions
   - Run "Stage 2 - Testing & QA"
   - Enter: `https://qa.zeventbooks.com`

---

## Local Development

### First-Time Setup

```bash
# Install dependencies
npm ci

# Login to Clasp (one time)
clasp login

# Verify setup
npm run deploy:diagnose
```

### Development Workflow

```bash
# Pull latest from Apps Script
clasp pull

# Make changes locally...

# Run tests
npm test

# Push to Apps Script
npm run push

# Create deployment
npm run deploy
```

### Testing Commands

```bash
# Unit tests only
npm run test:unit

# Contract tests only
npm run test:contract

# Quick validation
npm run test:quick

# All tests
npm run test:all

# E2E tests (requires deployed app)
BASE_URL=<url> ADMIN_KEY=<key> npm run test:e2e

# Triangle flow tests
npm run test:triangle
npm run test:triangle:parallel
```

---

## Verification

### Run Setup Diagnostics

```bash
curl "YOUR_DEPLOYMENT_URL?p=setup&brand=root"
```

This checks:
- Brand configuration
- Spreadsheet access
- Admin secrets
- Deployment configuration
- OAuth scopes
- Database structure

### Health Check

```bash
curl "YOUR_DEPLOYMENT_URL?p=status&brand=root"
```

Expected:
```json
{ "ok": true, "value": { "status": "healthy" } }
```

### Test All Surfaces

| Surface | URL |
|---------|-----|
| Admin | `?p=admin&brand=root` |
| Public | `?p=public&brand=root` |
| Display | `?p=display&brand=root` |
| Poster | `?p=poster&brand=root&eventId=EVT_xxx` |
| Status | `?p=status&brand=root` |

---

## Troubleshooting

### "User has not enabled the Apps Script API"

**This causes 90% of deployment failures.**

**Fix:**
1. Go to: https://script.google.com/home/usersettings
2. Toggle ON: "Google Apps Script API"
3. Wait 2-5 minutes
4. Retry deployment

### "Script not found"

**Fix:**
1. Verify `SCRIPT_ID` is correct
2. Check service account has Editor access
3. Run: `clasp open` to verify access

### "Token expired"

**Fix:**
1. Re-login: `clasp login`
2. Get new `.clasprc.json` contents
3. Update `CLASPRC_JSON` GitHub secret

### "Permission denied"

**Fix:**
1. Share Apps Script project with service account
2. Grant **Editor** access
3. Retry deployment

### CLASPRC_JSON validation fails

**Fix:**
1. Run: `./scripts/validate-clasp-setup.sh`
2. Check JSON: `cat ~/.clasprc.json | jq .`
3. Re-login: `clasp logout && clasp login`
4. Update GitHub secret

### QA environment not accessible

**Fix:**
1. Check Hostinger redirect is configured
2. Verify redirect target URL is correct
3. Test Apps Script URL directly
4. Check DNS: https://dnschecker.org

---

## Security Notes

- **Never commit** service account JSON to git
- **Never expose** SCRIPT_ID or ADMIN_KEY in logs
- Store credentials in GitHub Secrets (encrypted at rest)
- Rotate service account keys every 90 days
- Use principle of least privilege (Editor, not Owner)

---

## Files to Deploy

### Backend (.gs)

12 files form the runtime spine:

| File | Purpose |
|------|---------|
| Code.gs | Router + API endpoints |
| Config.gs | Brands, templates, feature flags |
| TemplateService.gs | Event templates |
| ApiSchemas.gs | API contracts |
| EventService.gs | Event CRUD |
| FormService.gs | Google Forms |
| SponsorService.gs | Sponsor management |
| SharedReporting.gs | Analytics views |
| AnalyticsService.gs | Logging |
| SecurityMiddleware.gs | Auth/security |
| i18nService.gs | Multi-lang (deferred) |
| WebhookService.gs | Integrations (deferred) |

### Frontend (.html)

6 MVP surfaces + supporting files:

| File | Purpose |
|------|---------|
| Admin.html | Event management |
| Public.html | Mobile event page |
| Display.html | TV/kiosk display |
| Poster.html | Print/QR |
| Sponsor.html | Sponsor portal |
| SharedReport.html | Analytics |

---

## Related Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - MVP architecture overview
- **[FRIENDLY_URLS.md](./FRIENDLY_URLS.md)** - URL aliasing system
- **[SETUP_DIAGNOSTICS.md](./SETUP_DIAGNOSTICS.md)** - Setup verification endpoint

---

*Deployment Guide - MVP v1.0*
