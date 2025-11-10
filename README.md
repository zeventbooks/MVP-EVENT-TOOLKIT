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
Push to `main` branch - automatic deployment via CI/CD pipeline.

### Option 2: clasp CLI
```bash
npm run push   # Push code to Apps Script
npm run deploy # Create new deployment
```

### Option 3: Manual Copy-Paste
1. Open [Apps Script Editor](https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit)
2. Edit `Config.gs`: set real `adminSecret` values
3. Deploy → New deployment → Web app → Execute as **User accessing**, Access **Anyone**
4. Open `/exec?page=test` → all ✅
5. Open `/exec?page=admin&p=events&tenant=root` → create an event → get Public/Poster links

## Documentation

### For Developers Building Custom Frontends
- **[Interactive API Docs](?page=docs)** - 🆕 Test API endpoints in your browser!
- **[AUTHENTICATION_GUIDE.md](./AUTHENTICATION_GUIDE.md)** - 🆕 3 authentication methods explained
- **[CUSTOM_FRONTEND_GUIDE.md](./CUSTOM_FRONTEND_GUIDE.md)** - Build React/Vue/mobile apps
- **[POSTMAN_API_TESTING.md](./POSTMAN_API_TESTING.md)** - REST API reference & testing
- **[postman-collection.json](./postman-collection.json)** - Import into Postman
- **[openapi.yaml](./openapi.yaml)** - 🆕 OpenAPI 3.0 specification

### For Deployment & DevOps
- **[APPS_SCRIPT_PROJECT.md](./APPS_SCRIPT_PROJECT.md)** - Unified deployment configuration
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide
- **[DEPLOYMENT_QUICK_START.md](./DEPLOYMENT_QUICK_START.md)** - DevOps quick start
- **[GITHUB_ACTIONS_DEPLOYMENT.md](./GITHUB_ACTIONS_DEPLOYMENT.md)** - CI/CD setup

### For Architecture & Testing
- **[ARCHITECTURE_REVIEW.md](./ARCHITECTURE_REVIEW.md)** - System architecture
- **[TESTING.md](./TESTING.md)** - Test infrastructure (130+ tests)
- **[tests/README.md](./tests/README.md)** - 🆕 Complete test suite documentation
- **[TEST_INFRASTRUCTURE_SUMMARY.md](./TEST_INFRASTRUCTURE_SUMMARY.md)** - Test coverage matrix

## Notes
- Poster shows a QR only when the server returns a verified `posterUrl`
- `EVENTS` & `DIAG` sheets are created on-demand in the bound spreadsheet
- Add tenants by extending `TENANTS` in `Config.gs`; later enable more scopes by adding `'leagues'` or `'tournaments'`

