# Apps Script Project Configuration

## Unified Deployment Target

**ALL code in this repository deploys to a SINGLE Google Apps Script project:**

```
Project ID: 1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l
Project Name: zeventbooks/mvp-event-toolkit
```

**Editor URL:**
https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit

---

## Why One Project?

This repository follows a **single-source-of-truth** deployment model:

- ✅ **One codebase** → One Apps Script project
- ✅ **One deployment pipeline** → Consistent releases
- ✅ **One configuration** → No project ID confusion
- ✅ **One version** → Easier debugging and rollback

---

## Deployment Methods

### 1. GitHub Actions (Recommended)

The CI/CD pipeline automatically deploys to this project when code is merged to `main`.

**Required GitHub Secrets:**
```
SCRIPT_ID         = 1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l
OAUTH_CREDENTIALS = <contents of ~/.clasprc.json>
DEPLOYMENT_ID     = <Apps Script deployment created with “Anyone, even anonymous”>
```

See: [GITHUB_ACTIONS_DEPLOYMENT.md](./GITHUB_ACTIONS_DEPLOYMENT.md)

### 2. Local Deployment with clasp

```bash
# 1. Login to Google (one-time)
npx clasp login

# 2. Create .clasp.json with project ID
echo '{"scriptId":"1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l","rootDir":"."}' > .clasp.json

# 3. Push code
npm run push

# 4. Deploy
npm run deploy
```

See: [DEPLOYMENT_QUICK_START.md](./DEPLOYMENT_QUICK_START.md)

### 3. Manual Copy-Paste

1. Open the [Apps Script Editor](https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit)
2. Copy file contents from this repository
3. Paste into corresponding files in the editor
4. Deploy as web app

See: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## Files Deployed to Apps Script

### Backend Code (.gs files)
- `Code.gs` - Main API logic, routing, request handling
- `Config.gs` - Multi-tenant configuration, schemas, secrets

### Frontend HTML Templates
- `Admin.html` - Admin dashboard
- `Public.html` - Mobile-friendly event display
- `Display.html` - TV/large-screen display
- `Poster.html` - Print-optimized poster with QR codes
- `Test.html` - Testing/diagnostics page
- `Diagnostics.html` - Diagnostic test interface
- `Styles.html` - Shared CSS
- `Header.html` - Common header component
- `DesignAdapter.html` - Design system adapter
- `NUSDK.html` - Utility SDK library

### Configuration
- `appsscript.json` - Apps Script manifest (runtime, scopes, timezone)

---

## Project Settings

### OAuth Scopes Required

```json
{
  "oauthScopes": [
    "https://www.googleapis.com/auth/script.external_request",
    "https://www.googleapis.com/auth/spreadsheets"
  ]
}
```

### Web App Deployment Settings

- **Execute as:** Me (User deploying)
- **Who has access:** Anyone, even anonymous
- **Important:** Always create a **new** deployment after updating `appsscript.json`; editing an old deployment does **not** apply manifest access changes and will continue to show Gmail prompts

---

## Security Notes

⚠️ **Before deploying to production:**

1. Update all `adminSecret` values in `Config.gs`
2. Never commit `.clasp.json` or `.clasprc.json` to version control
3. Rotate admin secrets periodically
4. Review tenant configurations for production use

See: [SECURITY_SETUP.md](./SECURITY_SETUP.md)

---

## Verification

After deployment, verify the app is working:

```bash
# Push latest files
npm run push

# Run automated verification against the new deployment URL
BASE_URL=https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec \
  ./verify-deployment.sh

# Or manually test
curl "$BASE_URL?p=status&tenant=root"
```

Expected response:
```json
{
  "ok": {
    "msg": "MVP Event Toolkit - OK",
    "tenant": "root"
  }
}
```

---

## Getting the Deployment URL

### Via clasp CLI:
```bash
npx clasp deployments
```

### Via Script Editor:
1. Open [Apps Script Editor](https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit)
2. Click **Deploy** → **Manage deployments**
3. Copy the web app URL

### Via GitHub Actions:
The CI/CD pipeline outputs the deployment URL in the workflow logs.

---

## Troubleshooting

### "Script not found" error
- Verify you're using the correct project ID: `1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l`
- Check your Google account has access to this project

### "Unauthorized" / Gmail prompt on admin URLs
- Run `./fix-anonymous-access.sh` to push the manifest and walk through creating a brand-new deployment with **Anyone, even anonymous** selected
- Update the `DEPLOYMENT_ID` GitHub secret and Hostinger proxy files with the new ID so Stage 1/Stage 2 deploy/test agents hit the correct URL
- Use an incognito window to confirm `/exec?page=admin&tenant=root` loads immediately instead of redirecting to Google login

### Deployment fails in GitHub Actions
- Verify `OAUTH_CREDENTIALS`, `DEPLOYMENT_ID`, and `ADMIN_KEY_ROOT` secrets are present
- Run `npm run deploy:verify-secrets` locally to replicate the GitHub validation logic
- Review GitHub Actions logs for Stage 1 (clasp push/deploy) and Stage 2 (Playwright) failures

---

## Migration Notes

If you previously used a different Apps Script project:

1. ✅ **Old Project ID:** `1KttRXT0Sq2663irNS0FlUi3mMkHL9QisErtY4pAqwtqPKH2ZuS7y_Upe` (zeventbook:: latest)
2. ✅ **Current/Unified Project ID:** `1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l` (zeventbooks/mvp-event-toolkit)

**This repository has been fully migrated to use only the unified project ID.**

All deployment scripts, documentation, and GitHub Actions are configured for the unified project.

---

## Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│  UNIFIED APPS SCRIPT PROJECT                                │
├─────────────────────────────────────────────────────────────┤
│  Project ID:                                                │
│  1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l  │
│                                                             │
│  Editor:                                                    │
│  https://script.google.com/home/projects/[PROJECT_ID]/edit │
│                                                             │
│  Deployment Methods:                                        │
│  • GitHub Actions (automatic)                               │
│  • clasp CLI (npm run push)                                 │
│  • Manual copy-paste                                        │
│                                                             │
│  Verify Deployment:                                         │
│  ./verify-deployment.sh <URL>                               │
└─────────────────────────────────────────────────────────────┘
```

---

## Related Documentation

- [DEPLOYMENT.md](./DEPLOYMENT.md) - Complete deployment guide
- [DEPLOYMENT_QUICK_START.md](./DEPLOYMENT_QUICK_START.md) - DevOps quick start
- [GITHUB_ACTIONS_DEPLOYMENT.md](./GITHUB_ACTIONS_DEPLOYMENT.md) - CI/CD setup
- [DEPLOYMENT_PIPELINE.md](./DEPLOYMENT_PIPELINE.md) - Pipeline architecture
- [ARCHITECTURE_REVIEW.md](./ARCHITECTURE_REVIEW.md) - System architecture
- [SECURITY_SETUP.md](./SECURITY_SETUP.md) - Security configuration

---

**Last Updated:** 2025-11-10
**Repository:** https://github.com/zeventbooks/MVP-EVENT-TOOLKIT
