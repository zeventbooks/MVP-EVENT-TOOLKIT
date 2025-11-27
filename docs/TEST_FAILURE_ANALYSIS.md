# Playwright Test Failure Analysis

> **Date**: 2025-11-27
> **Status**: Root Causes Identified, Fixes Proposed

---

## Executive Summary

The E2E Playwright tests are failing due to **API response format mismatches** between test expectations and actual API behavior. This document details the root causes and proposed fixes.

---

## Root Cause Analysis

### Issue 1: Status API Response Format Mismatch

**Problem**: Tests expect different response formats than what the API actually returns.

#### Actual API Response (`api_statusPure`)

The `/status` endpoint uses `api_statusPure()` which returns a **FLAT** format:

```javascript
// src/mvp/Code.gs:1659-1664
{
  ok: true,
  buildId: "triangle-extended-v1.5",  // Note: "buildId" not "build"
  brandId: "root",                     // Note: "brandId" not "brand"
  timestamp: "2025-11-27T..."
}
```

#### Test Expectations (INCORRECT)

| Test File | Expected Format | Issue |
|-----------|-----------------|-------|
| `system-api.spec.js:33` | `data.value.build` | Expects WRAPPED format with `value` property |
| `system-api.spec.js:37` | `data.value.brand` | Expects `brand` not `brandId` |
| `api-contract.spec.js:45` | `json.value` | Expects WRAPPED format |
| `api-contract.spec.js:48-53` | `json.value.build` | Wrong property path |

#### Test Expectations (CORRECT)

| Test File | Expected Format | Status |
|-----------|-----------------|--------|
| `critical-smoke.spec.js:54` | `json.buildId` | Correct FLAT format |
| `critical-smoke.spec.js:55` | `json.brandId` | Correct FLAT format |

### Issue 2: Two Different Status Functions

The codebase has TWO status functions with different response formats:

| Function | Location | Response Format |
|----------|----------|-----------------|
| `api_status()` | Code.gs:1583 | WRAPPED: `{ ok, value: { build, brand, ... } }` |
| `api_statusPure()` | Code.gs:1646 | FLAT: `{ ok, buildId, brandId, timestamp }` |

The `/status` page route uses `api_statusPure()` (FLAT), but tests expect `api_status()` format (WRAPPED).

---

## Affected Test Files

### High Priority (Blocking CI)

1. **`tests/e2e/api/system-api.spec.js`**
   - Lines 33, 36-38, 48-50, 58
   - All expect `data.value.build` and `data.value.brand`

2. **`tests/e2e/1-smoke/api-contract.spec.js`**
   - Lines 45-53, 77-86
   - Expects `json.value.build` and `json.value.brand`

### Working Correctly

1. **`tests/e2e/1-smoke/critical-smoke.spec.js`**
   - Lines 52-56
   - Correctly expects FLAT format

---

## Proposed Fixes

### Option A: Fix Tests to Match Current API (Recommended)

Update test expectations to match the actual FLAT response format:

```javascript
// BEFORE (WRONG)
expect(data).toHaveProperty('value');
expect(data.value).toHaveProperty('build');
expect(data.value.brand).toBe('root');

// AFTER (CORRECT)
expect(data).toHaveProperty('ok', true);
expect(data).toHaveProperty('buildId');
expect(data).toHaveProperty('brandId', 'root');
expect(data).toHaveProperty('timestamp');
```

### Option B: Create Separate Tests for Each API

- Test `api_status()` via RPC calls (WRAPPED format)
- Test `/status` page (FLAT format via `api_statusPure`)

---

## Files to Modify

| File | Changes Required |
|------|------------------|
| `tests/e2e/api/system-api.spec.js` | Update 4 tests to use FLAT format |
| `tests/e2e/1-smoke/api-contract.spec.js` | Update 3 tests to use FLAT format |

---

## Test Coverage Verification

After fixes, run:

```bash
# API tests
npm run test:api

# Smoke tests
npm run test:smoke

# All E2E
npm run test:e2e
```

---

## Additional Issues Identified

### 1. Hardcoded Build ID
- `critical-smoke.spec.js:54` hardcodes `'triangle-extended-v1.5'`
- Should validate format instead: `expect(json.buildId).toMatch(/^[\w-]+$/)`

### 2. Performance SLA Too Strict
- `api-contract.spec.js:62` expects `< 2000ms`
- Google Apps Script cold starts can exceed this
- Recommend: Increase to `< 5000ms` or add retry logic

### 3. Missing CI Environment Variables
- Tests skip when `ADMIN_KEY` not set
- CI must have secrets configured

---

## Implementation Priority

1. **P0**: Fix `system-api.spec.js` - Blocks API tests
2. **P0**: Fix `api-contract.spec.js` - Blocks smoke tests
3. **P1**: Remove hardcoded buildId check
4. **P2**: Adjust performance SLAs for cold starts

---

*Analysis performed by systematic review of test code vs API implementation.*
