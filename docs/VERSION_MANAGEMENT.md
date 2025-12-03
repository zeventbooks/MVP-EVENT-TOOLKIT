# Apps Script Version Management

Google Apps Script has a **hard limit of 200 versions** per project. This document explains how to manage versions and avoid deployment failures.

## Understanding the Limit

- Each `clasp deploy` creates a new version
- Versions **cannot be deleted programmatically** - only via the web UI
- Once at 200 versions, all deployments will fail until versions are manually deleted
- The weekly [version-monitor.yml](../.github/workflows/version-monitor.yml) workflow alerts when approaching the limit

## Quick Reference

| Version Count | Status | Action |
|---------------|--------|--------|
| 0-149 | Healthy | No action needed |
| 150-179 | Warning | Consider scheduling cleanup |
| 180-194 | High | Schedule cleanup soon |
| 195-199 | Critical | Cleanup immediately |
| 200 | Blocked | Deployments fail - cleanup required |

## How to Clean Up Versions

### Step 1: Open Project History

Go to your Apps Script project's version page:

```
https://script.google.com/home/projects/YOUR_SCRIPT_ID/versions
```

For this project:
```
https://script.google.com/home/projects/1YO4apLOQoAIh208AcAqWO3pWtx_O3yas_QC4z-pkurgMem9UgYOsp86l/versions
```

### Step 2: Bulk Delete Versions

1. Click the **"Bulk delete versions"** button
2. Select old versions to delete
3. Keep the **20-50 most recent versions** for rollback capability
4. Click Delete

### Step 3: Handle Deployed Versions

Versions that are actively deployed cannot be deleted directly. You must first archive the deployment:

1. Go to **Deploy → Manage Deployments**
2. Find deployments using old versions
3. Click the three-dot menu (⋮) and select **Archive**
4. Return to Project History and delete the now-undeployed version

## Best Practices

### Recommended Cleanup Schedule

| Deployment Frequency | Cleanup Frequency |
|---------------------|-------------------|
| Daily | Weekly |
| Weekly | Monthly |
| Monthly | Quarterly |

### Version Retention Policy

- **Keep recent 20-50 versions** for rollback capability
- **Delete versions older than 3 months** unless they're tagged releases
- **Never delete the version** currently in production deployment

### Monitoring

The [version-monitor.yml](../.github/workflows/version-monitor.yml) workflow:
- Runs weekly on Mondays at 9 AM UTC
- Creates GitHub issues when versions exceed 180
- Can be triggered manually via workflow_dispatch

To manually check versions:
```bash
# Run the monitor workflow manually
gh workflow run version-monitor.yml

# Or check via API
SCRIPT_ID="YOUR_SCRIPT_ID"
ACCESS_TOKEN="YOUR_TOKEN"
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://script.googleapis.com/v1/projects/${SCRIPT_ID}/versions" | \
  jq '.versions | length'
```

## Why Can't We Delete Versions Programmatically?

Google's Apps Script API provides:
- `projects.versions.create` - Create new versions
- `projects.versions.get` - Get version details
- `projects.versions.list` - List all versions

There is **no `projects.versions.delete`** endpoint. This is a deliberate limitation by Google, likely for audit/compliance reasons.

**References:**
- [Apps Script Versions Guide](https://developers.google.com/apps-script/guides/versions)
- [Managing Versions API](https://developers.google.com/apps-script/api/how-tos/manage-versions)
- [Stack Overflow Discussion](https://stackoverflow.com/questions/78392922/how-do-i-delete-old-deployments-versions-in-google-apps-script)

## Troubleshooting

### "Cannot create more versions" Error

This means you've hit the 200 version limit. Follow the cleanup steps above.

### "Version is in use by active deployment"

Archive the deployment first:
1. Deploy → Manage Deployments
2. Archive the deployment using that version
3. Then delete the version

### Version Count Shows Wrong Number

The API may cache results. Wait a few minutes after deleting versions before re-checking.

## FAQ

**Q: Can I use a different project to avoid the limit?**
A: Yes, but you'd need to update all deployment URLs and secrets. Not recommended.

**Q: Does archiving a deployment delete the version?**
A: No, archiving only removes the deployment. You must separately delete the version.

**Q: What happens to web app URLs when I delete versions?**
A: Deployments use deployment IDs, not version numbers. As long as the deployment exists, the URL works.

**Q: Can I delete the currently deployed version?**
A: No. You must first update the deployment to use a different version, then delete the old one.
