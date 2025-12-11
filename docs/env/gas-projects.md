# GAS Projects Inventory

**Last Updated:** 2025-12-11
**Story:** 1.1.1 - Inventory & document current GAS projects and owners
**Epic:** Backend Identity Consolidation

---

## Summary

This document serves as the **single source of truth** for all Google Apps Script (GAS) projects used by MVP-EVENT-TOOLKIT. All projects should be owned by `zeventbook@gmail.com` - any ownership by `mzdano@gmail.com` indicates configuration drift that must be corrected.

---

## Project Inventory Table

| Environment | Script ID | Project Name | Owner Email | Status |
|-------------|-----------|--------------|-------------|--------|
| **Staging** | `1gHiPuj7eXNk09dDyk17SJ6QsCJg7LMqXBRrkowljL3z2TaAKFIvBLhHJ` | EventAngle Staging | `zeventbook@gmail.com` | Correct |
| **Production** | `1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l` | EventAngle Production | `zeventbook@gmail.com` | Correct |

---

## Detailed Project Information

### Staging Environment

| Property | Value |
|----------|-------|
| **Script ID** | `1gHiPuj7eXNk09dDyk17SJ6QsCJg7LMqXBRrkowljL3z2TaAKFIvBLhHJ` |
| **Deployment ID** | `AKfycbwFneYCpkio7wCn7y08eDUb2PRCPc2Tdtbv20L4AbEHvuCvoqY9ks7-ONL0pzPPw4Hm` |
| **Owner** | `zeventbook@gmail.com` |
| **Project Editor URL** | https://script.google.com/home/projects/1gHiPuj7eXNk09dDyk17SJ6QsCJg7LMqXBRrkowljL3z2TaAKFIvBLhHJ/edit |
| **Web App URL** | `https://script.google.com/macros/s/AKfycbwFneYCpkio7wCn7y08eDUb2PRCPc2Tdtbv20L4AbEHvuCvoqY9ks7-ONL0pzPPw4Hm/exec` |
| **Public URL (Cloudflare)** | `https://stg.eventangle.com` |

### Production Environment

| Property | Value |
|----------|-------|
| **Script ID** | `1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l` |
| **Deployment ID** | `AKfycbz-RVTCdsQsI913wN3TkPtUP8F8EhSjyFAlWIpLVRgzV6WJ-isDyG-ntaV1VjBNaWZLdw` |
| **Owner** | `zeventbook@gmail.com` |
| **Project Editor URL** | https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/edit |
| **Web App URL** | `https://script.google.com/macros/s/AKfycbz-RVTCdsQsI913wN3TkPtUP8F8EhSjyFAlWIpLVRgzV6WJ-isDyG-ntaV1VjBNaWZLdw/exec` |
| **Public URL (Cloudflare)** | `https://www.eventangle.com` |

---

## Web App Deployments

### Staging Deployments

| Deployment ID | URL | Notes |
|---------------|-----|-------|
| `AKfycbwFneYCpkio7wCn7y08eDUb2PRCPc2Tdtbv20L4AbEHvuCvoqY9ks7-ONL0pzPPw4Hm` | [exec link](https://script.google.com/macros/s/AKfycbwFneYCpkio7wCn7y08eDUb2PRCPc2Tdtbv20L4AbEHvuCvoqY9ks7-ONL0pzPPw4Hm/exec) | Current active deployment |

### Production Deployments

| Deployment ID | URL | Notes |
|---------------|-----|-------|
| `AKfycbz-RVTCdsQsI913wN3TkPtUP8F8EhSjyFAlWIpLVRgzV6WJ-isDyG-ntaV1VjBNaWZLdw` | [exec link](https://script.google.com/macros/s/AKfycbz-RVTCdsQsI913wN3TkPtUP8F8EhSjyFAlWIpLVRgzV6WJ-isDyG-ntaV1VjBNaWZLdw/exec) | Current active deployment |

---

## Configuration File References

### Where Script IDs are Defined

| File | Environment | Script ID | Purpose |
|------|-------------|-----------|---------|
| `.clasp.json` | Staging (default) | `1gHiPuj7eXNk09dDyk17SJ6QsCJg7LMqXBRrkowljL3z2TaAKFIvBLhHJ` | Default clasp config (safe for local dev) |
| `.clasp-staging.json` | Staging | `1gHiPuj7eXNk09dDyk17SJ6QsCJg7LMqXBRrkowljL3z2TaAKFIvBLhHJ` | Staging clasp config |
| `.clasp-production.json` | Production | `1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l` | Production clasp config (CI-only) |
| `deploy-manifest.json` | Both | Both script IDs | Centralized deployment manifest |
| `cloudflare-proxy/wrangler.toml` | Both | Referenced in vars | Cloudflare Worker config |
| `wrangler.toml` (root) | Staging | Referenced in comments | Root staging worker config |

### Deployment ID Locations

| File | Variable/Key | Environment |
|------|--------------|-------------|
| `deploy-manifest.json` | `environments.staging.appsScript.deploymentId` | Staging |
| `deploy-manifest.json` | `environments.production.appsScript.deploymentId` | Production |
| `cloudflare-proxy/wrangler.toml` | `STAGING_DEPLOYMENT_ID` | Staging |
| `cloudflare-proxy/wrangler.toml` | `PROD_DEPLOYMENT_ID` | Production |
| `wrangler.toml` (root) | `STAGING_DEPLOYMENT_ID` | Staging |

---

## Ownership Audit

### Expected Ownership

All GAS projects for EventAngle **MUST** be owned by:

```
zeventbook@gmail.com
```

### Flagged Ownership Issues

| Environment | Script ID | Current Owner | Expected Owner | Status |
|-------------|-----------|---------------|----------------|--------|
| Staging | `1gHiPuj7eXNk09dDyk17SJ6QsCJg7LMqXBRrkowljL3z2TaAKFIvBLhHJ` | `zeventbook@gmail.com` | `zeventbook@gmail.com` | OK |
| Production | `1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l` | `zeventbook@gmail.com` | `zeventbook@gmail.com` | OK |

### Accounts to Watch

| Account | Should Own GAS Projects? | Notes |
|---------|--------------------------|-------|
| `zeventbook@gmail.com` | YES | Canonical owner for all EventAngle GAS projects |
| `mzdano@gmail.com` | NO | Personal account - should NOT own any EventAngle resources |

---

## Verification Steps

### Manual Ownership Verification

To verify project ownership in Apps Script:

1. Open the Project Editor URL (links above)
2. Click **Project Settings** (gear icon)
3. Verify **Owner** shows `zeventbook@gmail.com`
4. If owned by `mzdano`, this is a **DRIFT** issue requiring remediation

### Automated Verification

```bash
# Check staging health
npm run staging:verify

# Check production health
curl -s https://www.eventangle.com/status | jq

# Full environment status
npm run staging:status
```

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-11 | Initial inventory created (Story 1.1.1) | Claude |

---

## Related Documentation

- [`staging.md`](./staging.md) - Detailed staging environment docs
- [`deploy-manifest.json`](../../deploy-manifest.json) - Centralized deployment manifest
- [`DEPLOYMENT.md`](../DEPLOYMENT.md) - Deployment procedures
- [`cloudflare-proxy/wrangler.toml`](../../cloudflare-proxy/wrangler.toml) - Cloudflare Worker configuration
