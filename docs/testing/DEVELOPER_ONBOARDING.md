# Developer Onboarding: Testing Guide

**Welcome to the MVP Event Toolkit Test Suite!** 🎉

This guide will get you up and running with our test infrastructure in **less than 10 minutes**.

---

## Table of Contents

1. [Quick Start (5 minutes)](#quick-start-5-minutes)
2. [Understanding Our Test Architecture](#understanding-our-test-architecture)
3. [Running Your First Test](#running-your-first-test)
4. [Writing Your First Test](#writing-your-first-test)
5. [Debugging Tests](#debugging-tests)
6. [Common Pitfalls](#common-pitfalls)
7. [Next Steps](#next-steps)

---

## Quick Start (5 minutes)

### Step 1: Clone and Install

```bash
# Clone the repository
git clone https://github.com/zeventbooks/MVP-EVENT-TOOLKIT.git
cd MVP-EVENT-TOOLKIT

# Install dependencies
npm install

# Install Playwright browsers
npx playwright install
```

### Step 2: Set Up Environment Variables

```bash
# Create your local .env file
cat > .env << EOF
BASE_URL=https://script.google.com/macros/s/YOUR_DEPLOYED_SCRIPT_ID/exec
ADMIN_KEY=your-admin-key-here
TENANT_ID=root
EOF

# Load environment variables
source .env
```

> **Note:** Get your `BASE_URL` and `ADMIN_KEY` from the project lead or deployment documentation.

### Step 3: Run Tests

```bash
# Quick smoke test (fastest, ~30 seconds)
npm run test:smoke

# API tests (~2 minutes)
npm run test:api

# All E2E tests (~10 minutes)
npm run test:e2e
```

**Expected Output:**

```
🎭 Running Playwright tests against: https://script.google.com/...

Running 33 tests using 4 workers
  ✓ tests/e2e/1-smoke/api-contract.spec.js:23 (2s)
  ✓ tests/e2e/1-smoke/api-contract.spec.js:50 (1s)
  ...

33 passed (45s)
```

🎉 **Congratulations!** You've successfully run your first tests!

---

## Understanding Our Test Architecture

### Test Pyramid

```
       /\
      /  \     E2E Tests (3-flows/)
     /----\
    /      \   Page Tests (2-pages/)
   /--------\
  /          \ Smoke Tests (1-smoke/)
 /------------\
/              \ API Tests (api/)
```

### Directory Structure

```
tests/
├── e2e/
│   ├── api/                    # API contract tests
│   │   ├── events-crud-api.spec.js
│   │   ├── sponsors-crud-api.spec.js
│   │   └── system-api.spec.js
│   ├── 1-smoke/                # Quick health checks
│   │   ├── api-contract.spec.js
│   │   ├── critical-smoke.spec.js
│   │   └── security-smoke.spec.js
│   ├── 2-pages/                # Page component tests
│   │   ├── admin-page.spec.js
│   │   ├── display-page.spec.js
│   │   └── public-page.spec.js
│   └── 3-flows/                # End-to-end flows
│       ├── admin-flows.spec.js
│       ├── customer-flows.spec.js
│       └── sponsor-flows.spec.js
├── shared/
│   ├── config/
│   │   └── test.config.js      # ⭐ CENTRALIZED CONFIG
│   ├── fixtures/
│   │   ├── events.fixtures.js
│   │   └── sponsors.fixtures.js
│   ├── helpers/
│   │   └── api.helpers.js
│   └── page-objects/
│       └── BasePage.js
└── smoke/                       # Legacy smoke tests (Jest)
```

### Test Types

| Type | Location | Runtime | Purpose | Run Frequency |
|------|----------|---------|---------|---------------|
| **API** | `tests/e2e/api/` | ~2 min | Validate API contracts | Every commit |
| **Smoke** | `tests/e2e/1-smoke/` | ~30 sec | Quick health checks | Every deployment |
| **Page** | `tests/e2e/2-pages/` | ~5 min | Component testing | Before merge |
| **Flow** | `tests/e2e/3-flows/` | ~10 min | User journeys | Before release |

---

## Running Your First Test

### Run a Single Test File

```bash
# Run specific test file
npx playwright test tests/e2e/api/events-crud-api.spec.js

# Run with headed browser (see what's happening)
npx playwright test tests/e2e/api/events-crud-api.spec.js --headed

# Run in debug mode (step through tests)
npx playwright test tests/e2e/api/events-crud-api.spec.js --debug
```

### Run Tests by Tag/Pattern

```bash
# Run all smoke tests
npm run test:smoke

# Run all API tests
npm run test:api

# Run tests matching pattern
npx playwright test --grep "Status API"
```

### View Test Report

```bash
# Run tests and open report
npm run test:api
npx playwright show-report
```

This opens an interactive HTML report in your browser with:
- Test results and timing
- Screenshots on failure
- Video recordings
- Network logs
- Trace files

---

## Writing Your First Test

### Basic Test Structure

```javascript
/**
 * my-feature.spec.js
 * Tests for my awesome new feature
 */

const { test, expect } = require('@playwright/test');
const { BASE_URL, ADMIN_KEY } = require('../../shared/config/test.config.js');

test.describe('My Feature', () => {

  test('should do something awesome', async ({ page }) => {
    // Arrange: Set up test data
    await page.goto(`${BASE_URL}?page=myfeature`);

    // Act: Perform action
    await page.click('#awesomeButton');

    // Assert: Verify result
    await expect(page.locator('#result')).toHaveText('Awesome!');
  });

});
```

### Using Centralized Config

**✅ DO THIS:**

```javascript
// Import from centralized config
const { BASE_URL, TENANT_ID, ADMIN_KEY } = require('../../shared/config/test.config.js');

test('my test', async ({ page }) => {
  await page.goto(`${BASE_URL}?page=admin&tenant=${TENANT_ID}`);
});
```

**❌ DON'T DO THIS:**

```javascript
// Don't hardcode environment variables
const BASE_URL = process.env.BASE_URL || 'invalid-url';

test('my test', async ({ page }) => {
  await page.goto(`${BASE_URL}?page=admin`);
});
```

### Using Helper Classes

**API Helpers:**

```javascript
const { ApiHelpers } = require('./api-helpers.js');

test('create event via API', async ({ request }) => {
  const api = new ApiHelpers(request, BASE_URL);

  // Create event
  const response = await api.createEvent('root', {
    name: 'Test Event',
    dateISO: '2025-12-31'
  }, ADMIN_KEY);

  const data = await response.json();
  expect(data.ok).toBe(true);
});
```

**Page Objects:**

```javascript
const { AdminPage } = require('../../shared/page-objects/AdminPage.js');

test('create event via UI', async ({ page }) => {
  const adminPage = new AdminPage(page);

  await adminPage.navigateToAdmin();
  await adminPage.createEvent({
    name: 'Test Event',
    date: '2025-12-31'
  });

  await expect(page.locator('.success-message')).toBeVisible();
});
```

---

## Debugging Tests

### Visual Debugging

```bash
# Open Playwright Inspector (step through test)
npx playwright test --debug

# Run with headed browser
npx playwright test --headed --slow-mo 1000
```

### Trace Viewer

```bash
# Run with trace
npx playwright test --trace on

# View trace
npx playwright show-trace trace.zip
```

### Console Logging

```javascript
test('debug test', async ({ page }) => {
  // Log to test output
  console.log('Current URL:', page.url());

  // Log page console messages
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));

  // Take screenshot for debugging
  await page.screenshot({ path: 'debug-screenshot.png' });
});
```

### Network Debugging

```javascript
test('debug API calls', async ({ page }) => {
  // Log all network requests
  page.on('request', request => {
    console.log('→', request.method(), request.url());
  });

  page.on('response', response => {
    console.log('←', response.status(), response.url());
  });

  await page.goto(BASE_URL);
});
```

---

## Common Pitfalls

### 1. ❌ Forgetting to Set BASE_URL

**Error:**
```
Error: ❌ BASE_URL environment variable is not set!
```

**Fix:**
```bash
export BASE_URL="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
```

### 2. ❌ Using Invalid BASE_URL

**Error:**
```
TypeError: apiRequestContext.get: Invalid URL
```

**Fix:**
```bash
# Check current value
echo $BASE_URL

# Set valid URL (must start with https://)
export BASE_URL="https://script.google.com/macros/s/REAL_ID/exec"
```

### 3. ❌ Hardcoding Configuration

**Wrong:**
```javascript
const BASE_URL = 'https://...';  // Don't do this!
```

**Right:**
```javascript
const { BASE_URL } = require('../../shared/config/test.config.js');
```

### 4. ❌ Not Cleaning Up Test Data

**Problem:**
```javascript
test('create event', async () => {
  const response = await api.createEvent('root', eventData, ADMIN_KEY);
  // Test ends, event still exists in database
});
```

**Solution:**
```javascript
test('create event', async () => {
  const response = await api.createEvent('root', eventData, ADMIN_KEY);
  const eventId = response.value.id;

  // Clean up after test
  test.afterEach(async () => {
    await api.deleteEvent('root', eventId, ADMIN_KEY);
  });
});
```

### 5. ❌ Tests Depending on Each Other

**Wrong:**
```javascript
let sharedEventId;

test('create event', async () => {
  sharedEventId = await createEvent();  // ❌ Side effect
});

test('update event', async () => {
  await updateEvent(sharedEventId);  // ❌ Depends on previous test
});
```

**Right:**
```javascript
test('create and update event', async () => {
  // Each test is independent
  const eventId = await createEvent();
  await updateEvent(eventId);
  await deleteEvent(eventId);
});
```

---

## Next Steps

### Learn More

1. **Read Documentation:**
   - [Test Configuration Guide](./TEST_CONFIGURATION.md)
   - [CI/CD Integration](./CI_CD_INTEGRATION.md)
   - [Troubleshooting Guide](./TROUBLESHOOTING.md)

2. **Explore Code:**
   - Browse `tests/e2e/api/` for API test examples
   - Check `tests/shared/helpers/` for helper functions
   - Review `tests/shared/page-objects/` for page objects

3. **Write Tests:**
   - Start with a simple smoke test
   - Add API tests for new endpoints
   - Create E2E flows for user stories

### Best Practices

- ✅ **Use centralized config** for all environment variables
- ✅ **Write descriptive test names** (they're documentation!)
- ✅ **Keep tests independent** (no shared state)
- ✅ **Clean up test data** (use afterEach hooks)
- ✅ **Use page objects** for reusable UI interactions
- ✅ **Add comments** explaining complex test logic

### Getting Help

**Resources:**
- **Documentation:** `docs/testing/`
- **Examples:** `tests/e2e/` (browse existing tests)
- **Team:** Ask in #testing Slack channel
- **Playwright Docs:** https://playwright.dev

**Common Questions:**
- "How do I run tests locally?" → [Quick Start](#quick-start-5-minutes)
- "My tests are failing" → [Debugging Tests](#debugging-tests)
- "How do I write a new test?" → [Writing Your First Test](#writing-your-first-test)
- "What's BASE_URL?" → [Test Configuration Guide](./TEST_CONFIGURATION.md)

---

## Cheat Sheet

### Essential Commands

```bash
# Run tests
npm run test:smoke        # Quick health check (30s)
npm run test:api          # API tests (2m)
npm run test:e2e          # All E2E tests (10m)

# Debug
npx playwright test --debug                    # Step through test
npx playwright test --headed                   # See browser
npx playwright test --trace on                 # Record trace

# Reports
npx playwright show-report                     # View HTML report
npx playwright show-trace trace.zip            # View trace

# Specific tests
npx playwright test tests/e2e/api/events-crud-api.spec.js
npx playwright test --grep "Status API"
```

### Essential Imports

```javascript
// Test framework
const { test, expect } = require('@playwright/test');

// Configuration
const { BASE_URL, TENANT_ID, ADMIN_KEY } = require('../../shared/config/test.config.js');

// Helpers
const { ApiHelpers } = require('../../shared/helpers/api.helpers.js');

// Page Objects
const { AdminPage } = require('../../shared/page-objects/AdminPage.js');
```

---

**Happy Testing!** 🚀

If you have questions, check the [Test Configuration Guide](./TEST_CONFIGURATION.md) or ask the team.
