# Archived Documentation

These documents are **archived** and no longer maintained. They relate to the legacy Hostinger proxy deployment which has been replaced by Cloudflare Workers.

## Why Archived?

The project has migrated from Hostinger PHP proxy to Cloudflare Workers for:
- Better performance (edge computing vs PHP)
- Simpler deployment (no FTP required)
- Automatic HTTPS and caching
- Lower latency globally

## Current Deployment

For current deployment instructions, see:
- `/cloudflare-proxy/CLOUDFLARE_SETUP.md` - Cloudflare Workers setup
- `/DEPLOYMENT_PIPELINE.md` - CI/CD pipeline documentation

## Archived Files

| File | Original Purpose |
|------|------------------|
| `HOSTINGER_DEPLOYMENT_STRATEGY.md` | Hostinger deployment planning |
| `HOSTINGER_SETUP_INSTRUCTIONS.md` | Hostinger configuration steps |
| `HOSTINGER_PROXY_SETUP.md` | PHP proxy setup guide |
| `HOSTINGER_HPANEL_WALKTHROUGH.md` | Hostinger control panel guide |
| `PR_DESCRIPTION_HOSTINGER.md` | PR template for Hostinger changes |

## Note

The `hostinger-proxy/` directory still exists for reference but is deprecated.
