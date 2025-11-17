# Execution Command Map & Traceability Tree

> Use this guide to understand **which command runs what**, how automation vs manual fallbacks
> work, where artifacts are stored, and which document/script owns the source of truth. Every
> update to code, docs, or scripts should trace back to the branch below so the system stays
> synchronized.

```
Zeventbook Execution Tree
├─ Local Workspace
│  ├─ Repo URL → github.com/zeventbooks/MVP-EVENT-TOOLKIT
│  ├─ Required env vars → BASE_URL, ADMIN_KEY, TENANT_ID (per TESTING.md)
│  └─ Primary commands → npm run quality:gate · npm run test:unit · npm run test:contract
│
├─ Apps Script Automation (Service Account)
│  ├─ Commands → npm run deploy:auto · deploy:verify · monitor:health · dns:verify
│  ├─ Automation evidence → ops/deploy, ops/monitoring, ops/domains, ops/security
│  └─ Source docs → DEPLOYMENT_AUTOMATION.md, APPS_SCRIPT_PROJECT.md
│
├─ Clasp Workflow
│  ├─ Commands → npm run pull · npm run deploy:clasp · clasp open/logs
│  ├─ Config → .clasprc.json (per CLASP_SETUP.md)
│  └─ Usage → Fast local pushes or backup when deploy:auto unavailable
│
├─ GitHub Actions CI/CD
│  ├─ Trigger → git push origin main
│  ├─ Pipeline → lint → test:unit → test:contract → test:smoke → deploy:auto → monitor
│  └─ Docs → GITHUB_ACTIONS_DEPLOYMENT.md, DEPLOYMENT_AUTOMATION.md
│
├─ Hostinger / External DNS Layer
│  ├─ Purpose → Redirect zeventbooks.io → Apps Script web app
│  ├─ Commands → npm run dns:verify (scripts/verify-domains.js)
│  └─ Docs → DEPLOYMENT_AUTOMATION.md (DNS guard appendix)
│
└─ Test Automation Surfaces
   ├─ Jest → npm run test:unit · npm run test:contract · npm run quality:gate
   ├─ Playwright → npm run test:smoke · test:pages · test:flows · test:scenario:*
   └─ Load/Diagnostics → npm run test:load:* · qa:seed · monitor:health
```

## 1. Local Execution Summary

| Workflow | Command(s) | Automation vs Manual | Artifacts | Owning Doc / Script |
| --- | --- | --- | --- | --- |
| Install dependencies | `npm install` | Manual (once per machine) | `node_modules/` | README.md → "Quick Deploy Options" |
| Baseline quality gate | `npm run quality:gate` | Automated threshold enforcement | `.quality-gate-report.json`, Jest coverage | TESTING.md, scripts/quality-gate.js |
| Unit regression | `npm run test:unit` | Manual trigger, automated assertions | Jest output | TESTING.md |
| Contract regression | `npm run test:contract` | Manual trigger, automated assertions | Jest output | TESTING.md |
| Scenario suites | `npm run test:scenario:{1,2,3}` | Manual trigger, **auto login-wall guard** | `test-results/` HTML reports | tests/e2e/scenarios/README.md |
| Full Playwright stack | `npm run test:playwright` or `npm run test:e2e` | Manual trigger with auto guard & admin-key prechecks | HTML reports + traces | TESTING.md, tests/config/global-setup.js |
| Seed QA data | `npm run qa:seed` / `qa:seed:comprehensive` | Manual trigger calling Apps Script APIs | `.test-data-history.json` | tests/shared/test-data-manager.js |

## 2. Apps Script Deployment (Service Account Path)

| Step | Command | Automation | Evidence | Source |
| --- | --- | --- | --- | --- |
| Validate service account access | `npm run deploy:guard` | Automated headless checks | `ops/deploy/guardian-status.json` | scripts/deploy-access-guard.js |
| Full pipeline (verify → deploy → monitor) | `npm run deploy:auto` | Automated end-to-end | `ops/*` artifacts (deploy, monitoring, dns, security) | scripts/deploy-cli.js, DEPLOYMENT_AUTOMATION.md |
| Quick redeploy (skips verification) | `npm run deploy:quick` | Automated upload only | `ops/deploy/deploy-history.json` | scripts/deploy-cli.js |
| Verify DNS redirects | `npm run dns:verify` | Automated | `ops/domains/dns-status.json` | scripts/verify-domains.js |
| Post-deploy health sweep | `npm run monitor:health` | Automated | `ops/monitoring/health-history.json` | scripts/monitor-health.js |
| Rotate admin session secrets | `npm run secrets:sync` | Automated (validates policy) | `ops/security/admin-secret-rotation.json` | scripts/sync-admin-secrets.js, SECURITY.md |

**URLs:** Unified Apps Script ID `1YO4ap...` and deployment URL recorded in `DEPLOYMENT.md` + `APPS_SCRIPT_PROJECT.md`.

## 3. Clasp Execution Path

| Step | Command | Automation Level | Notes |
| --- | --- | --- | --- |
| Authenticate once | `clasp login` | Manual (browser OAuth) | Stores token in `~/.clasprc.json`; see CLASP_SETUP.md |
| Pull current script | `npm run pull` | Automated via clasp | Syncs Apps Script → local files |
| Push changes | `clasp push` or `npm run deploy:clasp` | Semi-automated (manual confirmation) | Good for hotfixes when service-account deploy is blocked |
| Inspect runtime logs | `npm run logs` | Automated fetch | Mirrors Apps Script `View > Logs` |
| Open editor | `npm run open` | Manual (opens browser) | Quick navigation to script editor |

Clasp path should follow the same **quality gate + tests** before pushing to avoid divergence.

## 4. GitHub Code & Actions

| Activity | Command / Trigger | Automation | Output |
| --- | --- | --- | --- |
| Push code | `git push origin main` | Manual push | Triggers GitHub Actions workflow defined in `.github/workflows/*.yml` |
| CI pipeline | GitHub Actions | Automated | Lint → Jest → Playwright (with login-wall guard) → `deploy:auto` → `monitor:health` |
| Deployment evidence | Workflow artifacts + `ops/*` commits | Automated | Each run archives coverage, health history, dns checks |

Reference docs: `GITHUB_ACTIONS_DEPLOYMENT.md`, `DEPLOYMENT_AUTOMATION.md`, `CI_CD_ANALYSIS_REPORT.md`.

## 5. Hostinger / External DNS Layer

Hostinger is now a DNS forwarder only. The system keeps a **single source deployment** in Apps Script and uses Hostinger (or any registrar) to redirect friendly domains.

| Task | Command | Notes | Doc |
| --- | --- | --- | --- |
| Confirm redirect targets | `npm run dns:verify` | Ensures `zeventbooks.io` → Apps Script URL & records TTL/provider metadata | DEPLOYMENT_AUTOMATION.md §DNS Guard |
| Update redirect (manual) | Hostinger hPanel UI | Change A/CNAME/URL redirect | Follow `DEPLOYMENT.md` Appendix B |
| Capture evidence | Screenshot/CSV upload | Add to `ops/domains/` if manual edits occur | DEPLOYMENT_AUTOMATION.md |

## 6. Test Automation Command Matrix

See also the expanded table in `TESTING.md`. Key commands are summarized here for traceability.

| Suite | Command | Env Vars | Guard / Automation | Owning Doc |
| --- | --- | --- | --- | --- |
| Unit | `npm run test:unit` | None | Jest only | TESTING.md |
| Contract | `npm run test:contract` | None | Jest only | TESTING.md |
| Smoke | `npm run test:smoke` | `BASE_URL` | Playwright global login-wall guard, auto admin-key prompt watchers | TESTING.md, tests/config/global-setup.js |
| Page/Flow suites | `npm run test:pages`, `npm run test:flows` | `BASE_URL`, `ADMIN_KEY` for admin surfaces | Guard + admin key skip | TESTING.md |
| API suites | `npm run test:api`, `test:api:*` | `BASE_URL`, optional `ADMIN_KEY` | Guard (skips if login required) | tests/e2e/api/*.spec.js |
| Scenarios | `npm run test:scenario:1/2/3`, `npm run test:scenarios` | `BASE_URL`, `ADMIN_KEY` | Guard + scenario-specific skip messaging | tests/e2e/scenarios/README.md |
| Triangle suites | `npm run test:triangle:*` | `BASE_URL`, `ADMIN_KEY` | Guard + data seeds; reference `TRIANGLE_UI_FLOWS.md` | tests/triangle/* |
| Load tests | `npm run test:load:{smoke,average,stress,spike}` | `BASE_URL` | k6 CLI (manual) | LOAD_TESTING.md |

## 7. Keeping the Tree Updated

1. **When you add/update a script or command**, add/adjust its row in this file.
2. **When you change deployment procedures**, update both this map and the owning guide (e.g., `DEPLOYMENT_AUTOMATION.md`).
3. **When you add a new test suite**, update Section 6 and `TESTING.md` to keep the guard/command map in sync.
4. **During reviews**, use this document to confirm every artifact traces back to a branch (Local, Apps Script, Clasp, CI, DNS, Tests).

This ensures every shell script, documentation page, and automation flow ties back to the same authoritative map and prevents any
"mystery command" drift across the team.
