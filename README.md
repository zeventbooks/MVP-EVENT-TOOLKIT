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

## Documentation

### Core Documentation (MVP)
- **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** - MVP architecture (12 backend services, 5 frontend surfaces, feature flags)
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
- Add brands by extending `BRANDS` in `Config.gs`; later enable more scopes by adding `'leagues'` or `'tournaments'`

# Last updated: 2025-11-22
