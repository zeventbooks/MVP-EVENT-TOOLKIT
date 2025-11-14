# ADR-001: Centralized Test Configuration

**Status:** Accepted
**Date:** 2025-11-14
**Deciders:** Development Team
**Technical Story:** Fix Playwright API test configuration issues

---

## Context and Problem Statement

We had 29+ test files across the codebase with hardcoded, invalid BASE_URL fallbacks (e.g., `'https://script.google.com/macros/s/.../exec'`). When BASE_URL environment variable was not set, tests would fail with cryptic "Invalid URL" errors. This created:

1. **Poor Developer Experience**: Unclear error messages, difficult debugging
2. **Maintenance Burden**: Configuration duplicated across 29+ files
3. **Inconsistency**: Different fallback values in different files
4. **Testing Fragility**: Easy to miss environment variables in new tests

## Decision Drivers

* **Developer Experience**: Clear, actionable error messages
* **Maintainability**: Single source of truth for configuration
* **Reliability**: Fail-fast validation prevents runtime errors
* **Scalability**: Easy to add new environment variables
* **Testing Best Practices**: DRY principle, centralized config

## Considered Options

### Option 1: Keep Distributed Configuration (Status Quo)
**Pros:**
- No changes required
- Each file is self-contained

**Cons:**
- Duplicated code across 29+ files
- Inconsistent fallback values
- Poor error messages
- High maintenance overhead

### Option 2: Centralized Configuration (SELECTED)
**Pros:**
- Single source of truth
- Validation at config load time
- Clear, helpful error messages
- Easy to maintain and extend
- Consistent across all tests

**Cons:**
- Requires migration effort
- Adds one more file to understand

### Option 3: Playwright Config Only
**Pros:**
- Uses Playwright's built-in config
- Standard pattern for Playwright tests

**Cons:**
- Doesn't help Jest tests
- Less flexible for multi-environment
- Harder to validate and provide custom errors

## Decision Outcome

**Chosen option: "Option 2: Centralized Configuration"**

We created `tests/shared/config/test.config.js` as the single source of truth for all test configuration.

### Implementation Details

```javascript
// tests/shared/config/test.config.js
function getValidatedBaseUrl() {
  const url = process.env.BASE_URL;

  if (!url || url.trim() === '') {
    throw new Error(
      '❌ BASE_URL environment variable is not set!\n\n' +
      'To run tests, you must set BASE_URL:\n' +
      '  export BASE_URL="https://script.google.com/..."\n'
    );
  }

  // Validate URL format
  try {
    new URL(url);
  } catch (error) {
    throw new Error(`❌ BASE_URL is not a valid URL: "${url}"`);
  }

  // Warn about placeholders
  if (url.includes('...') || url.includes('YOUR_SCRIPT_ID')) {
    console.warn('⚠️  WARNING: BASE_URL appears to contain placeholder');
  }

  return url;
}

const BASE_URL = getValidatedBaseUrl();
const TENANT_ID = process.env.TENANT_ID || 'root';
const ADMIN_KEY = process.env.ADMIN_KEY || 'CHANGE_ME_root';

module.exports = { BASE_URL, TENANT_ID, ADMIN_KEY, ... };
```

### Migration Strategy

1. **Automated Migration**: Created `scripts/fix-test-base-url.js` to automatically update test files
2. **Manual Review**: Updated complex files (page objects, fixtures) manually
3. **Validation**: Tested config validation with and without BASE_URL
4. **Documentation**: Created comprehensive docs for all team roles

### Positive Consequences

* ✅ **Better Developer Experience**: Clear error messages when config is wrong
* ✅ **Easier Maintenance**: Only one file to update for config changes
* ✅ **Fail-Fast**: Configuration errors caught at import time, not runtime
* ✅ **Consistency**: All tests use the same configuration logic
* ✅ **Extensibility**: Easy to add new environment variables
* ✅ **Documentation**: Single place to document all test configuration

### Negative Consequences

* ❌ **Migration Effort**: Required updating 32 test files
* ❌ **Learning Curve**: Developers need to understand centralized config
* ❌ **Additional Dependency**: All test files now depend on central config

## Pros and Cons of the Options

See "Considered Options" section above.

## Links

* **Implementation PR**: [Link to PR]
* **Related Issues**:
  * Playwright API tests failing with "Invalid URL" errors
  * Inconsistent test configuration across files
* **Documentation**:
  * `docs/testing/TEST_CONFIGURATION.md`
  * `scripts/fix-test-base-url.js`

---

## Technical Details

### Files Modified

**Core Configuration:**
- `tests/shared/config/test.config.js` (enhanced with validation)

**Test Files (32 files):**
- `tests/e2e/1-smoke/*` (3 files)
- `tests/e2e/2-pages/*` (3 files)
- `tests/e2e/3-flows/*` (8 files)
- `tests/e2e/*.spec.js` (9 files)
- `tests/smoke/*` (4 files)
- `tests/shared/fixtures/*` (2 files)
- `tests/shared/helpers/api.helpers.js`
- `tests/shared/page-objects/BasePage.js`

**New Files:**
- `scripts/fix-test-base-url.js` (automated migration script)

### Configuration Architecture

```
┌─────────────────────────────────────────┐
│  Environment Variables                  │
│  (BASE_URL, ADMIN_KEY, TENANT_ID, ...)  │
└─────────────┬───────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│  tests/shared/config/test.config.js     │
│                                         │
│  - Validates BASE_URL                   │
│  - Provides defaults                    │
│  - Exports typed config                 │
└─────────────┬───────────────────────────┘
              │
              ↓
┌─────────────────────────────────────────┐
│  Test Files                             │
│                                         │
│  const { BASE_URL } = require(...)      │
│  - API tests                            │
│  - Smoke tests                          │
│  - E2E tests                            │
│  - Page objects                         │
│  - Fixtures                             │
└─────────────────────────────────────────┘
```

### Error Handling

**Before (distributed config):**
```javascript
// test-file.spec.js
const BASE_URL = process.env.BASE_URL || 'https://script.google.com/macros/s/.../exec';

// Runtime error during test execution:
// TypeError: apiRequestContext.get: Invalid URL
//   at test('...', async ({ request }) => {
//     const response = await request.get(`${BASE_URL}?p=status`);
//                                     ^
```

**After (centralized config):**
```javascript
// test-file.spec.js
const { BASE_URL } = require('../../shared/config/test.config.js');

// Config load time error (before any tests run):
// Error: ❌ BASE_URL environment variable is not set!
//
// To run tests, you must set BASE_URL:
//   export BASE_URL="https://script.google.com/macros/s/YOUR_SCRIPT_ID/exec"
```

### Validation Rules

1. **Required**: BASE_URL must be set (no empty string)
2. **Format**: Must be a valid URL (validated with `new URL()`)
3. **Placeholder Detection**: Warns if contains '...', 'YOUR_SCRIPT_ID', 'CHANGE_ME'
4. **Type Safety**: All exports are properly typed for IDE autocomplete

### Extension Points

The centralized config makes it easy to add:

```javascript
// Environment-specific URLs
const DEV_URL = process.env.DEV_URL || BASE_URL;
const STAGING_URL = process.env.STAGING_URL || BASE_URL;
const PROD_URL = process.env.PROD_URL || BASE_URL;

// Multi-tenant admin keys
const TENANT_ADMIN_KEYS = {
  root: process.env.ROOT_ADMIN_KEY || ADMIN_KEY,
  abc: process.env.ABC_ADMIN_KEY || 'CHANGE_ME_abc',
  // ... more tenants
};

// Performance thresholds
const TEST_CONFIG = {
  timeouts: { short: 5000, medium: 30000, ... },
  performance: { apiResponseTime: 2000, ... },
  // ... more config
};
```

---

## Compliance

### Testing Best Practices

* ✅ **DRY Principle**: Configuration not duplicated
* ✅ **Fail-Fast**: Errors caught early
* ✅ **Clear Errors**: Actionable error messages
* ✅ **Environment Abstraction**: Tests don't directly access process.env

### Agile Principles

* ✅ **Working Software**: Tests now run reliably
* ✅ **Simplicity**: Simpler to understand and maintain
* ✅ **Technical Excellence**: Better code quality
* ✅ **Sustainable Development**: Easier to maintain long-term

---

## Future Considerations

1. **TypeScript Migration**: Consider adding TypeScript for better type safety
2. **Schema Validation**: Use JSON Schema or Zod for config validation
3. **Config Presets**: Add preset configurations for common scenarios
4. **Environment Files**: Support `.env` files for local development
5. **Monitoring**: Add telemetry for config validation failures

---

## References

* [Playwright Best Practices](https://playwright.dev/docs/best-practices)
* [Jest Configuration](https://jestjs.io/docs/configuration)
* [The Twelve-Factor App - Config](https://12factor.net/config)
* [ADR Template](https://github.com/joelparkerhenderson/architecture-decision-record)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2025-11-14 | Initial ADR created | Development Team |
| 2025-11-14 | Implemented centralized config | Development Team |
| 2025-11-14 | Migrated 32 test files | Development Team |
