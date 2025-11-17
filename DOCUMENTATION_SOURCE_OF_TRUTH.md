# Documentation Source of Truth

Because this repository contains dozens of historical audits, use this checklist to confirm which documents currently mirror the
codebase and which are purely archival. Update the "Last verified" column whenever you touch a document so future maintainers
know whether instructions still apply.

| Area | Canonical artifact | Last verified | Notes |
| --- | --- | --- | --- |
| Routing & templating | [FRONTEND_TEMPLATE_REFACTOR.md](./FRONTEND_TEMPLATE_REFACTOR.md) | `git describe --always` at commit creation | Mirrors the `doGet`/`brand` logic in `Code.gs` (see `firstParam_`, tenant fallback). Prefer this doc over legacy UI PDFs. |
| Deployment quick start | [README.md](./README.md) | `git describe --always` at commit creation | Use for `?brand=` examples and up-to-date deployment steps. |
| Automation scripts | [`deploy-and-get-urls.sh`](./deploy-and-get-urls.sh), [`verify-deployment.sh`](./verify-deployment.sh) | `git describe --always` at commit creation | Scripts already emit `brand=` URLs; rerun after edits to confirm behavior. |
| Test environments | [`tests/config/environments.js`](./tests/config/environments.js) | `git describe --always` at commit creation | Playwright/Newman helpers should surface `brand` terminology when generating URLs. |

## How to audit a document

1. **Identify the code it references.** Example: front-end routing docs must cite `Code.gs` or template files.
2. **Validate against HEAD.** Use `rg`/`sed` (per repo guidelines) to confirm APIs, parameters, and filenames still exist.
3. **Record the verification.** Update this matrix (and optionally add an inline note in the document) so teammates know the
   instructions are current.
4. **Flag archival docs.** If a file is intentionally historical, add a front-matter note such as "Status: archival" so readers
   do not assume it reflects the current stack.

## Responding to "tenant" vs. "brand" terminology

- **External URLs:** Always communicate `?brand=` links (e.g., `...?page=admin&brand=root`) to customers. `tenant` remains a
  supported alias inside `Code.gs`, but it is now an implementation detail.
- **Docs & runbooks:** When you find `tenant=` in prose or shell output, either replace it with `brand=` or add a parenthetical
  note clarifying that `brand` is the preferred public label.
- **Tests & automation:** Confirm new tests read the canonical value from `firstParam_` so both `brand` and `tenant` inputs are
  covered without duplicating logic.

Following this process ensures we do not rely on outdated documents and keeps the working front end (including
`https://script.google.com/.../exec?page=admin&brand=root` and `brand=ABC`) aligned with the written guidance.
