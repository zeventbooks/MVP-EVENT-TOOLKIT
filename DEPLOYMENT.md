# Zeventbook Production Deployment Guide

**Build:** triangle-prod-v1.2
**Contract:** 1.0.2
**Status:** Production-Ready MVP

---

## Table of Contents

1. [Quick Start](#quick-start)
2. [What's Included](#whats-included)
3. [Apps Script Deployment](#apps-script-deployment)
4. [Domain Setup (zeventbooks.io)](#domain-setup)
5. [Testing & Verification](#testing--verification)
6. [The Triangle Workflow](#the-triangle-workflow)
7. [Production Checklist](#production-checklist)
8. [Troubleshooting](#troubleshooting)

---

## Quick Start

### Prerequisites

- Google account with Apps Script access
- Admin secrets configured (change default values in `Config.gs`)
- Domain `zeventbooks.io` with redirect/DNS capabilities

### 5-Minute Deploy

```bash
# 1. Open Apps Script
# Go to: https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l

# 2. Upload all files from this repository (keep exact filenames):
# - Code.gs
# - Config.gs
# - Admin.html
# - Display.html
# - Public.html
# - Poster.html
# - Styles.html
# - NUSDK.html (if using the SDK)
# - Header.html (if present)
# - DesignAdapter.html (if present)
# - Test.html (if present)
# - appsscript.json

# 3. Deploy as Web App
# Deploy → New deployment → Web app
# Execute as: "User accessing the web app"
# Who has access: "Anyone"
# Copy the deployment URL (ends with /exec)

# 4. Test immediately
# Open: <DEPLOYMENT_URL>?page=admin
# Run Diagnostics → Status (should show green)
# Run Diagnostics → Self-Test (all checks should pass)
```

---

## What's Included

### Server Files (Code.gs)

**Production Features:**
- ✅ Runtime contract validation with schemas
- ✅ Comprehensive diagnostics (status + self-test)
- ✅ Analytics logging (impressions, clicks, dwell time)
- ✅ Report generation (aggregated by surface, sponsor, token)
- ✅ Shortlink redirect system (?p=r&t=<token>)
- ✅ Multi-tenant support (root, ABC, CBC, CBL)
- ✅ Rate limiting (20 req/min per tenant)
- ✅ Idempotency for writes
- ✅ DIAG logging with automatic rotation

**API Endpoints:**
- `api_status()` - Health check
- `api_healthCheck()` - Ping test
- `api_list()` - List events
- `api_get()` - Get single event
- `api_create()` - Create event (admin only)
- `api_updateEventData()` - Update display/sponsors config
- `api_logEvents()` - Batch analytics logging
- `api_getReport()` - Generate report JSON
- `api_exportReport()` - Export report to Sheet
- `api_createShortlink()` - Generate shortlink
- `api_runDiagnostics()` - End-to-end self-test

### Client Files

**Admin.html**
- Diagnostics (Status + Self-Test)
- Create Event form
- Display & Sponsors configuration UI
- Links management (Public, Display, Poster)
- One-click report export

**Display.html (TV)**
- Static mode (mirrors Public page)
- Carousel mode (rotate URLs with timing)
- Sponsor top banner + side panel
- Blocked-embed fallback detection
- Analytics logging (impressions, dwell, blocks)
- Legible typography (10-12ft viewing distance)

**Public.html (Mobile)**
- Event list + detail views
- Sponsor banner (mobile-optimized)
- Analytics logging (impressions, clicks)
- Responsive design

**Poster.html (Print/QR)**
- Verified-QR invariant (only shows QR if verified)
- Sponsor strip (posterTop placement)
- Collapses cleanly when no sponsors
- Print-optimized CSS

**Styles.html**
- Minimal global tokens
- A11y focus styles
- Reduced-motion support
- DRY button/toast/container primitives

### Configuration (Config.gs)

**Tenants:**
- `root` - Zeventbook (zeventbook.io)
- `abc` - American Bocce Co.
- `cbc` - Chicago Bocce Club
- `cbl` - Chicago Bocce League

**⚠️ IMPORTANT:** Change all `adminSecret` values before production!

---

## Apps Script Deployment

### Step 1: Upload Files

1. Go to [Apps Script Project](https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit)
2. **Enable manifest:** Project Settings → Show "appsscript.json" manifest
3. Add each file (exact names required):
   - `Code.gs` (server backend)
   - `Config.gs` (tenant config)
   - `Admin.html`, `Display.html`, `Public.html`, `Poster.html`
   - `Styles.html`, `NUSDK.html`, `Header.html`, `DesignAdapter.html`, `Test.html`
   - `appsscript.json`

### Step 2: Configure Admin Secrets

Edit `Config.gs`:

```javascript
{
  id: 'root',
  adminSecret: 'YOUR_STRONG_SECRET_HERE',  // ⚠️ CHANGE THIS!
  ...
}
```

Generate strong secrets (20+ characters, mix of alphanumeric + symbols).

### Step 3: Deploy

1. **Deploy → New deployment**
2. Type: **Web app**
3. Execute as: **User accessing the web app**
4. Who has access: **Anyone**
5. Click **Deploy**
6. **Copy the deployment URL** (ends with `/exec`)

Example URL:
```
https://script.google.com/macros/s/AKfycbx.../exec
```

---

## Domain Setup (zeventbooks.io)

### Option A: HTTP Redirects (Recommended for MVP)

In Hostinger → Domains → Redirects:

```
https://zeventbooks.io/ → https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?p=events&tenant=root
https://www.zeventbooks.io/ → https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?p=events&tenant=root
https://zeventbooks.io/admin → https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?page=admin&tenant=root
https://zeventbooks.io/display → https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?page=display&tenant=root
```

**Force HTTPS:** Enable in Hostinger SSL settings.

### Option B: iframe Wrapper (if domain must stay in browser)

Create a static page on zeventbooks.io:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Zeventbook</title>
  <style>
    body, html { margin:0; padding:0; height:100%; overflow:hidden; }
    iframe { width:100%; height:100%; border:0; }
  </style>
</head>
<body>
  <iframe src="https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec?p=events"></iframe>
</body>
</html>
```

Ensure Apps Script returns pages with:
```javascript
.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
```
(Already configured in `Code.gs`)

---

## Testing & Verification

### 1. Status Check

Open: `<DEPLOYMENT_URL>?page=status`

Expected response (JSON):
```json
{
  "ok": true,
  "value": {
    "build": "triangle-prod-v1.2",
    "contract": "1.0.2",
    "time": "2025-11-08T...",
    "db": { "ok": true, "id": "..." }
  }
}
```

### 2. Admin Diagnostics

Open: `<DEPLOYMENT_URL>?page=admin`

Click **"Run Self-Test"**

Expected result: All checks pass (✓ green)

```json
{
  "ok": true,
  "steps": [
    { "name": "status", "ok": true },
    { "name": "create_event", "ok": true },
    { "name": "update_config", "ok": true },
    { "name": "log_analytics", "ok": true },
    { "name": "get_report", "ok": true },
    { "name": "export_report", "ok": true },
    { "name": "create_shortlink", "ok": true }
  ],
  "eventId": "...",
  "sheetUrl": "..."
}
```

### 3. Create Test Event

In Admin:
1. Enter event details (Name, Date, optional Signup URL)
2. Click **"Create"**
3. Verify links appear: Public, Display, Poster
4. Click **"Configure Display & Sponsors"**
5. Add a sponsor with placements
6. Save config

### 4. Test All Surfaces

**Public (Mobile):**
- Open Public link
- Verify sponsor banner shows (if configured)
- Check browser console: no errors

**Display (TV):**
- Open Display link on a large screen
- Verify carousel rotates (if configured) or mirrors Public (static mode)
- Verify sponsor top/side panels show
- Check toast messages

**Poster (Print/QR):**
- Open Poster link
- Verify QR code displays
- Verify sponsor strip shows at top (if configured)
- Print to PDF to verify layout

### 5. Analytics & Reports

1. Browse Public and Display pages for a few minutes
2. In Admin → Click **"View Report"**
3. Verify Sheet opens with:
   - Totals (impressions, clicks, dwell time)
   - By Surface breakdown
   - By Sponsor breakdown
   - By Token breakdown (if shortlinks used)

---

## The Triangle Workflow

### Phase 1: Pre-Event (Admin)

1. **Create Event** (Admin page on mobile/desktop)
2. **Configure Display** (Static or Carousel mode + URLs)
3. **Add Sponsors** (Name, URL, Image, Placements)
4. **Generate Links** (Public, Display, Poster)
5. **Create Posters** (Print Poster page with QR codes)
6. **Start Signups** (Share Public link or Signup URL)

### Phase 2: During Event (Display)

1. **TV Display** shows configured carousel/static content
2. **Sponsor panels** visible on TV (top banner + side panel)
3. **Mobile Public** page shows event details + sponsor banner
4. **Analytics** log impressions, clicks, dwell time automatically

### Phase 3: Post-Event (Reports)

1. **Admin** clicks "View Report"
2. **Event Organizers** get:
   - Total engagement metrics
   - Breakdown by surface (TV, mobile, poster)
   - Signups count (if tracked)
3. **Sponsors** get (same report):
   - Impressions
   - Clicks
   - CTR (click-through rate)
   - Dwell time
4. **Consumers** get (future):
   - Event highlights
   - Link to next event

---

## Production Checklist

### Security

- [ ] Changed all `adminSecret` values in Config.gs
- [ ] Tested admin auth (wrong key should fail)
- [ ] Rate limiting works (20 req/min per tenant)
- [ ] Input sanitization active (XSS protection)
- [ ] HTTPS forced on all domains

### Functionality

- [ ] Status endpoint returns OK
- [ ] Self-test passes all checks
- [ ] Event create works
- [ ] Display config saves correctly
- [ ] Sponsors render on all surfaces
- [ ] Analytics log correctly
- [ ] Reports export with accurate data
- [ ] Shortlinks redirect properly

### Performance

- [ ] Public page loads < 2s
- [ ] Display page rotates smoothly
- [ ] Admin diagnostics complete < 10s
- [ ] Report export completes < 15s

### UX

- [ ] Admin UI is clear and intuitive
- [ ] Public page is mobile-responsive
- [ ] Display page is legible at 10-12ft
- [ ] Poster prints cleanly
- [ ] No sponsor gaps when unconfigured
- [ ] Toast messages are helpful

### Observability

- [ ] DIAG sheet populates correctly
- [ ] ANALYTICS sheet records events
- [ ] SHORTLINKS sheet tracks tokens
- [ ] Error messages are actionable

---

## Troubleshooting

### Issue: "Contract violation" errors

**Cause:** Response schema mismatch
**Fix:** Check DIAG sheet for details; ensure server returns expected shape

### Issue: Self-test fails at "create_event"

**Cause:** Admin secret mismatch or rate limit hit
**Fix:** Verify Config.gs `adminSecret` matches what's stored in sessionStorage

### Issue: TV Display shows "Content Unavailable" for all URLs

**Cause:** URLs block iframing (X-Frame-Options, CSP)
**Fix:** Use embeddable sources (YouTube, Vimeo, your own pages); avoid Instagram/LeagueApps

### Issue: Sponsor banner doesn't show

**Cause:** No sponsors configured with correct placement
**Fix:** In Admin → Configure Display & Sponsors → check placement boxes (Poster Top, TV Top, Mobile Banner)

### Issue: QR code says "unavailable (not verified)"

**Cause:** Event ID not found or links not generated
**Fix:** Ensure event was created via api_create; check EVENTS sheet for record

### Issue: Analytics not logging

**Cause:** google.script.run calls failing
**Fix:** Open browser console; check for errors; verify deployment is "User accessing" mode

### Issue: Domain redirect loop

**Cause:** Circular redirect in Hostinger
**Fix:** Ensure target URL is different from source; check HTTPS enforcement

---

## Next Steps

### Immediate (MVP Complete)

- [x] Deploy to Apps Script
- [x] Test all surfaces
- [x] Configure domain redirects
- [ ] Run pilot event

### Short-term (Week 1-2)

- [ ] Set up CI/CD pipeline (GitHub Actions)
- [ ] Add E2E tests (Playwright or Cypress)
- [ ] Monitor analytics for first event
- [ ] Gather sponsor feedback

### Mid-term (Month 1)

- [ ] Implement ETag/SWR caching
- [ ] Add golden dataset tests for reports
- [ ] A11y audit (target: Lighthouse ≥90)
- [ ] Distance legibility testing for TV

### Long-term (Quarter 1)

- [ ] Multi-event shortlink campaigns
- [ ] Instagram scraping for TV carousel
- [ ] Consumer highlights/recap feature
- [ ] Leagues & tournaments (flip feature flag)

---

## Support

**Documentation:** See [README.md](./README.md) and [CODE_REVIEW.md](./CODE_REVIEW.md)
**Issues:** Check DIAG sheet first; review browser console
**Contact:** Admin → Diagnostics → Copy status JSON for support requests

**Production Scorecard:** 62/100 (Pre-Pilot)
**Target:** 80/100 (Pilot-Ready) | 90/100 (Production-Hardened)

---

**Last Updated:** 2025-11-08
**Build:** triangle-prod-v1.2
**Maintainer:** Zeventbook Team
