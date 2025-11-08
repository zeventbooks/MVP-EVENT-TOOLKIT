# ✅ FIXED: Spreadsheet Binding Error

## The Problem
```
TypeError: Cannot read properties of null (reading 'getId') (line 18, file "Config")
```

This happened because `SpreadsheetApp.getActive()` returns `null` when running as a standalone web app.

## The Solution
✅ **Fixed in latest code!** The database spreadsheet now auto-creates on first run.

---

## How It Works Now

When you deploy and make your first API call (e.g., visit the Diagnostics page), the system will:

1. **Auto-create** a new Google Spreadsheet called `ZEB_DB - Database`
2. **Save the ID** in script properties (persistent storage)
3. **Add a README sheet** with instructions
4. **Create data sheets** as needed (EVENTS, SPONSORS, ANALYTICS, etc.)

The spreadsheet will appear in your **Google Drive** root folder.

---

## Deploy the Fixed Code

### Option 1: Using Clasp (Fastest)

```bash
# Pull latest changes
git pull origin claude/check-github-code-011CUuzreVPnYQL5vaM5jrpj

# Login to Google
clasp login

# Push to Apps Script
clasp push

# Deploy (updates existing deployment)
clasp deploy --deploymentId AKfycbxtxrxzFSg6DqsP1-IVv2WRi5-mcgCDKzatPQB1x8pnq8dBRDIdzVTDndBsxmkPAm_jgA --description "Fixed database binding"
```

### Option 2: Manual Copy-Paste

1. Open Apps Script Editor: https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit

2. **Replace `Config.gs`** with the latest version from GitHub

3. Click **Deploy** → **Manage deployments** → **Edit** → **Deploy**

---

## Test It Works

### 1. Test Status Endpoint

```bash
curl "https://script.google.com/macros/s/AKfycbxtxrxzFSg6DqsP1-IVv2WRi5-mcgCDKzatPQB1x8pnq8dBRDIdzVTDndBsxmkPAm_jgA/exec?p=status"
```

Expected:
```json
{
  "ok": true,
  "value": {
    "build": "mvp-v1.1-full-triangle",
    "contract": "1.1.0",
    "db": { "ok": true, "id": "1abc..." },
    "time": "2025-...",
    "features": {...}
  }
}
```

### 2. Open Diagnostics Page

**IMPORTANT**: First, change your admin secret in Config.gs line 80:
```javascript
adminSecret: 'YOUR_SECURE_PASSWORD_HERE'
```

Then visit:
```
https://script.google.com/macros/s/AKfycbxtxrxzFSg6DqsP1-IVv2WRi5-mcgCDKzatPQB1x8pnq8dBRDIdzVTDndBsxmkPAm_jgA/exec?page=diagnostics
```

Click "Run Status Check" → Should show ✅ OK

### 3. Check Your Google Drive

After the first API call, you should see:
```
ZEB_DB - Database
```

in your Google Drive root folder.

---

## Optional: Use Your Own Spreadsheet

If you want to use a specific spreadsheet instead of auto-creating:

1. Create a new Google Spreadsheet
2. Copy its ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/[SPREADSHEET_ID]/edit
   ```
3. Paste it in `Config.gs` line 20:
   ```javascript
   const DB_SPREADSHEET_ID = 'YOUR_SPREADSHEET_ID_HERE';
   ```
4. Redeploy

---

## Troubleshooting

### "Authorization required"
**First time only**: Apps Script will ask for permissions. Click "Review Permissions" → Select your Google account → Click "Advanced" → "Go to Zeventbook (unsafe)" → "Allow"

### "Cannot open spreadsheet [ID]"
The spreadsheet was deleted. Clear the cached ID:
1. Apps Script Editor → **Project Settings** → **Script Properties**
2. Delete the `DB_SPREADSHEET_ID` property
3. Re-run any API call to auto-create a new one

### Still seeing the error?
Make sure you deployed the **latest code** with the fixed `Config.gs`.

---

## Next Steps

Once deployed and working:

1. ✅ Visit Config page and create your first event
2. ✅ Configure sponsors, forms, and display carousel
3. ✅ Test on mobile (Public page)
4. ✅ Test on TV (Display page)
5. ✅ Generate Poster with QR code
6. ✅ Check analytics in the database spreadsheet

---

**Ready to deploy!** 🚀
