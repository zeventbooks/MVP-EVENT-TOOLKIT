# Test Configuration Guide

**Audience:** All Team Members
**Last Updated:** 2025-11-14
**Status:** Active

---

## Table of Contents

1. [Overview](#overview)
2. [Quick Start](#quick-start)
3. [Configuration Architecture](#configuration-architecture)
4. [For Different Roles](#for-different-roles)
5. [Environment Variables](#environment-variables)
6. [Troubleshooting](#troubleshooting)

---

## Overview

### What Changed?

We centralized all test configuration to eliminate "Invalid URL" errors and provide a single source of truth for test environment settings.

### Benefits by Role

| Role | Benefit |
|------|---------|
| **Product Owner** | Faster feedback cycles, reduced test failures |
| **Developers** | Clear error messages, easier local testing |
| **QA/SDET** | Consistent test configuration, easier debugging |
| **DevOps** | Centralized env var management, better CI/CD integration |
| **Architects** | Single source of truth, better maintainability |

---

## Quick Start

### Running Tests Locally

```bash
# 1. Set required environment variables
export BASE_URL="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
export ADMIN_KEY="your-admin-key"

# 2. Run tests
npm run test:api          # API tests
npm run test:smoke        # Smoke tests
npm run test:e2e          # All E2E tests
```

### Running Tests in CI/CD

Environment variables are automatically set by GitHub Actions from deployment outputs. No manual configuration needed.

---

## Configuration Architecture

### File Structure

```
tests/
├── shared/
│   └── config/
│       └── test.config.js          # ⭐ CENTRALIZED CONFIG
├── e2e/
│   ├── config.js                   # Imports from shared config
│   ├── api/*.spec.js               # Use centralized config
│   └── 1-smoke/*.spec.js           # Use centralized config
└── smoke/*.test.js                 # Use centralized config
```

### Configuration Flow

```
Environment Variables (BASE_URL, ADMIN_KEY)
    ↓
tests/shared/config/test.config.js (Validation & Defaults)
    ↓
Test Files (Import from centralized config)
    ↓
Playwright/Jest Test Execution
```

### Centralized Config Features

1. **Validation**: Validates BASE_URL format and provides clear error messages
2. **Multi-Environment**: Supports DEV_URL, STAGING_URL, PROD_URL
3. **Multi-Tenant**: Supports tenant-specific admin keys
4. **Defaults**: Provides sensible defaults for optional variables
5. **Type Safety**: Exports typed configuration objects

---

## For Different Roles

### 👨‍💼 Product Owner

**What to Know:**
- Tests now fail fast with clear error messages when misconfigured
- Reduced debugging time = faster delivery
- Single configuration point reduces maintenance overhead

**Key Metrics:**
- **Before**: ~29 files with inconsistent configuration
- **After**: 1 centralized config file
- **Impact**: 97% reduction in configuration complexity

---

### 🏗️ Software Architect

**Architecture Decision Record:** See [ADR-001: Centralized Test Configuration](#)

**Design Patterns:**
- **Single Source of Truth**: All test config in one place
- **Fail-Fast Validation**: Config errors detected at load time
- **Environment Abstraction**: Tests don't know about env vars

**Technical Details:**

```javascript
// Old Pattern (❌ Don't use)
const BASE_URL = process.env.BASE_URL || 'invalid-fallback';

// New Pattern (✅ Use this)
const { BASE_URL } = require('../../shared/config/test.config.js');
```

**Migration Path:**
1. Run `node scripts/fix-test-base-url.js` for automated migration
2. Manual review of edge cases
3. Validate with test run

---

### 💻 Frontend Integration

**What Changed:**
- All frontend E2E tests now use centralized config
- Page objects updated to use validated BASE_URL
- Mobile performance tests now properly configured

**Files Affected:**
```
tests/e2e/2-pages/*.spec.js          # Page component tests
tests/e2e/3-flows/*.spec.js          # User flow tests
tests/e2e/mobile-performance.spec.js # Mobile tests
tests/shared/page-objects/BasePage.js # Page object base class
```

**Example Usage:**

```javascript
// In your test file
const { BASE_URL, TENANT_ID } = require('../../shared/config/test.config.js');

test('should load admin page', async ({ page }) => {
  await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);
  // ... rest of test
});
```

---

### 🧪 Software Testing / QA

**Running Different Test Suites:**

```bash
# API Contract Tests
npm run test:api

# Smoke Tests (Quick health checks)
npm run test:smoke

# Full E2E Suite
npm run test:e2e

# Specific test file
BASE_URL="..." npx playwright test tests/e2e/api/events-crud-api.spec.js
```

**Test Configuration Options:**

```javascript
const { TEST_CONFIG } = require('./tests/shared/config/test.config.js');

// Available timeouts
TEST_CONFIG.timeouts.short      // 5s - quick operations
TEST_CONFIG.timeouts.medium     // 30s - API calls
TEST_CONFIG.timeouts.long       // 60s - complex operations
TEST_CONFIG.timeouts.veryLong   // 120s - full flows

// Performance thresholds
TEST_CONFIG.performance.apiResponseTime    // 2s
TEST_CONFIG.performance.pageLoadTime       // 5s
```

**Debugging Failed Tests:**

1. **Check Configuration:**
   ```bash
   node -e "const c = require('./tests/shared/config/test.config.js'); console.log(c.BASE_URL)"
   ```

2. **Validate Environment:**
   ```bash
   echo $BASE_URL
   echo $ADMIN_KEY
   ```

3. **Run with Verbose Output:**
   ```bash
   DEBUG=pw:api npm run test:api
   ```

---

### 🔧 SRE / SDET

**Monitoring & Observability:**

The centralized config provides consistent logging:

```javascript
// Config validation errors are logged to stderr
// Easy to parse in monitoring systems

// Example error format:
❌ BASE_URL environment variable is not set!

To run tests, you must set BASE_URL:
  export BASE_URL="https://..."
```

**CI/CD Integration:**

```yaml
# GitHub Actions example
- name: Run Playwright Tests
  env:
    BASE_URL: ${{ needs.deploy.outputs.deployment_url }}
    ADMIN_KEY: ${{ secrets.ADMIN_KEY_ROOT }}
  run: npm run test:api
```

**Health Checks:**

```bash
# Validate test configuration without running tests
node -e "
  try {
    const config = require('./tests/shared/config/test.config.js');
    console.log('✅ Configuration valid');
    console.log('BASE_URL:', config.BASE_URL);
  } catch (error) {
    console.error('❌ Configuration error:', error.message);
    process.exit(1);
  }
"
```

**Retry Strategy:**

```javascript
// Configured in TEST_CONFIG
retries: {
  api: IS_CI ? 3 : 1,      // 3 retries in CI, 1 locally
  ui: IS_CI ? 2 : 0,       // 2 retries in CI, 0 locally
  maxBackoffMs: 16000      // Max 16s backoff
}
```

---

### ⚙️ DevOps

**Environment Variable Management:**

| Environment | BASE_URL Source | ADMIN_KEY Source |
|-------------|----------------|------------------|
| **Local** | Developer's export | Developer's export |
| **CI/CD** | Deployment output | GitHub Secrets |
| **Staging** | STAGING_URL env var | GitHub Secrets |
| **Production** | PROD_URL env var | GitHub Secrets |

**GitHub Secrets Required:**

```bash
# Repository Secrets (Settings > Secrets and variables > Actions)
ADMIN_KEY_ROOT    # Root tenant admin key
ADMIN_KEY         # Fallback admin key (optional)
ABC_ADMIN_KEY     # Tenant-specific keys (optional)
CBC_ADMIN_KEY     # (optional)
CBL_ADMIN_KEY     # (optional)
```

**Workflow Integration:**

```yaml
# .github/workflows/stage2-testing.yml
jobs:
  playwright-tests:
    env:
      BASE_URL: ${{ needs.setup.outputs.deployment_url }}
      ADMIN_KEY: ${{ secrets.ADMIN_KEY_ROOT }}
    steps:
      - name: Run tests
        run: npm run test:api
```

**Multi-Environment Support:**

```bash
# Development
DEV_URL="https://dev.example.com" npm run test:api

# Staging
STAGING_URL="https://staging.example.com" npm run test:api

# Production (use with caution!)
PROD_URL="https://prod.example.com" npm run test:smoke
```

---

### 📚 Documentation

**Files Updated:**

1. ✅ `docs/testing/TEST_CONFIGURATION.md` (this file)
2. ⏳ `docs/testing/TROUBLESHOOTING.md` (next)
3. ⏳ `docs/testing/CI_CD_INTEGRATION.md` (next)
4. ⏳ `docs/architecture/ADR-001-centralized-test-config.md` (next)
5. ⏳ `README.md` (update testing section)

**Documentation Standards:**

- All test files include JSDoc comments
- Configuration exports are typed
- Error messages include actionable guidance
- Examples provided for common use cases

---

## Environment Variables

### Required Variables

| Variable | Description | Example | Used By |
|----------|-------------|---------|---------|
| `BASE_URL` | Deployment URL | `https://script.google.com/...` | All tests |
| `ADMIN_KEY` | Root admin key | `your-secret-key` | Admin/write tests |

### Optional Variables

| Variable | Description | Default | Used By |
|----------|-------------|---------|---------|
| `TENANT_ID` | Tenant identifier | `root` | Multi-tenant tests |
| `DEV_URL` | Development URL | `BASE_URL` | Dev environment |
| `STAGING_URL` | Staging URL | `BASE_URL` | Staging tests |
| `PROD_URL` | Production URL | `BASE_URL` | Prod smoke tests |
| `ROOT_ADMIN_KEY` | Root tenant key | `ADMIN_KEY` | Root tenant tests |
| `ABC_ADMIN_KEY` | ABC tenant key | `CHANGE_ME_abc` | ABC tenant tests |
| `CBC_ADMIN_KEY` | CBC tenant key | `CHANGE_ME_cbc` | CBC tenant tests |
| `CBL_ADMIN_KEY` | CBL tenant key | `CHANGE_ME_cbl` | CBL tenant tests |

### Setting Variables

**Local Development:**

```bash
# Create .env file (add to .gitignore!)
cat > .env << EOF
BASE_URL=https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec
ADMIN_KEY=your-secret-admin-key
TENANT_ID=root
EOF

# Load and run
source .env && npm run test:api
```

**CI/CD (GitHub Actions):**

Variables are set automatically from deployment outputs and secrets.

---

## Troubleshooting

### Error: "BASE_URL environment variable is not set!"

**Cause:** BASE_URL not defined in environment.

**Solution:**
```bash
export BASE_URL="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
npm run test:api
```

### Error: "BASE_URL is not a valid URL"

**Cause:** BASE_URL contains placeholder or invalid format.

**Solution:**
```bash
# Check current value
echo $BASE_URL

# Set valid URL
export BASE_URL="https://script.google.com/macros/s/REAL_SCRIPT_ID/exec"
```

### Warning: "BASE_URL appears to contain placeholder"

**Cause:** BASE_URL contains '...', 'YOUR_SCRIPT_ID', or other placeholder text.

**Solution:** Update to use real deployment URL.

### Tests Fail with "Invalid URL" in Playwright

**Cause:** Test file not using centralized config.

**Solution:**
```bash
# Run migration script
node scripts/fix-test-base-url.js

# Or manually update test file:
# Old: const BASE_URL = process.env.BASE_URL || 'invalid';
# New: const { BASE_URL } = require('../../shared/config/test.config.js');
```

### CI/CD Tests Failing

**Checklist:**
1. ✅ Verify BASE_URL is set in workflow: `echo $BASE_URL`
2. ✅ Verify ADMIN_KEY secret exists: Check GitHub Secrets
3. ✅ Verify deployment succeeded: Check Stage 1 workflow
4. ✅ Check deployment URL is valid: Visit URL in browser

---

## Best Practices

### ✅ Do's

- **Do** use centralized config for all new tests
- **Do** validate configuration before running tests
- **Do** use environment-specific URLs for different stages
- **Do** keep secrets in GitHub Secrets, not code
- **Do** provide clear error messages in tests

### ❌ Don'ts

- **Don't** hardcode URLs in test files
- **Don't** commit `.env` files with secrets
- **Don't** use placeholder URLs in production tests
- **Don't** bypass configuration validation
- **Don't** duplicate environment variables across files

---

## Additional Resources

- [Playwright Documentation](https://playwright.dev)
- [GitHub Actions Workflow](../../.github/workflows/stage2-testing.yml)
- [Test Config Source](../../tests/shared/config/test.config.js)
- [Migration Script](../../scripts/fix-test-base-url.js)

---

## Support

**Questions?**
- Check [Troubleshooting](#troubleshooting) section
- Review [GitHub Issues](https://github.com/zeventbooks/MVP-EVENT-TOOLKIT/issues)
- Contact: DevOps team

**Found a bug?**
- Open issue with "testing" label
- Include error message and steps to reproduce
