# RUNBOOK: Operational Playbook

**When something breaks, you don't want to think. You want steps.**

This document is your single source of truth for production incidents. Read it before you need it.

---

## Table of Contents

1. [System Health Checks](#1-system-health-checks)
2. [Common Failure Scenarios](#2-common-failure-scenarios)
3. [Rollback Procedures](#3-rollback-procedures)
4. [Escalation Guide](#4-escalation-guide)
5. [Quick Reference](#5-quick-reference)

---

## 1. System Health Checks

### 1.1 URLs to Verify System Status

| Check | URL | What You're Looking For |
|-------|-----|------------------------|
| **Ping** (fastest) | `https://www.eventangle.com/ping` | `{"status":"ok"}` |
| **Status** (detailed) | `https://www.eventangle.com/status` | `{"ok":true,"buildId":"mvp-v19",...}` |
| **Setup Diagnostics** | `https://www.eventangle.com/status?p=setup` | 6-point diagnostic check |
| **Staging** | `https://stg.eventangle.com/ping` | Verify staging is separate from prod |

### 1.2 External Uptime Dashboard

| Service | Dashboard URL | What to Check |
|---------|---------------|---------------|
| **UptimeRobot** | https://uptimerobot.com/dashboard | Response time trends, downtime history |
| **Pingdom** | https://my.pingdom.com/ | SLA reports, incident timeline |
| **Cloudflare** | https://dash.cloudflare.com/ > Workers | Request volume, error rates, CPU time |
| **Google Status** | https://www.google.com/appsstatus | Apps Script service status |
| **Cloudflare Status** | https://www.cloudflarestatus.com/ | Workers outages |

### 1.3 Critical Sheets to Check

Open the production spreadsheet and check these sheets:

| Sheet | Purpose | What to Look For |
|-------|---------|------------------|
| **DATA_ISSUES** | Nightly health check results | Red rows = ERROR (fix immediately), Yellow = WARNING |
| **DIAG** | Diagnostic logs | Recent errors, timestamps, stack traces |
| **LOG_ERRORS** | API error log | Error spikes, correlation IDs, patterns |
| **EVENTS** | Event data | Row count, recent entries, data integrity |
| **ANALYTICS** | Metrics data | Metric logging working, no gaps |

**Quick Sheet Health Assessment:**
```
DATA_ISSUES empty?     → Good, nightly check found no issues
DATA_ISSUES has RED?   → Stop. Fix these before anything else.
DIAG growing normally? → Good, logging is working
DIAG stale (>24hr)?    → Bad, something stopped logging
```

### 1.4 Quick Health Commands

```bash
# Quick ping - should return instantly
curl -s https://www.eventangle.com/ping

# Detailed status with timing
curl -s -w "\nHTTP: %{http_code} | Time: %{time_total}s\n" \
  https://www.eventangle.com/status | jq

# Full 6-point diagnostic
curl -s "https://www.eventangle.com/status?p=setup&brand=root" | jq '.value.checks'

# Bypass Cloudflare - test GAS directly
curl -s "https://script.google.com/macros/s/AKfycbyS1cW9VhviR-Jr8AmYY_BAGrb1gzuKkrgEBP2M3bMdqAv4ktqHOZInWV8ogkpz5i8SYQ/exec?p=ping"

# Check current build ID
curl -s https://www.eventangle.com/status | jq '.buildId'
```

---

## 2. Common Failure Scenarios

### 2.1 GAS Errors / Deployment Issues

**Symptoms:**
- 500 errors from eventangle.com
- Status returns `"ok": false`
- Error messages mention "Script error" or "Service unavailable"
- Everything was working, then a deployment happened

**Diagnosis Checklist:**
1. Check recent GitHub Actions: https://github.com/zeventbooks/MVP-EVENT-TOOLKIT/actions
2. Compare build IDs: `curl -s https://www.eventangle.com/status | jq '.buildId'`
3. Check Google Apps Script status: https://www.google.com/appsstatus
4. Test GAS directly (bypasses Cloudflare):
   ```bash
   curl -s "https://script.google.com/macros/s/AKfycbyS1cW9VhviR-Jr8AmYY_BAGrb1gzuKkrgEBP2M3bMdqAv4ktqHOZInWV8ogkpz5i8SYQ/exec?p=status"
   ```

**Resolution:**
- **If GAS direct URL works but eventangle.com doesn't:** Problem is Cloudflare Worker (see 2.2)
- **If GAS direct URL also fails:**
  - Check Google Apps Script status page
  - If Google is up, recent deployment likely broke something → **Rollback GAS** (see 3.1)
- **If quota errors:** Wait 24 hours or contact Google Workspace admin

---

### 2.2 Worker Misrouting

**Symptoms:**
- Requests go to wrong backend or return 404
- Some routes work, others don't
- Brand-specific URLs broken
- Friendly URLs (`/manage`, `/display`) not resolving

**Diagnosis Checklist:**
1. Check Cloudflare Worker logs: Dashboard > Workers > eventangle-events > Logs
2. Test specific routes:
   ```bash
   # Test friendly URL routing
   curl -s -I https://www.eventangle.com/manage
   curl -s -I https://www.eventangle.com/display
   curl -s -I https://www.eventangle.com/abc/events

   # Check X-Proxied-By header
   curl -s -I https://www.eventangle.com/ping | grep -i x-proxied
   ```
3. Verify `DEPLOYMENT_ID` in wrangler.toml matches production GAS deployment

**Resolution:**
- **Wrong DEPLOYMENT_ID:** Update `cloudflare-proxy/wrangler.toml` and redeploy worker
- **Route pattern issue:** Check `wrangler.toml` route patterns, redeploy
- **Worker crashed:** Check Cloudflare dashboard for errors, may need to **Rollback Worker** (see 3.2)

---

### 2.3 Broken SharedReport / Analytics

**Symptoms:**
- SharedReport page shows no data or errors
- Analytics metrics not updating
- "No events found" when events exist
- Dashboard shows stale numbers

**Diagnosis Checklist:**
1. Check ANALYTICS sheet: Is it being written to?
2. Check DATA_ISSUES sheet for analytics-related errors
3. Test the analytics bundle endpoint:
   ```bash
   curl -s "https://www.eventangle.com/api?action=getSharedAnalytics&brand=root" | jq
   ```
4. Check for recent events with analytics:
   ```bash
   curl -s "https://www.eventangle.com/api?action=listEvents&brand=root" | jq '.value | length'
   ```

**Resolution:**
- **ANALYTICS sheet missing:** Will auto-create on next metric write. Force by visiting any public event page.
- **Schema mismatch:** Check `shared-analytics.schema.json` against actual response
- **No metrics for time period:** Analytics only tracks actual visits. Check ANALYTICS sheet has rows.
- **Aggregation broken:** Check `AnalyticsService.gs` for errors, may need code fix via PR

---

### 2.4 DIAG Sheet Full or Archiving Failure

**Symptoms:**
- DIAG sheet has 3000+ rows (max is 3000)
- DIAG_ARCHIVE_YYYY_MM sheets not being created
- "Exceeded maximum execution time" errors in triggers
- Old logs not being rotated

**Diagnosis Checklist:**
1. Count DIAG rows: Open sheet, scroll to bottom or use `COUNTA(A:A)`
2. Check for archive sheets: Look for `DIAG_ARCHIVE_2025_11` pattern
3. Check trigger status in Apps Script:
   - Open Apps Script editor
   - Go to Triggers (clock icon)
   - Look for `archiveDiagLogs_` trigger
4. Check LOG_ERRORS for archiver errors

**Resolution:**

**If DIAG is full (3000+ rows):**
```javascript
// Run manually in Apps Script editor
archiveDiagLogs_();
```

**If archiver trigger missing:**
```javascript
// Install the trigger
installDiagArchiveTrigger_();
```

**If archiver is failing:**
1. Check LOG_ERRORS for specific error
2. Common issue: Quota exceeded - wait 24h or batch smaller
3. Manual emergency cleanup:
   - Copy DIAG data to a new sheet manually
   - Clear DIAG sheet (keep headers)
   - Document in GitHub issue

**Prevention:**
- Archiver should run nightly at 2 AM
- Health checker runs at 3 AM after archiver
- If both triggers are missing, reinstall:
  ```javascript
  installDiagArchiveTrigger_();
  installDataHealthTrigger_();
  ```

---

## 3. Rollback Procedures

### 3.1 Roll Back Apps Script Deployment

**When to use:** GAS code is broken, need to restore previous version.

**Option A: Git Revert (Preferred - Uses CI)**
```bash
# This is the safest option - CI tests the revert before deploying
git revert HEAD
git push origin main
# Wait for CI to deploy (~3-5 minutes)
```

**Option B: Manual Rollback (Emergency Only)**

Use this ONLY if CI is completely broken:

1. **Open Apps Script Deployments:**
   https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/deployments

2. **Find Previous Working Version:**
   - Click on the web app deployment
   - Click "Manage versions"
   - Note the current version number
   - Find the last known-good version (check GitHub Actions history for deployment times)

3. **Edit Deployment:**
   - Click pencil icon to edit
   - Change "Version" to the previous good version
   - Click "Deploy"

4. **Verify:**
   ```bash
   curl -s https://www.eventangle.com/ping
   curl -s https://www.eventangle.com/status | jq '.buildId'
   ```

5. **Document Immediately:**
   - Create GitHub issue explaining what happened
   - Note the version numbers involved
   - Fix the underlying issue via proper PR

---

### 3.2 Roll Back Cloudflare Worker

**When to use:** Worker code is broken, routing is wrong, or wrong DEPLOYMENT_ID.

**Option A: Redeploy Previous Code (Preferred)**
```bash
# Check out previous working commit
git log --oneline cloudflare-proxy/worker.js
git checkout HEAD~1 -- cloudflare-proxy/worker.js cloudflare-proxy/wrangler.toml

# Or revert the entire cloudflare-proxy directory
git checkout <last-good-commit> -- cloudflare-proxy/

# Deploy
cd cloudflare-proxy && wrangler deploy --env events
```

**Option B: Cloudflare Dashboard Rollback**

1. **Open Cloudflare Dashboard:**
   https://dash.cloudflare.com/ > Workers & Pages > eventangle-events

2. **View Deployments:**
   - Click "Deployments" tab
   - Find previous deployment (shows timestamp)
   - Click "Rollback to this deployment"

3. **Verify:**
   ```bash
   curl -s -I https://www.eventangle.com/ping | grep -i x-worker-version
   curl -s https://www.eventangle.com/status
   ```

**Option C: Fix DEPLOYMENT_ID Mismatch**

If the Worker is pointing to wrong GAS deployment:

1. Get current production GAS deployment ID from Apps Script
2. Edit `cloudflare-proxy/wrangler.toml`:
   ```toml
   [env.events.vars]
   GAS_DEPLOYMENT_BASE_URL = "https://script.google.com/macros/s/CORRECT_ID_HERE/exec"
   DEPLOYMENT_ID = "CORRECT_ID_HERE"
   ```
3. Deploy: `cd cloudflare-proxy && wrangler deploy --env events`

---

## 4. Escalation Guide

### 4.1 If Harbor Calls During a Failure

Harbor is likely your operations partner or client. They're calling because something is broken and customers are affected.

**What You Say:**
> "I'm aware of the issue and actively working on it. Let me get you a status update in [X] minutes."

**What You Do:**

1. **Acknowledge** - Note the time and what they're reporting
2. **Don't guess** - Follow the diagnosis steps below
3. **Communicate** - Give updates every 15 minutes until resolved
4. **Document** - Create incident report after

**First 5 Minutes:**
```bash
# Run these immediately
curl -s https://www.eventangle.com/ping
curl -s https://www.eventangle.com/status | jq '.ok'
curl -s "https://www.eventangle.com/status?p=setup" | jq '.value.checks[] | select(.ok == false)'
```

**Report template:**
> "The [ping/status/events] endpoint is [working/failing]. Error is [specific error]. Checking [GAS/Cloudflare/Data]. ETA for update: [time]."

---

### 4.2 If a Bar Can't See Their Event

**What they're probably experiencing:**
- "My event isn't showing up"
- "The page is blank"
- "It says no events found"

**Triage Questions:**
1. What URL are they using?
2. What brand are they (root, abc, cbc, cbl)?
3. When did they create the event?
4. Can they see the admin page?

**Diagnostic Steps:**

**Check 1: Is the event in the database?**
```bash
# List events for the brand
curl -s "https://www.eventangle.com/api?action=listEvents&brand=abc" | jq '.value[] | {id, slug, name}'
```

**Check 2: Is the specific event accessible?**
```bash
# Get the event by slug
curl -s "https://www.eventangle.com/api?action=getEvent&slug=their-event-slug&brand=abc" | jq
```

**Check 3: Is the public bundle loading?**
```bash
# Get the public bundle
curl -s "https://www.eventangle.com/api?action=getPublicBundle&slug=their-event-slug&brand=abc" | jq '.ok'
```

**Common Causes & Fixes:**

| Problem | Symptom | Fix |
|---------|---------|-----|
| Wrong brand | Event exists but not for their brand | Have them use correct brand URL |
| Event not saved | Not in listEvents | Check admin, re-save event |
| Slug typo | getEvent returns not found | Verify exact slug spelling |
| Data corruption | DATA_ISSUES has errors | Fix data issues first |
| Caching | Old data showing | Clear browser cache, try incognito |

---

### 4.3 What to Check First, Second, Third

When something's broken and you don't know why:

#### First (0-2 minutes): Is the system alive?
```bash
curl -s -w "Time: %{time_total}s\n" https://www.eventangle.com/ping
```
- **If fails:** System is down. Check Cloudflare status, Google status.
- **If slow (>5s):** Cold start or performance issue.
- **If ok:** System is alive, problem is specific.

#### Second (2-5 minutes): Where is it broken?
```bash
# Test Cloudflare → GAS chain
curl -s https://www.eventangle.com/status | jq '.ok'

# Test GAS directly (bypass Cloudflare)
curl -s "https://script.google.com/macros/s/AKfycbyS1cW9VhviR-Jr8AmYY_BAGrb1gzuKkrgEBP2M3bMdqAv4ktqHOZInWV8ogkpz5i8SYQ/exec?p=status" | jq '.ok'
```
- **Cloudflare fails, GAS works:** Cloudflare Worker issue
- **Both fail:** GAS issue (deployment or Google outage)
- **Both work:** Problem is specific feature/data

#### Third (5-15 minutes): What specifically broke?
```bash
# Run full diagnostics
curl -s "https://www.eventangle.com/status?p=setup&brand=root" | jq '.value.checks'
```

Check each diagnostic point:
1. Brand Config - Is the brand configured?
2. Spreadsheet Access - Can we read/write?
3. Secrets - Are admin secrets set?
4. Sheets - Do required sheets exist?
5. Events - Are there any events?
6. Analytics - Is analytics healthy?

**Then check DATA_ISSUES sheet for data-level problems.**

---

### 4.4 Escalation Contacts

| Situation | First Contact | Escalate To |
|-----------|---------------|-------------|
| Worker routing issues | On-call engineer | Cloudflare support |
| GAS deployment broken | On-call engineer | Google Workspace admin |
| Data corruption | On-call engineer | Database owner |
| Sustained outage (>30min) | On-call engineer | Team lead |
| Security incident | Team lead immediately | Security team |

**Configure your team's contacts:**
```
Primary On-Call: [Name] - [Phone] - [Slack]
Backup On-Call:  [Name] - [Phone] - [Slack]
Team Lead:       [Name] - [Phone] - [Slack]
```

---

## 5. Quick Reference

### 5.1 Key URLs

| Resource | URL |
|----------|-----|
| Production | https://www.eventangle.com |
| Staging | https://stg.eventangle.com |
| Apps Script Project | https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l |
| Apps Script Deployments | https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/deployments |
| Cloudflare Dashboard | https://dash.cloudflare.com/ > Workers > eventangle-events |
| GitHub Actions | https://github.com/zeventbooks/MVP-EVENT-TOOLKIT/actions |
| Google Status | https://www.google.com/appsstatus |
| Cloudflare Status | https://www.cloudflarestatus.com/ |

### 5.2 Key IDs

| ID | Value | Purpose |
|----|-------|---------|
| GAS Project ID | `1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l` | Apps Script project |
| Production Deployment ID | `AKfycbyS1cW9VhviR-Jr8AmYY_BAGrb1gzuKkrgEBP2M3bMdqAv4ktqHOZInWV8ogkpz5i8SYQ` | GAS exec URL |
| Build ID | `mvp-v19` | Current version (check Config.gs) |
| Contract Version | `1.0.0` | API contract version |

### 5.3 Emergency Commands

```bash
# Is it alive?
curl -s https://www.eventangle.com/ping

# What version is running?
curl -s https://www.eventangle.com/status | jq '{ok,buildId}'

# What's broken?
curl -s "https://www.eventangle.com/status?p=setup" | jq '.value.checks[] | select(.ok==false)'

# Bypass Cloudflare
curl -s "https://script.google.com/macros/s/AKfycbyS1cW9VhviR-Jr8AmYY_BAGrb1gzuKkrgEBP2M3bMdqAv4ktqHOZInWV8ogkpz5i8SYQ/exec?p=ping"

# Git revert (emergency rollback via CI)
git revert HEAD && git push origin main

# Manual worker deploy (emergency)
cd cloudflare-proxy && wrangler deploy --env events
```

### 5.4 Post-Incident Checklist

After any incident:

- [ ] Update status page (if applicable)
- [ ] Create GitHub issue with incident report
- [ ] Document: time detected, time resolved, root cause, fix applied
- [ ] Update this runbook if procedures were unclear or missing
- [ ] Schedule post-mortem if incident lasted >30 minutes
- [ ] Verify monitoring caught the issue (add alerts if not)

---

## Related Documentation

| Document | Purpose |
|----------|---------|
| [docs/RUNBOOK.md](./docs/RUNBOOK.md) | Detailed operational procedures |
| [docs/UPTIME_MONITORING.md](./docs/UPTIME_MONITORING.md) | Setting up external monitoring |
| [docs/SETUP_DIAGNOSTICS.md](./docs/SETUP_DIAGNOSTICS.md) | 6-point setup verification |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | Deployment procedures |
| [PRODUCTION_DEPLOYMENT_POLICY.md](./PRODUCTION_DEPLOYMENT_POLICY.md) | CI-only deployment policy |
| [docs/DATA_POLICY.md](./docs/DATA_POLICY.md) | Data retention and archiving |

---

**Last Updated:** 2025-12-01

**Remember:** When you're under pressure, don't think. Follow the steps. That's what this document is for.
