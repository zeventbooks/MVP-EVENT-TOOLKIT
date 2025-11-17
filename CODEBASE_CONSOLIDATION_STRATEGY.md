<!-- DOC-HIERARCHY
Tier: T0
Parent: none
Path: 0
Name: Canonical Consolidation Strategy
Role: canonical
Token: T0-CANON-STRATEGY
-->

# 🏗️ MVP-EVENT-TOOLKIT: CODEBASE CONSOLIDATION STRATEGY

## Executive Summary

**Date:** 2025-11-14
**Repository:** https://github.com/zeventbooks/MVP-EVENT-TOOLKIT
**Current State:** Two divergent codebases requiring consolidation
**Risk Level:** 🔴 HIGH - Code drift between deployment infrastructure and application logic

### Canonical References

To keep future guidance discoverable, the consolidation strategy is now the *source of truth* for:

- **Documentation hierarchy** – how this file, `mind_mapping.md`, and downstream runbooks relate.
- **Stage-aware monitoring** – shared language for the `scripts/monitor-health.js` CLI, scenario filters, and report generation.
- **Data-driven improvement loops** – where to store metrics, how to interpret them, and when to update artifacts.

Every other guide should point back to these two artifacts so new contributors can land here first and fan out only as needed.

## Documentation Governance System

### Hierarchy tiers and naming tokens

The documentation tree now adheres to a predictable taxonomy so anyone can instantly determine the weight of a file:

| Tier | Meaning | Token prefix | Expected file naming pattern |
| --- | --- | --- | --- |
| **T0** | Canonical sources (this strategy) | `T0-CANON-*` | `T0-<DOMAIN>-<ARTIFACT>.md` |
| **T1** | Visual indexes (`mind_mapping.md`) | `T1-INDEX-*` | `T1-<DOMAIN>-<ARTIFACT>.md` |
| **T2** | Cross-cutting workflows (DevOps, monitoring, pre-deploy) | `T2-FLOW-*` | `T2-<DOMAIN>-<ARTIFACT>.md` |
| **T3** | Runbooks for a single surface (e.g., `DEPLOYMENT.md`, `TESTING.md`) | `T3-RUN-*` | `T3-<DOMAIN>-<ARTIFACT>.md` |
| **T4** | Leaf references (per-environment overrides, lab notes) | `T4-LEAF-*` | `T4-<DOMAIN>-<ARTIFACT>.md` |

Existing filenames are grandfathered, but new files must follow the `Tier-Domain-Artifact` pattern. When touching a legacy document, add the tier token to its first-level heading (e.g., `# T3-RUN-DEPLOYMENT: Deployment Guide`) before landing any new content.

### Hierarchy tags in every file

Each Markdown document must start with a `<!-- DOC-HIERARCHY ... -->` comment block that records its tier, parent, path, friendly name, role, and the tier-token it advertises. Example template:

```
<!-- DOC-HIERARCHY
Tier: T2
Parent: CODEBASE_CONSOLIDATION_STRATEGY.md
Path: 0.2
Name: DevOps Workflow
Role: workflow
Token: T2-FLOW-DEVOPS
-->
```

The `Path` represents the breadcrumb (e.g., `0.2.1` means "third child of the DevOps workflow"). `Token` must match the naming pattern above even if the underlying filename has not been renamed yet. The automation hook below enforces this metadata.

### Update + verification workflow

1. **Author here first** – document changes in this file using the correct tier token.
2. **Reflect in the mind map** – add/update the same token under the relevant branch.
3. **Update downstream guide** – prepend/update its hierarchy comment and adjust its top-level heading with the token prefix.
4. **Validate** – run `npm run docs:lint` (see "Automation hooks" below) before committing. CI adopters should wire the same command into their workflows.

### Automation hooks

The repository contains two governance aids:

1. `doc-hierarchy.manifest.json` – declares every top-level document, its tier, parent, and expected token.
2. `scripts/validate-doc-hierarchy.js` – reads the manifest, ensures each file exists, and verifies that the on-disk metadata block matches the manifest. Run via `npm run docs:lint`.

Any new documentation must be registered in the manifest so the validator can keep the hierarchy honest.

### When the hierarchy falls out of line

If a document, script, or monitoring scenario drifts from the canon, do not patch it ad hoc. Follow this corrective-action loop so every deviation is captured, triaged, and proven fixed:

1. **Detect & log**
   - Run `npm run docs:lint` (or review failed CI output) to capture the exact validation errors coming from `scripts/validate-doc-hierarchy.js`.
   - Create a short "Deviation Register" entry in your working notes (include token, file, and failing check).
   - If the drift surfaced via monitoring (e.g., a scenario that no longer matches the blueprint), pin the associated `scripts/monitor-health.js` report or history segment to the same entry.
2. **Realign the canon**
   - Update the relevant section in this file **first**, making sure the `DOC-HIERARCHY` metadata and heading token reflect the desired end state.
   - Mirror the change inside `mind_mapping.md` so the index stays synchronized.
   - Touch the downstream document or scenario only after the two canonical artifacts agree on the correction.
3. **Prove the fix**
   - Re-run `npm run docs:lint` to ensure the validator is green.
   - Execute the affected monitoring scenario (for example, `npm run monitor:health -- --scenario=ci --report`) to show the instrumentation reads the updated targets and produces clean output.
   - Attach the successful command output to your PR description so reviewers can see the deviation was closed.

If you encounter a deviation type that the validator cannot detect, add a new rule (or script) here before applying the fix downstream; the canon must always lead.

### Systematic drift matrix (Docs → Code → Tests → Process → DevOps → Config → Data → Roles)

To address the user's request for a **truly systematic** response, the canon now tracks every discipline that can fall out of line. Use the matrix below to decide how to detect drift, who owns the remediation, and which proof is required before you merge:

| Domain | Signals of drift | Detection hook(s) | Remediation steps | Accountable role(s) | Proof of closure |
| --- | --- | --- | --- | --- | --- |
| **Documentation & knowledge** | Missing hierarchy tags, conflicting instructions, unregistered files | `npm run docs:lint`, review manifest diffs | Update this strategy file → mirror in `mind_mapping.md` → align downstream docs | Tech writer, product lead | ✅ `npm run docs:lint` output attached to PR |
| **Application code (Apps Script + HTML)** | Endpoint mismatch, commented legacy URLs, referrer meta regression | `npm run lint:apps-script-meta`, monitor scenario failures, clasp diffs | Land endpoint or security changes here first, then sync `Code.gs`/HTML, leave legacy URLs commented with token references | Lead engineer, Apps Script owner | ✅ `npm run lint:apps-script-meta`; ✅ scenario report referencing updated deployment |
| **Automated tests** | Playwright/Jest targets disagree, flaky suites, missing BASE_URL propagation | Playwright env info (`npm run test:hostinger:smoke -- --list-env`), GitHub Actions logs | Update scenario tokens + env matrix here → align `tests/config/environments.js` and package scripts → regenerate reports | QA/SDET lead | ✅ Relevant test command; attach log chunk + scenario token |
| **Process & DevOps** | Pipelines pointing at wrong env, clasp pushes skipped, monitor automation offline | `DEVOPS-WORKFLOW.md` drift alerts, GitHub Actions status, `monitor-health` watch output | Document fix sequence here → update DevOps workflow → patch CI/CD definitions / clasp scripts | DevOps/SRE | ✅ `npm run monitor:health -- --scenario=<stage>` + CI run link |
| **Configuration & secrets** | `.clasp.json`, `appsscript.json`, npm config out of sync, missing manifest entries | `scripts/validate-doc-hierarchy.js`, config diff review, secret rotation logs | Approve change in this canon, update manifest + config files, note rotation schedule | Release manager, security owner | ✅ Config diff referencing token; secret audit note |
| **Data & telemetry** | Health history missing, dashboards stale, KPIs lack owner | `.monitoring/health-history.json`, Looker/Grafana exports, spreadsheet audits | Record metrics contract here → update `monitoring.targets*.json` → rerun scenario to populate history/report | Analytics lead, product owner | ✅ Markdown report from `--report` flag archived with PR |
| **Agile team roles** | Roles undefined, responsibilities unclear, no reviewer coverage | Stand-up notes, retro findings, `TEAM-SYSTEMATIC-ANALYSIS-COMPLETE.md` gaps | Update the "Agile Team Analysis" section here to reassign responsibilities → alert owners via PR mention → ensure mind map references updated roles | Delivery manager, scrum master | ✅ Updated section diff + reviewer ACK |

**How to use the matrix:**

1. When something drifts, find the domain row and populate the "Deviation Register" with the token, owner, and detection hook output.
2. Apply the same detect → realign → prove loop, but execute the remediation steps and proofs listed above.
3. Do not merge until every required proof artifact is captured in the PR description or attached as a monitoring/test log.

This transforms "fix the docs" into "fix the system": documentation, code, automation, and team rituals stay synchronized because every deviation must flow through the canon with explicit owners and verifiable evidence.

### How other documents plug into the canon

The repository already contains dozens of markdown guides (deployment, QA, testing, automation, etc.). Instead of duplicating
instructions, follow this routing table whenever you touch or consume them:

| Downstream document | Primary intent | How it must reference the canon |
| --- | --- | --- |
| `DEVOPS-WORKFLOW.md` | CI/CD playbooks, clasp automation, stage health monitoring hooks | Link back to the **Stage-Aware Monitoring Blueprint** for scenario definitions and to the **Consolidation Game Plan** for sequencing changes. |
| `PRE_DEPLOY_CHECKLIST.md` | Demo/showcase prep, day-of validation rituals | Reference the **Documentation hierarchy** noted above so the checklist always points readers here for authoritative context. |
| Deployment stack (`DEPLOYMENT.md`, `DEPLOYMENT_AUTOMATION.md`, `HOSTINGER_*`, `APPS_SCRIPT_PROJECT.md`) | Environment-specific procedures | Declare that configuration or version changes were first approved in this strategy file, then summarize deltas in `mind_mapping.md`. |
| Testing stack (`TESTING.md`, `TEST_INFRASTRUCTURE_SUMMARY.md`, `LOAD_TESTING.md`, Playwright/Jest READMEs) | Coverage, lab results, tooling gaps | Cite the **SDET/SRE Assessment** for baseline expectations and update that section before changing the subordinate guides. |
| Architecture & UX stack (`ARCHITECTURE_REVIEW*.md`, `FRONTEND-*`, `CUSTOM_FRONTEND_GUIDE.md`) | Systems analysis, frontend guidance | Carry forward the risks/opportunities captured under **Agile Team Analysis**; if they diverge, amend this document first. |
| Security & secrets (`GOOGLE_CLOUD_SECRETS_SETUP.md`, `SECURITY*.md`) | Secret rotation, scanning, hardening | Add breadcrumbs back to the **Risk Level** and **Integration** sections any time mitigations evolve. |

If a file is not listed above, treat it as a *leaf*—it still inherits terminology from this guide, but it does not redefine
process. Authors should add themselves to the table before introducing new top-level docs.

### The Problem

You have two codebases on your local machine:
1. **`/home/user/MVP-EVENT-TOOLKIT`** - ✅ Up-to-date deployment & testing infrastructure
2. **`/home/user/ZEVENTBOOKS/MVP-EVENT-TOOLKIT`** - ✅ Up-to-date backend & frontend code

This creates a **code synchronization crisis** where:
- One codebase has the latest CI/CD, testing, and deployment automation
- The other has the latest business logic, features, and UI improvements
- Neither can be deployed safely without merging both

---

## Consolidation Game Plan

1. **Establish authoring flow** – Create or update content in `CODEBASE_CONSOLIDATION_STRATEGY.md` → summarize visually in `mind_mapping.md` → reference from feature-specific docs.
2. **Track updates with scenarios** – Any change to CI/CD, clasp deploy, or QA targets must ship with an updated scenario definition for the monitoring CLI (see "Stage-Aware Monitoring Blueprint" below).
3. **Reconcile repositories** – Align Apps Script + static assets first, then merge deployment automation. Use `mind_mapping.md` as the canonical diff tracker between the two local directories until they are unified.

> ✅ **Reminder:** If a document conflicts with this file or the mind map, this file wins. Update downstream docs instead of forking guidance.

---

## 🎯 Agile Team Analysis

### Software Architect's Assessment

**Current Architecture:**
- **Backend:** Google Apps Script (1,879 lines across 3 files)
  - Code.gs (1,152 lines) - Monolithic REST API
  - Config.gs (195 lines) - Multi-tenant configuration
  - SharedReporting.gs (532 lines) - Analytics engine
- **Frontend:** 18 HTML pages (Display, Public, Admin, Sponsor, etc.)
- **Testing:** 45 test files (233+ tests across Jest + Playwright)
- **Deployment:** 2-stage GitHub Actions pipeline

**Critical Architecture Issues:**
1. 🔴 **Shared Single Spreadsheet** - All tenants use same spreadsheet (data isolation risk)
2. 🔴 **Monolithic Code.gs** - 1,152 lines in single file (maintenance nightmare)
3. 🟡 **JWT Implementation** - Simplified HMAC without proper crypto library
4. 🟡 **No Pagination** - List API returns all items at once (scalability issue)
5. 🟡 **Documentation Clutter** - 62 markdown files in root directory

**Strengths:**
- ✅ Multi-tenant architecture with proper routing
- ✅ Unified response envelope pattern (Ok/Err)
- ✅ Rate limiting (20 req/min per tenant)
- ✅ Schema validation with runtime contracts
- ✅ ETag caching support

---

### Integration Engineer's Assessment

**Backend ↔ Frontend Integration:**

**Pattern:** Google Apps Script RPC via `google.script.run`

```javascript
// Frontend → Backend (from any .html file)
google.script.run
  .withSuccessHandler(res => { /* handle response */ })
  .withFailureHandler(err => { /* handle error */ })
  .api_get({ tenantId: 'root', scope: 'events', id: '123' });
```

**Integration Quality:**
- ✅ **Consistent:** All frontends use same RPC pattern
- ✅ **Error-safe:** withFailureHandler prevents unhandled rejections
- ✅ **Unified API:** Single backend serves all frontend pages
- ⚠️ **No type safety:** No TypeScript, runtime validation only
- ⚠️ **No API versioning:** Breaking changes affect all clients immediately

**Data Flow:**
```
Frontend (HTML) → google.script.run → Backend (Code.gs) → Google Sheets → Backend → Frontend
```

**Critical Gaps:**
1. ❌ No real-time push (WebSocket/SSE) - clients must poll
2. ❌ No offline support (service workers)
3. ❌ No API mocking for local development
4. ⚠️ Frontend can't run without Apps Script backend

---

### Frontend Designer's Assessment

**Customer Experience (Public.html):**
- ✅ **Mobile-first:** Responsive grid, sticky action buttons
- ✅ **Dead simple:** Browse events → Tap event → Register/Check-in
- ✅ **Touch-optimized:** 44px minimum tap targets
- ✅ **Fast:** Lazy-loaded images, SWR caching
- 🟢 **Complexity:** LOW - Perfect for customers

**TV Display Experience (Display.html):**
- ✅ **Auto-play carousel:** No interaction needed
- ✅ **Dark theme:** #111 background, high contrast
- ✅ **Readable at 10-12ft:** clamp(20px, 2.8vw, 32px) font
- ✅ **Graceful failures:** Skips blocked embeds automatically
- ✅ **Sponsor rotation:** Top banner + side panel
- 🟢 **Complexity:** LOW - Venue staff just launch and walk away

**Sponsor Interface (Sponsor.html):**
- ❌ **Not functional:** "Coming Soon" placeholder
- ⚠️ **Workaround:** Must use Admin.html instead
- 🔴 **Complexity:** HIGH - Forces sponsors to use complex admin interface

**Admin Interface (Admin.html):**
- ✅ **Comprehensive:** Full event lifecycle management
- ✅ **Wizard mode available:** AdminWizard.html for simplified setup
- ⚠️ **Complex:** Multi-section form, many optional fields
- 🔴 **Complexity:** HIGH - But necessary for power users

**Critical UX Gaps:**
1. ❌ Sponsor.html not implemented - sponsors can't self-serve
2. ❌ No sponsor analytics dashboard - can't see impressions/clicks
3. ⚠️ Display.html doesn't auto-refresh - requires manual reload for sponsor changes
4. ⚠️ No mobile app - web-only

---

### SDET/SRE's Assessment

**Testing Infrastructure: 8.5/10**

**Test Coverage:**
- ✅ **Unit Tests:** 127 tests (Jest) - Backend logic validation
- ✅ **Contract Tests:** 50+ tests (Jest) - API response structure
- ✅ **E2E Tests:** 56+ tests (Playwright) - Full user workflows
- ✅ **Smoke Tests:** 25+ tests - Critical path validation
- ✅ **Triangle Framework:** Event lifecycle testing (before/during/after)

**Test Types by Layer:**
```
Backend API:    100% coverage (11 endpoints)
Frontend Pages:  85% coverage (18 pages)
Security:       100% coverage (8 attack vectors)
Performance:      0% coverage ❌
Load Testing:     0% coverage ❌
```

**Test Execution:**
- ✅ **Local:** `npm test` (2-3 minutes)
- ✅ **CI/CD:** GitHub Actions (10-15 minutes, parallel)
- ✅ **Multi-environment:** Hostinger + Google Apps Script

**Critical Testing Gaps:**
1. ❌ No load testing (k6, JMeter)
2. ❌ No visual regression testing (Percy, Chromatic)
3. ❌ No Lighthouse CI (performance tracking)
4. ❌ No chaos/resilience testing
5. ⚠️ No automated accessibility testing (optional package only)

**Quality Gates:**
- ✅ Unit tests must pass (50-60% coverage threshold)
- ✅ Contract tests must pass (all lifecycle phases)
- ✅ E2E tests must pass (4 parallel suites)
- ❌ Linting not enforced (configured but not in CI)
- ❌ No security scanning (CodeQL, Dependabot)
- ❌ No dependency vulnerability checks

---

## Stage-Aware Monitoring Blueprint

The `scripts/monitor-health.js` CLI is the shared instrumentation layer. All pipeline stages **must** declare a scenario so they can be executed with:

```bash
npm run monitor:health -- --scenario=<stage> --report
```

| Stage | Targets | Expectations | Notes |
| --- | --- | --- | --- |
| `dev` | Local Apps Script web app, local static build | `expectStatus:200`, `contains:["MVP Toolkit"]` | Run automatically after every feature branch merge.
| `test` | QA deployment endpoints, Postman mock, staging dashboards | Auth headers + latency thresholds (`maxMs`) | Hook into smoke tests.
| `clasp` | GAS deployments (`/exec`, `/dev`) | `expectStatus:200`, `contains:["google.script.run"]` | Triggered after clasp push.
| `deploy` | Hostinger/production public URLs | `contains:["Event Schedule"]` | Include CDN purge timestamp.
| `ci` | GitHub Action artifacts (`/healthz`, `/report.json`) | Accepts `expectStatus:204` | Runs in workflow job.
| `pipeline` | Aggregated dashboards (Looker Studio, Grafana) | `contains:["All Clear"]` | Used for leadership snapshots.

**Data Discipline**

- Store historical runs in `.monitoring/health-history.json` (already gitignored).
- Attach Markdown reports to release notes and retro docs.
- File bugs if a target flakes twice in 24h; link to history slices for context.

**Documentation Hooks**

- This section outlines the why/what. Implementation specifics (URLs, headers, expected strings) live alongside the config in `.monitoring/targets.json`.
- `mind_mapping.md` visualizes the scenario graph so non-technical stakeholders can grok coverage quickly.

---

## Documentation Consolidation Rules

1. **Single Authoring Point:** All new operational guidance starts here. Summaries roll up into the mind map, and other docs only reference or extend.
2. **Bi-Directional Links:** If another guide elaborates on a topic introduced here (e.g., `DEVOPS-WORKFLOW.md` describing how to schedule monitor runs), it must link back to this section.
3. **Change Logs:** Each commit touching pipeline process should add a bullet under "Recent Consolidation Updates" below so we can audit history.

### Recent Consolidation Updates

- **2025-01-15:** Introduced monitoring blueprint and canonical reference flow with `mind_mapping.md` v2.

---

---

### QA Tester's Assessment

**Ease of Use Testing:**

**Customer Journey (Public.html):**
1. **Discover events:** Grid view with images ✅
2. **View event details:** Single tap ✅
3. **Register:** Single tap on sticky button ✅
4. **Check-in:** Single tap ✅
5. **Survey:** External form link ✅

**Complexity:** 🟢 **PASS** - 5-year-old could use it

**Sponsor Journey (Sponsor.html):**
1. **Add logo:** ❌ Not functional
2. **Configure placements:** ❌ Not functional
3. **View analytics:** ❌ Not functional
4. **Workaround:** Use Admin.html (complex) ⚠️

**Complexity:** 🔴 **FAIL** - Must use admin interface

**Venue Staff Journey (Display.html):**
1. **Launch display:** Single URL ✅
2. **Auto-play:** No interaction ✅
3. **Handle errors:** Automatic skip ✅
4. **Update sponsors:** Requires manual reload ⚠️

**Complexity:** 🟢 **PASS** - But no live updates

**Admin Journey (Admin.html / AdminWizard.html):**
1. **Create event:** Wizard mode: 3 steps ✅
2. **Full mode:** Many fields, complex ⚠️
3. **Add sponsors:** Checkboxes for placements ✅
4. **Generate forms:** Automated ✅
5. **Create QR codes:** Automated ✅

**Complexity:** 🟡 **PASS** (with Wizard) - But steep learning curve for full mode

**Functional Gaps:**
1. ❌ Sponsor.html completely non-functional
2. ❌ No real-time updates (Display.html)
3. ❌ No sponsor analytics visibility
4. ⚠️ No offline mode
5. ⚠️ No undo/redo for admin actions

---

### DevOps Engineer's Assessment

**Current Pipeline (GitHub Actions):**

```
┌─────────────────────────────────────────────────────────┐
│                    STAGE 1: BUILD & DEPLOY               │
├─────────────────────────────────────────────────────────┤
│  1. ✅ Unit Tests (Jest)                                 │
│  2. ✅ Contract Tests (Triangle Framework)               │
│  3. 🚀 Deploy to Google Apps Script (clasp)             │
│  4. 📋 Generate tenant URLs (ROOT, ABC, CBC)             │
│  5. 📦 Upload deployment artifact                        │
└─────────────────────────────────────────────────────────┘
                           ⬇️
┌─────────────────────────────────────────────────────────┐
│                   STAGE 2: TESTING & QA                  │
├─────────────────────────────────────────────────────────┤
│  1. 🔧 Extract deployment URL from Stage 1               │
│  2. 🎭 Playwright Tests (4 parallel suites)              │
│     ├─ API Suite                                         │
│     ├─ Smoke Suite                                       │
│     ├─ Flow Suite                                        │
│     └─ Page Suite                                        │
│  3. 🎯 Quality Gate (all tests must pass)                │
│  4. 🚀 QA Deployment (PLACEHOLDER - not implemented)     │
└─────────────────────────────────────────────────────────┘
```

**Pipeline Quality Score: 5.6/10**

| Category | Score | Status |
|----------|-------|--------|
| Unit Testing | 8/10 | ✅ Good |
| Linting | 2/10 | ❌ Critical Gap |
| Contract Testing | 8/10 | ✅ Good |
| E2E Testing | 7/10 | ✅ Mostly Good |
| Security Scanning | 2/10 | ❌ Critical Gap |
| Deployment Automation | 7/10 | ⚠️ Fragile |
| Monitoring | 2/10 | ❌ Missing |
| Documentation | 8/10 | ✅ Excellent |

**Deployment Flow:**

```
Local Machine → Git Push → GitHub
                    ⬇️
          GitHub Actions (Stage 1)
                    ⬇️
          Google Apps Script API (clasp push)
                    ⬇️
          Production Deployment
                    ⬇️
          GitHub Actions (Stage 2)
                    ⬇️
          E2E Tests → Quality Gate
```

**Critical DevOps Issues:**

1. 🔴 **Fragile Deployment ID Extraction** (Line 147-153 in stage1-deploy.yml)
   ```yaml
   DEPLOYMENT_ID_FROM_OUTPUT=$(echo "$DEPLOY_OUTPUT" | grep -oP 'AKfycb[a-zA-Z0-9_-]+')
   ```
   - **Risk:** Regex breaks if clasp output format changes
   - **Impact:** Deployment fails silently
   - **Fix:** Use `clasp deployments --json` for structured output

2. ❌ **Linting Not Enforced**
   - ESLint configured (.eslintrc.json exists)
   - But no lint step in GitHub Actions
   - Code quality can degrade unnoticed

3. ❌ **No Security Scanning**
   - No CodeQL for code analysis
   - No Dependabot for dependency vulnerabilities
   - No SAST (Static Application Security Testing)

4. ⚠️ **QA Deployment Placeholder** (Stage 2, lines 224-246)
   - Job exists but does nothing
   - No actual QA environment configured
   - No rollback mechanism

5. ⚠️ **No Health Checks**
   - Deployment succeeds even if app crashes
   - No smoke test after deployment
   - No uptime monitoring

6. ⚠️ **Silent Error Handling**
   ```yaml
   || true  # Suppresses errors
   ```
   - Used in multiple places
   - Failures go unnoticed

**Secret Management:**
- ✅ `OAUTH_CREDENTIALS` - clasp deployment auth
- ✅ `ADMIN_KEY_ROOT` - API authentication
- ⚠️ `DEPLOYMENT_ID` - Optional, but should be required
- ❌ Missing: `QA_SCRIPT_ID`, `QA_OAUTH_CREDENTIALS`

**Deployment Environments:**
- ✅ **Production:** Google Apps Script (main branch)
- ❌ **QA:** Not configured (placeholder only)
- ❌ **Staging:** Not configured
- ✅ **Local Dev:** Manual clasp push

---

## 🚨 Critical Risks & Impact

### Risk Matrix

| Risk | Likelihood | Impact | Severity | Mitigation Priority |
|------|-----------|--------|----------|---------------------|
| **Code drift between codebases** | 🔴 Very High | 🔴 Critical | 🔴 P0 | Immediate |
| **Shared spreadsheet data breach** | 🟡 Medium | 🔴 Critical | 🔴 P0 | High |
| **Sponsor.html non-functional** | 🔴 Very High | 🟡 Medium | 🟡 P1 | High |
| **No load testing** | 🟡 Medium | 🟡 Medium | 🟡 P1 | Medium |
| **Fragile deployment pipeline** | 🟡 Medium | 🟡 Medium | 🟡 P1 | Medium |
| **No security scanning** | 🟡 Medium | 🔴 Critical | 🟡 P1 | Medium |
| **Documentation clutter** | 🔴 Very High | 🟢 Low | 🟢 P2 | Low |

---

## 📋 Consolidation Strategy

### Option 1: Merge ZEVENTBOOKS → MVP-EVENT-TOOLKIT (Recommended)

**Approach:** Use MVP-EVENT-TOOLKIT as base (has testing infrastructure), merge backend/frontend from ZEVENTBOOKS

**Steps:**
1. Create feature branch: `git checkout -b merge/zeventbooks-backend-frontend`
2. Copy backend files from ZEVENTBOOKS:
   - Code.gs
   - Config.gs
   - SharedReporting.gs
3. Copy frontend files from ZEVENTBOOKS:
   - All .html files (Admin.html, Display.html, Public.html, etc.)
4. Run full test suite: `npm run test:all`
5. Fix any failing tests
6. Commit with detailed message
7. Create PR for review

**Pros:**
- ✅ Keeps mature CI/CD pipeline
- ✅ Preserves test infrastructure
- ✅ Maintains git history
- ✅ Lower risk (base is stable)

**Cons:**
- ⚠️ Requires manual file comparison
- ⚠️ May lose ZEVENTBOOKS-specific commits
- ⚠️ Time-consuming merge process

**Estimated Time:** 4-6 hours

---

### Option 2: Merge MVP-EVENT-TOOLKIT → ZEVENTBOOKS

**Approach:** Use ZEVENTBOOKS as base (has latest code), merge testing/deployment from MVP-EVENT-TOOLKIT

**Steps:**
1. Create feature branch in ZEVENTBOOKS
2. Copy testing infrastructure from MVP-EVENT-TOOLKIT:
   - tests/ directory (all 45 files)
   - .github/workflows/ (CI/CD pipelines)
   - scripts/ (deployment scripts)
   - Configuration files (jest.config.js, playwright.config.js, etc.)
3. Copy package.json scripts
4. Install dependencies
5. Run full test suite
6. Fix any failing tests

**Pros:**
- ✅ Keeps latest business logic
- ✅ Preserves feature development
- ✅ May have more recent bug fixes

**Cons:**
- ⚠️ Loses mature CI/CD git history
- ⚠️ Requires reconfiguring GitHub Actions
- ⚠️ Risk: ZEVENTBOOKS may have incomplete testing

**Estimated Time:** 6-8 hours

---

### Option 3: Three-Way Merge (Advanced)

**Approach:** Create new branch, use git merge-base to find common ancestor, resolve conflicts

**Steps:**
1. Find common ancestor: `git merge-base MVP-EVENT-TOOLKIT ZEVENTBOOKS`
2. Create merge branch
3. Use git merge or diff tools
4. Resolve conflicts file-by-file
5. Run full test suite
6. Manual verification

**Pros:**
- ✅ Preserves full git history
- ✅ Git handles most conflicts automatically
- ✅ Most "correct" approach

**Cons:**
- ⚠️ Complex if divergence is significant
- ⚠️ Requires git expertise
- ⚠️ Time-consuming conflict resolution

**Estimated Time:** 8-12 hours

---

### Recommended Approach: **Option 1**

**Rationale:**
- MVP-EVENT-TOOLKIT has mature CI/CD (proven in production)
- Testing infrastructure is comprehensive (233+ tests)
- GitHub Actions workflows are stable
- Documentation is excellent
- Risk is lower (start with stable base)

---

## 🗓️ Actionable Remediation Roadmap

### Phase 0: Pre-Merge (Immediate - Day 1)

**Goal:** Understand the differences before merging

```bash
# On your local machine with both codebases

# 1. Create diff report for backend files
diff -u /home/user/MVP-EVENT-TOOLKIT/Code.gs \
        /home/user/ZEVENTBOOKS/MVP-EVENT-TOOLKIT/Code.gs \
        > code-gs-diff.txt

diff -u /home/user/MVP-EVENT-TOOLKIT/Config.gs \
        /home/user/ZEVENTBOOKS/MVP-EVENT-TOOLKIT/Config.gs \
        > config-gs-diff.txt

diff -u /home/user/MVP-EVENT-TOOLKIT/SharedReporting.gs \
        /home/user/ZEVENTBOOKS/MVP-EVENT-TOOLKIT/SharedReporting.gs \
        > shared-reporting-diff.txt

# 2. Create diff report for frontend files
for file in Admin.html Public.html Display.html Sponsor.html; do
  diff -u /home/user/MVP-EVENT-TOOLKIT/$file \
          /home/user/ZEVENTBOOKS/MVP-EVENT-TOOLKIT/$file \
          > ${file%.html}-diff.txt || true
done

# 3. Create size comparison
du -sh /home/user/MVP-EVENT-TOOLKIT > codebase-sizes.txt
du -sh /home/user/ZEVENTBOOKS/MVP-EVENT-TOOLKIT >> codebase-sizes.txt

# 4. Check git status of both
cd /home/user/MVP-EVENT-TOOLKIT && git status > /tmp/mvp-git-status.txt
cd /home/user/ZEVENTBOOKS/MVP-EVENT-TOOLKIT && git status > /tmp/zeventbooks-git-status.txt

# 5. Compare package.json dependencies
diff -u /home/user/MVP-EVENT-TOOLKIT/package.json \
        /home/user/ZEVENTBOOKS/MVP-EVENT-TOOLKIT/package.json \
        > package-json-diff.txt || true
```

**Deliverable:** Diff reports showing exact differences

---

### Phase 1: Backup & Preparation (Day 1 - 2 hours)

**Goal:** Create safety nets before making changes

**Tasks:**

1. **Create backup branches**
   ```bash
   cd /home/user/MVP-EVENT-TOOLKIT
   git checkout -b backup/mvp-pre-merge-$(date +%Y%m%d)
   git push -u origin backup/mvp-pre-merge-$(date +%Y%m%d)

   cd /home/user/ZEVENTBOOKS/MVP-EVENT-TOOLKIT
   git checkout -b backup/zeventbooks-pre-merge-$(date +%Y%m%d)
   git push -u origin backup/zeventbooks-pre-merge-$(date +%Y%m%d)
   ```

2. **Export current state**
   ```bash
   # Create tarballs for disaster recovery
   cd /home/user
   tar -czf mvp-event-toolkit-backup-$(date +%Y%m%d).tar.gz MVP-EVENT-TOOLKIT/
   tar -czf zeventbooks-backup-$(date +%Y%m%d).tar.gz ZEVENTBOOKS/MVP-EVENT-TOOLKIT/
   ```

3. **Document current deployment URLs**
   ```bash
   cd /home/user/MVP-EVENT-TOOLKIT
   clasp deployments > current-deployments.txt
   ```

**Success Criteria:**
- ✅ Backup branches created and pushed
- ✅ Tarballs created
- ✅ Current deployment IDs documented

---

### Phase 2: Code Consolidation (Day 1-2 - 4-6 hours)

**Goal:** Merge codebases into single source of truth

**Tasks:**

1. **Create merge branch in MVP-EVENT-TOOLKIT**
   ```bash
   cd /home/user/MVP-EVENT-TOOLKIT
   git checkout main
   git pull origin main
   git checkout -b merge/consolidate-zeventbooks-backend
   ```

2. **Copy backend files from ZEVENTBOOKS**
   ```bash
   # Review diff first, then copy if ZEVENTBOOKS is newer
   cp /home/user/ZEVENTBOOKS/MVP-EVENT-TOOLKIT/Code.gs ./Code.gs
   cp /home/user/ZEVENTBOOKS/MVP-EVENT-TOOLKIT/Config.gs ./Config.gs
   cp /home/user/ZEVENTBOOKS/MVP-EVENT-TOOLKIT/SharedReporting.gs ./SharedReporting.gs
   ```

3. **Copy frontend files from ZEVENTBOOKS**
   ```bash
   # Copy all .html files
   for file in /home/user/ZEVENTBOOKS/MVP-EVENT-TOOLKIT/*.html; do
     basename=$(basename "$file")
     cp "$file" "./$basename"
   done
   ```

4. **Run full test suite**
   ```bash
   npm ci  # Clean install dependencies
   npm run test:unit  # Unit tests first
   npm run test:contract  # Then contract tests
   ```

5. **Fix failing tests**
   - Review test output
   - Update tests if API contracts changed
   - Fix backend code if tests are correct

6. **Run E2E tests locally**
   ```bash
   # Deploy to test Apps Script project first
   clasp push
   clasp deploy -d "Test merge"

   # Get test URL
   BASE_URL=$(clasp deployments | grep -oP 'https://[^ ]+' | head -1)

   # Run E2E tests
   BASE_URL=$BASE_URL npm run test:e2e
   ```

7. **Commit consolidated code**
   ```bash
   git add .
   git commit -m "feat: Consolidate ZEVENTBOOKS backend and frontend

   - Merge Code.gs from ZEVENTBOOKS (includes latest business logic)
   - Merge Config.gs (updated tenant configuration)
   - Merge SharedReporting.gs (enhanced analytics)
   - Update all frontend .html files with latest UX improvements
   - All unit tests passing
   - All contract tests passing
   - E2E tests validated locally

   Breaking changes:
   - [List any API changes here]

   Co-authored-by: [Your name] <[email]>"
   ```

**Success Criteria:**
- ✅ All backend files consolidated
- ✅ All frontend files consolidated
- ✅ Unit tests passing (100%)
- ✅ Contract tests passing (100%)
- ✅ E2E tests passing (locally)
- ✅ Git commit with detailed message

---

### Phase 3: CI/CD Validation (Day 2 - 2 hours)

**Goal:** Ensure GitHub Actions pipelines work with merged code

**Tasks:**

1. **Push merge branch**
   ```bash
   git push -u origin merge/consolidate-zeventbooks-backend
   ```

2. **Monitor GitHub Actions**
   - Go to https://github.com/zeventbooks/MVP-EVENT-TOOLKIT/actions
   - Watch Stage 1 pipeline run
   - Ensure unit tests pass
   - Ensure contract tests pass
   - Ensure deployment succeeds

3. **Verify Stage 2 auto-triggers**
   - Wait for Stage 2 to start automatically
   - Monitor Playwright test results
   - Check all 4 parallel suites pass

4. **Review deployment summary**
   - Check GitHub Actions Summary tab
   - Verify deployment URLs are correct
   - Test URLs manually in browser

**Success Criteria:**
- ✅ Stage 1 passes (unit + contract + deploy)
- ✅ Stage 2 passes (all E2E suites)
- ✅ Deployment URLs accessible
- ✅ No broken links or 500 errors

---

### Phase 4: Quality Assurance (Day 2-3 - 4 hours)

**Goal:** Manual testing and validation

**Test Scenarios:**

1. **Customer Journey (Public.html)**
   - Browse events list
   - View event details
   - Click register button
   - Click check-in button
   - Verify mobile responsiveness

2. **TV Display (Display.html)**
   - Load display URL
   - Verify carousel rotation
   - Verify sponsor display
   - Test dynamic mode
   - Test public mode

3. **Admin Journey (Admin.html)**
   - Create new event
   - Add sponsors
   - Configure display mode
   - Generate forms
   - Create QR codes

4. **Multi-Tenant Testing**
   - Test ROOT tenant
   - Test ABC tenant
   - Test CBC tenant
   - Verify data isolation

5. **API Testing**
   - Test all 11 endpoints
   - Verify authentication
   - Test rate limiting
   - Verify error handling

**Success Criteria:**
- ✅ All customer flows work
- ✅ TV display works correctly
- ✅ Admin can create/edit events
- ✅ Multi-tenant isolation verified
- ✅ No regressions found

---

### Phase 5: Documentation Update (Day 3 - 2 hours)

**Goal:** Update documentation to reflect merged codebase

**Tasks:**

1. **Update README.md**
   - Add consolidation date
   - Update architecture diagrams
   - Document new features
   - Update deployment instructions

2. **Consolidate markdown files**
   ```bash
   # Move all .md files to docs/ directory
   mkdir -p docs/archive

   # Keep only these in root:
   # - README.md
   # - START_HERE.md
   # - CHANGELOG.md (create if doesn't exist)

   # Move rest to docs/
   mv *.md docs/archive/ 2>/dev/null || true
   ```

3. **Create CHANGELOG.md**
   ```markdown
   # Changelog

   ## [1.4.0] - 2025-11-14

   ### Added
   - Consolidated ZEVENTBOOKS backend and frontend
   - [List new features from ZEVENTBOOKS]

   ### Changed
   - [List changed APIs or behavior]

   ### Fixed
   - [List bug fixes]

   ### Removed
   - [List deprecated features]
   ```

4. **Update deployment docs**
   - Update DEPLOYMENT.md with latest instructions
   - Document any new environment variables
   - Update secret setup instructions

**Success Criteria:**
- ✅ README updated
- ✅ Documentation organized
- ✅ CHANGELOG created
- ✅ Deployment docs updated

---

### Phase 6: Production Deployment (Day 3-4 - 2 hours)

**Goal:** Merge to main and deploy to production

**Tasks:**

1. **Create Pull Request**
   ```bash
   # On GitHub: https://github.com/zeventbooks/MVP-EVENT-TOOLKIT/compare
   # Base: main
   # Compare: merge/consolidate-zeventbooks-backend
   ```

2. **PR Checklist**
   - [ ] All tests passing in CI
   - [ ] Manual QA complete
   - [ ] Documentation updated
   - [ ] Breaking changes documented
   - [ ] Deployment plan reviewed
   - [ ] Rollback plan ready

3. **Merge PR**
   - Squash commits or merge commit (your choice)
   - Ensure main branch protected rules pass

4. **Monitor production deployment**
   - Stage 1 runs automatically on main push
   - Stage 2 runs automatically after Stage 1
   - Verify all quality gates pass

5. **Post-deployment verification**
   - Test production URLs
   - Monitor error logs (clasp logs)
   - Check analytics for anomalies
   - Verify multi-tenant access

6. **Create git tag**
   ```bash
   git checkout main
   git pull origin main
   git tag -a v1.4.0 -m "Consolidate ZEVENTBOOKS backend and frontend"
   git push origin v1.4.0
   ```

**Success Criteria:**
- ✅ PR merged to main
- ✅ Production deployment successful
- ✅ All quality gates passed
- ✅ Production URLs working
- ✅ Git tag created

---

### Phase 7: Cleanup (Day 4 - 1 hour)

**Goal:** Remove duplicate codebase and finalize

**Tasks:**

1. **Archive ZEVENTBOOKS codebase**
   ```bash
   cd /home/user
   mv ZEVENTBOOKS/MVP-EVENT-TOOLKIT ZEVENTBOOKS/MVP-EVENT-TOOLKIT.archived-$(date +%Y%m%d)
   ```

2. **Update local git remotes**
   ```bash
   cd /home/user/MVP-EVENT-TOOLKIT
   git fetch origin
   git checkout main
   git pull origin main
   ```

3. **Delete merge branch**
   ```bash
   git branch -d merge/consolidate-zeventbooks-backend
   git push origin --delete merge/consolidate-zeventbooks-backend
   ```

4. **Communicate to team**
   - Send email with new repository structure
   - Update internal wiki/documentation
   - Schedule team training if needed

**Success Criteria:**
- ✅ Duplicate codebase archived
- ✅ Single source of truth established
- ✅ Team notified

---

## 📊 Timeline Summary

| Phase | Duration | Dependencies | Risk Level |
|-------|----------|--------------|-----------|
| **Phase 0: Pre-Merge** | 1 hour | None | 🟢 Low |
| **Phase 1: Backup** | 2 hours | Phase 0 | 🟢 Low |
| **Phase 2: Consolidation** | 4-6 hours | Phase 1 | 🟡 Medium |
| **Phase 3: CI/CD Validation** | 2 hours | Phase 2 | 🟡 Medium |
| **Phase 4: QA Testing** | 4 hours | Phase 3 | 🟡 Medium |
| **Phase 5: Documentation** | 2 hours | Phase 4 | 🟢 Low |
| **Phase 6: Production** | 2 hours | Phase 5 | 🔴 High |
| **Phase 7: Cleanup** | 1 hour | Phase 6 | 🟢 Low |
| **TOTAL** | **18-20 hours** | | |

**Recommended Schedule:**
- Day 1 (8 hours): Phases 0-2
- Day 2 (8 hours): Phases 3-4
- Day 3 (4 hours): Phases 5-6
- Day 4 (1 hour): Phase 7

---

## 🚨 Rollback Plan

**If something goes wrong during deployment:**

1. **Immediate rollback**
   ```bash
   cd /home/user/MVP-EVENT-TOOLKIT
   git checkout backup/mvp-pre-merge-$(date +%Y%m%d -d yesterday)
   clasp push --force
   clasp deploy -i <PRODUCTION_DEPLOYMENT_ID> -d "Emergency rollback"
   ```

2. **Restore from tarball**
   ```bash
   cd /home/user
   tar -xzf mvp-event-toolkit-backup-YYYYMMDD.tar.gz
   cd MVP-EVENT-TOOLKIT
   clasp push --force
   clasp deploy
   ```

3. **Use GitHub deployment history**
   ```bash
   # Find last good commit
   git log --oneline -20

   # Reset to last good commit
   git reset --hard <COMMIT_HASH>
   git push --force origin main
   ```

---

## 📈 Post-Consolidation Improvements

**After successful merge, prioritize these:**

### P0 - Critical (Week 1-2)
1. ✅ **Implement Sponsor.html** - Self-service sponsor management (COMPLETED 2025-11-14)
   - Full CRUD operations via Sponsor.html interface
   - 24 E2E tests (18 page tests + 6 workflow tests)
   - Analytics dashboard with tier breakdown
   - Session-based authentication
2. ✅ **Add linting to CI/CD** - Enforce code quality (COMPLETED 2025-11-14)
   - ESLint integrated into Stage 1 deployment workflow
   - Blocks deployment if code quality issues found
   - 80 warnings fixed, 0 errors
3. ❌ **Fix shared spreadsheet issue** - Per-tenant databases (NOT STARTED)
   - Requires architectural change to separate spreadsheets per tenant
   - Lower priority - current single spreadsheet works for MVP

### P1 - High (Week 3-4)
4. ✅ **Add security scanning** - CodeQL + Dependabot (COMPLETED 2025-11-14)
   - CodeQL scanning for 200+ security vulnerabilities
   - Dependabot for dependency updates
   - Runs on every push and weekly schedule
5. ✅ **Implement QA deployment** - Proper staging environment (COMPLETED 2025-11-14)
   - Functional QA deployment job in Stage 2 workflow
   - Health checks and rollback mechanism
   - Comprehensive setup guide (635 lines)
6. ✅ **Add load testing** - k6 or JMeter in CI (COMPLETED 2025-11-14)
   - k6 load testing with 4 test scenarios (smoke, average, stress, spike)
   - Manual GitHub Actions workflow
   - Complete documentation and usage guide

### P2 - Medium (Month 2)
7. **Add Lighthouse CI** - Performance tracking
8. **Implement real-time updates** - WebSocket or SSE
9. **Add sponsor analytics dashboard** - Self-service ROI visibility

### P3 - Low (Month 3+)
10. **Visual regression testing** - Percy or Chromatic
11. **Mobile app** - React Native wrapper
12. **API versioning** - Support v1, v2 simultaneously

---

## 🎯 Success Metrics

**Consolidation is successful when:**

- ✅ Single codebase contains all latest features
- ✅ All 233+ tests passing
- ✅ CI/CD pipeline green
- ✅ Production deployment successful
- ✅ No customer-facing regressions
- ✅ Team trained on new structure
- ✅ Documentation up-to-date
- ✅ Duplicate codebase archived

**Health Indicators (Monitor for 1 week post-merge):**
- ✅ No increase in error rate
- ✅ No performance degradation
- ✅ No customer complaints
- ✅ CI/CD success rate > 95%
- ✅ Test coverage maintained

---

## 🆘 Need Help?

**Contact:**
- GitHub Issues: https://github.com/zeventbooks/MVP-EVENT-TOOLKIT/issues
- Slack: #mvp-event-toolkit (if applicable)
- Email: [team lead email]

**Resources:**
- Deployment Guide: docs/DEPLOYMENT.md
- Testing Guide: tests/README.md
- Architecture Review: ARCHITECTURE_REVIEW.md
- CI/CD Guide: CI_CD_ENHANCEMENT_PLAN.md

---

**Document Version:** 1.0
**Last Updated:** 2025-11-14
**Authors:** Agile Team Analysis (Architect, Integration, Frontend, SDET, Tester, DevOps)
