# Operations Runbook

This runbook provides step-by-step procedures for diagnosing and resolving common production issues.

---

## Quick Reference

### Health Check URLs

| Check | URL | Expected Response |
|-------|-----|-------------------|
| Ping | `https://www.eventangle.com/ping` | `{"status":"ok"}` |
| Status | `https://www.eventangle.com/status` | `{"ok":true,...}` |
| Setup | `https://www.eventangle.com/status?p=setup` | 6-point diagnostic |

### Quick Commands

```bash
# Basic health check
curl -s https://www.eventangle.com/ping

# Detailed status
curl -s https://www.eventangle.com/status | jq

# Full diagnostics
curl -s "https://www.eventangle.com/status?p=setup&brand=root" | jq
```

---

## Incident Response

### When Alerted

**Step 1: Acknowledge** (0-2 minutes)
- Mark alert as acknowledged in monitoring tool
- Note the time and initial symptoms

**Step 2: Verify** (2-5 minutes)
```bash
# Try the ping endpoint
curl -s -w "\nHTTP Status: %{http_code}\nTime: %{time_total}s\n" \
  https://www.eventangle.com/ping

# If that fails, try direct GAS URL (bypasses Cloudflare)
curl -s -w "\nHTTP Status: %{http_code}\n" \
  "https://script.google.com/macros/s/AKfycbyS1cW9VhviR-Jr8AmYY_BAGrb1gzuKkrgEBP2M3bMdqAv4ktqHOZInWV8ogkpz5i8SYQ/exec?p=ping"
```

**Step 3: Diagnose** (5-15 minutes)
- See specific issue sections below

**Step 4: Resolve or Escalate** (15+ minutes)
- Apply fix from runbook
- Or escalate to development team

---

## Common Issues

### Issue: Ping Returns Non-200

**Symptoms:**
- Uptime monitor alerts "DOWN"
- `curl` returns HTTP 5xx or no response

**Diagnostic Steps:**

1. **Check Cloudflare status**
   - Visit https://www.cloudflarestatus.com/
   - Look for incidents affecting Workers

2. **Check Google Apps Script status**
   - Visit https://www.google.com/appsstatus
   - Look for Apps Script service issues

3. **Test direct GAS URL** (bypasses Cloudflare):
   ```bash
   curl -s "https://script.google.com/macros/s/AKfycbyS1cW9VhviR-Jr8AmYY_BAGrb1gzuKkrgEBP2M3bMdqAv4ktqHOZInWV8ogkpz5i8SYQ/exec?p=ping"
   ```

4. **Check Cloudflare Worker logs**:
   - Log in to Cloudflare Dashboard
   - Go to Workers > eventangle-events
   - Check "Logs" tab for errors

**Resolution:**
- If GAS is down: Wait for Google to restore service
- If Cloudflare is down: Wait for Cloudflare to restore service
- If both are up but site is down: Check recent deployments

---

### Issue: Ping Returns 200 but Wrong Content

**Symptoms:**
- HTTP 200 but body doesn't contain "ok"
- Keyword check fails in monitoring

**Diagnostic Steps:**

1. **Check full response**:
   ```bash
   curl -s https://www.eventangle.com/ping | cat -v
   ```

2. **Check status endpoint for details**:
   ```bash
   curl -s https://www.eventangle.com/status | jq
   ```

3. **Run full setup diagnostics**:
   ```bash
   curl -s "https://www.eventangle.com/status?p=setup&brand=root" | jq '.value.checks'
   ```

**Resolution:**
- Review the `issues` and `fixes` arrays in the setup response
- Follow the suggested fix steps

---

### Issue: Slow Response Times

**Symptoms:**
- Response times > 5 seconds
- Intermittent timeouts

**Diagnostic Steps:**

1. **Measure response time**:
   ```bash
   curl -s -w "Total time: %{time_total}s\n" -o /dev/null \
     https://www.eventangle.com/ping
   ```

2. **Compare GAS vs Cloudflare**:
   ```bash
   # Direct GAS (no proxy)
   curl -s -w "GAS Direct: %{time_total}s\n" -o /dev/null \
     "https://script.google.com/macros/s/AKfycbyS1cW9VhviR-Jr8AmYY_BAGrb1gzuKkrgEBP2M3bMdqAv4ktqHOZInWV8ogkpz5i8SYQ/exec?p=ping"

   # Via Cloudflare
   curl -s -w "Cloudflare: %{time_total}s\n" -o /dev/null \
     https://www.eventangle.com/ping
   ```

3. **Check for cold start** (GAS apps sleep after inactivity):
   - First request after inactivity may take 5-10 seconds
   - Subsequent requests should be < 2 seconds

**Resolution:**
- If only first request is slow: This is normal GAS cold start behavior
- If consistently slow: Check Google Apps Script quotas and status

---

### Issue: Spreadsheet Access Errors

**Symptoms:**
- Status shows `"ok": false`
- Error message mentions spreadsheet access

**Diagnostic Steps:**

1. **Run setup diagnostics**:
   ```bash
   curl -s "https://www.eventangle.com/status?p=setup&brand=root" | jq '.value.checks[] | select(.name == "Spreadsheet Access")'
   ```

2. **Check for quota issues**:
   - Google Sheets has read/write quotas
   - High traffic can exhaust quotas

**Resolution:**
- Verify spreadsheet still exists and hasn't been deleted
- Verify script owner still has access
- Check Google Workspace admin console for quota status
- See [SETUP_DIAGNOSTICS.md](./SETUP_DIAGNOSTICS.md) for detailed fix steps

---

### Issue: Recent Deployment Broke Something

**Symptoms:**
- Issues started after a deployment
- New build ID in status response

**Diagnostic Steps:**

1. **Check current build**:
   ```bash
   curl -s https://www.eventangle.com/status | jq '.buildId'
   ```

2. **Check GitHub Actions history**:
   - Go to repository > Actions tab
   - Review recent workflow runs
   - Look for failed tests or deployment errors

3. **Check what changed**:
   - Review commits in the last deployment
   - Look for changes to routing, Config.gs, or Code.gs

**Resolution:**
- If deployment is broken: Revert to previous Apps Script version
  1. Open Apps Script editor
  2. Go to Deploy > Manage deployments
  3. Edit the web app deployment
  4. Select a previous version
  5. Update Cloudflare Worker with old deployment ID if needed

---

### Issue: Brand-Specific Failures

**Symptoms:**
- One brand returns errors, others work fine
- Error mentions brand configuration

**Diagnostic Steps:**

1. **Test specific brand**:
   ```bash
   curl -s "https://www.eventangle.com/status?p=status&brand=abc" | jq
   curl -s "https://www.eventangle.com/status?p=setup&brand=abc" | jq
   ```

2. **Compare with working brand**:
   ```bash
   curl -s "https://www.eventangle.com/status?p=setup&brand=root" | jq
   ```

**Resolution:**
- Check brand configuration in Config.gs
- Verify brand's spreadsheet ID is valid
- Check brand's admin secret is set in Script Properties

---

## Monitoring Dashboard Locations

### UptimeRobot
- Dashboard: https://uptimerobot.com/dashboard
- History: Click monitor > View history
- Response times: Click monitor > Response Time tab

### Pingdom
- Dashboard: https://my.pingdom.com/
- Uptime reports: Monitoring > Uptime > select check
- Response times: Check details > Response Time tab

### Cloudflare
- Worker analytics: https://dash.cloudflare.com/ > Workers > eventangle-events > Analytics
- Request logs: Workers > eventangle-events > Logs

### GitHub Actions
- Deployments: https://github.com/zeventbooks/MVP-EVENT-TOOLKIT/actions
- Recent runs: Actions tab > All workflows

---

## Escalation Contacts

| Role | Contact | When to Escalate |
|------|---------|------------------|
| Primary On-Call | (configure in team) | First responder |
| Backend Developer | (configure in team) | GAS/API issues |
| Infrastructure | (configure in team) | Cloudflare/DNS issues |

---

## Post-Incident

After resolving an incident:

1. **Update status page** (if you have one)
   - Mark incident as resolved
   - Add brief description

2. **Document in incident log**
   - Time detected
   - Time resolved
   - Root cause
   - Fix applied
   - Lessons learned

3. **Create follow-up tasks**
   - Improve monitoring if detection was slow
   - Add automation if manual steps were needed
   - Update this runbook if procedures were unclear

---

## Preventive Measures

### Daily
- Check uptime dashboard for any yellow/red indicators
- Review response time trends

### Weekly
- Review GitHub Actions for any test failures
- Check Google Sheets quotas if traffic increased

### After Each Deployment
- Verify ping endpoint returns 200
- Run setup diagnostics
- Monitor for 15 minutes for errors

---

## Related Documentation

- [UPTIME_MONITORING.md](./UPTIME_MONITORING.md) - Setting up external monitoring
- [SETUP_DIAGNOSTICS.md](./SETUP_DIAGNOSTICS.md) - 6-point setup verification
- [DEPLOYMENT.md](../DEPLOYMENT.md) - Deployment procedures
- [PRODUCTION_DEPLOYMENT_POLICY.md](../PRODUCTION_DEPLOYMENT_POLICY.md) - CI-only deployment policy

---

**Last Updated:** 2025-12-01
