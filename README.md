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
- **3 Authentication Methods** - adminKey, JWT tokens, API key header (✅ NEW!)
- **Interactive API Docs** - Test endpoints right in your browser! (✅ NEW!)
- **Built-in HTML Pages** - Admin, Public, Display, Poster, Test, Diagnostics
- Multi-tenant config (events-only flags)
- Uniform API envelopes, DIAG logging, idempotency, rate-limits
- SWR helper (etag + localStorage)
- Styles: your patched `Styles.html` + DesignAdapter map

## Files to paste into Apps Script
- appsscript.json
- Config.gs
- Code.gs
- Styles.html
- NUSDK.html
- DesignAdapter.html
- Header.html
- Admin.html
- Public.html
- Poster.html
- Test.html
- Display.html
- Diagnostics.html
- ApiDocs.html (🆕 Interactive API documentation)

## Quick Deploy Options

### Option 1: GitHub Actions (Recommended)
Push to `main` – Stage 1 (lint + Jest + contract + clasp deploy) and Stage 2 (API + smoke + full Playwright) run automatically.
- **Required secrets (repository → Settings → Secrets and variables → Actions):**
  - `OAUTH_CREDENTIALS` → contents of `~/.clasprc.json` (keeps Stage 1 authenticated)
  - `DEPLOYMENT_ID` → anonymous deployment ID created via the Apps Script UI (keeps the pipeline reusing the “Anyone, even anonymous” deployment instead of creating a login-gated one)
  - `ADMIN_KEY_ROOT` → current `adminSecret` for the root tenant (Stage 2 smoke/API tests use this)
- **Optional secrets:** `BASE_URL_QA` if QA doesn’t live at `https://zeventbooks.com`
- **Verify setup:** `npm run deploy:verify-secrets` confirms every secret/action matches the workflow expectations before you push
- **Anonymous access guard:** run `./fix-anonymous-access.sh` once to create the new deployment the secrets will target

### Option 2: clasp CLI
```bash
npm run push   # Push code to Apps Script
npm run deploy # Create new deployment
```
- **First time setup:** Run `clasp login` (see [CLASP_SETUP.md](./CLASP_SETUP.md))

### Option 3: Manual Copy-Paste
1. Open [Apps Script Editor](https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit)
2. Edit `Config.gs`: set real `adminSecret` values
3. Deploy → **New deployment** → Web app → Execute as **Me (User deploying)** → Who has access **Anyone, even anonymous** (old deployments must be deleted; updating an old “Anyone” deployment will still yield Gmail login prompts)
4. Copy the `/exec` URL → export `BASE_URL=<url>` → run `./verify-deployment.sh` to ensure Status/Public/Admin/Display return HTTP 200
5. Update the `DEPLOYMENT_ID` GitHub secret and Hostinger proxy files with the new ID so Stage 1/Stage 2 can keep testing the same anonymous deployment

### Multi-agent verification flow
1. **Local agent – `verify-deployment.sh`:** Hits `/status`, `/public`, `/admin`, and `/display` for every tenant to confirm the newly created deployment is anonymous before it is referenced anywhere else.
2. **CI Agent Stage 1:** ESLint → Jest → contract → clasp deploy (using `OAUTH_CREDENTIALS` + `DEPLOYMENT_ID`). Outputs every tenant/page URL plus the base Apps Script link for manual checks.
3. **CI Agent Stage 2:** Consumes the Stage 1 artifact, health-checks Hostinger (`https://zeventbooks.com?p=status&tenant=root`), then runs Playwright API + smoke suites first. If failure rate < 50 % it unlocks the full page/flow suites, making sure the shared admin URLs work before releasing them.
4. **Hostinger proxy agent:** `hostinger-proxy/index.php` and `.htaccess` simply forward `/` or `?p=admin&tenant=root` requests to the Stage 1 deployment URL so that QA/Production always map back to the verified anonymous Apps Script web app.

## Documentation

### For Developers Building Custom Frontends
- **[Interactive API Docs](?page=docs)** - 🆕 Test API endpoints in your browser!
- **[AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md)** - 🆕 3 authentication methods explained
- **[CUSTOM_FRONTEND_GUIDE.md](./CUSTOM_FRONTEND_GUIDE.md)** - Build React/Vue/mobile apps
- **[POSTMAN_API_TESTING.md](./POSTMAN_API_TESTING.md)** - REST API reference & testing
- **[postman-collection.json](./postman-collection.json)** - Import into Postman
- **[openapi.yaml](./openapi.yaml)** - 🆕 OpenAPI 3.0 specification

### For Deployment & DevOps
- **[GOOGLE_CLOUD_SECRETS_SETUP.md](./GOOGLE_CLOUD_SECRETS_SETUP.md)** - 🆕 Configure Google Cloud secrets for GitHub Actions
- **[DEPLOYMENT_AUTOMATION.md](./DEPLOYMENT_AUTOMATION.md)** - 🆕 Automated deployment CLI tool
- **[DEPLOYMENT_CONFIGURATION.md](./DEPLOYMENT_CONFIGURATION.md)** - Single source of truth for deployment config
- **[APPS_SCRIPT_PROJECT.md](./APPS_SCRIPT_PROJECT.md)** - Unified deployment configuration
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide
- **[DEPLOYMENT_QUICK_START.md](./DEPLOYMENT_QUICK_START.md)** - DevOps quick start
- **[GITHUB_ACTIONS_DEPLOYMENT.md](./GITHUB_ACTIONS_DEPLOYMENT.md)** - CI/CD setup

### For Architecture & Testing
- **[ARCHITECTURE_REVIEW.md](./ARCHITECTURE_REVIEW.md)** - System architecture
- **[TESTING.md](./TESTING.md)** - Test infrastructure (130+ tests)
- **[tests/README.md](./tests/README.md)** - 🆕 Complete test suite documentation
- **[TEST_INFRASTRUCTURE_SUMMARY.md](./TEST_INFRASTRUCTURE_SUMMARY.md)** - Test coverage matrix
- **[LOAD_TESTING.md](./LOAD_TESTING.md)** - 🆕 Performance & load testing with k6

## Notes
- Poster shows a QR only when the server returns a verified `posterUrl`
- `EVENTS` & `DIAG` sheets are created on-demand in the bound spreadsheet
- Add tenants by extending `TENANTS` in `Config.gs`; later enable more scopes by adding `'leagues'` or `'tournaments'`

# Deployment test - Thu Nov 13 05:41:27 PM CST 2025
