# Deployment Guide - MVP Event Toolkit

## Quick Deploy (Using clasp)

Your Apps Script project is already configured with:
- **Script ID**: `1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l`
- **Deployment ID**: `AKfycbxtxrxzFSg6DqsP1-IVv2WRi5-mcgCDKzatPQB1x8pnq8dBRDIdzVTDndBsxmkPAm_jgA`

### Step 1: Login to Google Account

```bash
clasp login
```

This will open a browser window. Sign in with your Google account that has access to the Apps Script project.

### Step 2: Push Code to Apps Script

```bash
clasp push
```

This uploads all `.gs` and `.html` files to your Apps Script project.

### Step 3: Deploy to Existing Deployment

```bash
clasp deploy --deploymentId AKfycbxtxrxzFSg6DqsP1-IVv2WRi5-mcgCDKzatPQB1x8pnq8dBRDIdzVTDndBsxmkPAm_jgA --description "MVP v1.1 Full Triangle"
```

### Step 4: Get Deployment URL

```bash
clasp deployments
```

Or use the existing URL format:
```
https://script.google.com/macros/s/AKfycbxtxrxzFSg6DqsP1-IVv2WRi5-mcgCDKzatPQB1x8pnq8dBRDIdzVTDndBsxmkPAm_jgA/exec
```

---

## Manual Deployment (Via Apps Script Editor)

If you prefer to deploy manually through the web interface:

### Step 1: Open Apps Script Editor

Visit: https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit

### Step 2: Copy Files

Copy and paste the following files from this repo into the Apps Script editor:

**Server-Side Files (.gs):**
- `Config.gs`
- `Code.gs`

**Client-Side Files (.html):**
- `Admin.html`
- `Config.html`
- `Diagnostics.html`
- `Display.html`
- `Public.html`
- `Poster.html`
- `Test.html`
- `Header.html`
- `NUSDK.html`
- `Styles.html`
- `DesignAdapter.html`

**Configuration:**
- `appsscript.json`

### Step 3: Deploy

1. Click **Deploy** → **Manage deployments**
2. Find your existing deployment: `AKfycbxtxrxzFSg6DqsP1-IVv2WRi5-mcgCDKzatPQB1x8pnq8dBRDIdzVTDndBsxmkPAm_jgA`
3. Click **Edit** (pencil icon)
4. Set **Version**: New version
5. Add description: "MVP v1.1 Full Triangle"
6. Click **Deploy**

---

## Testing Your Deployment

### 1. Test Status Endpoint

```bash
curl "https://script.google.com/macros/s/AKfycbxtxrxzFSg6DqsP1-IVv2WRi5-mcgCDKzatPQB1x8pnq8dBRDIdzVTDndBsxmkPAm_jgA/exec?p=status"
```

Expected response:
```json
{
  "ok": true,
  "value": {
    "build": "mvp-v1.1-full-triangle",
    "contract": "1.1.0",
    "db": { "ok": true, "id": "..." },
    "time": "2025-...",
    "features": {
      "events": true,
      "leagues": false,
      "tournaments": false,
      "multiTenant": false
    }
  }
}
```

### 2. Open Diagnostics Page

**IMPORTANT**: Change admin secret first!

1. Open `Config.gs` in Apps Script editor
2. Line 24: Change `adminSecret: 'CHANGE_ME_root'` to a strong password
3. Save the file
4. Redeploy

Then visit:
```
https://script.google.com/macros/s/AKfycbxtxrxzFSg6DqsP1-IVv2WRi5-mcgCDKzatPQB1x8pnq8dBRDIdzVTDndBsxmkPAm_jgA/exec?page=diagnostics
```

Click "Run Status Check" → Should show ✅ OK
Click "Run Self-Test" → Should show all steps passing

### 3. Open Config Portal

```
https://script.google.com/macros/s/AKfycbxtxrxzFSg6DqsP1-IVv2WRi5-mcgCDKzatPQB1x8pnq8dBRDIdzVTDndBsxmkPAm_jgA/exec?page=config
```

Create your first event and test the full Triangle workflow.

### 4. Test Public Page (Mobile)

```
https://script.google.com/macros/s/AKfycbxtxrxzFSg6DqsP1-IVv2WRi5-mcgCDKzatPQB1x8pnq8dBRDIdzVTDndBsxmkPAm_jgA/exec?p=events
```

### 5. Test Display Page (TV)

After creating an event in Config, use the Display link provided.

---

## Common Issues

### Issue: "Authorization required"

**Solution**: The first time you run any function, Apps Script will ask for permissions. Click "Review Permissions" and grant access.

### Issue: "Script function not found: doGet"

**Solution**: Make sure `Code.gs` has been uploaded correctly. The `doGet()` function is the entry point.

### Issue: "Cannot find tenant"

**Solution**: Make sure `Config.gs` is uploaded and the `TENANTS` array is defined correctly.

### Issue: "Admin key invalid"

**Solution**:
1. Check that you changed `adminSecret` in `Config.gs` (line 24)
2. Make sure you're using the same admin key when prompted in the UI
3. The key is stored in `localStorage` with key pattern: `ADMIN_KEY:<tenantId>`

---

## Monitoring & Logs

### View Execution Logs

1. Open Apps Script Editor
2. Click **Executions** (left sidebar)
3. View recent runs and any errors

### View DIAG Sheet

1. Open your Google Spreadsheet (the one bound to this Apps Script)
2. Look for the `DIAG` sheet tab
3. View diagnostic logs with timestamps, levels, and messages

### View Analytics

1. Open your Google Spreadsheet
2. Look for the `ANALYTICS` sheet tab
3. View impression/click/dwell tracking data

---

## Next Steps

Once deployed and tested:

1. ✅ Create your first event in Config.html
2. ✅ Configure sponsors (all 4 placements)
3. ✅ Add Google Form URLs for Sign Up/Check In/Walk In/Survey
4. ✅ Set up Display carousel with YouTube URLs
5. ✅ Test on mobile (Public page)
6. ✅ Test on TV (Display page)
7. ✅ Generate and print Poster with QR code
8. ✅ Run a live event and collect analytics
9. ✅ Export post-event report

---

## Production Checklist

Before going live:

- [ ] Changed all `adminSecret` values in `Config.gs`
- [ ] Tested Status endpoint (returns `ok: true`)
- [ ] Ran Self-Test successfully (all steps pass)
- [ ] Created test event and verified all pages load
- [ ] Tested on actual mobile device
- [ ] Tested on actual TV/large screen
- [ ] Verified analytics are logging to ANALYTICS sheet
- [ ] Exported a test report successfully
- [ ] Set up custom domain (optional)
- [ ] Configured rate limiting if needed

---

## Support

- **Script Editor**: https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit
- **GitHub Repo**: https://github.com/zeventbooks/MVP-EVENT-TOOLKIT
- **Documentation**: See README.md
