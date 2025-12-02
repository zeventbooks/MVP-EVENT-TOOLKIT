# Zeventbook MVP (Events-only)

**Build:** mvp-v1.0-events-only
**Date:** 20251107-194908

## 🎯 Single Unified Deployment

**All code in this repository deploys to ONE Google Apps Script project:**

```
Project ID: 1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l
```

📖 **See [APPS_SCRIPT_PROJECT.md](./APPS_SCRIPT_PROJECT.md) for complete deployment details**

---

## What's here
- **REST API** - Build custom frontends in React, Vue, mobile apps!
- **3 Authentication Methods** - adminKey, JWT tokens, API key header
- **Interactive API Docs** - Test endpoints right in your browser!
- **5 MVP Surfaces** - Admin, Public, Display, Poster, SharedReport (LOCKED for focus groups)
- **Experimental Pages** - ApiDocs, Diagnostics, Signup, Test (labeled v2+)
- Multi-brand config (events-only flags)
- Uniform API envelopes, DIAG logging, idempotency, rate-limits
- SWR helper (etag + localStorage)
- Styles: your patched `Styles.html` + DesignAdapter map

## MVP Status

**Surfaces are LOCKED for focus group testing.** Each MVP page has a header comment:

```
MVP SURFACE - Focus Group Critical
Status: LOCKED for MVP v1.0
```

| Surface | Purpose | Status |
|---------|---------|--------|
| Admin.html | Event management dashboard | MVP LOCKED |
| Public.html | Public event listing | MVP LOCKED |
| Display.html | TV/kiosk display | MVP LOCKED |
| Poster.html | Printable poster with QR | MVP LOCKED |
| SharedReport.html | Shared analytics | MVP LOCKED |

See **[docs/MVP_SCOPE.md](./docs/MVP_SCOPE.md)** for full MVP definition.

## Files to paste into Apps Script
- appsscript.json
- Config.gs
- Code.gs
- Styles.html
- NUSDK.html
- DesignAdapter.html
- Header.html
- SponsorUtils.html (Shared sponsor rendering utilities)
- Admin.html
- Public.html
- Poster.html
- Test.html
- Display.html
- Diagnostics.html
- ApiDocs.html (Interactive API documentation)

## Quick Deploy Options

### Option 1: GitHub Actions (Recommended)
Push to `main` branch - automatic deployment via CI/CD pipeline.
- **First time setup:** See [Google Cloud Secrets Setup Guide](./GOOGLE_CLOUD_SECRETS_SETUP.md) to configure GitHub Actions secrets
- **Verify setup:** Run `npm run deploy:verify-secrets` to check configuration

### Option 2: clasp CLI
```bash
npm run push   # Push code to Apps Script
npm run deploy # Create new deployment
```
- **First time setup:** Run `clasp login` (see [docs/CLASP_SETUP.md](./docs/CLASP_SETUP.md))

### Option 3: Manual Copy-Paste
1. Open [Apps Script Editor](https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit)
2. Edit `Config.gs`: set real `adminSecret` values
3. Deploy → New deployment → Web app → Execute as **User accessing**, Access **Anyone**
4. Open `/exec?page=test` → all ✅
5. Open `/exec?page=admin&p=events&brand=root` → create an event → get Public/Poster links

## CI Gate (Required Before Pushing)

**You must be able to run `npm run ci:all` locally before pushing.**

This is the mandatory pre-deploy gate that runs all contract guards:

```bash
npm run ci:all          # Run full CI gate
npm run ci:all:verbose  # Run with detailed output
npm run ci:all:fast     # Run critical checks only
```

The CI gate validates:
- MVP Surfaces (only 5 allowed: admin, public, display, poster, report)
- RPC Inventory (API inventory matches actual usage)
- API vs Schemas (all api_* functions have schemas)
- Event Schema consistency
- Service Tests (form, sponsor, security)
- Dead Exports (no zombie api_* functions)
- Schema Fields (surfaces only use schema-defined fields)
- Analytics Schema consistency

**If `ci:all` fails locally, it will also fail in CI and block deployment.**

## Environment Matrix

The application supports three environments: **Dev**, **Staging**, and **Production**.

| Environment | URL | Purpose | Test Command |
|-------------|-----|---------|--------------|
| **Dev** | `http://localhost:3000` | Local development | `BASE_URL=http://localhost:3000 npm run test:smoke` |
| **Staging** | `https://stg.eventangle.com` | Safe sandbox (DEFAULT) | `npm run test:smoke` |
| **Production** | `https://www.eventangle.com` | Customer-facing | `npm run test:prod:smoke` |
| **GAS Direct** | `https://script.google.com/macros/s/{ID}/exec` | Debugging | `BASE_URL="..." npm run test:smoke` |

### Brand Configuration

#### Single Source of Truth

Brand metadata is centralized in **`config/brand-config.js`**:

| Brand ID | Name | Type | Description |
|----------|------|------|-------------|
| `root` | Zeventbook | standalone | Default platform brand |
| `abc` | American Bocce Co. | parent | Parent organization for bocce brands |
| `cbc` | Chicago Bocce Club | child (of abc) | Community bocce club |
| `cbl` | Chicago Bocce League | child (of abc) | Competitive bocce league |

#### How to Add a New Brand

1. **Add brand metadata** in `config/brand-config.js` (BRAND_METADATA object):
   ```javascript
   newbrand: {
     id: 'newbrand',
     name: 'New Brand Name',
     type: 'standalone', // or 'parent' / 'child'
     description: 'Description of the brand'
   }
   ```

2. **Update backend** in `src/mvp/Config.gs` (BRANDS array):
   ```javascript
   {
     id: 'newbrand',
     name: 'New Brand Name',
     hostnames: ['newbrand.zeventbooks.io'],
     store: { type: 'workbook', spreadsheetId: '...' },
     scopesAllowed: ['events', 'sponsors']
   }
   ```

3. **Update worker routing** in `cloudflare-proxy/worker.js` (VALID_BRANDS):
   ```javascript
   const VALID_BRANDS = Object.freeze(['root', 'abc', 'cbc', 'cbl', 'newbrand']);
   ```

4. **Set environment variables** (see below)

5. **Run validation tests** to verify configuration:
   ```bash
   npm run test -- tests/unit/brand-config.test.js
   ```

#### Admin Keys & Spreadsheet IDs (Environment Variables)

Secrets and per-brand configuration flow via environment variables, NOT hardcoded in config files.

**Environment Variable Priority:** Brand-specific > Shared > Default

| Variable | Purpose | Example |
|----------|---------|---------|
| `ADMIN_KEY` | Shared admin key (all brands) | `my-shared-secret` |
| `ADMIN_KEY_ROOT` | Admin key for root brand | `root-secret-123` |
| `ADMIN_KEY_ABC` | Admin key for ABC brand | `abc-secret-456` |
| `SPREADSHEET_ID` | Shared spreadsheet (all brands) | `1SV1oZMq...` |
| `SPREADSHEET_ID_ROOT` | Dedicated spreadsheet for root | `1ABC...` |
| `SPREADSHEET_ID_ABC` | Dedicated spreadsheet for ABC | `1DEF...` |

**Local Development** (`.env` file):
```bash
ADMIN_KEY=your-dev-admin-key
# Or per-brand:
ADMIN_KEY_ROOT=root-dev-key
ADMIN_KEY_ABC=abc-dev-key
```

**Production** (Google Apps Script):
- Set via: File > Project Properties > Script Properties
- Or: `PropertiesService.getScriptProperties().setProperty('ADMIN_SECRET_ROOT', 'secret')`

**CI/CD**: Configure secrets in GitHub Actions or your deployment platform.

### Environment Configuration

Single source of truth: **`config/environments.js`**

```javascript
const { getBaseUrl, getEnvironment, ENVIRONMENTS } = require('./config/environments');

// In tests
const BASE_URL = getBaseUrl(); // Returns current environment URL
```

## Testing

### Stage 1: Smoke Packs (Hard Blocker)

The **Smoke Packs** are the Stage 1 CI gate. If any smoke pack fails, deployment is blocked.

**4 Core Smoke Packs:**
| Pack | File | Purpose |
|------|------|---------|
| Pages | `pages.smoke.test.js` | MVP surface health (Admin, Public, Display, Poster) |
| Integration | `integration.smoke.test.js` | Cross-component flows (Admin → Public → Display) |
| Components | `components.smoke.test.js` | Deep component validation (lifecycle, sponsors, QR) |
| API | `api.smoke.test.js` | Backend endpoint health (status, errors, multi-brand) |

```bash
# Run all 4 smoke packs (Stage 1 gate)
npm run test:smoke:packs

# Run individual smoke packs
npm run test:smoke:packs:pages
npm run test:smoke:packs:integration
npm run test:smoke:packs:components
npm run test:smoke:packs:api

# Run with custom environment
BASE_URL=https://www.eventangle.com npm run test:smoke:packs      # Production
BASE_URL=https://stg.eventangle.com npm run test:smoke:packs      # Staging (default)
BASE_URL="https://script.google.com/macros/s/XXX/exec" npm run test:smoke:packs  # GAS direct

# Run with specific brand
BRAND_ID=abc npm run test:smoke:packs
BRAND_ID=cbc BASE_URL=https://stg.eventangle.com npm run test:smoke:packs
```

**CI Behavior:** The `smoke-packs-gate.yml` workflow runs on PRs to main and feature branch pushes. All 4 packs must pass or deployment is blocked.

### BASE_URL Toggle (GAS vs EventAngle)

The same test suite runs against any environment by changing `BASE_URL`:

```bash
# Test against STAGING (default - safe sandbox)
npm run test:smoke

# Test against PRODUCTION (explicit only)
npm run test:prod:smoke
USE_PRODUCTION=true npm run test:smoke

# Test against GAS directly (debugging)
BASE_URL="https://script.google.com/macros/s/XXX/exec" npm run test:smoke
```

### Quick Test Commands

```bash
# CI Gate (REQUIRED before pushing)
npm run ci:all

# Stage 1: Smoke Packs (must pass before deploy)
npm run test:smoke:packs

# Stage 1: Lint + Unit + Contract (must pass before deploy)
npm run test:ci:stage1

# Stage 2: API + E2E tests
npm run test:ci:stage2

# E2E smoke tests (separate from smoke packs)
npm run test:smoke

# All smoke tests combined
npm run test:smoke:all

# All tests
npm run test:all
```

See **[tests/README.md](./tests/README.md)** for complete test documentation.

---

## Documentation

### Core Documentation (MVP)
- **[NAVIGATION_DIAGRAM.txt](./NAVIGATION_DIAGRAM.txt)** - Master integration flow diagram (Admin → Bundles → Surfaces → Analytics, MVP vs V2 paths)
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - MVP architecture (12 backend services, 5 frontend surfaces, feature flags)
- **[docs/INTEGRATION-FLOWS.md](./docs/INTEGRATION-FLOWS.md)** - API wiring diagrams with request/response schemas
- **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Deployment, CI/CD, environments, troubleshooting
- **[docs/FRIENDLY_URLS.md](./docs/FRIENDLY_URLS.md)** - Customer-friendly URL aliasing system
- **[docs/SETUP_DIAGNOSTICS.md](./docs/SETUP_DIAGNOSTICS.md)** - Setup verification endpoint

### For Developers
- **[Interactive API Docs](?page=docs)** - Test API endpoints in your browser
- **[openapi.yaml](./openapi.yaml)** - OpenAPI 3.0 specification
- **[tests/README.md](./tests/README.md)** - Test suite documentation
- **[scripts/README.md](./scripts/README.md)** - Local CI commands

### Archived Documentation
Historical analysis reports and experimental features are in `docs/archived/`

## Notes
- Poster shows a QR only when the server returns a verified `posterUrl`
- `EVENTS` & `DIAG` sheets are created on-demand in the bound spreadsheet
- Add brands via `config/brand-config.js` (see [Brand Configuration](#brand-configuration) section above)
- Enable more scopes per brand by adding `'leagues'` or `'tournaments'` to `scopesAllowed` in `Config.gs`

# Last updated: 2025-11-30
