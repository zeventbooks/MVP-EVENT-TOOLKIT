# Production Deployment Policy

**Last Updated:** 2025-12-01
**Status:** Active

---

## Policy Statement

> **All production deployments MUST go through GitHub Actions CI/CD.**
>
> Manual deployment methods (clasp push, copy/paste, direct Apps Script edits)
> are **prohibited** for production. No exceptions.

This policy exists to prevent "random Tuesday" outages caused by bypassing safety nets.

---

## Why CI-Only?

| Risk | Without CI | With CI |
|------|-----------|---------|
| Untested code in prod | Possible | Blocked |
| Schema drift | Undetected | Caught by contract tests |
| Syntax errors | Live in prod | Caught by lint |
| Regressions | Undetected | Caught by unit tests |
| Broken API contracts | Live in prod | Caught by E2E tests |
| Audit trail | None | Full git history |
| Rollback capability | Manual guesswork | Versioned deployments |

---

## The One True Path to Production

```
PR to main
    │
    ▼
┌─────────────────────────────────────────┐
│           GitHub Actions CI             │
│                                         │
│  1. Lint (ESLint)                       │
│  2. Unit Tests (512+ tests)             │
│  3. Contract Tests (155+ tests)         │
│  4. MVP Guards                          │
│           │                             │
│           ▼                             │
│  5. Deploy to Apps Script (clasp)       │
│  6. Update Cloudflare Worker            │
│           │                             │
│           ▼                             │
│  7. Stage 2 E2E Tests (Playwright)      │
│     - API tests                         │
│     - Smoke tests                       │
│     - Flow tests                        │
│     - Page tests                        │
└─────────────────────────────────────────┘
    │
    ▼
Production Live
```

---

## Deployment Methods

### ALLOWED: GitHub Actions (Production)

| Trigger | Branch | Result |
|---------|--------|--------|
| Push | `main` | Build + Test + Deploy to Prod |
| Push | `release/*` | Build + Test + Deploy to Prod |
| PR | `main` | Build + Test (no deploy) |

**Workflow:** `.github/workflows/stage1-deploy.yml`

The workflow:
1. Runs lint, unit tests, contract tests, MVP guards
2. **Only deploys if ALL tests pass**
3. Only deploys on push to `main` or `release/*` branches
4. PRs are validated but NOT deployed

### PROHIBITED: Manual Methods (Production)

These methods are **DEV/STAGE ONLY**:

| Method | Status | Use Case |
|--------|--------|----------|
| `clasp push` | Dev/Stage only | Local development |
| `clasp deploy` | Dev/Stage only | Creating test deployments |
| Apps Script Editor | Dev/Stage only | Quick debugging |
| Copy/paste code | Dev/Stage only | Never recommended |

**If you find yourself tempted to use these for production, STOP and create a PR.**

---

## What If I Need to Deploy Urgently?

**Still use CI.** Even hotfixes go through the pipeline:

```bash
# Create hotfix branch
git checkout -b hotfix/critical-fix main

# Make the fix
# ... edit files ...

# Commit and push
git add .
git commit -m "fix: critical production issue"
git push -u origin hotfix/critical-fix

# Create PR and merge (fast-track review if needed)
# CI will deploy automatically after merge
```

The CI pipeline is fast (~3-5 minutes). If tests are green, you're deploying known-good code. If tests fail, you just avoided deploying broken code to production.

---

## Emergency Rollback

If production is broken and you need to rollback:

### Option 1: Revert via Git (Preferred)

```bash
# Revert the bad commit
git revert HEAD
git push origin main

# CI will deploy the reverted version
```

### Option 2: Manual Rollback in Apps Script UI (Last Resort)

**Only if CI is completely broken:**

1. Open [Apps Script Deployments](https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/deployments)
2. Select previous working version
3. **Document this action immediately** in a GitHub issue
4. Fix CI and redeploy properly

---

## Enforcement

This policy is enforced by:

1. **GitHub Branch Protection** - PRs required for `main`
2. **CI Workflow Conditions** - Deploy job only runs after test jobs pass
3. **Code Review** - All PRs reviewed before merge
4. **Team Agreement** - Everyone understands and follows this policy

---

## GitHub Secrets Required

The CI pipeline uses these secrets (configured by admins only):

| Secret | Purpose |
|--------|---------|
| `OAUTH_CREDENTIALS` | Clasp OAuth credentials (JSON) |
| `DEPLOYMENT_ID` | Production deployment ID |
| `CLOUDFLARE_API_TOKEN` | Cloudflare Worker deployment |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account |

**These secrets are the "keys to production" - guard them carefully.**

---

## Checklist: Is This a Production Deployment?

Before using any deployment method, ask:

- [ ] Will this change affect `eventangle.com`?
- [ ] Will this change affect the production Apps Script deployment?
- [ ] Are real users going to see this change?

If **any** answer is YES → **Use CI (PR to main)**

If **all** answers are NO → Manual methods are acceptable for dev/stage

---

## Related Documentation

- [APPS_SCRIPT_PROJECT.md](./APPS_SCRIPT_PROJECT.md) - Project configuration
- [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) - Full deployment guide
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Deployment runbook
- [.github/workflows/stage1-deploy.yml](./.github/workflows/stage1-deploy.yml) - CI workflow
