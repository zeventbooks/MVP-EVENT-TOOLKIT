# ZE Eventbook Mind Map

> Use this page as the single entry point that orients new contributors to the repo. Each branch links to the deeper guide that owns the source of truth.

```
Zeventbook MVP
├─ Unified Deployment
│  ├─ Single Google Apps Script project (Project ID 1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l)
│  ├─ Paste set = appsscript.json + Config/Code/Styles/NUSDK/DesignAdapter/Header HTMLs
│  └─ Deploy paths → GitHub Actions · clasp CLI · Manual copy/paste
│
├─ Runtime Surfaces & APIs
│  ├─ Built-in HTML apps: Admin, AdminWizard, Public, Display, Poster, Diagnostics, ApiDocs
│  ├─ REST API powering custom frontends + multi-tenant config hooks
│  └─ Interactive docs + OpenAPI + Postman collection for external builders
│
├─ Authentication & Sessions
│  ├─ Three auth methods: adminKey, JWT (Bearer), X-API-Key header
│  ├─ UI default = short-lived admin session tokens minted via api_createAdminSession
│  └─ Legacy secrets purged from storage; session tokens auto-expire + gate_() validation
│
├─ Automation & DevOps
│  ├─ `npm run deploy:auto` orchestrates verify → guard → deploy → monitor → dns verify → history logging
│  ├─ Supporting commands: `deploy:verify`, `deploy:guard`, `deploy:quick`, `deploy:setup`, `deploy:history`, `deploy:rollback`
│  ├─ Quality + security helpers: `quality:gate`, `secrets:sync`, `monitor:health`, `dns:verify`
│  └─ Evidence stored in ops/: deploy guardian, health history, dns status, secret rotations
│
├─ Security & Secrets
│  ├─ Automated secret policy (`secrets:sync`) with rotation log + enforcement rules
│  ├─ Session-token rollout mitigates Bug #15 (no raw admin keys in sessionStorage)
│  ├─ Platform controls: sanitizeInput_/sanitizeId_, CSRF tokens, rate limiting, tenant isolation, redirect & CORS guards
│  └─ Security checklist + incident response + future hardening notes
│
├─ Testing & Quality Gates
│  ├─ Enforced `npm run quality:gate` (Jest + coverage thresholds) before every deploy
│  ├─ Test suites: unit (78), contract (~10), smoke (100+ Playwright), e2e (8 critical flows)
│  ├─ Playwright requires BASE_URL (+ ADMIN_KEY for e2e); smoke suite covers Admin→Public lifecycle, diagnostics, sponsor flow
│  └─ Supporting docs: tests/README, TEST_INFRASTRUCTURE_SUMMARY, LOAD_TESTING for k6 performance runs
│
└─ Operations Evidence & Monitoring
   ├─ `monitor:health` hits Status/Diagnostics/Self-Test/API docs and app root, persisting 50-run history
   ├─ `dns:verify` confirms zeventbooks.io redirects to deployed Apps Script URL, records outputs under ops/domains
   ├─ `deploy:guard` proves service-account access, storing guardian status artifacts
   └─ README + Deployment docs outline fallback manual path, but automation flow is now canonical
```

## How to Use This Mind Map
1. **Start at the branch you care about.** Each bullet references the owning document or CLI command, so click into those files for procedural depth.
2. **Share the link during onboarding.** New contributors can digest the end-to-end story in minutes, then drill down only where needed.
3. **Update this page whenever you add a major artifact.** Treat it like a table of contents with architectural context so we keep one place that explains the "why" and "where".
