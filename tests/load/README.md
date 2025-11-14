# Load Tests

Performance and load testing for MVP Event Toolkit API using k6.

## Quick Start

```bash
# Install k6 (one-time)
# Linux: sudo apt-get install k6
# macOS: brew install k6
# Windows: choco install k6

# Set environment variables
export BASE_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
export ADMIN_KEY="your-admin-key"

# Run tests
npm run test:load:smoke      # Quick baseline (30s)
npm run test:load:average    # Normal load (2m)
npm run test:load:stress     # Heavy load (4m)
npm run test:load:spike      # Traffic spike (~80s)
```

## Test Files

| File | Description | VUs | Duration | Use Case |
|------|-------------|-----|----------|----------|
| `smoke-load.js` | Baseline verification | 1 | 30s | Verify deployment works |
| `average-load.js` | Normal usage simulation | 10 | 2m | Benchmark typical load |
| `stress-load.js` | Heavy sustained load | 0→50→0 | 4m | Find system limits |
| `spike-load.js` | Sudden traffic spike | 1→100→1 | 80s | Test resilience |
| `helpers.js` | Shared utilities | - | - | API helpers & thresholds |

## What Gets Tested

- ✅ System status API
- ✅ Events CRUD operations
- ✅ Sponsors CRUD operations
- ✅ Multi-tenant support
- ✅ Response times
- ✅ Error rates
- ✅ Concurrent request handling

## Documentation

See [LOAD_TESTING.md](../../LOAD_TESTING.md) for:
- Complete setup instructions
- Detailed test descriptions
- Performance targets
- Troubleshooting guide
- Best practices
- CI/CD integration

## GitHub Actions

Run via **Actions** tab → **Load Testing** workflow:
- Choose test type (smoke/average/stress/spike/all)
- Optionally specify custom BASE_URL
- View results in workflow summary
- Download detailed metrics as artifacts

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BASE_URL` | ✅ Yes | - | Deployment URL to test |
| `ADMIN_KEY` | ⚠️ CRUD tests | - | Admin authentication key |
| `TENANT_ID` | No | `root` | Tenant to test |
| `ENVIRONMENT` | No | `production` | Environment tag |

## Performance Targets

| Metric | Target |
|--------|--------|
| Average response | < 2s |
| p95 response | < 5s |
| Error rate | < 0.5% |
| Concurrent users | 50+ |

## Example Output

```
✓ status: status is 200
✓ status: response time < 5s
✓ list events: has ok:true

checks.........................: 100.00% ✓ 150  ✗ 0
http_req_duration..............: avg=1.2s min=200ms med=1s max=3.5s p(95)=2.8s
http_req_failed................: 0.00%   ✓ 0    ✗ 150
http_reqs......................: 150     5/s
```

## Tips

- Start with smoke test before larger tests
- Test QA environment before production
- Monitor Google Apps Script logs during tests
- Expect some rate limiting at high VU counts
- CRUD tests auto-cleanup created test data

## Support

- [k6 Documentation](https://k6.io/docs/)
- [Project Load Testing Guide](../../LOAD_TESTING.md)
- [GitHub Actions Workflow](../../.github/workflows/load-testing.yml)
