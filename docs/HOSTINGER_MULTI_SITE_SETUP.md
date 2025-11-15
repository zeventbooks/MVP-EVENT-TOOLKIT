# Hostinger Multi-Site Setup Guide

Complete guide for setting up **QA** and **Production** environments on Hostinger with automatic environment detection.

## Overview

This setup uses a **single `index.php` file** that automatically detects the environment based on the domain:

| Domain | Environment | Apps Script Deployment | Updates |
|--------|-------------|------------------------|---------|
| **qa.zeventbooks.com** | QA | `@HEAD` (auto-updates) | Automatic on main branch |
| **zeventbooks.com** | Production | Versioned (e.g., `@7`) | Manual promotion |

## Architecture

```
User Request
    ↓
https://qa.zeventbooks.com?p=admin&tenant=root
    ↓
[index.php detects "qa.zeventbooks.com"]
    ↓
Routes to → QA Apps Script Deployment (AKfycb...QA...)
    ↓
Response
```

```
User Request
    ↓
https://zeventbooks.com?p=admin&tenant=root
    ↓
[index.php detects "zeventbooks.com"]
    ↓
Routes to → Production Apps Script Deployment (AKfycb...PROD...)
    ↓
Response
```

## Prerequisites

- [x] Hostinger hosting account
- [x] Domain `zeventbooks.com` configured
- [x] Google Apps Script project deployed
- [x] Files ready: `hostinger-proxy/index.php` and `hostinger-proxy/.htaccess`

---

## Step 1: Create Two Apps Script Deployments

### 1.1 Create QA Deployment (Already Exists)

Your current deployment is configured as QA:

```bash
# View current deployments
npx clasp deployments
```

Current QA deployment:
```
Deployment ID: AKfycbzu-U4UgdjdAiXHTg9TD5Y-1gDkc798YSTqQCdhOddG
Type: @HEAD (auto-updates)
Used by: qa.zeventbooks.com
```

### 1.2 Create Production Deployment (NEW)

Create a separate versioned deployment for production:

```bash
# Create production deployment
npx clasp deploy -d "Production v1.0.0"
```

This will output something like:
```
Created version 7.
- AKfycbxXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX @7 - Production v1.0.0
```

**Copy this new deployment ID** - you'll need it in Step 3.

### 1.3 Authorize Both Deployments

For each deployment, ensure it's publicly accessible:

1. Open [Google Apps Script](https://script.google.com)
2. Click **Deploy** → **Manage deployments**
3. For each deployment:
   - Click the **Edit** (pencil) icon
   - **Execute as:** Me
   - **Who has access:** Anyone
   - Click **Deploy**

Test authorization:
```bash
# Test QA deployment
curl "https://script.google.com/macros/s/AKfycbzu-U4UgdjdAiXHTg9TD5Y-1gDkc798YSTqQCdhOddG/exec?p=status&tenant=root"

# Test Production deployment (use your new ID)
curl "https://script.google.com/macros/s/YOUR_PROD_DEPLOYMENT_ID/exec?p=status&tenant=root"
```

Expected response: `{"ok":true,"code":"OK","message":"API is healthy",...}`

---

## Step 2: Configure Hostinger Subdomain

### 2.1 Create QA Subdomain

1. Log into [Hostinger hPanel](https://hpanel.hostinger.com)
2. Go to **Domains** → **Subdomains**
3. Click **Create Subdomain**
4. Configure:
   - **Subdomain:** `qa`
   - **Domain:** `zeventbooks.com`
   - **Document root:** `/public_html/qa.zeventbooks.com`
5. Click **Create**

### 2.2 Enable SSL for QA Subdomain

1. Go to **Advanced** → **SSL**
2. Find `qa.zeventbooks.com`
3. Click **Install SSL** (should be automatic with Let's Encrypt)
4. Wait 2-5 minutes for SSL to activate

### 2.3 Verify DNS Propagation

```bash
# Check if subdomain resolves
nslookup qa.zeventbooks.com

# Test HTTPS access (should redirect to HTTPS)
curl -I https://qa.zeventbooks.com
```

---

## Step 3: Update Production Deployment ID

Edit `hostinger-proxy/index.php` and update line 44 with your new production deployment ID:

```php
} else {
    // Production Environment - Manually promoted versioned deployment
    // TODO: Replace with your production deployment ID after creating it
    define('GOOGLE_SCRIPT_URL', 'https://script.google.com/macros/s/YOUR_PROD_DEPLOYMENT_ID/exec');
    define('ENVIRONMENT', 'PRODUCTION');
}
```

Replace `YOUR_PROD_DEPLOYMENT_ID` with the ID from Step 1.2.

---

## Step 4: Upload Files to Hostinger

### 4.1 Upload to Production (zeventbooks.com)

**Via File Manager:**

1. In hPanel, go to **Files** → **File Manager**
2. Navigate to `/public_html/`
3. Upload both files:
   - `hostinger-proxy/index.php` → `/public_html/index.php`
   - `hostinger-proxy/.htaccess` → `/public_html/.htaccess`
4. Set permissions:
   - Right-click each file → **Permissions** → Set to `644`

**Via FTP (Alternative):**

```bash
# FTP credentials from: Hosting → FTP Accounts
ftp ftp.zeventbooks.com
# Login with your credentials
cd public_html
put hostinger-proxy/index.php index.php
put hostinger-proxy/.htaccess .htaccess
chmod 644 index.php
chmod 644 .htaccess
quit
```

### 4.2 Upload to QA (qa.zeventbooks.com)

**Via File Manager:**

1. Navigate to `/public_html/qa.zeventbooks.com/`
2. Upload the **SAME files**:
   - `hostinger-proxy/index.php` → `/public_html/qa.zeventbooks.com/index.php`
   - `hostinger-proxy/.htaccess` → `/public_html/qa.zeventbooks.com/.htaccess`
3. Set permissions to `644`

**Note:** Both sites use the SAME files - the environment detection happens automatically based on the domain.

---

## Step 5: Verify Setup

### 5.1 Test Environment Detection

Check the response headers to verify which environment is detected:

```bash
# Test QA environment
curl -I https://qa.zeventbooks.com?p=status&tenant=root

# Should show:
# X-Zeventbooks-Environment: QA
# X-Zeventbooks-Host: qa.zeventbooks.com
```

```bash
# Test Production environment
curl -I https://zeventbooks.com?p=status&tenant=root

# Should show:
# X-Zeventbooks-Environment: PRODUCTION
# X-Zeventbooks-Host: zeventbooks.com
```

### 5.2 Test All Tenant URLs

**QA Environment:**
```bash
# Status endpoints
curl "https://qa.zeventbooks.com?p=status&tenant=root"
curl "https://qa.zeventbooks.com?p=status&tenant=abc"
curl "https://qa.zeventbooks.com?p=status&tenant=cbc"
curl "https://qa.zeventbooks.com?p=status&tenant=cbl"

# Admin pages (open in browser)
https://qa.zeventbooks.com?page=admin&tenant=root
https://qa.zeventbooks.com?page=admin&tenant=abc
```

**Production Environment:**
```bash
# Status endpoints
curl "https://zeventbooks.com?p=status&tenant=root"
curl "https://zeventbooks.com?p=status&tenant=abc"
curl "https://zeventbooks.com?p=status&tenant=cbc"
curl "https://zeventbooks.com?p=status&tenant=cbl"

# Admin pages (open in browser)
https://zeventbooks.com?page=admin&tenant=root
https://zeventbooks.com?page=admin&tenant=abc
```

### 5.3 Test Query Parameter Preservation

All query parameters should be forwarded correctly:

```bash
# Complex query strings
curl "https://qa.zeventbooks.com?p=events&tenant=root&limit=10&sort=date"
curl "https://zeventbooks.com?p=events&tenant=abc&filter=upcoming"
```

---

## Step 6: Update GitHub Actions (Optional)

To fully separate QA and Production deployments in CI/CD:

### 6.1 Add GitHub Secrets

Go to **Settings** → **Secrets and variables** → **Actions**:

1. Rename existing secret:
   - `DEPLOYMENT_ID` → `DEPLOYMENT_ID_QA`
   - Value: `AKfycbzu-U4UgdjdAiXHTg9TD5Y-1gDkc798YSTqQCdhOddG`

2. Add new secret:
   - Name: `DEPLOYMENT_ID_PROD`
   - Value: `YOUR_PROD_DEPLOYMENT_ID` (from Step 1.2)

### 6.2 Update Workflow

Edit `.github/workflows/stage1-deploy.yml` line 141:

```yaml
# Before
DEPLOYMENT_ID: ${{ secrets.DEPLOYMENT_ID }}

# After
DEPLOYMENT_ID: ${{ secrets.DEPLOYMENT_ID_QA }}
```

This ensures GitHub Actions always deploys to the QA environment.

---

## Step 7: Deployment Workflow

### 7.1 QA Deployments (Automatic)

```bash
# 1. Push code to main branch
git push origin main

# 2. GitHub Actions automatically:
#    - Runs tests
#    - Deploys to QA Apps Script deployment
#    - Updates qa.zeventbooks.com (immediately reflects changes)

# 3. Test on QA
https://qa.zeventbooks.com?p=status&tenant=root
```

### 7.2 Production Deployments (Manual)

```bash
# 1. Create a new production deployment
npx clasp deploy -d "Production v1.1.0"
# Copy new deployment ID: AKfycb...NEW_ID...

# 2. Update index.php (line 44) with new production deployment ID

# 3. Re-upload index.php to Hostinger production
# Via File Manager: Upload to /public_html/index.php

# 4. Test production
https://zeventbooks.com?p=status&tenant=root
```

---

## Troubleshooting

### Issue: "403 Forbidden" or "Authorization required"

**Fix:** Ensure deployment is publicly accessible

1. Go to [Apps Script](https://script.google.com)
2. **Deploy** → **Manage deployments**
3. Edit deployment → Set "Who has access" to **Anyone**

### Issue: Environment detection not working

**Check response headers:**
```bash
curl -I https://qa.zeventbooks.com?p=status&tenant=root | grep X-Zeventbooks
```

Should show:
```
X-Zeventbooks-Environment: QA
X-Zeventbooks-Host: qa.zeventbooks.com
```

### Issue: Query parameters not preserved

**Verify .htaccess has QSA flag:**
```apache
RewriteRule ^(.*)$ index.php [QSA,L]
```

### Issue: SSL not working

**Force HTTPS in .htaccess:**
```apache
RewriteCond %{HTTPS} off
RewriteRule ^(.*)$ https://%{HTTP_HOST}%{REQUEST_URI} [L,R=301]
```

### Enable Debug Logging

Edit `index.php` and uncomment lines 164-177:

```php
// Uncomment these lines:
$logFile = __DIR__ . '/proxy-debug.log';
$logEntry = sprintf(
    "[%s] ENV:%s HOST:%s %s %s → %s (Status: %d)\n",
    date('Y-m-d H:i:s'),
    ENVIRONMENT,
    $currentHost,
    $_SERVER['REQUEST_METHOD'],
    $_SERVER['REQUEST_URI'],
    $targetUrl,
    $httpCode
);
file_put_contents($logFile, $logEntry, FILE_APPEND);
```

View logs via File Manager: `/public_html/proxy-debug.log`

---

## File Checklist

After setup, you should have:

**Production (zeventbooks.com):**
```
/public_html/
├── index.php          (Environment: PRODUCTION)
└── .htaccess          (Rewrites + HTTPS enforcement)
```

**QA (qa.zeventbooks.com):**
```
/public_html/qa.zeventbooks.com/
├── index.php          (Environment: QA - SAME FILE)
└── .htaccess          (SAME FILE)
```

**Apps Script:**
```
Deployments:
├── @HEAD → AKfycbzu-U4UgdjdAiXHTg9TD5Y-1gDkc798YSTqQCdhOddG (QA)
└── @7    → AKfycb...PROD_ID... (Production)
```

---

## Testing Checklist

- [ ] QA subdomain created and SSL enabled
- [ ] Production deployment created and authorized
- [ ] `index.php` updated with production deployment ID
- [ ] Files uploaded to both `/public_html/` and `/public_html/qa.zeventbooks.com/`
- [ ] Permissions set to 644 for all files
- [ ] Environment headers showing correct environment
- [ ] All tenant status endpoints responding
- [ ] Admin pages loading correctly
- [ ] Query parameters preserved
- [ ] HTTPS working on both domains

---

## Quick Reference

### All Supported URLs

**Pages:** `status`, `admin`, `events`, `display`, `sponsor`, `public`

**Tenants:** `root`, `abc`, `cbc`, `cbl`

**QA:**
```
https://qa.zeventbooks.com?p={page}&tenant={tenant}
https://qa.zeventbooks.com?page=admin&tenant={tenant}
```

**Production:**
```
https://zeventbooks.com?p={page}&tenant={tenant}
https://zeventbooks.com?page=admin&tenant={tenant}
```

### Cost Summary

| Item | Cost |
|------|------|
| Domain (zeventbooks.com) | $12/year |
| QA Subdomain | FREE |
| SSL Certificates | FREE |
| Apps Script | FREE |
| **Total** | **$12/year** |

---

## Next Steps

1. Follow Step 1 to create production deployment
2. Update `index.php` with production deployment ID (Step 3)
3. Upload files to Hostinger (Step 4)
4. Test both environments (Step 5)
5. Update GitHub Actions secrets (Step 6)

For detailed Hostinger hPanel walkthrough, see: [HOSTINGER_HPANEL_WALKTHROUGH.md](./HOSTINGER_HPANEL_WALKTHROUGH.md)
