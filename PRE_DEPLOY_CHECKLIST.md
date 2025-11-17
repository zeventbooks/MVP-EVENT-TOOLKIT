# Pre-Deployment Checklist

**Print this out and check off before EVERY deployment!**

---

## 🚨 CRITICAL - ONE-TIME SETUP (Do Once, Verify Before First Deploy)

### Apps Script API - User Settings ⚠️ MOST COMMON FAILURE!

- [ ] **Go to:** https://script.google.com/home/usersettings
- [ ] **Verify:** ✅ "Google Apps Script API" is **ON**
- [ ] **Who:** Must be done by PROJECT OWNER
- [ ] **When last checked:** ________________

> ⚠️ If this is OFF, ALL deployments will fail with "User has not enabled API" error!

### Service Account Access to Apps Script

- [ ] **Go to:** https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit
- [ ] **Click:** "Share" button (top right)
- [ ] **Verify:** `apps-script-deployer@zeventbooks.iam.gserviceaccount.com` is listed
- [ ] **Verify:** Role is "Editor"
- [ ] **When last checked:** ________________

### GitHub Secrets

- [ ] **Go to:** https://github.com/zeventbooks/MVP-EVENT-TOOLKIT/settings/secrets/actions
- [ ] **Verify:** `APPS_SCRIPT_SERVICE_ACCOUNT_JSON` exists
- [ ] **Verify:** `SCRIPT_ID` exists and equals `1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l`
- [ ] **Verify:** `ADMIN_KEY_ROOT` exists (for E2E tests)
- [ ] **When last checked:** ________________

---

## 📋 BEFORE EVERY DEPLOYMENT

### 1. Code Quality

```bash
# Run all checks
npm run lint          # ✅ Pass
npm test              # ✅ Pass
npm run format        # ✅ Run
```

- [ ] Linting passed (no errors)
- [ ] All tests passed (94+ tests)
- [ ] Code formatted

### 2. Configuration Verification

```bash
# Run verification script
./scripts/verify-deployment-config.sh
```

- [ ] Verification script passed
- [ ] No failed checks
- [ ] Warnings reviewed and acceptable

### 3. Git Status

```bash
git status
```

- [ ] All changes committed
- [ ] No sensitive data in code (API keys, passwords, secrets)
- [ ] Commit message is descriptive
- [ ] Branch is up to date with remote

### 4. Documentation

- [ ] Updated relevant documentation if features changed
- [ ] Updated DEPLOYMENT_CONFIGURATION.md if IDs changed
- [ ] Updated this checklist if process changed

---

## 🚀 DEPLOYMENT

### Option A: CI/CD (Recommended)

```bash
# Push to main to trigger automatic deployment
git push origin main
```

- [ ] Push completed successfully
- [ ] **Monitor:** https://github.com/zeventbooks/MVP-EVENT-TOOLKIT/actions
- [ ] CI/CD pipeline started
- [ ] Watch for any failures

### Option B: Manual (Emergency/Testing)

```bash
# Set environment variables
export SCRIPT_ID='1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l'
export SERVICE_ACCOUNT_JSON='<paste-json-here>'

# Deploy
npm run deploy
```

- [ ] Environment variables set
- [ ] Deployment completed successfully
- [ ] Deployment URL received

---

## ✅ POST-DEPLOYMENT

### 1. Verify Deployment

```bash
# Test production URL
curl "https://script.google.com/macros/s/AKfycbx6ZTFD8H3NiAlagCLHa9DPzhgxcqWRmGXGiXzzC8CTpRUBUY_YHhfKDzGCdgMkKMZNMA/exec?page=status"
```

- [ ] Status endpoint returns 200 OK
- [ ] Response contains valid data

### 2. Smoke Tests

Open in browser and verify:

- [ ] **Status:** `?page=status` loads
- [ ] **Admin:** `?page=admin&tenant=root` loads (with key)
- [ ] **Public:** `?p=events&tenant=root` loads
- [ ] **Display:** `?page=display&tenant=root&tv=1` loads
- [ ] **Poster:** `?page=poster&tenant=root` loads

### 3. E2E Tests

- [ ] GitHub Actions E2E tests passed (if CI/CD)
- [ ] Or run manually: `npm run test:e2e`

### 4. Monitor

- [ ] Check Apps Script logs for errors: https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/executions
- [ ] No unexpected errors in logs
- [ ] Performance is acceptable

---

## 🐛 IF DEPLOYMENT FAILS

### Common Failures & Quick Fixes

#### ❌ "User has not enabled the Apps Script API"

**Fix:**
1. Go to: https://script.google.com/home/usersettings
2. Toggle ON: "Google Apps Script API"
3. Wait 2-5 minutes
4. Retry deployment

#### ❌ "Service account does not have permission"

**Fix:**
1. Go to: https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit
2. Click "Share"
3. Add: `apps-script-deployer@zeventbooks.iam.gserviceaccount.com` as Editor

#### ❌ GitHub Actions fails

**Fix:**
1. Check logs: https://github.com/zeventbooks/MVP-EVENT-TOOLKIT/actions
2. Verify GitHub secrets are set correctly
3. Run locally: `npm run deploy:diagnose`

#### ❌ Deployment succeeds but URL returns 404

**Fix:**
1. Go to: https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/deployments
2. Verify deployment settings:
   - Execute as: **Me** (project owner)
   - Who has access: **Anyone**

---

## 🔄 ROLLBACK (If bad deployment goes live)

### Quick Rollback

```bash
# Revert the commit
git revert <bad-commit-sha>
git push origin main
```

### Manual Rollback

1. Go to: https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/deployments
2. Find previous working version
3. Click "⋮" → Promote to production

---

## Client Showcase Routine

Keep your MVP demos predictable and impressive by layering a reusable showcase routine on top of the deployment checklist.

### 1. Prime Your Toolkit (one-time per laptop)
- Run `npm install` to ensure dependencies exist.
- Copy `monitoring.targets.example.json` to `.monitoring/targets.json`, then add client-specific URLs and `contains` markers.
- Execute `npm run deploy:verify-secrets` so CI credentials are ready before you travel.

### 2. T-1 Day Confidence Pass (~30 minutes)
| Step | Command | Why |
| --- | --- | --- |
| Sanity test suites | `npm run test:quick` | Confirms Jest + core Playwright stay green. |
| Validate demo surfaces | `npm run monitor:health -- --config=.monitoring/targets.json --report` | Generates `.monitoring/latest-report.md` for proof. |
| Review report | Open `.monitoring/latest-report.md` | Verify each row contains the expected CTA/sponsor copy. |
| Confirm target deployment | `npm run deploy:status` | Ensures the Apps Script version you plan to show is still active. |
| Refresh talking points | — | Update your deck/notes with anything notable from the run. |

### 3. Day-of Warm-Up (60 minutes before clients join)
1. Seed data if needed (`npm run qa:seed:triangle:before` or other scenario).
2. Start live monitoring: `npm run monitor:health:watch -- --config=.monitoring/targets.json --interval=60000 --report=.monitoring/live.md`.
3. Stage browser tabs (Admin, Public, Poster, Diagnostics, ApiDocs) using URLs stored in your monitoring config.
4. Dry-run risky flows (Create Event, Add Sponsor, Download Poster) so caches are ready.

### 4. During the Meeting
- Share the latest Markdown report (from `.monitoring/live.md`) up front to demonstrate operational rigor.
- Narrate with telemetry: if a row flips to ⚠️ during the meeting, acknowledge it and keep the watcher running.
- Close with clear next steps (deployment timeline, docs, how they can run the same health scripts themselves).

### 5. After the Call (~10 minutes)
1. `npm run monitor:health:history -- --limit=10` and capture a screenshot/snippet of the success streak.
2. Email the Markdown report, meeting recording, and any promised follow-ups.
3. Create tickets or TODOs immediately while details are fresh.

This showcase routine turns solo prep into a systematic, data-backed experience without adding another standalone document to maintain.

## 📝 DEPLOYMENT LOG

Keep track of deployments:

| Date | Version | Deployed By | Status | Notes |
|------|---------|-------------|--------|-------|
| YYYY-MM-DD | vX.X.X | Name | ✅/❌ | Description |
| | | | | |

---

## 🆘 EMERGENCY CONTACTS

| Issue Type | Contact | Action |
|------------|---------|--------|
| Apps Script API user setting | Project Owner | Enable at https://script.google.com/home/usersettings |
| Service account access | GCP Admin | Grant permissions |
| GitHub secrets | DevOps Lead | Update secrets |
| Code issues | Tech Lead | Fix and redeploy |

---

## 📚 REFERENCES

- **Full Config:** DEPLOYMENT_CONFIGURATION.md
- **Setup Guide:** docs/APPS_SCRIPT_API_SETUP.md
- **Troubleshooting:** docs/TROUBLESHOOTING_APPS_SCRIPT.md
- **CI/CD Guide:** GITHUB_ACTIONS_DEPLOYMENT.md

---

**💡 TIP:** Print this checklist and keep it handy. Check off items as you go!

**⚠️ REMEMBER:** The #1 cause of deployment failures is the Apps Script API user setting being OFF!
