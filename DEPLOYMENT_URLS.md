# Deployment URLs Reference

## Quick Deploy with Test URLs

After making changes to your code, deploy and get all test URLs in one command:

```bash
npm run deploy:test
```

This will:
1. ✅ Push your latest code to Apps Script
2. ✅ Create a new deployment
3. ✅ Output formatted test URLs for all tenants and pages

---

## Manual Deployment

If you prefer manual deployment:

```bash
# Push code only (no new deployment)
npm run push

# Create new deployment
npm run deploy

# Get deployment URLs
npx @google/clasp deployments
```

---

## Test URL Format

Once deployed, your URLs follow this pattern:

```
https://script.google.com/macros/s/{SCRIPT_ID}/exec?page={PAGE}&tenant={TENANT}
```

### Pages Available:
- `admin` - Event management dashboard
- `report` - **NEW!** Shared Analytics dashboard
- `public` - Public event listings (mobile)
- `display` - TV display mode
- `poster` - Print poster with QR codes
- `test` - Test dashboard
- `api` - API documentation
- `status` - System status
- `diagnostics` - Diagnostics page

### Tenants:
- `root` - Zeventbook (main)
- `abc` - American Bocce Co.
- `cbc` - Chicago Bocce Club
- `cbl` - Chicago Bocce League

---

## Quick Testing Checklist

After deployment, test in this order:

1. **Admin Page** - Create test events
   ```
   {URL}?page=admin&tenant=root
   ```

2. **Shared Analytics** - View analytics dashboard (NEW!)
   ```
   {URL}?page=report&tenant=root
   ```

3. **Public Page** - Mobile experience
   ```
   {URL}?page=public&tenant=root
   ```

4. **Display Page** - TV display
   ```
   {URL}?page=display&tenant=root&tv=1
   ```

5. **Poster Page** - Print version
   ```
   {URL}?page=poster&tenant=root
   ```

---

## Mobile Testing

1. Open any page in Chrome
2. Press `F12` to open DevTools
3. Click device toggle (or `Ctrl+Shift+M`)
4. Select "iPhone 12 Pro" or similar
5. Verify:
   - ✅ No horizontal scrolling
   - ✅ Buttons are thumb-friendly (44px min)
   - ✅ Cards stack vertically
   - ✅ Forms use full width

---

## API Testing

Test the Shared Analytics API:

```javascript
// Open browser console (F12) on any page
google.script.run
  .withSuccessHandler(result => console.log('✅ Success:', result))
  .withFailureHandler(error => console.error('❌ Error:', error))
  .api_getSharedAnalytics({
    tenantId: 'root',
    isSponsorView: false
  });
```

Expected response:
```json
{
  "ok": true,
  "value": {
    "totalImpressions": 0,
    "totalClicks": 0,
    "engagementRate": "0%",
    "uniqueEvents": 0,
    "uniqueSponsors": 0,
    "bySurface": {...},
    "byEvent": {...},
    "bySponsor": {...}
  }
}
```

---

## Troubleshooting

**No deployments found?**
```bash
# Create your first deployment
npx @google/clasp deploy --description "Initial deployment"
```

**Code not updating?**
```bash
# Force push your changes
npx @google/clasp push --force
```

**Need to see Apps Script editor?**
```bash
npm run open
```

**Check deployment logs?**
```bash
npm run logs
```

---

## CI/CD Automated Deployment

When you merge to `main` branch, GitHub Actions will automatically:
1. Run linting
2. Run unit tests
3. Run contract tests
4. Deploy to Apps Script
5. Run E2E smoke tests
6. Run E2E page tests
7. Run E2E flow tests
8. Quality gate check

See `.github/workflows/ci.yml` for details.
