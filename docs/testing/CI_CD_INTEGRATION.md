# CI/CD Integration Guide

**Audience:** DevOps Engineers, SRE, Platform Teams
**Last Updated:** 2025-11-14

---

## Table of Contents

1. [Overview](#overview)
2. [GitHub Actions Integration](#github-actions-integration)
3. [Environment Variable Management](#environment-variable-management)
4. [Workflow Configuration](#workflow-configuration)
5. [Monitoring & Alerts](#monitoring--alerts)
6. [Troubleshooting CI/CD Issues](#troubleshooting-cicd-issues)

---

## Overview

### Current CI/CD Pipeline

```
Stage 1: Build & Deploy
    ↓
    Outputs: deployment_url
    ↓
Stage 2: Testing & QA  ← We are here
    ↓
    Uses: deployment_url from Stage 1
    Tests: API, Smoke, Flows, Pages (parallel)
    ↓
Quality Gate: All tests must pass
    ↓
Stage 3: Deploy to QA (if tests pass)
```

### Test Configuration in CI/CD

The centralized test configuration (`tests/shared/config/test.config.js`) integrates seamlessly with GitHub Actions:

1. **Automatic URL Detection**: BASE_URL comes from deployment output
2. **Secret Management**: ADMIN_KEY from GitHub Secrets
3. **Fail-Fast Validation**: Config errors caught before tests run
4. **Clear Error Messages**: Easy to debug in CI logs

---

## GitHub Actions Integration

### Workflow File

**Location:** `.github/workflows/stage2-testing.yml`

**Key Sections:**

```yaml
# Stage 2: Testing & QA
jobs:
  setup:
    name: 🔧 Setup & Extract Deployment URL
    outputs:
      deployment_url: ${{ steps.get-url.outputs.url }}
    steps:
      - name: Get deployment URL
        id: get-url
        run: |
          # Extract URL from Stage 1 artifacts
          gh run download ${{ github.event.workflow_run.id }} \
            --name deployment-info || true

          if [[ -f deployment-url.txt ]]; then
            DEPLOYMENT_URL=$(cat deployment-url.txt)
            echo "url=$DEPLOYMENT_URL" >> $GITHUB_OUTPUT
          else
            echo "url=https://qa.zeventbooks.com" >> $GITHUB_OUTPUT
          fi

  playwright-tests:
    name: 🎭 Playwright Tests - ${{ matrix.suite }}
    needs: setup
    strategy:
      fail-fast: false
      matrix:
        suite: [api, smoke, flows, pages]
    steps:
      - name: Run Playwright ${{ matrix.suite }} tests
        env:
          BASE_URL: ${{ needs.setup.outputs.deployment_url }}
          ADMIN_KEY: ${{ secrets.ADMIN_KEY_ROOT }}
        run: |
          echo "🎭 Running tests against: $BASE_URL"
          case "${{ matrix.suite }}" in
            api) npm run test:api ;;
            smoke) npm run test:smoke ;;
            flows) npm run test:flows ;;
            pages) npm run test:pages ;;
          esac
```

### Environment Variables in Workflows

| Variable | Source | Required | Description |
|----------|--------|----------|-------------|
| `BASE_URL` | Stage 1 output | ✅ Yes | Deployment URL from build |
| `ADMIN_KEY` | GitHub Secret | ✅ Yes | Admin authentication key |
| `TENANT_ID` | Hardcoded | ❌ No | Defaults to 'root' |
| `CI` | GitHub Actions | ❌ No | Auto-set to 'true' |

---

## Environment Variable Management

### GitHub Secrets

**Required Secrets:**

```bash
# Navigate to: Repository → Settings → Secrets and variables → Actions

ADMIN_KEY_ROOT    # Primary admin key for root tenant
```

**Optional Secrets (for multi-tenant testing):**

```bash
ABC_ADMIN_KEY     # Admin key for ABC tenant
CBC_ADMIN_KEY     # Admin key for CBC tenant
CBL_ADMIN_KEY     # Admin key for CBL tenant
```

**Setting Secrets via GitHub CLI:**

```bash
# Set from command line
gh secret set ADMIN_KEY_ROOT --body "your-secret-admin-key"

# Set from file
gh secret set ADMIN_KEY_ROOT < admin-key.txt

# List secrets
gh secret list
```

**Setting Secrets via GitHub UI:**

1. Go to repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `ADMIN_KEY_ROOT`
4. Value: Your admin key
5. Click **Add secret**

### Environment-Specific URLs

For different environments, set environment-specific secrets:

```yaml
# Development environment
- name: Run dev tests
  env:
    BASE_URL: ${{ secrets.DEV_URL }}
    ADMIN_KEY: ${{ secrets.DEV_ADMIN_KEY }}
  run: npm run test:api

# Staging environment
- name: Run staging tests
  env:
    BASE_URL: ${{ secrets.STAGING_URL }}
    ADMIN_KEY: ${{ secrets.STAGING_ADMIN_KEY }}
  run: npm run test:smoke

# Production (smoke tests only!)
- name: Run prod smoke tests
  env:
    BASE_URL: ${{ secrets.PROD_URL }}
    ADMIN_KEY: ${{ secrets.PROD_ADMIN_KEY }}
  run: npm run test:smoke
```

---

## Workflow Configuration

### Parallel Test Execution

Tests run in parallel using matrix strategy:

```yaml
strategy:
  fail-fast: false  # Continue all tests even if one fails
  matrix:
    suite:
      - api     # API contract tests
      - smoke   # Critical smoke tests
      - flows   # User flow tests
      - pages   # Page component tests
```

**Benefits:**
- ⚡ **3x faster** execution (parallel vs sequential)
- 🔍 **Complete visibility**: See all failures, not just first one
- 💰 **Cost efficient**: Parallel execution uses same minutes

### Test Suite Configuration

```yaml
case "${{ matrix.suite }}" in
  api)
    npm run test:api
    ;;
  smoke)
    npm run test:smoke
    ;;
  flows)
    npm run test:flows
    ;;
  pages)
    npm run test:pages
    ;;
esac
```

**Mapped to package.json:**

```json
{
  "scripts": {
    "test:api": "playwright test tests/e2e/api --reporter=html --reporter=line",
    "test:smoke": "playwright test tests/e2e/1-smoke/critical-smoke.spec.js --reporter=html --reporter=line",
    "test:flows": "playwright test tests/e2e/3-flows --reporter=html --reporter=line",
    "test:pages": "playwright test tests/e2e/2-pages --reporter=html --reporter=line"
  }
}
```

### Retry Configuration

Tests automatically retry in CI environment:

```javascript
// tests/shared/config/test.config.js
const IS_CI = process.env.CI === 'true';

const TEST_CONFIG = {
  retries: {
    api: IS_CI ? 3 : 1,  // 3 retries in CI, 1 locally
    ui: IS_CI ? 2 : 0,   // 2 retries in CI, none locally
    maxBackoffMs: 16000  // Max 16s exponential backoff
  }
};
```

**Retry behavior:**
- **Attempt 1**: No delay
- **Attempt 2**: 2s delay
- **Attempt 3**: 4s delay
- **Attempt 4**: 8s delay (if configured)

---

## Monitoring & Alerts

### GitHub Actions Summary

The workflow creates a summary with test results:

```markdown
## 🎯 Stage 2 Quality Gate Results

### 🚀 Process 3: Fast-Fail Progressive Testing

**Deployment URL:** `https://script.google.com/macros/s/.../exec`

### Test Execution (Parallel)

| Test Suite | Result |
|-----------|--------|
| 🎭 Playwright Tests (Parallel) | ✅ PASS |
| ↳ API Suite | ✅ |
| ↳ Smoke Suite | ✅ |
| ↳ Flow Suite | ✅ |
| ↳ Page Suite | ✅ |

### ✅ Quality Gate: **PASSED**

All tests passed successfully! Ready for QA deployment.
```

### Artifacts

Test reports are saved as artifacts:

```yaml
- name: Upload Playwright ${{ matrix.suite }} results
  if: always()
  uses: actions/upload-artifact@v4
  with:
    name: playwright-${{ matrix.suite }}-report
    path: playwright-report/
    retention-days: 7
```

**Download artifacts:**

```bash
# Using GitHub CLI
gh run download <run-id> --name playwright-api-report

# Or via GitHub UI
# Actions → Select workflow run → Artifacts → Download
```

### Notifications

**Slack Integration (example):**

```yaml
- name: Notify Slack on failure
  if: failure()
  uses: slackapi/slack-github-action@v1
  with:
    webhook-url: ${{ secrets.SLACK_WEBHOOK }}
    payload: |
      {
        "text": "❌ Tests failed in ${{ github.repository }}",
        "blocks": [
          {
            "type": "section",
            "text": {
              "type": "mrkdwn",
              "text": "*Test Suite Failed*\nRepository: ${{ github.repository }}\nBranch: ${{ github.ref }}\nActor: ${{ github.actor }}"
            }
          }
        ]
      }
```

### Health Checks

**Pre-test validation:**

```yaml
- name: Validate test configuration
  run: |
    node -e "
      try {
        const config = require('./tests/shared/config/test.config.js');
        console.log('✅ Configuration valid');
        console.log('BASE_URL:', config.BASE_URL);
        console.log('TENANT_ID:', config.TENANT_ID);
      } catch (error) {
        console.error('❌ Configuration error:', error.message);
        process.exit(1);
      }
    "
```

---

## Troubleshooting CI/CD Issues

### Issue: "BASE_URL environment variable is not set!"

**Symptoms:**
```
Error: ❌ BASE_URL environment variable is not set!

To run tests, you must set BASE_URL:
  export BASE_URL="https://..."
```

**Causes:**
1. Stage 1 deployment failed
2. Deployment artifact not created
3. Workflow not triggered correctly

**Solutions:**

```yaml
# Add debugging step
- name: Debug environment
  run: |
    echo "BASE_URL: ${BASE_URL:-NOT SET}"
    echo "ADMIN_KEY: ${ADMIN_KEY:+REDACTED}"
    echo "Deployment URL from needs: ${{ needs.setup.outputs.deployment_url }}"
```

### Issue: Tests fail with "Invalid URL"

**Symptoms:**
```
TypeError: apiRequestContext.get: Invalid URL
```

**Cause:** BASE_URL contains placeholder or invalid format

**Solution:**

```yaml
# Validate URL before running tests
- name: Validate BASE_URL
  run: |
    if [[ ! "$BASE_URL" =~ ^https?:// ]]; then
      echo "❌ BASE_URL is not a valid URL: $BASE_URL"
      exit 1
    fi
    echo "✅ BASE_URL is valid: $BASE_URL"
```

### Issue: ADMIN_KEY not working

**Symptoms:**
```
Error: Authentication failed
```

**Causes:**
1. Secret not set in repository
2. Wrong secret name
3. Secret value incorrect

**Solutions:**

```bash
# Check if secret exists
gh secret list | grep ADMIN_KEY

# Update secret
gh secret set ADMIN_KEY_ROOT --body "correct-admin-key"

# Verify in workflow
- name: Debug admin key (CAREFUL - don't log actual value!)
  run: |
    if [[ -z "$ADMIN_KEY" ]]; then
      echo "❌ ADMIN_KEY not set"
      exit 1
    else
      echo "✅ ADMIN_KEY is set (length: ${#ADMIN_KEY})"
    fi
```

### Issue: Tests timing out in CI

**Symptoms:**
```
Error: Timeout 30000ms exceeded
```

**Cause:** Tests configured with shorter timeouts than CI needs

**Solution:**

```javascript
// tests/shared/config/test.config.js
const IS_CI = process.env.CI === 'true';

const TEST_CONFIG = {
  timeouts: {
    medium: IS_CI ? 60000 : 30000,  // Longer timeout in CI
    long: IS_CI ? 120000 : 60000,
  }
};
```

### Issue: Parallel tests interfering with each other

**Symptoms:**
```
Error: Resource conflict
Error: Test data already exists
```

**Solution:**

```yaml
# Reduce parallelism
strategy:
  matrix:
    suite: [api, smoke, flows, pages]
jobs:
  playwright-tests:
    runs-on: ubuntu-latest
    env:
      BASE_URL: ${{ needs.setup.outputs.deployment_url }}
      # Add unique suffix for parallel tests
      TEST_RUN_ID: ${{ github.run_id }}-${{ matrix.suite }}
```

---

## Best Practices

### ✅ Do's

- **Do** validate environment variables before running tests
- **Do** use GitHub Secrets for sensitive data
- **Do** run tests in parallel for faster feedback
- **Do** upload test artifacts for debugging
- **Do** create meaningful workflow summaries
- **Do** set appropriate retry strategies

### ❌ Don'ts

- **Don't** hardcode secrets in workflows
- **Don't** run destructive tests against production
- **Don't** skip test failures with `continue-on-error`
- **Don't** use overly aggressive retries (wastes CI minutes)
- **Don't** commit .env files

---

## Performance Optimization

### Caching

```yaml
- name: Setup Node.js
  uses: actions/setup-node@v4
  with:
    node-version: '18'
    cache: 'npm'  # Cache npm dependencies

- name: Cache Playwright browsers
  uses: actions/cache@v3
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('**/package-lock.json') }}
```

### Selective Test Execution

```yaml
# Only run API tests on API changes
- name: Detect changed files
  id: changes
  run: |
    if git diff --name-only HEAD~1 | grep -q 'Code.gs\|lib/'; then
      echo "run_api_tests=true" >> $GITHUB_OUTPUT
    fi

- name: Run API tests
  if: steps.changes.outputs.run_api_tests == 'true'
  run: npm run test:api
```

---

## Additional Resources

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Playwright CI Configuration](https://playwright.dev/docs/ci)
- [GitHub Secrets Management](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Workflow Artifacts](https://docs.github.com/en/actions/using-workflows/storing-workflow-data-as-artifacts)

---

## Support

**Issues with CI/CD?**
1. Check [Troubleshooting](#troubleshooting-cicd-issues) section
2. Review workflow run logs
3. Validate secrets are set correctly
4. Contact DevOps team
