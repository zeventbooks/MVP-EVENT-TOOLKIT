# CI/CD Architecture & Enforcement Rules

> **Purpose:** Anchor the CI/CD design for future maintainers and prevent architecture drift.
> **Last Updated:** 2025-12-07
> **Status:** MVP Production-Ready

---

## Active CI/CD Workflows

Only these workflows are considered part of the live CI/CD pipeline:

| Workflow | Purpose | Trigger |
|----------|---------|---------|
| `.github/workflows/stage1.yml` | Stage 1 – Validate, Build, Deploy | PRs = validate only; push to main = deploy STG; tags = deploy PROD |
| `.github/workflows/stage2.yml` | Stage 2 – Environment Tests | Runs after Stage-1 succeeds on main (API + UI smoke against deployed STG) |
| `.github/workflows/codeql-analysis.yml` | Security scanning (CodeQL) | Push to main/claude branches, PRs to main, weekly schedule |

**Rule:** If it's not `stage1.yml`, `stage2.yml`, or `codeql-analysis.yml`, it doesn't run as part of the live CI/CD pipeline.

All other CI definitions have been archived under `.github/workflows/archive/`.

---

## Table of Contents

1. [Active CI/CD Workflows](#active-cicd-workflows)
2. [Overview](#overview)
3. [Stage-1: Validate + Deploy](#stage-1-validate--deploy)
4. [Stage-2: Environment Tests](#stage-2-environment-tests)
5. [Environment Keys (stg/prod)](#environment-keys-stgprod)
6. [Cloudflare Routing Alignment](#cloudflare-routing-alignment)
7. [QR Verification Invariant](#qr-verification-invariant)
8. [Contract Safety Rules](#contract-safety-rules)
9. [Fail-Fast Philosophy](#fail-fast-philosophy)
10. [Deployment Flow Diagram](#deployment-flow-diagram)
11. [Quick Reference](#quick-reference)

---

## Overview

This repository uses a **two-stage CI/CD architecture**:

| Stage | Purpose | Runs Against | Trigger |
|-------|---------|--------------|---------|
| **Stage-1** | Hermetic validation + deployment | No external deps | PR, push to main, tag |
| **Stage-2** | Post-deploy verification | Live staging URL | After Stage-1 succeeds |

**Core Principles:**
- **CI-Only Production Deployment** — Manual deploys to production are prohibited
- **Hermetic Stage-1** — Zero external HTTP dependencies (no BASE_URL)
- **Progressive Failure Gates** — Stop early when critical tests fail
- **Single Source of Truth** — `config/environments.js` for all URLs

---

## Stage-1: Validate + Deploy

**Workflow:** `.github/workflows/stage1.yml`

### Trigger Matrix

| Event | Validate | Deploy to Staging | Deploy to Production |
|-------|----------|-------------------|---------------------|
| PR to main | ✅ | ❌ | ❌ |
| Push to main | ✅ | ✅ | ❌ |
| Tag `vX.Y.Z` | ✅ | ❌ | ✅ |

### Validation Steps

All validation runs via `npm run stage1-local` (unified truth script):

```
┌─────────────────────────────────────────────────────────────┐
│                    STAGE-1 VALIDATION                       │
├─────────────────────────────────────────────────────────────┤
│  1. ESLint          Code quality & style                    │
│  2. Unit Tests      512+ tests (>80% coverage required)     │
│  3. Contract Tests  155+ tests (schema + API + bundles)     │
│  4. MVP Guards      5 automated enforcement checks          │
└─────────────────────────────────────────────────────────────┘
```

### MVP Guards (Automated Enforcement)

| Guard | File | Enforces |
|-------|------|----------|
| Surface Count | `check-surfaces.js` | Only 5 MVP surfaces: admin, public, display, poster, report |
| Dead Code | `check-dead-code.js` | No unused `api_*` exports (zombie functions) |
| V2 Files | `check-v2-files.js` | No V2 files in MVP directory |
| Schema Fields | `check-schema-fields.js` | Surfaces only use schema-defined fields |
| RPC Inventory | `check-rpc-inventory.js` | All `api_*` functions have schemas |

### Hermetic Principle

**Critical:** Stage-1 has **zero external HTTP dependencies**.

```javascript
// Stage-1 MUST NOT use BASE_URL
if (process.env.BASE_URL) {
  throw new Error('Stage-1 is hermetic - BASE_URL not allowed');
}
```

**Why this matters:**
- Stage-1 cannot break due to staging/production outages
- Validation is completely decoupled from deployment infrastructure
- Reproducible results regardless of network conditions

### Deployment Process

When deployment triggers:

1. **Clasp Push** — Push all `.gs` and `.html` files to Apps Script
2. **Create Deployment** — Create new version with timestamp description
3. **Emit Artifact** — Output `stg-base-url` or `prod-base-url` for Stage-2

**Script IDs:**
```
Staging:    1gHiPuj7eXNk09dDyk17SJ6QsCJg7LMqXBRrkowljL3z2TaAKFIvBLhHJ
Production: 1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l
```

**Retry Logic:** 4 attempts with exponential backoff (5s, 10s, 20s, 40s)

---

## Stage-2: Environment Tests

**Workflows:**
- `.github/workflows/stage2.yml` — Orchestrator (API + UI smoke)
- `.github/workflows/stage2-testing.yml` — Comprehensive E2E testing

### URL Selection Hierarchy

```
1. USE_PRODUCTION=true     → https://www.eventangle.com (explicit opt-in)
2. inputs.deployment_url   → Manual override
3. Stage-1 artifact        → From deployment-url.txt
4. Default                 → https://stg.eventangle.com (safe sandbox)
```

### Progressive Test Gates

```
┌─────────────────────────────────────────────────────────────┐
│                    STAGE-2 TESTING                          │
├─────────────────────────────────────────────────────────────┤
│  Preflight    → Reachability check (fail-fast)              │
│  Warmup       → GAS cold-start elimination                  │
│       ↓                                                     │
│  API Tests    → Critical path (status, events, qr, report)  │
│       ↓                                                     │
│  ═══ GATE 1 ═══  API Pass? No → BLOCK RELEASE               │
│       ↓                                                     │
│  Smoke Packs  → 4 core tests (pages, integration, etc.)     │
│       ↓                                                     │
│  ═══ GATE 1.5 ═══  Packs Pass? No → BLOCK RELEASE           │
│       ↓                                                     │
│  UI Smoke     → Admin, Public, Display, Poster surfaces     │
│  E2E Smoke    → End-to-end validation                       │
│       ↓                                                     │
│  ═══ GATE 2 ═══  Smoke Pass? No → SKIP EXPENSIVE TESTS      │
│       ↓                                                     │
│  Expensive    → Flow tests + Page tests (parallel)          │
│       ↓                                                     │
│  Quality Gate → Final aggregation                           │
└─────────────────────────────────────────────────────────────┘
```

### Test Categories

| Category | Tests | Purpose |
|----------|-------|---------|
| **API Smoke** | `tests/api/smoke/*.spec.ts` | Contract validation (v4.1.2 schema) |
| **UI Smoke** | `tests/ui/smoke/*.spec.ts` | Surface load verification |
| **Smoke Packs** | 4 core tests | MVP surface health |
| **Flow Tests** | Template scenarios | Data propagation (Admin → Public → Display → Poster) |
| **Page Tests** | Comprehensive validation | Deep page functionality |

### Brand Testing Matrix

All tests run for each of 4 brands:

| Brand | Key | Environment Variables |
|-------|-----|----------------------|
| root | Zeventbook | `ADMIN_KEY_ROOT`, `SPREADSHEET_ID_ROOT` |
| abc | American Bocce Co. | `ADMIN_KEY_ABC`, `SPREADSHEET_ID_ABC` |
| cbc | Community Based Cricket | `ADMIN_KEY_CBC`, `SPREADSHEET_ID_CBC` |
| cbl | Community Based League | `ADMIN_KEY_CBL`, `SPREADSHEET_ID_CBL` |

---

## Environment Keys (stg/prod)

### Single Source of Truth

**File:** `config/environments.js`

```javascript
// Production
PRODUCTION_URL = 'https://www.eventangle.com'
GAS_PRODUCTION_URL = 'https://script.google.com/macros/s/{PROD_ID}/exec'

// Staging
STAGING_URL = 'https://stg.eventangle.com'
GAS_STAGING_URL = 'https://script.google.com/macros/s/{STG_ID}/exec'

// QA
QA_URL = 'https://zeventbooks.com'

// Local
LOCAL_URL = 'http://localhost:3000'
```

### Environment Matrix

| Environment | URL | GAS Project | Who Can Deploy |
|-------------|-----|-------------|----------------|
| **Production** | `www.eventangle.com` | Production Script | **CI ONLY** |
| **Staging** | `stg.eventangle.com` | Staging Script | Developers, CI |
| **Local** | `localhost:3000` | N/A | Developers |

### Environment Detection

```javascript
// Helper functions from config/environments.js
isProduction()          // true if production URL
isStaging()             // true if staging URL
isGoogleAppsScript()    // true if running in GAS
getBaseUrl()            // current environment URL
getBrandUrl(brand, page) // brand-specific URLs
```

---

## Cloudflare Routing Alignment

**Config:** `cloudflare-proxy/wrangler.toml`

### Route Configuration

| Environment | Routes | Worker |
|-------------|--------|--------|
| **Production** | `eventangle.com/*`, `www.eventangle.com/*`, `api.eventangle.com/*` | `eventangle-prod` |
| **Staging** | `stg.eventangle.com/*`, `api-stg.eventangle.com/*` | `eventangle-staging` |

### Friendly URL Aliases

All routes proxy to Google Apps Script via Cloudflare Worker:

| Alias | Maps To | Purpose |
|-------|---------|---------|
| `/events` | `?page=public` | Event listing |
| `/manage` | `?page=admin` | Admin panel |
| `/display` | `?page=display` | TV/kiosk mode |
| `/poster` | `?page=poster` | Print/QR page |
| `/status` | `?page=status` | Health check |

### Brand URL Patterns

```
Root:   /{alias}         → /events, /manage, /display
Brands: /{brand}/{alias} → /abc/events, /cbc/manage, /cbl/display
```

### Deployment Command

```bash
# Staging
wrangler deploy --env staging

# Production (CI only)
wrangler deploy --env production
```

---

## QR Verification Invariant

### Why QR Verification is Critical

The Poster surface requires QR codes to function. If QR generation fails, the poster page is broken. This is a **critical invariant** checked before every production deployment.

### QR Code Structure

```javascript
event: {
  qr: {
    public: "data:image/png;base64,...",  // Links to public page
    signup: "data:image/png;base64,..."   // Links to signup page
  }
}
```

### Verification Checks

**Test:** `tests/api/smoke/qr.spec.ts`

| Check | Validation |
|-------|------------|
| Existence | Both `qr.public` and `qr.signup` present |
| Base64 Valid | Can decode to binary PNG data |
| PNG Magic Bytes | `89 50 4E 47 0D 0A 1A 0A` at start |
| Dimensions | 100x100 minimum, 1000x1000 maximum |
| Header Valid | Dimensions readable from PNG header (offset 16-24) |

### Production Gate

```
IF QR verification fails → BLOCK production deployment
```

### Sponsor Report QR Contract

```typescript
// Input
{ brandId: string, sponsorId: string }

// Output (envelope format)
{
  ok: true,
  value: {
    url: string,         // Contains sponsorId parameter
    qrB64: string,       // Raw base64 PNG (no data URI)
    verified: boolean
  }
}
```

---

## Contract Safety Rules

### API Response Envelope (v4.1.2)

**Two response formats — strict boundary between them:**

#### Flat Endpoints (Status pages only)

```javascript
// Success
{ ok: true, buildId: "mvp-v19", brandId: "root", time: "ISO8601" }

// Error
{ ok: false, buildId: "mvp-v19", message: "error text" }
```

#### Envelope Endpoints (All other endpoints)

```javascript
// Success
{ ok: true, value: { /* data */ }, etag?: string }

// Error
{ ok: false, code: "BAD_INPUT|NOT_FOUND|RATE_LIMITED|INTERNAL|CONTRACT", message: string }

// Not Modified (304-equivalent)
{ ok: true, notModified: true, etag: "abc123" }
```

### Contract Enforcement

| Mechanism | Location | Purpose |
|-----------|----------|---------|
| `validateEnvelope()` | Test helpers | Verify response format |
| `validateFlatResponse()` | Test helpers | Verify status format |
| Schema files | `schemas/*.schema.json` | Canonical field definitions |
| Contract tests | `tests/contract/` | Endpoint compliance |

### Event Contract (Frozen MVP v1.0)

**Required Fields:**
- `id`, `slug`, `name`, `startDateISO`, `venue`
- `links.*` (publicUrl, displayUrl, posterUrl, signupUrl)
- `qr.*` (public, signup)
- `ctas.primary.*` (label, url)
- `settings.show*` (schedule, standings, bracket, sponsors, etc.)

**Read-Only Fields (Never overwrite):**
- `id`, `links.*`, `qr.*`, `createdAtISO`, `updatedAtISO`

### Surface Constraints

| Surface | Constraints |
|---------|------------|
| **Public** | Use `links.*`, gate sections with `setting && data?.length` |
| **Display** | Filter sponsors by placement, QR from `event.qr.*` |
| **Poster** | Print-safe (no links on sponsors), QR must be pre-generated |
| **Admin** | Preserve core fields, never rebuild links/QR |

---

## Fail-Fast Philosophy

### Core Principle

> **Stop early when critical tests fail to save time and CI costs.**

### Implementation

```
API Tests fail     → Skip Smoke Packs + all downstream
Smoke Packs fail   → Skip E2E Smoke + Expensive Tests
Smoke Tests fail   → Skip Expensive Tests (Flow + Page)
```

### Gate Hierarchy

```
┌─────────────────────────────────────────────────┐
│   GATE 1 (API)                                  │
│   ├─ FAIL → Stop immediately, block release     │
│   └─ PASS → Continue to Gate 1.5                │
├─────────────────────────────────────────────────┤
│   GATE 1.5 (Smoke Packs)                        │
│   ├─ FAIL → Stop, skip expensive tests          │
│   └─ PASS → Continue to Gate 2                  │
├─────────────────────────────────────────────────┤
│   GATE 2 (Smoke Tests)                          │
│   ├─ FAIL → Stop, skip expensive tests          │
│   └─ PASS → Run expensive tests                 │
├─────────────────────────────────────────────────┤
│   Quality Gate (Final)                          │
│   ├─ ANY FAIL → Block release                   │
│   └─ ALL PASS → Release ready                   │
└─────────────────────────────────────────────────┘
```

### Benefits

1. **Cost Optimization** — Don't run expensive tests if cheap tests fail
2. **Fast Feedback** — Developers know within minutes if critical tests fail
3. **Resource Efficiency** — Parallel test execution where possible
4. **Clear Audit Trail** — Each gate produces actionable status

### Timeouts

| Operation | Timeout |
|-----------|---------|
| Deployment warmup | 60s |
| HTTP requests | 30s |
| Playwright actions | 30s |
| Full Stage-2 | 30 min |

---

## Deployment Flow Diagram

```
                    Developer
                        │
                        ▼
           ┌────────────────────────┐
           │  Create PR to main     │
           └───────────┬────────────┘
                       │
                       ▼
    ┌──────────────────────────────────────┐
    │         STAGE-1: VALIDATION          │
    │      (Hermetic - No BASE_URL)        │
    ├──────────────────────────────────────┤
    │  ● Lint                              │
    │  ● Unit Tests (512+)                 │
    │  ● Contract Tests (155+)             │
    │  ● MVP Guards (5 checks)             │
    └───────────────────┬──────────────────┘
                        │
           ┌────────────┴────────────┐
           │                         │
      PR to main              Push to main
           │                         │
           ▼                         ▼
      VALIDATE ONLY          VALIDATE + DEPLOY
      (No deploy)                    │
           │                ┌────────┴────────┐
           │                │                 │
           │           Push to main      Tag vX.Y.Z
           │                │                 │
           │                ▼                 ▼
           │           Deploy to          Deploy to
           │           STAGING            PRODUCTION
           │                │                 │
           │                │                 ▼
           │                │            ┌─────────────┐
           │                │            │ QR Verify   │
           │                │            │ Prod Smoke  │
           │                │            └──────┬──────┘
           │                │                   │
           │                │          ┌────────┴────────┐
           │                │          │                 │
           │                │         FAIL              PASS
           │                │          │                 │
           │                │          ▼                 ▼
           │                │       BLOCK            PROD LIVE
           │                │                            ✅
           │                │
           │                ▼
           │         Emit stg-base-url
           │                │
           │                ▼
           │    ┌──────────────────────────────┐
           │    │   STAGE-2: POST-DEPLOY TEST  │
           │    │   (Against Live Staging URL) │
           │    ├──────────────────────────────┤
           │    │  ● Preflight Check           │
           │    │  ● API Tests (GATE 1)        │
           │    │  ● Smoke Packs (GATE 1.5)    │
           │    │  ● UI + E2E Smoke (GATE 2)   │
           │    │  ● Expensive Tests           │
           │    │  ● Quality Gate              │
           │    └───────────────┬──────────────┘
           │                    │
           │           ┌───────┴───────┐
           │           │               │
           │          FAIL            PASS
           │           │               │
           │           ▼               ▼
           │       BLOCK           RELEASE
           │       RELEASE         READY ✅
           │
           ▼
         END
```

---

## Quick Reference

### Commands

```bash
# Stage-1 (Pre-Deploy)
npm run lint                # ESLint
npm run test:unit           # Jest unit tests
npm run test:contract       # Contract tests
npm run stage1-local        # Unified Stage-1 (all above)
npm run ci:all              # Full CI gate

# Stage-2 (Post-Deploy)
npm run test:api            # API integration tests
npm run test:smoke          # E2E smoke tests
npm run test:smoke:packs    # 4 core smoke packs
npm run test:ui:smoke       # UI smoke tests
npm run test:flows          # Flow tests (expensive)
npm run test:pages          # Page tests (expensive)
npm run test:ci:stage2      # Full Stage-2

# Environment-Specific
npm run test:prod:smoke                    # Production smoke
BASE_URL="https://stg..." npm run test:smoke  # Custom URL
TEST_BRAND=abc npm run test:smoke          # Brand-specific
```

### Key Files

| Purpose | File |
|---------|------|
| Stage-1 Workflow | `.github/workflows/stage1.yml` |
| Stage-2 Workflow | `.github/workflows/stage2-testing.yml` |
| Environment Config | `config/environments.js` |
| Cloudflare Config | `cloudflare-proxy/wrangler.toml` |
| QR Tests | `tests/api/smoke/qr.spec.ts` |
| Stage-1 Script | `scripts/stage1-local.mjs` |
| API Contract | `API_CONTRACT.md` |
| Event Schema | `EVENT_CONTRACT.md` |
| Production Policy | `PRODUCTION_DEPLOYMENT_POLICY.md` |

### Safety Checklist

- [ ] Stage-1 passes before any deployment
- [ ] No BASE_URL in Stage-1 (hermetic)
- [ ] QR verification passes before production
- [ ] All 4 brands tested
- [ ] Production deploys only via CI (tag push)
- [ ] Staging mirrors production routes

---

## Related Documentation

- [DEPLOYMENT.md](../DEPLOYMENT.md) — Step-by-step deployment runbook
- [PRODUCTION_DEPLOYMENT_POLICY.md](../PRODUCTION_DEPLOYMENT_POLICY.md) — CI-only policy
- [API_CONTRACT.md](../API_CONTRACT.md) — Response envelope boundaries
- [EVENT_CONTRACT.md](../EVENT_CONTRACT.md) — Event schema (frozen)
- [ENVIRONMENT_MATRIX.md](../ENVIRONMENT_MATRIX.md) — Authoritative environment reference
- [ARCHITECTURE.md](./ARCHITECTURE.md) — MVP architecture overview
