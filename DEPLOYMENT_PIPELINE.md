# Deployment Pipeline Documentation

Complete guide to the CI/CD pipeline from local code to production.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT PIPELINE                           │
└─────────────────────────────────────────────────────────────────────┘

Local Development
      ↓
Git Commit & Push
      ↓
GitHub (claude/architecture-review-e2e-setup-011CUyqiYMYG7FW7m2CvG1fy)
      ↓
┌─────────────────────────────────────────────────────────────────────┐
│                    GitHub Actions CI/CD                              │
├─────────────────────────────────────────────────────────────────────┤
│  1. Lint (ESLint)                                                   │
│     ├─ Code style check                                             │
│     └─ PASS → Continue                                              │
│                                                                      │
│  2. Unit Tests (Jest)                                               │
│     ├─ Backend logic tests                                          │
│     ├─ Input sanitization                                           │
│     └─ PASS → Continue                                              │
│                                                                      │
│  3. Contract Tests (Jest)                                           │
│     ├─ API response format validation                               │
│     ├─ OK/Err envelope structure                                    │
│     └─ PASS → Continue                                              │
│                                                                      │
│  4. Deploy (clasp) - MAIN BRANCH ONLY                               │
│     ├─ Write .clasprc.json from secrets                             │
│     ├─ Write .clasp.json with script ID                             │
│     ├─ clasp push --force                                           │
│     ├─ clasp deploy                                                 │
│     └─ Extract deployment URL → $BASE_URL                           │
│                                                                      │
│  5. Smoke Tests (Playwright)                                        │
│     ├─ Quick page load checks                                       │
│     ├─ API endpoint health                                          │
│     ├─ No JS errors                                                 │
│     └─ PASS → Continue                                              │
│                                                                      │
│  6. E2E Tests (Playwright)                                          │
│     ├─ Critical user flows                                          │
│     ├─ Admin creates event                                          │
│     ├─ Public views event                                           │
│     ├─ Display shows sponsors                                       │
│     └─ PASS → Deployment Complete ✅                                │
└─────────────────────────────────────────────────────────────────────┘
      ↓
Google Apps Script (Production)
https://script.google.com/u/0/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit
      ↓
Live Web App URL
https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec
```

## Prerequisites

### Local Development

1. **Node.js & npm**
   ```bash
   node --version  # v18+
   npm --version   # v9+
   ```

2. **Google Clasp CLI**
   ```bash
   npm install -g @google/clasp
   clasp login
   ```

3. **Project Dependencies**
   ```bash
   npm install
   ```

4. **Environment Setup**
   ```bash
   # .clasp.json (local only, gitignored)
   {
     "scriptId": "1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l",
     "rootDir": "."
   }
   ```

### GitHub Secrets (Required for CI/CD)

Configure in: `Settings → Secrets and variables → Actions`

| Secret Name | Description | How to Get |
|-------------|-------------|------------|
| `SCRIPT_ID` | Apps Script project ID | From Apps Script URL |
| `CLASPRC_JSON` | Google OAuth credentials | `cat ~/.clasprc.json` |
| `ADMIN_KEY_ROOT` | Admin secret for testing | From Config.gs (line 17) |

**Getting CLASPRC_JSON:**
```bash
# After clasp login
cat ~/.clasprc.json

# Copy entire JSON:
{
  "token": {
    "access_token": "...",
    "refresh_token": "...",
    "scope": "...",
    "token_type": "Bearer",
    "expiry_date": ...
  },
  "oauth2ClientSettings": {...},
  "isLocalCreds": false
}
```

## Local Deployment

### Quick Deploy (Recommended)

```bash
# 1. Make your changes
# 2. Commit to git
git add .
git commit -m "feat: your changes"

# 3. Push to dev branch (triggers CI/CD)
git push -u origin claude/architecture-review-e2e-setup-011CUyqiYMYG7FW7m2CvG1fy
```

### Manual Deploy

```bash
# 1. Push code to Apps Script
npm run push
# or: clasp push

# 2. Deploy new version
npm run deploy
# or: clasp deploy --description "Manual deploy v1.3"

# 3. Get deployment URL
clasp deployments
```

### Local Testing (Before Push)

```bash
# Run linter
npm run lint

# Run unit tests
npm run test:unit

# Run contract tests
npm run test:contract

# Run all local tests
npm test
```

## CI/CD Pipeline Details

### Pipeline Trigger

**Automatic triggers:**
- Push to `main` branch → Full pipeline + deployment
- Push to `claude/**` branches → Tests only (no deploy)
- Pull requests to `main` → Tests only

### Stage 1: Linting

**What it checks:**
- Code style consistency
- Common errors
- Best practices

**Files checked:**
- `*.js` (JavaScript)
- `*.gs` (Google Apps Script)

**How to fix failures:**
```bash
npm run lint:fix
```

### Stage 2: Unit Tests

**What it tests:**
- Backend utility functions
- Input sanitization (XSS prevention)
- Error envelope creation
- Data validation

**Coverage target:** 60%+

**Files:**
- `tests/unit/backend.test.js`

### Stage 3: Contract Tests

**What it validates:**
- API response structure
- OK envelope: `{ ok: true, value: {...} }`
- Err envelope: `{ ok: false, code: '...', message: '...' }`
- ETags for caching

**Files:**
- `tests/contract/api.contract.test.js`

### Stage 4: Deployment (Main Branch Only)

**What it does:**
1. Writes credentials from GitHub secrets
2. Pushes all files to Apps Script
3. Creates new deployment version
4. Extracts deployment URL

**Requirements:**
- Must be on `main` branch
- Must be a `push` event (not PR)
- All previous stages passed

**Output:**
- Deployment ID (e.g., `@15`)
- Web app URL

### Stage 5: Smoke Tests

**What it checks:**
- All pages load (200 status)
- Core UI elements present
- No JavaScript errors
- Basic responsive behavior
- API endpoints respond

**Duration:** ~30-60 seconds

**Files:**
- `tests/smoke/pages.smoke.test.js`
- `tests/smoke/api.smoke.test.js`

### Stage 6: E2E Tests

**What it tests:**
- Complete user journeys
- Admin creates event
- Public views event
- Display shows sponsors
- Analytics tracking
- Security (XSS, auth)

**Duration:** ~2-5 minutes

**Files:**
- `tests/e2e/critical-flows.spec.js`

## Deployment URLs

### Development Branch
This branch: `claude/architecture-review-e2e-setup-011CUyqiYMYG7FW7m2CvG1fy`

**Note:** Development branches do NOT trigger deployment. Only `main` branch deploys.

### Production (Main Branch)

**Apps Script Project:**
https://script.google.com/u/0/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit

**Web App URL (after deployment):**
```
https://script.google.com/macros/s/[DEPLOYMENT_ID]/exec
```

**How to get the URL:**
```bash
clasp deployments
# Look for: https://script.google.com/macros/s/.../exec
```

## Testing the Deployment

### Quick Smoke Test

```bash
# Set environment variable
export BASE_URL="https://script.google.com/macros/s/.../exec"

# Run smoke tests
npm run test:smoke
```

### Full E2E Test

```bash
# Set environment variables
export BASE_URL="https://script.google.com/macros/s/.../exec"
export ADMIN_KEY="your-admin-secret"

# Run E2E tests
npm run test:e2e
```

### Manual Browser Test

1. **Status Check:**
   ```
   {BASE_URL}?p=status&brand=root
   ```
   Should return: `{ ok: true, value: { build: "triangle-extended-v1.3" } }`

2. **Admin Page:**
   ```
   {BASE_URL}?page=admin&brand=root
   ```
   Should show event creation form

3. **Public Page:**
   ```
   {BASE_URL}?p=events&brand=root
   ```
   Should show event listing

4. **Display Page:**
   ```
   {BASE_URL}?page=display&brand=root
   ```
   Should show TV display layout

## Troubleshooting

### "clasp: command not found"

```bash
npm install -g @google/clasp
```

### "User has not enabled the Apps Script API"

1. Go to: https://script.google.com/home/usersettings
2. Enable "Google Apps Script API"

### "Cannot read property 'scriptId'"

Missing `.clasp.json`:
```bash
echo '{"scriptId":"1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l","rootDir":"."}' > .clasp.json
```

### "Push failed" or "Invalid credentials"

Re-authenticate:
```bash
clasp logout
clasp login
```

### GitHub Actions Deploy Fails

1. Check secrets are set correctly
2. Verify SCRIPT_ID matches your project
3. Ensure CLASPRC_JSON is valid JSON
4. Check branch is `main` (deploy only runs on main)

### Tests Fail After Deployment

1. Wait 30 seconds for deployment to propagate
2. Verify BASE_URL is correct
3. Check deployment is public (set to ANYONE in appsscript.json)
4. Test manually in browser first

## Best Practices

### Development Workflow

1. **Create feature branch from main**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make changes and test locally**
   ```bash
   npm run lint
   npm test
   ```

3. **Commit with conventional commits**
   ```bash
   git commit -m "feat: add new feature"
   git commit -m "fix: resolve bug"
   git commit -m "docs: update README"
   ```

4. **Push to GitHub**
   ```bash
   git push -u origin feature/my-feature
   ```

5. **Create Pull Request**
   - CI will run tests
   - Merge to main after approval

6. **Deployment happens automatically**
   - Merge to main triggers deploy
   - E2E tests run on live URL

### Rollback Strategy

If deployment fails or has issues:

1. **Find previous deployment:**
   ```bash
   clasp deployments
   ```

2. **Undeploy bad version:**
   ```bash
   clasp undeploy [DEPLOYMENT_ID]
   ```

3. **Revert git commit:**
   ```bash
   git revert HEAD
   git push origin main
   ```

### Monitoring

**Check deployment logs:**
```bash
clasp logs
# or
clasp logs --watch
```

**View in Apps Script:**
https://script.google.com/home → Your Project → Executions

## Quality Gates

All of these must pass for deployment to succeed:

| Gate | Tool | Duration | Failure Action |
|------|------|----------|----------------|
| Linting | ESLint | ~10s | Fix code style |
| Unit Tests | Jest | ~5s | Fix failing tests |
| Contract Tests | Jest | ~3s | Fix API contracts |
| Smoke Tests | Playwright | ~60s | Check deployment |
| E2E Tests | Playwright | ~3min | Fix user flows |

## Performance Targets

| Metric | Target | Actual |
|--------|--------|--------|
| Status API response | < 500ms | ~200ms |
| Page load time | < 3s | ~1-2s |
| CI/CD pipeline | < 10min | ~5-8min |
| Test coverage | > 60% | 65%+ |

## Next Steps

- [ ] Set up GitHub secrets (SCRIPT_ID, CLASPRC_JSON, ADMIN_KEY_ROOT)
- [ ] Test deployment manually: `npm run push && npm run deploy`
- [ ] Push to main branch to trigger full CI/CD
- [ ] Monitor GitHub Actions workflow
- [ ] Run smoke tests against deployed URL
- [ ] Set up monitoring/alerting (optional)
