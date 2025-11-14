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
- **First time setup:** See [Google Cloud Secrets Setup Guide](./GOOGLE_CLOUD_SECRETS_SETUP.md) to configure GitHub Actions secrets
- **Verify setup:** Run `npm run deploy:verify-secrets` to check configuration

### Option 2: clasp CLI
```bash
npm run push   # Push code to Apps Script
npm run deploy # Create new deployment
```
- **First time setup:** Run `clasp login` (see [CLASP_SETUP.md](./CLASP_SETUP.md))

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
- **[GOOGLE_CLOUD_SECRETS_SETUP.md](./GOOGLE_CLOUD_SECRETS_SETUP.md)** - 🆕 Configure Google Cloud secrets for GitHub Actions
- **[DEPLOYMENT_AUTOMATION.md](./DEPLOYMENT_AUTOMATION.md)** - 🆕 Automated deployment CLI tool
- **[DEPLOYMENT_CONFIGURATION.md](./DEPLOYMENT_CONFIGURATION.md)** - Single source of truth for deployment config
- **[APPS_SCRIPT_PROJECT.md](./APPS_SCRIPT_PROJECT.md)** - Unified deployment configuration
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Complete deployment guide
- **[DEPLOYMENT_QUICK_START.md](./DEPLOYMENT_QUICK_START.md)** - DevOps quick start
- **[GITHUB_ACTIONS_DEPLOYMENT.md](./GITHUB_ACTIONS_DEPLOYMENT.md)** - CI/CD setup

### For Architecture & Testing
- **[ARCHITECTURE_REVIEW.md](./ARCHITECTURE_REVIEW.md)** - System architecture
- **[docs/architecture/ADR-001-centralized-test-config.md](./docs/architecture/ADR-001-centralized-test-config.md)** - 🆕 Architecture Decision Record for test configuration
- **[TESTING.md](./TESTING.md)** - Test infrastructure (130+ tests)
- **[tests/README.md](./tests/README.md)** - Complete test suite documentation
- **[TEST_INFRASTRUCTURE_SUMMARY.md](./TEST_INFRASTRUCTURE_SUMMARY.md)** - Test coverage matrix

### For Quality Assurance & Testing Teams
- **[docs/testing/DEVELOPER_ONBOARDING.md](./docs/testing/DEVELOPER_ONBOARDING.md)** - 🆕 Quick start guide for developers (< 10 min)
- **[docs/testing/TEST_CONFIGURATION.md](./docs/testing/TEST_CONFIGURATION.md)** - 🆕 Comprehensive test configuration guide
- **[docs/testing/CI_CD_INTEGRATION.md](./docs/testing/CI_CD_INTEGRATION.md)** - 🆕 CI/CD integration for DevOps teams

## Testing

### Quick Start

```bash
# Set environment variables
export BASE_URL="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
export ADMIN_KEY="your-admin-key"

# Run tests
npm run test:smoke        # Quick health check (30s)
npm run test:api          # API contract tests (2m)
npm run test:e2e          # All E2E tests (10m)
```

### Test Suites

| Suite | Command | Runtime | Purpose |
|-------|---------|---------|---------|
| **Smoke** | `npm run test:smoke` | ~30s | Critical health checks |
| **API** | `npm run test:api` | ~2m | API contract validation |
| **Pages** | `npm run test:pages` | ~5m | UI component testing |
| **Flows** | `npm run test:flows` | ~10m | End-to-end user journeys |
| **All** | `npm run test:e2e` | ~15m | Complete test suite |

### For Different Roles

- **👨‍💼 Product Owners**: See [TEST_CONFIGURATION.md](./docs/testing/TEST_CONFIGURATION.md#for-different-roles) for metrics and business value
- **🏗️ Architects**: See [ADR-001](./docs/architecture/ADR-001-centralized-test-config.md) for architecture decisions
- **💻 Developers**: See [DEVELOPER_ONBOARDING.md](./docs/testing/DEVELOPER_ONBOARDING.md) for quick start (< 10 min)
- **🧪 QA/SDET**: See [TEST_CONFIGURATION.md](./docs/testing/TEST_CONFIGURATION.md) for test suite details
- **⚙️ DevOps**: See [CI_CD_INTEGRATION.md](./docs/testing/CI_CD_INTEGRATION.md) for pipeline integration

### Recent Improvements

**Nov 14, 2025** - Centralized Test Configuration:
- ✅ Fixed "Invalid URL" errors in 32 test files
- ✅ Single source of truth for test configuration
- ✅ Clear error messages when BASE_URL not set
- ✅ Comprehensive documentation for all team roles
- ✅ Automated migration script for future updates

See [ADR-001](./docs/architecture/ADR-001-centralized-test-config.md) for details.

## Notes
- Poster shows a QR only when the server returns a verified `posterUrl`
- `EVENTS` & `DIAG` sheets are created on-demand in the bound spreadsheet
- Add tenants by extending `TENANTS` in `Config.gs`; later enable more scopes by adding `'leagues'` or `'tournaments'`

# Deployment test - Thu Nov 13 05:41:27 PM CST 2025
