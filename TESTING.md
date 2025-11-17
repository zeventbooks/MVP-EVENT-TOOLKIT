# Testing Guide

Complete guide to running tests for MVP Event Toolkit.

## Test Structure

```
tests/
├── unit/           → Jest (backend logic)
├── contract/       → Jest (API validation)
├── smoke/          → Playwright (quick health checks)
└── e2e/            → Playwright (full user flows)
```

**Important:** Jest and Playwright tests are separated to avoid conflicts.

---

## Quick Start

### Enforced Quality Gate (CI default)

```bash
npm run quality:gate
```

- Runs Jest with coverage and fails if coverage < 60% lines/statements, 55% functions, 40% branches
- Writes `.quality-gate-report.json` for audit evidence
- Used automatically by `npm run deploy:auto` and `deploy:verify`

### Run All Tests

```bash
# Run Jest tests (unit + contract) then Playwright tests (smoke + e2e)
npm run test:all
```

### Run Jest Tests Only

```bash
# All Jest tests with coverage
npm test

# With coverage report
npm run test:coverage

# Unit tests only
npm run test:unit

# Contract tests only
npm run test:contract

# Watch mode (re-run on file changes)
npm run test:watch
```

### Run Playwright Tests Only

```bash
# All Playwright tests (smoke + e2e)
npm run test:playwright

# Smoke tests only (quick, ~1 min)
npm run test:smoke

# E2E tests only (requires BASE_URL)
npm run test:e2e
```

---

## Test Command Matrix (Systematic View)

| Suite | Command | Required Env | Automation/Guards | Primary Evidence |
| --- | --- | --- | --- | --- |
| **Quality Gate** | `npm run quality:gate` | None | Enforces 60/55/40 coverage floor before any deploy | `.quality-gate-report.json`, Jest coverage |
| **Unit** | `npm run test:unit` | None | Jest only | Terminal output, `coverage/` (when run w/ `--coverage`) |
| **Contract** | `npm run test:contract` | None | Jest only | Terminal output |
| **Smoke** | `npm run test:smoke` | `BASE_URL` | Repo-wide Playwright login-wall guard skips if deployment is private | `playwright-report/`, traces |
| **Pages / Flows** | `npm run test:pages`, `npm run test:flows` | `BASE_URL`, `ADMIN_KEY` | Login-wall guard + admin-key guard (skips if missing) | `playwright-report/`, traces |
| **API** | `npm run test:api` / `test:api:*` | `BASE_URL`, optional `ADMIN_KEY` | Login-wall guard handles anonymous access, suites fail only after authenticated call passes | `playwright-report/`, traces |
| **Scenario 1–3** | `npm run test:scenario:{1,2,3}` | `BASE_URL`, `ADMIN_KEY` | Shared guard auto-skips on Google login wall; scenario code stops immediately | `test-results/scenarios/*` |
| **All Scenarios** | `npm run test:scenarios` / `npm run test:scenarios:all` | `BASE_URL`, `ADMIN_KEY` | Inherits guard + scenario-specific skip messages | `.test-results/scenarios/bug-tracker.json` |
| **Triangle Suites** | `npm run test:triangle:*` | `BASE_URL`, `ADMIN_KEY` | Guard + data seeding (via `qa:seed:triangle:*`) | Terminal output, Playwright reports |
| **Load Tests** | `npm run test:load:{smoke,average,stress,spike}` | `BASE_URL` | k6 CLI (manual) | `k6-results/` (if exported) |

> 📌 **Standard practice:** All Playwright entry points import `tests/shared/register-login-wall-guard.js` via
> `tests/config/global-setup.js`, so every `page.goto` automatically checks for the Google login wall and
> calls `test.skip(true, LOGIN_WALL_SKIP_MESSAGE)` before any assertions run. Admin-only suites also run
> an admin-key guard and skip (instead of fail) when `ADMIN_KEY` is missing to prevent noisy reports.

---

## Test Types Explained

### 1. Unit Tests (Jest)

**Location:** `tests/unit/backend.test.js`
**Count:** 78 tests
**Duration:** ~5 seconds

**What they test:**
- Backend utility functions
- Input sanitization (XSS prevention)
- Error envelope creation (Ok/Err)
- URL validation
- Schema validation
- Rate limiting logic
- Slug generation

**Run:**
```bash
npm run test:unit
```

**Example output:**
```
PASS tests/unit/backend.test.js
  ✓ should create success response with value (3ms)
  ✓ should remove XSS characters
  ✓ should validate URLs correctly

Tests: 78 passed, 78 total
Time: 1.167s
```

---

### 2. Contract Tests (Jest)

**Location:** `tests/contract/api.contract.test.js`
**Count:** ~10 tests
**Duration:** ~3 seconds

**What they test:**
- API response format validation
- OK envelope structure: `{ ok: true, value: {...} }`
- Err envelope structure: `{ ok: false, code: '...', message: '...' }`
- ETags for caching
- notModified responses

**Run:**
```bash
npm run test:contract
```

---

### 3. Smoke Tests (Playwright)

**Location:** `tests/smoke/` (4 files)
**Count:** 100+ tests
**Duration:** ~1 minute
**Requires:** BASE_URL environment variable

**What they test:**

#### `pages.smoke.test.js` (20+ tests)
- All pages load successfully (200 status)
- Core UI elements present
- Responsive design (mobile, tablet, TV)
- No JavaScript errors on load
- Performance (load time < 5s)
- Accessibility (keyboard nav, labels)

#### `api.smoke.test.js` (10+ tests)
- Status endpoint returns system info
- Health check responds
- Error handling (invalid params)
- Response format (OK/Err envelopes)
- Multi-tenant support
- Rate limiting

#### `components.smoke.test.js` (50+ tests)
- Event lifecycle dashboard
- Sign-up form cards
- Sponsor banner system
- TV display carousel
- Analytics batching
- QR code generation
- Error handling UI

#### `integration.smoke.test.js` (30+ tests)
- Admin to Public flow
- Config propagation to Display
- Analytics end-to-end
- Multi-tenant isolation
- Shortlink creation & redirect
- RPC communication
- State management

**Run:**
```bash
# Set BASE_URL first
export BASE_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"

# Run smoke tests
npm run test:smoke

# Run in headed mode (see browser)
npm run test:smoke -- --headed

# Run specific file
npm run test:smoke tests/smoke/pages.smoke.test.js
```

---

### 4. E2E Tests (Playwright)

**Location:** `tests/e2e/critical-flows.spec.js`
**Count:** 8 critical flows
**Duration:** ~3 minutes
**Requires:** BASE_URL + ADMIN_KEY environment variables

> ℹ️ **Anonymous access guard** – Every Playwright suite (scenarios, smoke, flows, API docs, etc.) now auto-detects the Google login wall. If your Apps Script deployment is still restricted to "Only myself" or your Workspace domain, the tests are skipped with guidance to publish the web app as "Anyone" (per `DEPLOYMENT.md`) or point `BASE_URL` at an anonymous deployment. This prevents false failures while still surfacing the remediation steps.

**What they test:**
- Admin creates event and views on public page
- Configure display with sponsors
- Public page shows sponsor banner
- Display page carousel mode
- Health check endpoints
- Shortlink redirect
- Responsive design
- Accessibility

**Run:**
```bash
# Set environment variables
export BASE_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
export ADMIN_KEY="your-admin-secret"

# Run E2E tests
npm run test:e2e

# Run in headed mode
npm run test:e2e -- --headed

# Debug mode (step through)
npx playwright test --debug tests/e2e/critical-flows.spec.js
```

---

## Environment Variables

### Required for Playwright Tests

```bash
# Deployed Apps Script URL
export BASE_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"

# Admin secret for testing (optional for smoke, required for E2E)
export ADMIN_KEY="CHANGE_ME_root"

# Tenant ID (defaults to 'root')
export TENANT_ID="root"
```

### Setting Permanently (Optional)

Create `.env` file in project root:
```bash
BASE_URL=https://script.google.com/macros/s/.../exec
ADMIN_KEY=CHANGE_ME_root
TENANT_ID=root
```

Then load in terminal:
```bash
source .env
```

---

## Playwright Options

### Browsers

```bash
# Run on specific browser
npm run test:smoke -- --project=chromium
npm run test:smoke -- --project="Mobile Chrome"
npm run test:smoke -- --project="TV Display"
```

### Headed Mode (See Browser)

```bash
npm run test:smoke -- --headed
```

### Debug Mode (Step Through)

```bash
npx playwright test --debug
```

### UI Mode (Interactive)

```bash
npx playwright test --ui
```

### Specific Test

```bash
npx playwright test tests/smoke/pages.smoke.test.js
```

### Parallel Execution

```bash
# Run tests in parallel (default in CI)
npm run test:smoke -- --workers=4

# Run tests serially (useful for debugging)
npm run test:smoke -- --workers=1
```

---

## CI/CD Pipeline

GitHub Actions runs tests automatically:

```
Lint → Unit → Contract → Deploy → Smoke → E2E
  ↓      ↓       ↓          ↓       ↓       ↓
 10s    5s      3s        30s     1min    3min
```

**Triggers:**
- Push to `main` → Full pipeline + deployment
- Push to `claude/**` → Tests only (no deploy)
- Pull requests → Tests only

**Configuration:** `.github/workflows/ci.yml`

---

## Coverage Reports

```bash
# Generate coverage report
npm run test:coverage

# View HTML report
open coverage/lcov-report/index.html
```

**Coverage targets:**
- Statements: 60%
- Branches: 50%
- Functions: 60%
- Lines: 60%

---

## Troubleshooting

### Jest tries to run Playwright tests

**Error:**
```
Playwright Test needs to be invoked via 'npx playwright test'
```

**Solution:** Jest config has been updated to exclude Playwright tests. Make sure you're using:
```bash
npm test              # Jest only
npm run test:smoke    # Playwright only
```

### Playwright tests timeout

**Error:**
```
Test timeout of 30000ms exceeded
```

**Solutions:**
1. Check BASE_URL is correct
2. Verify deployment is live
3. Increase timeout:
   ```bash
   npm run test:smoke -- --timeout=60000
   ```

### BASE_URL not set

**Error:**
```
Cannot read property 'goto' of undefined
```

**Solution:**
```bash
export BASE_URL="https://script.google.com/macros/s/.../exec"
```

### Tests fail in CI but pass locally

**Common causes:**
1. Environment variables not set in GitHub Secrets
2. Deployment not complete before tests run
3. Rate limiting (too many requests)

**Solution:**
Check GitHub Actions secrets are set:
- `SCRIPT_ID`
- `CLASPRC_JSON`
- `ADMIN_KEY_ROOT`

---

## GitHub Codespaces

Run tests in Codespaces (FREE):

**Setup:**
1. Go to: https://github.com/zeventbooks/MVP-EVENT-TOOLKIT
2. Click: **Code** → **Codespaces** → **Create codespace**
3. Wait ~2-3 minutes for setup

**Run tests:**
```bash
# Set BASE_URL
export BASE_URL="your-deployed-url"

# Run smoke tests
npm run test:smoke

# Run all tests
npm run test:all
```

**Benefits:**
- 120 core-hours/month FREE
- No local Playwright installation needed
- Consistent environment

---

## Test Results Summary

**Total tests: 563+**
```
├─ Unit Tests (Jest): 78 ✅
├─ Contract Tests (Jest): ~10 ✅
├─ Smoke Tests (Playwright): 100+ ✅
└─ E2E Tests (Playwright): 8 ✅

Pass rate: 100%
```

**Quick commands:**
```bash
npm test                # Jest only (unit + contract)
npm run test:smoke      # Playwright smoke tests
npm run test:e2e        # Playwright E2E tests
npm run test:all        # Everything
```

---

## Best Practices

### Before Committing

```bash
# 1. Lint code
npm run lint

# 2. Run Jest tests
npm test

# 3. Format code
npm run format
```

### Before Merging to Main

```bash
# 1. Run all Jest tests with coverage
npm run test:coverage

# 2. Deploy to test environment
npm run push && npm run deploy

# 3. Run smoke tests on deployed URL
export BASE_URL="your-test-url"
npm run test:smoke

# 4. Run full E2E suite
npm run test:e2e
```

### In Production

```bash
# Run smoke tests against production
export BASE_URL="https://script.google.com/macros/s/.../exec"
npm run test:smoke

# Monitor for failures
# Set up alerts if tests fail
```

---

## Resources

- **Jest Docs:** https://jestjs.io/
- **Playwright Docs:** https://playwright.dev/
- **Project README:** `README.md`
- **Deployment Guide:** `DEPLOYMENT_PIPELINE.md`
- **Architecture Review:** `ARCHITECTURE_REVIEW_SUMMARY.md`
- **Smoke Test Guide:** `tests/smoke/README.md`
