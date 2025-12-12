# Google Service Account Setup for Sheets API

> **Story 1.1** - Create Google Service Account & Bind to Sheets
>
> Purpose: Give the Worker its own identity to read/write Sheets without user OAuth flows.

## Overview

This guide walks through setting up a Google Service Account that the Cloudflare Worker
uses to access Google Sheets directly. This eliminates the need for user OAuth flows
and provides a stable, server-to-server authentication mechanism.

## Prerequisites

- Google Cloud Console access (same account that owns the spreadsheets)
- Cloudflare account with Workers enabled
- Access to GitHub repository secrets (for CI/CD)

---

## Step 1: Create a Google Cloud Project (if needed)

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown (top-left)
3. Click "New Project"
4. Enter project name: `eventangle-sheets-api` (or similar)
5. Click "Create"

> **Note:** You can use an existing project if you have one.

---

## Step 2: Enable the Google Sheets API

1. In Google Cloud Console, select your project
2. Go to **APIs & Services** > **Library**
3. Search for "Google Sheets API"
4. Click on it and click **Enable**

---

## Step 3: Create a Service Account

1. Go to **IAM & Admin** > **Service Accounts**
2. Click **+ Create Service Account**
3. Fill in the details:
   - **Service account name:** `eventangle-worker`
   - **Service account ID:** `eventangle-worker` (auto-generated)
   - **Description:** `Service account for Cloudflare Worker to access Google Sheets`
4. Click **Create and Continue**
5. Skip the "Grant this service account access to project" step (click **Continue**)
6. Skip the "Grant users access to this service account" step (click **Done**)

---

## Step 4: Create and Download Credentials JSON

1. Click on the newly created service account
2. Go to the **Keys** tab
3. Click **Add Key** > **Create new key**
4. Select **JSON** format
5. Click **Create**
6. **Save the downloaded JSON file securely** - you'll need it for the next steps

The JSON file will look like this:

```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQ...\n-----END PRIVATE KEY-----\n",
  "client_email": "eventangle-worker@your-project.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

**Important values you'll need:**
- `client_email` - The service account email address
- `private_key` - The RSA private key (PEM format)

---

## Step 5: Share Google Sheets with Service Account

For each spreadsheet the Worker needs to access:

1. Open the Google Sheet in your browser
2. Click **Share** (top-right)
3. In the "Add people and groups" field, paste the service account email:
   ```
   eventangle-worker@your-project.iam.gserviceaccount.com
   ```
4. Set permission to **Editor** (for read/write) or **Viewer** (for read-only)
5. Uncheck "Notify people" (service accounts can't receive emails)
6. Click **Share**

### Sheets to Share (Staging First)

| Environment | Spreadsheet | Permission |
|-------------|-------------|------------|
| Staging     | STG Events Sheet | Editor |
| Production  | PROD Events Sheet | Editor (share later once stable) |

> **Note:** Only share staging sheets initially. Share production sheets once the
> integration is verified and stable.

---

## Step 6: Configure Cloudflare Worker Secrets

Add the service account credentials as Worker secrets:

```bash
# Navigate to the cloudflare-proxy directory
cd cloudflare-proxy

# Set the service account email
wrangler secret put GOOGLE_CLIENT_EMAIL --env staging
# Enter: eventangle-worker@your-project.iam.gserviceaccount.com

# Set the private key (paste the entire PEM block including BEGIN/END markers)
wrangler secret put GOOGLE_PRIVATE_KEY --env staging
# Paste the private_key value from the JSON file

# Set the spreadsheet ID (from the sheet URL)
wrangler secret put SHEETS_SPREADSHEET_ID --env staging
# Enter: 1abc123xyz... (from https://docs.google.com/spreadsheets/d/{THIS_ID}/edit)
```

### Finding the Spreadsheet ID

The spreadsheet ID is in the URL:
```
https://docs.google.com/spreadsheets/d/1abc123xyz_the_spreadsheet_id_here/edit
                                       ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                       This is the SHEETS_SPREADSHEET_ID
```

---

## Step 7: Configure GitHub Secrets (for CI/CD)

Add these secrets to GitHub for the CI pipeline:

1. Go to your repository > **Settings** > **Secrets and variables** > **Actions**
2. Add the following secrets:

| Secret Name | Description | Value |
|-------------|-------------|-------|
| `GOOGLE_CLIENT_EMAIL` | Service account email | `eventangle-worker@project.iam.gserviceaccount.com` |
| `GOOGLE_PRIVATE_KEY` | Service account private key | The entire PEM block from JSON |
| `SHEETS_SPREADSHEET_ID_TEST` | Test spreadsheet ID | ID of a test sheet for CI connectivity |

> **Note:** Use a dedicated test spreadsheet (`SHEETS_SPREADSHEET_ID_TEST`) for CI
> connectivity tests to avoid polluting production/staging data.

---

## Step 8: Create a Test Sheet for CI

Create a dedicated test spreadsheet for CI connectivity checks:

1. Create a new Google Sheet named "CI Connectivity Test"
2. Share it with the service account (Editor access)
3. Note the spreadsheet ID from the URL
4. Add it to GitHub secrets as `SHEETS_SPREADSHEET_ID_TEST`

The CI pipeline will:
1. Read a test cell (e.g., `TEST!A1`)
2. Write a timestamp to verify write access
3. Read back to confirm the write

---

## Step 9: Verify Setup Locally

Run the local connectivity test script:

```bash
# Set environment variables
export GOOGLE_CLIENT_EMAIL="eventangle-worker@your-project.iam.gserviceaccount.com"
export GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----
...your key here...
-----END PRIVATE KEY-----"
export SHEETS_SPREADSHEET_ID="your-test-spreadsheet-id"

# Run the connectivity test
npm run test:sheets:connectivity
```

Expected output:
```
Google Sheets Connectivity Test
================================
Service Account: eventangle-worker@your-project.iam.gserviceaccount.com
Spreadsheet ID:  your-test-spreadsheet-id

[1/4] Getting access token... OK (245ms)
[2/4] Reading test cell (TEST!A1)... OK (312ms)
[3/4] Writing timestamp to TEST!B1... OK (287ms)
[4/4] Verifying write... OK (298ms)

All connectivity tests passed!
```

---

## Troubleshooting

### Error: 403 Forbidden

**Cause:** Service account doesn't have access to the spreadsheet.

**Fix:**
1. Verify the spreadsheet is shared with the correct service account email
2. Check that the service account has Editor (not Viewer) access for write operations
3. Verify you're using the correct spreadsheet ID

### Error: 404 Not Found

**Cause:** Spreadsheet ID is incorrect or sheet/range doesn't exist.

**Fix:**
1. Double-check the spreadsheet ID in the URL
2. Verify the sheet name (e.g., `EVENTS`, `TEST`) exists
3. Check the range is valid (e.g., `TEST!A1`)

### Error: JWT Signature Invalid

**Cause:** Private key is malformed or incorrectly formatted.

**Fix:**
1. Ensure the private key includes `-----BEGIN PRIVATE KEY-----` and `-----END PRIVATE KEY-----`
2. Check for any extra whitespace or missing newlines
3. Regenerate the key if necessary (Step 4)

### Error: Token Exchange Failed

**Cause:** Google Sheets API not enabled or invalid credentials.

**Fix:**
1. Verify Google Sheets API is enabled (Step 2)
2. Check the client email matches the service account
3. Ensure the private key matches the client email

---

## Security Best Practices

1. **Never commit credentials** - Always use environment variables or secrets managers
2. **Principle of least privilege** - Only share sheets that need to be accessed
3. **Rotate keys periodically** - Create new keys and delete old ones every 90 days
4. **Use separate test sheets** - Don't use production/staging data for CI tests
5. **Monitor API usage** - Check Google Cloud Console for unusual activity

---

## Related Files

- `cloudflare-proxy/src/sheets/auth.js` - JWT authentication implementation
- `cloudflare-proxy/src/sheets/client.js` - Sheets API client
- `scripts/test-sheets-connectivity.js` - Local connectivity test script
- `.github/workflows/stage1.yml` - CI pipeline with Sheets connectivity job

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2024-12-12 | Initial Story 1.1 implementation |
