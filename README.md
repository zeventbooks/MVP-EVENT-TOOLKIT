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
- Multi-brand config (events-only flags)
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

### Getting Started
- **[docs/FIRST_TIME_SETUP.md](./docs/FIRST_TIME_SETUP.md)** - Complete setup guide from scratch
- **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** - Deployment guide

### For Developers Building Custom Frontends
- **[Interactive API Docs](?page=docs)** - Test API endpoints in your browser
- **[docs/AUTHENTICATION_GUIDE.md](./docs/AUTHENTICATION_GUIDE.md)** - 3 authentication methods
- **[docs/CUSTOM_FRONTEND_GUIDE.md](./docs/CUSTOM_FRONTEND_GUIDE.md)** - Build React/Vue/mobile apps
- **[docs/DESIGN_SYSTEM.md](./docs/DESIGN_SYSTEM.md)** - UI patterns, SharedUtils, APIClient
- **[openapi.yaml](./openapi.yaml)** - OpenAPI 3.0 specification

### For Architecture & Testing
- **[docs/TESTING.md](./docs/TESTING.md)** - Test infrastructure (260+ tests)
- **[tests/README.md](./tests/README.md)** - Complete test suite documentation
- **[docs/SECURITY.md](./docs/SECURITY.md)** - Security considerations

### For DevOps
- **[docs/CLASP_SETUP.md](./docs/CLASP_SETUP.md)** - clasp CLI setup
- **[docs/DEPLOYMENT_FLOW.md](./docs/DEPLOYMENT_FLOW.md)** - CI/CD pipeline

## Notes
- Poster shows a QR only when the server returns a verified `posterUrl`
- `EVENTS` & `DIAG` sheets are created on-demand in the bound spreadsheet
- Add brands by extending `BRANDS` in `Config.gs`; later enable more scopes by adding `'leagues'` or `'tournaments'`

# Deployment test - Thu Nov 13 05:41:27 PM CST 2025
