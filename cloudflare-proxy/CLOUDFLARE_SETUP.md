# Cloudflare Workers Setup Guide

Replace Hostinger with Cloudflare Workers as your proxy layer to Google Apps Script.

## Why Cloudflare Workers?

| Feature | Hostinger (PHP) | Cloudflare Workers |
|---------|-----------------|-------------------|
| Cold start | ~500ms | ~0ms (edge computing) |
| Global CDN | Limited regions | 300+ edge locations |
| Free tier | No | 100,000 requests/day |
| Latency | Variable | <50ms globally |
| SSL | Manual setup | Automatic |
| Custom headers | PHP code | Built-in |
| Analytics | Basic | Real-time dashboard |
| Deployment | FTP upload | CLI or CI/CD |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DEPLOYMENT OPTIONS                               │
└─────────────────────────────────────────────────────────────────────┘

Option A: FULL SITE via Cloudflare (Recommended)
─────────────────────────────────────────────────
User → zeventbooks.com ────→ Cloudflare Worker ────→ Google Apps Script
       (custom domain)       (edge: <50ms)           (backend)

       Serves: HTML pages + API + All brands
       URLs:
         zeventbooks.com?page=admin&brand=root     (Admin page)
         zeventbooks.com?page=display&brand=abc    (Display page)
         zeventbooks.com?p=status&brand=cbc        (Status API)


Option B: API Subdomain Only
────────────────────────────
User → api.zeventbooks.com ──→ Cloudflare Worker ──→ Google Apps Script
       (API subdomain)         (edge: <50ms)         (backend)

       Serves: API responses only
       Main site: Still on Hostinger or elsewhere


Option C: Direct Apps Script (No Proxy)
───────────────────────────────────────
User → script.google.com/macros/s/.../exec ──→ Google Apps Script
       (Google's URL)                           (backend)

       No custom domain, long URL
```

## Deployment Commands

| Environment | Command | Routes |
|-------------|---------|--------|
| Development | `wrangler deploy` | `*.workers.dev` |
| Production (Full Site) | `wrangler deploy --env production` | `zeventbooks.com/*` |
| Staging | `wrangler deploy --env staging` | `staging.zeventbooks.com/*` |
| API Only | `wrangler deploy --env api-only` | `api.zeventbooks.com/*` |

## Prerequisites

1. **Cloudflare Account** (free tier works)
2. **Domain** (optional - can use workers.dev subdomain)
3. **Node.js** (for Wrangler CLI)

## Quick Start

### Step 1: Install Wrangler CLI

```bash
npm install -g wrangler
```

### Step 2: Login to Cloudflare

```bash
wrangler login
```

This opens a browser for authentication.

### Step 3: Deploy Worker

```bash
cd cloudflare-proxy
wrangler deploy
```

Your worker is now live at:
```
https://zeventbooks-api.YOUR_SUBDOMAIN.workers.dev
```

### Step 4: Test the Proxy

```bash
# Test status endpoint
curl "https://zeventbooks-api.YOUR_SUBDOMAIN.workers.dev?p=status&brand=root"

# Should return:
# {"ok":true,"value":{"build":"triangle-extended-v1.3","brand":"root"}}
```

## Custom Domain Setup

### Option A: Subdomain (Recommended)

1. **Add domain to Cloudflare** (if not already)
   - Go to Cloudflare Dashboard → Add Site
   - Update nameservers at your registrar

2. **Add route in wrangler.toml**:
   ```toml
   [env.production]
   routes = [
     { pattern = "api.zeventbooks.com/*", zone_name = "zeventbooks.com" }
   ]
   ```

3. **Deploy to production**:
   ```bash
   wrangler deploy --env production
   ```

### Option B: Workers.dev Subdomain (No Custom Domain)

Use the default workers.dev URL - no configuration needed:
```
https://zeventbooks-api.YOUR_SUBDOMAIN.workers.dev
```

## CI/CD Integration

### GitHub Actions - Auto-Update Deployment ID

Add to your `.github/workflows/stage1-deploy.yml`:

```yaml
- name: Update Cloudflare Worker
  if: success()
  env:
    CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
    CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  run: |
    # Update wrangler.toml with new deployment ID
    DEPLOYMENT_ID="${{ steps.deploy.outputs.deployment_id }}"

    cd cloudflare-proxy

    # Update the deployment ID in wrangler.toml
    sed -i "s/DEPLOYMENT_ID = \"[^\"]*\"/DEPLOYMENT_ID = \"${DEPLOYMENT_ID}\"/" wrangler.toml

    # Deploy updated worker
    npx wrangler deploy

    echo "✅ Cloudflare Worker updated with deployment ID: $DEPLOYMENT_ID"
```

### Required GitHub Secrets

| Secret | Description | How to Get |
|--------|-------------|------------|
| `CLOUDFLARE_API_TOKEN` | API token with Workers permissions | Cloudflare Dashboard → My Profile → API Tokens |
| `CLOUDFLARE_ACCOUNT_ID` | Your account identifier | Cloudflare Dashboard → Workers → Account ID |

### Creating API Token

1. Go to https://dash.cloudflare.com/profile/api-tokens
2. Click **Create Token**
3. Use template: **Edit Cloudflare Workers**
4. Set permissions:
   - Account: Workers Scripts: Edit
   - Zone: Workers Routes: Edit (if using custom domain)
5. Copy token to GitHub Secrets

## Environment Configuration

### Development (default)

```bash
wrangler deploy
# → https://zeventbooks-api.YOUR_SUBDOMAIN.workers.dev
```

### Production

```bash
wrangler deploy --env production
# → https://api.zeventbooks.com (custom domain)
```

### Staging

```bash
wrangler deploy --env staging
# → https://api-staging.zeventbooks.com
```

## Testing with Cloudflare URL

Update your test environment to use Cloudflare:

```bash
# Run tests against Cloudflare proxy
export BASE_URL=https://zeventbooks-api.YOUR_SUBDOMAIN.workers.dev
npm run test:api
npm run test:smoke
```

Or update `tests/config/environments.js`:

```javascript
cloudflare: {
  name: 'Cloudflare Workers',
  baseUrl: process.env.CLOUDFLARE_URL || 'https://api.zeventbooks.com',
  description: 'Cloudflare Workers proxy to Apps Script',
  brands: { root: 'root', abc: 'abc', cbc: 'cbc', cbl: 'cbl' }
}
```

## Worker Features

### CORS Support

The worker automatically handles CORS preflight requests:

```javascript
// Allowed methods
'GET, POST, PUT, DELETE, OPTIONS'

// Allowed headers
'Content-Type, Authorization, X-Requested-With'
```

### Error Handling

Proxy errors return standardized JSON:

```json
{
  "ok": false,
  "error": "PROXY_ERROR",
  "message": "Failed to proxy request to Apps Script"
}
```

### Request Forwarding

The worker forwards:
- Query parameters (`?p=status&brand=root`)
- Request body (for POST/PUT)
- Content-Type header
- User-Agent (for analytics)

## Monitoring

### Cloudflare Dashboard

View real-time metrics at:
```
https://dash.cloudflare.com → Workers → zeventbooks-api → Analytics
```

Available metrics:
- Request count
- Error rate
- Response time percentiles
- Geographic distribution

### Worker Logs

```bash
# Stream real-time logs
wrangler tail

# Filter by status
wrangler tail --status error
```

## Troubleshooting

### "Worker not found"

```bash
# Check deployment status
wrangler whoami
wrangler deployments list
```

### "Route not matching"

Ensure your domain is added to Cloudflare and nameservers are updated.

### "502 Bad Gateway"

Apps Script may be rate-limited or deployment ID is invalid:

```bash
# Test direct Apps Script URL
curl "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec?p=status&brand=root"
```

### Update Deployment ID Manually

```bash
cd cloudflare-proxy

# Edit wrangler.toml
# Change DEPLOYMENT_ID = "..."

# Redeploy
wrangler deploy
```

## Cost Comparison

### Cloudflare Workers (Free Tier)
- 100,000 requests/day
- 10ms CPU time per request
- Unlimited bandwidth
- **Cost: $0/month**

### Cloudflare Workers (Paid)
- 10 million requests/month included
- Unlimited requests at $0.50/million
- **Cost: $5/month base**

### Hostinger (Current)
- Shared hosting plan
- **Cost: ~$3-10/month**

## Migration Checklist

- [ ] Create Cloudflare account
- [ ] Install Wrangler CLI
- [ ] Deploy worker to workers.dev
- [ ] Test all endpoints via worker URL
- [ ] (Optional) Add custom domain
- [ ] Add GitHub Secrets for CI/CD
- [ ] Update CI/CD workflow
- [ ] Update test configuration
- [ ] Verify production traffic
- [ ] Decommission Hostinger proxy

## File Structure

```
cloudflare-proxy/
├── worker.js           # Main worker code
├── wrangler.toml       # Wrangler configuration
└── CLOUDFLARE_SETUP.md # This guide
```

## Next Steps

1. Run `wrangler login` to authenticate
2. Run `wrangler deploy` to deploy
3. Test with `curl` or browser
4. Update CI/CD if needed
5. Point DNS to Cloudflare (for custom domain)
