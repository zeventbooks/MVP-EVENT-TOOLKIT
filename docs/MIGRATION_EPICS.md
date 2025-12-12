# Migration Plan: GAS → Cloudflare Workers

## Epics & Stories for Backlog

**Environment Assumption**: STAGING first, PROD only when explicitly called out.

---

# EPIC 0 – Risk Containment & Coexistence

## Purpose / Value

Don't blow up existing QR flows while you cut over from GAS to Workers. This is the "no whack-a-mole" guardrail.

## Scope

| Component | Status |
|-----------|--------|
| Cloudflare Worker router config | In scope |
| GAS backend (leave as legacy) | In scope (read-only, no changes) |
| DNS / routes `stg.eventangle.com` → Worker | In scope |

## Epic Definition of Done

- [ ] All existing QR flows continue to work unchanged via GAS proxy
- [ ] New `/api/v2/*` routes available but not yet consumed by frontend
- [ ] Feature flag `USE_WORKER_API` defaults to `false`
- [ ] Rollback procedure documented and tested
- [ ] Smoke tests pass on both v1 (GAS) and v2 (Worker) endpoints

---

## Stories

### Story 0.1: Establish Coexistence Router Pattern

**As a** platform engineer
**I want** the Worker to route requests to GAS by default while exposing v2 endpoints in parallel
**So that** existing flows remain unbroken during migration

**Acceptance Criteria:**

```gherkin
Given the Worker receives a request to /api/rpc
When the request method is POST
Then the Worker proxies to GAS backend
And returns the GAS response unchanged

Given the Worker receives a request to /api/v2/status
When the request method is GET
Then the Worker handles it natively (no GAS call)
And returns Worker-native response with header X-Handler: worker-native
```

**Technical Tasks:**

- [ ] Verify `worker.js` routing logic sends `/api/*` → GAS proxy
- [ ] Verify `worker.js` routing logic sends `/api/v2/*` → Worker-native handlers
- [ ] Add `X-Handler` response header to identify response source (`gas-proxy` | `worker-native`)
- [ ] Write routing unit tests for both paths

**Points:** 3
**Priority:** P0 (Critical)

---

### Story 0.2: Feature Flag for API Version Selection

**As a** platform engineer
**I want** a feature flag to control whether frontend calls v1 (GAS) or v2 (Worker) APIs
**So that** I can toggle migration on/off without code deployment

**Acceptance Criteria:**

```gherkin
Given USE_WORKER_API is set to "false" (default)
When frontend calls event listing API
Then the call goes to /api/rpc with method=api_list

Given USE_WORKER_API is set to "true"
When frontend calls event listing API
Then the call goes to /api/v2/events
```

**Technical Tasks:**

- [ ] Add `USE_WORKER_API` environment variable to `wrangler.toml` (default: `"false"`)
- [ ] Document feature flag in `config/brand-config.js`
- [ ] Add runtime check in frontend NUSDK to respect flag
- [ ] Ensure flag is readable from both staging and production configs

**Points:** 2
**Priority:** P0 (Critical)

---

### Story 0.3: Validate GAS Backend Still Works (M1 Completion)

**As a** platform engineer
**I want** confirmation that GAS backend accepts POST requests
**So that** I can be confident the proxy path works end-to-end

**Acceptance Criteria:**

```gherkin
Given GAS is deployed with ANYONE_ANONYMOUS access
When I POST to /api/rpc with {"method": "api_status"}
Then I receive HTTP 200
And response body contains {"ok": true, "value": {...}}
And response body does NOT contain HTML
```

**Technical Tasks:**

- [ ] Redeploy GAS with correct permissions (Execute as: Me, Access: Anyone)
- [ ] Update `STAGING_DEPLOYMENT_ID` in `wrangler.toml`
- [ ] Update `deploy-manifest.json` with new deployment ID
- [ ] Run smoke test: `POST /api/rpc {"method":"api_status"}`
- [ ] Document new deployment ID in `APPS_SCRIPT_PROJECT.md`

**Points:** 2
**Priority:** P0 (Critical) – Currently BLOCKED

**Notes:**
- Current issue: GAS POST returns HTML permission error
- Resolution: Requires new deployment with correct access settings
- GitHub Action "Fix GAS Permissions" available for automation

---

### Story 0.4: Verify QR Code Invariant Protection

**As a** platform engineer
**I want** automated tests that verify QR codes are never shown unless valid
**So that** the "if you show it, it works" invariant is protected during migration

**Acceptance Criteria:**

```gherkin
Given an event with valid qr.public and qr.signup
When I request /api/v2/events/:id/bundle/poster
Then response includes both QR data URIs
And QR codes are scannable and resolve to correct URLs

Given an event missing qr.public
When I request /api/v2/events/:id/bundle/poster
Then response returns 400 or omits the event
And no broken QR is exposed to the user
```

**Technical Tasks:**

- [ ] Add Playwright E2E test: poster page renders valid QR codes
- [ ] Add unit test: `validateEventContract_()` rejects events without QR
- [ ] Add integration test: `/api/v2/events/:id/bundle/poster` returns error for invalid events
- [ ] Add QR decode verification in test (scan QR, verify URL)

**Points:** 5
**Priority:** P1 (High)

**Files:**
- `tests/api/smoke/worker-gas-routing.spec.ts`
- `tests/e2e/poster-qr.spec.ts` (new)

---

### Story 0.5: Rollback Procedure & Runbook

**As a** platform engineer
**I want** a documented rollback procedure
**So that** I can quickly revert to GAS-only if Worker migration causes issues

**Acceptance Criteria:**

```gherkin
Given a production incident caused by Worker v2 API
When I follow the rollback runbook
Then traffic reverts to GAS-only within 5 minutes
And no data loss occurs
```

**Technical Tasks:**

- [ ] Document rollback steps in `docs/ROLLBACK_RUNBOOK.md`
- [ ] Create `wrangler.toml` backup config (GAS-only mode)
- [ ] Test rollback procedure in staging
- [ ] Add Slack/PagerDuty alert for v2 API errors > threshold
- [ ] Document DNS TTL considerations (currently 60s for stg.eventangle.com)

**Rollback Steps:**
1. Set `USE_WORKER_API=false` in environment
2. Deploy Worker with v2 routes returning 503
3. Verify all traffic flows through GAS proxy
4. Investigate root cause before re-enabling

**Points:** 3
**Priority:** P1 (High)

---

### Story 0.6: Smoke Test Suite for Coexistence

**As a** QA engineer
**I want** automated smoke tests that verify both v1 and v2 APIs work simultaneously
**So that** I can detect regressions in either path

**Acceptance Criteria:**

```gherkin
Given both v1 and v2 APIs are deployed
When smoke tests run
Then all v1 (GAS proxy) endpoints return expected responses
And all v2 (Worker-native) endpoints return expected responses
And response times are within SLA (< 3s for GAS, < 500ms for Worker)
```

**Technical Tasks:**

- [ ] Create `tests/smoke/coexistence.spec.ts`
- [ ] Test matrix:

| Endpoint | Method | Expected Source |
|----------|--------|-----------------|
| `/api/rpc {method: api_status}` | POST | GAS proxy |
| `/api/rpc {method: api_list}` | POST | GAS proxy |
| `/api/rpc {method: api_getPosterBundle}` | POST | GAS proxy |
| `/api/v2/status` | GET | Worker-native |
| `/api/v2/events` | GET | Worker-native |
| `/api/v2/events/:id/bundle/poster` | GET | Worker-native |

- [ ] Add GitHub Actions workflow: `smoke-coexistence.yml`
- [ ] Run on every PR to `main`

**Points:** 5
**Priority:** P1 (High)

---

### Story 0.7: Observability for Migration

**As a** platform engineer
**I want** separate metrics for v1 and v2 API calls
**So that** I can monitor migration progress and detect issues

**Acceptance Criteria:**

```gherkin
Given traffic is flowing to both v1 and v2 endpoints
When I view the dashboard
Then I see request counts by version (v1 vs v2)
And I see error rates by version
And I see latency percentiles by version (p50, p95, p99)
```

**Technical Tasks:**

- [ ] Add `X-API-Version` header to all responses (`v1` or `v2`)
- [ ] Configure Cloudflare Analytics to track by version
- [ ] Create Grafana/Cloudflare dashboard for migration monitoring
- [ ] Set up alerts for:
  - v2 error rate > 1%
  - v2 p95 latency > 2s
  - v1 traffic > 50% after cutover date

**Points:** 3
**Priority:** P2 (Medium)

---

## Epic 0 Summary

| Story | Points | Priority | Status |
|-------|--------|----------|--------|
| 0.1 Coexistence Router Pattern | 3 | P0 | ✅ Done (commit 168deda) |
| 0.2 Feature Flag | 2 | P0 | Pending |
| 0.3 GAS Backend Validation | 2 | P0 | ⚠️ Blocked (permissions) |
| 0.4 QR Invariant Protection | 5 | P1 | Pending |
| 0.5 Rollback Runbook | 3 | P1 | Pending |
| 0.6 Smoke Test Suite | 5 | P1 | Pending |
| 0.7 Observability | 3 | P2 | Pending |

**Total Points:** 23
**Critical Path:** Stories 0.1, 0.2, 0.3 must complete before any traffic shift

---

## Architecture Reference

```
                    ┌─────────────────────────────────────────┐
                    │         Cloudflare Worker               │
                    │    stg.eventangle.com / api-stg.*       │
                    └─────────────────┬───────────────────────┘
                                      │
              ┌───────────────────────┼───────────────────────┐
              │                       │                       │
              ▼                       ▼                       ▼
    ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
    │  /api/rpc       │    │  /api/v2/*      │    │  /events, etc.  │
    │  /api/*         │    │  Worker-Native  │    │  HTML Templates │
    │  → GAS Proxy    │    │  Handlers       │    │  (embedded)     │
    └────────┬────────┘    └────────┬────────┘    └─────────────────┘
             │                      │
             ▼                      ▼
    ┌─────────────────┐    ┌─────────────────┐
    │  Google Apps    │    │  Google Sheets  │
    │  Script (GAS)   │    │  Direct API     │
    │                 │    │  (via service   │
    │  Legacy backend │    │   account)      │
    └────────┬────────┘    └─────────────────┘
             │
             ▼
    ┌─────────────────┐
    │  Google Sheets  │
    │  (Data Store)   │
    └─────────────────┘
```

**Coexistence Invariants:**

1. **GAS Proxy Passthrough**: All `/api/*` requests (except `/api/v2/*`) proxy to GAS unchanged
2. **Worker-Native Independence**: `/api/v2/*` never touches GAS
3. **Feature Flag Control**: Frontend uses `USE_WORKER_API` to select endpoint version
4. **Response Tagging**: Every response includes `X-Handler` header for debugging

---

## Key Files Reference

| File | Purpose |
|------|---------|
| `cloudflare-proxy/worker.js` | Router logic (v1 vs v2) |
| `cloudflare-proxy/wrangler.toml` | Worker config & routes |
| `cloudflare-proxy/src/api/` | Worker-native v2 handlers |
| `src/mvp/Code.gs` | GAS backend (legacy) |
| `config/brand-config.js` | Frontend feature flags |
| `deploy-manifest.json` | Deployment configuration |

---

## Risk Register (Epic 0)

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| GAS POST permission blocks testing | High | High | Story 0.3: Redeploy with correct settings |
| QR codes break during cutover | Medium | Critical | Story 0.4: Invariant tests |
| Worker latency spikes | Low | Medium | Story 0.7: Observability + alerts |
| Rollback takes too long | Low | High | Story 0.5: Documented runbook |
| Frontend calls wrong endpoint | Medium | Medium | Story 0.2: Feature flag |

---

*Next: Epic 1 – Read-Only API Migration (Events Listing)*
