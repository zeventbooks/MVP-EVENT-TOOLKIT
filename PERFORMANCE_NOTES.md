# Performance Notes

Performance baselines and load testing documentation for MVP Event Toolkit.

## Bundle Endpoint Load Testing

### Overview

The bundle endpoints serve the public-facing pages (Public, Display, Poster) and are critical for user experience. These endpoints are tested under moderate load to ensure they remain responsive.

### Endpoints Tested

| Endpoint | Purpose | Response Includes |
|----------|---------|-------------------|
| `api_getPublicBundle` | Public event page | Event + brand config |
| `api_getDisplayBundle` | TV/Display page | Event + rotation config + layout |
| `api_getPosterBundle` | Poster/print page | Event + QR codes + print strings |

### Load Test Configuration

- **VUs (Virtual Users):** 5 concurrent
- **Duration:** 60 seconds
- **Requests:** ~100-300 per endpoint (depending on response times)
- **Target Events:** 3-5 events (fetched dynamically)
- **Environment:** Staging (`https://stg.eventangle.com`)

### Performance Baselines

These baselines account for Google Apps Script backend characteristics:

| Metric | Public Bundle | Display Bundle | Poster Bundle |
|--------|---------------|----------------|---------------|
| **p95 Latency** | < 5000ms | < 5000ms | < 5000ms |
| **Average Latency** | < 3000ms | < 3000ms | < 3000ms |
| **Error Rate** | < 1% | < 1% | < 1% |
| **Success Rate** | > 99% | > 99% | > 99% |

### Running the Load Test

```bash
# Against staging (recommended)
BASE_URL=https://stg.eventangle.com k6 run tests/load/bundle-load.js

# With specific brand
BASE_URL=https://stg.eventangle.com BRAND_ID=root k6 run tests/load/bundle-load.js

# Against production (requires explicit confirmation)
BASE_URL=https://www.eventangle.com CONFIRM_PRODUCTION=true k6 run tests/load/bundle-load.js

# Using npm script
npm run test:load:bundles
```

### When to Run

- **Before major deployments** - Verify no performance regressions
- **After infrastructure changes** - Confirm system stability
- **Periodically (weekly/monthly)** - Track performance trends
- **NOT on every PR** - Too expensive and slow for CI

### Interpreting Results

K6 will output metrics including:

```
public_bundle_latency......: avg=1234ms  p(95)=3456ms
display_bundle_latency.....: avg=1345ms  p(95)=3567ms
poster_bundle_latency......: avg=1456ms  p(95)=3678ms

public_bundle_success......: 99.50%
display_bundle_success.....: 99.75%
poster_bundle_success......: 99.25%
```

**Pass criteria:**
- All p(95) values under 5000ms
- All success rates above 99%
- http_req_failed rate under 1%

### Historical Baselines

Record your baseline measurements here after each significant run:

| Date | Environment | Public p95 | Display p95 | Poster p95 | Notes |
|------|-------------|------------|-------------|------------|-------|
| YYYY-MM-DD | staging | TBD | TBD | TBD | Initial baseline |

### Known Performance Characteristics

1. **Cold Start Latency**: Google Apps Script has cold start delays. First request may be 3-5s slower.
2. **Sponsor Hydration**: All bundle endpoints call `getEventById_()` with `hydrateSponsors: true`, adding overhead for events with many sponsors.
3. **QR Code Generation**: Poster bundle generates QR codes via quickchart.io API, adding external dependency latency.
4. **ETag Caching**: All bundles support `ifNoneMatch` for conditional requests, returning `notModified: true` for unchanged content.

### Troubleshooting

**High error rates:**
- Check if staging environment is up
- Verify brand ID exists
- Check for rate limiting

**Slow response times:**
- Check Google Apps Script quotas
- Verify external dependencies (quickchart.io for posters)
- Consider cold start effects

**No events found:**
- Seed test data using `npm run qa:seed`
- Verify brand has events

## Other Load Tests

The project includes additional load tests in `tests/load/`:

| Test | Purpose | Command |
|------|---------|---------|
| `smoke-load.js` | Baseline verification | `npm run test:load:smoke` |
| `average-load.js` | Typical usage pattern | `npm run test:load:average` |
| `stress-load.js` | Find breaking point | `npm run test:load:stress` |
| `spike-load.js` | Sudden traffic surge | `npm run test:load:spike` |
| `bundle-load.js` | Bundle endpoints | `npm run test:load:bundles` |

## Performance Improvement Ideas

- [ ] Add CDN caching for bundle responses
- [ ] Implement response compression
- [ ] Cache sponsor data at the brand level
- [ ] Pre-generate QR codes instead of on-demand generation
