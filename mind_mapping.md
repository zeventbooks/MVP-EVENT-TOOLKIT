<!-- DOC-HIERARCHY
Tier: T1
Parent: CODEBASE_CONSOLIDATION_STRATEGY.md
Path: 0.1
Name: Mind Map Index
Role: index
Token: T1-INDEX-MAP
-->

# 🧠 MVP Event Toolkit Mind Map

This living map mirrors the canonical consolidation plan. Update this file whenever `CODEBASE_CONSOLIDATION_STRATEGY.md` changes so stakeholders can grok the system at a glance.

## 1. Documentation Spine
- **Source of truth (`T0-CANON-STRATEGY`):** `CODEBASE_CONSOLIDATION_STRATEGY.md`
  - Holds executive narrative, architecture analysis, consolidation guardrails, and the naming taxonomy.
- **Visual index (`T1-INDEX-MAP`):** `mind_mapping.md` (this file)
  - Mirrors major domains as nested lists for quick scanning.
- **Downstream guides (`T2-FLOW-*` / `T3-RUN-*` / `T4-LEAF-*`):** DevOps workflow, pre-deploy checklist, monitoring configs, deployment runbooks, testing suites, security guides
  - Must link back to the sections noted here and inherit their terminology.
  - When new top-level docs are created, authors must add themselves to the routing table inside the strategy file and register their metadata in `doc-hierarchy.manifest.json`.
  - Add the tier token to the document title and insert the `<!-- DOC-HIERARCHY ... -->` header comment before submitting PRs.
  - Run `npm run docs:lint` locally (or in CI) to confirm the metadata is accepted by `scripts/validate-doc-hierarchy.js`.

## 2. Dual-Repo Consolidation Flow
- **Inputs:**
  - `/home/user/MVP-EVENT-TOOLKIT` → deployment + testing infra
  - `/home/user/ZEVENTBOOKS/MVP-EVENT-TOOLKIT` → frontend + backend code
- **Pipeline:**
  1. Compare repos (features vs. automation)
  2. Merge Apps Script + HTML assets
  3. Align CI/CD + monitoring configs
  4. Decommission redundant directory
- **Tracking:**
  - Capture deltas + decisions here before editing other docs.

## 3. Stage-Aware Monitoring Graph
- **CLI:** `scripts/monitor-health.js`
- **Scenarios:**
  - `dev` → local Apps Script endpoints & static preview
  - `test` → QA deployments, Postman mocks, staging dashboards
  - `clasp` → `/exec` and `/dev` URLs after clasp push
  - `deploy` → Hostinger / production URLs with CDN validation
  - `ci` → GitHub Actions artifacts & workflow health probes
  - `pipeline` → Aggregated dashboards (Looker Studio, Grafana)
- **Data Loop:**
  - Run `npm run monitor:health -- --scenario=<stage> --report`
  - Store JSON history in `.monitoring/health-history.json`
  - Publish Markdown reports alongside release notes
  - File follow-up issues if a scenario flakes twice in 24h

## 4. Architecture + Testing Hotspots
- **Backend:** Monolithic `Code.gs` (1,152 lines)
  - Risks: shared spreadsheet tenancy, missing pagination, JWT limitations
- **Frontend:** 18 HTML entry points
  - Gaps: Sponsor portal placeholder, limited real-time refresh
- **Testing:** 200+ tests across Jest + Playwright
  - Missing: load tests, visual regression, Lighthouse CI, chaos experiments
- **Quality Gates:** Unit, contract, E2E suites must pass; linting & security scanning pending

## 5. Operational Rituals
- **Authoring order:** Strategy → Mind Map → Downstream docs
- **Demo readiness:** Follow `PRE_DEPLOY_CHECKLIST.md` (now references this hierarchy)
- **Automation:** `DEVOPS-WORKFLOW.md` describes how to schedule monitoring scenarios; ensure edits there cite the relevant sections above.

## 6. Change Log
- *2025-01-15* – v2 adds monitoring blueprint alignment + consolidation rules sync.
