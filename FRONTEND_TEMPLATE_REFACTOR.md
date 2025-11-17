# Front-End Template Architecture Modernization

This document evaluates the current server-side include (SSI) templating approach that powers the published admin experience at
`https://script.google.com/macros/s/AKfycbz-RVTCdsQsI913wN3TkPtUP8F8EhSjyFAlWIpLVRgzV6WJ-isDyG-ntaV1VjBNaWZLdw/exec?page=admin&brand=root`
(and branded overrides such as `brand=ABC`), and prescribes a modernized, modular structure that preserves the existing deployment URL and UX while improving maintainability. The legacy `Tenant` query parameter is still accepted for backwards compatibility, but documentation/scripts should prefer the consumer-friendly `brand` alias.

## 1. Systematic analysis of the current approach

### Strengths
- **Low barrier to entry:** Using `HtmlService.createTemplateFromFile` plus inline `<?!= include('Header'); ?>` keeps the rendering logic approachable for Apps Script newcomers, and the includes are shared across every top-level page (for example `Admin.html` injects `Styles`, `DesignAdapter`, `NUSDK`, and the shared header block).【F:Admin.html†L5-L37】
- **Single deployment surface:** `doGet` is the only HTTP entry point, which simplifies routing and allows features like tenant detection, scope validation, and security headers to be enforced centrally.【F:Code.gs†L214-L287】
- **Incremental rendering:** Template variables (e.g., `appTitle`, `tenantId`, `ZEB`) are set just before evaluation, so tenant-specific metadata already flows into every HTML file without client-side fetches.【F:Code.gs†L276-L283】

### Weaknesses
- **Tight coupling between routing and templates:** `doGet` directly maps `page` query parameters to physical files via `pageFile_`, which makes it difficult to reorganize or test templates independently, and every new view requires touching the router.【F:Code.gs†L265-L513】
- **Global includes without composition rules:** Each HTML shell is responsible for knowing which partials to include, so it is easy for templates to drift apart (for instance, a page could forget to include `HeaderInit` and lose the branding initialization).【F:Admin.html†L5-L37】【F:HeaderInit.html†L1-L22】
- **Limited dynamic data strategy:** The only serialized data is through inline template variables; larger payloads (event lists, sponsor analytics) require additional client-side RPCs, but there is no standardized bootstrap JSON or module loader to keep data schemas consistent.
- **Maintenance overhead for tenant branding:** The helper `renderHeaderInit` is already compensating for inconsistent includes by templating the logo separately, highlighting that the present include tree has become hard to reason about.【F:Code.gs†L515-L527】

## 2. Recommended architecture

Adopt a **layout + view + partial registry** backed by a lightweight module system:

1. **Front controller remains `doGet`:** Continue using the existing deployment URL and query parameters (`page`, `brand`, `scope`, etc.) to build a `RequestContext` (tenant, page, scope, host, feature flags).
2. **Central view registry:** Replace the `if/else` in `pageFile_` with a registry object that maps logical routes to view metadata `{ file, layout, partials, dataBuilder }`.
3. **Layout template:** Introduce `Layout.html` that owns the `<html>/<head>/<body>` skeleton and injects page-specific content via a placeholder (`<?= content ?>`). The layout is responsible for standard includes (styles, adapters, shared scripts), ensuring consistent UI framing regardless of the view.
4. **Composable partials:** Register partial snippets (Header, Footer, Toasts, etc.) as reusable modules rendered through a single helper so they stay deduplicated and testable.
5. **Bootstrap JSON:** Generate a serialized `window.__ZEB_BOOTSTRAP__` blob that contains tenant info, page metadata, feature flags, and pre-fetched datasets. Client-side modules hydrate the UI using that bootstrap object, avoiding redundant RPCs.
6. **ES module-oriented client bundles:** Keep templates thin and move view-specific behavior into per-page ES modules (served via `<script type="module" src="...">` from Apps Script files or CDN). This maintains the same UX while aligning with modern JS standards.

## 3. Integration guide

### 3.1 Modular template inclusion

```javascript
// Code.gs
const VIEW_REGISTRY = {
  admin: {
    file: 'Admin',
    layout: 'MainLayout',
    partials: ['Header', 'Footer', 'GlobalToasts'],
    dataBuilder: buildAdminBootstrap_,
  },
  wizard: { /* ... */ },
  sponsor: { /* ... */ }
};

function renderPage_(context) {
  const view = VIEW_REGISTRY[context.page] || VIEW_REGISTRY.public;
  const viewTpl = HtmlService.createTemplateFromFile(view.file);
  Object.assign(viewTpl, view.dataBuilder(context));
  const renderedView = viewTpl.evaluate().getContent();

  const layoutTpl = HtmlService.createTemplateFromFile(view.layout);
  layoutTpl.content = renderedView;
  layoutTpl.partials = view.partials.map(renderPartial_).join('');
  layoutTpl.bootstrapJson = JSON.stringify(context.bootstrap, null, 0);
  return layoutTpl.evaluate()
    .setTitle(`${context.bootstrap.app.title} · ${context.page}`)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
```

```javascript
function renderPartial_(name) {
  return HtmlService.createHtmlOutputFromFile(name).getContent();
}

function buildAdminBootstrap_(context) {
  const tenant = context.tenant;
  return {
    appTitle: `${tenant.name} · ${context.scope}`,
    tenantId: tenant.id,
    page: context.page,
    bootstrap: {
      app: { title: tenant.name, buildId: ZEB.BUILD_ID },
      tenant,
      scope: context.scope,
      csrfToken: generateCSRFToken_(),
      datasets: fetchAdminData_(tenant),
    },
  };
}
```

`MainLayout.html` would now look like:

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <title><?= appTitle ?></title>
    <?!= include('Styles'); ?>
    <?!= include('DesignAdapter'); ?>
    <script>window.__ZEB_BOOTSTRAP__ = <?= bootstrapJson ?>;</script>
  </head>
  <body>
    <?= partials ?>
    <main id="app">
      <?= content ?>
    </main>
    <script type="module" src="<?= execUrl ?>?pageScript=<?= page ?>"></script>
  </body>
</html>
```

All current HTML view files (`Admin.html`, `ConfigHtml.html`, `Sponsor.html`, etc.) shrink to only the inner markup that belongs inside `<main>`, because layout + partials are centrally controlled.

### 3.2 Dynamic data rendering

1. **Server bootstrap:** `buildAdminBootstrap_` (and peers per view) fetch the minimal datasets required for first paint (tenant branding, feature toggles, cached summaries). This data is injected into the layout via `bootstrapJson`.
2. **Client hydration:** A shared module reads `window.__ZEB_BOOTSTRAP__` and initializes page-specific modules.

```javascript
// AdminPage.js (served via HtmlService)
import { initHeader } from './modules/header.js';
import { renderDashboard } from './modules/dashboard.js';

const bootstrap = window.__ZEB_BOOTSTRAP__;
initHeader(bootstrap.app);
renderDashboard(bootstrap.datasets.dashboard);
```

3. **Subsequent fetches:** Use the existing REST endpoints (`action=...`) for additional data, but wrap them in a `fetchJson` helper to enforce consistent headers, tenant IDs, and CSRF tokens.

### 3.3 UI consistency & tenant handling

- **Header module:** Move the logic currently inside `HeaderInit.html` into a reusable ES module (`modules/header.js`) so every page calls `initHeader(bootstrap.app, bootstrap.tenant)` during hydration. This ensures the root brand (`brand=root`) and branded tenants (`brand=ABC`) share identical initialization steps.
- **Tenant-aware assets:** Extend the tenant config with `themeTokens` (colors, logos) that feed both CSS custom properties (set via `<style>:root { --brand-primary: ... }</style>`) and runtime modules. Because the bootstrap object already contains the resolved tenant from `doGet`, both `brand=root` and `brand=ABC` URLs render the correct skin without double-loading the root shell.

## 4. Best-practice recommendations

1. **Encapsulate routing:** Keep `doGet` focused on building a `RequestContext` and delegate rendering to `renderPage_`. This separation simplifies unit tests (you can test data builders without spinning up HtmlService).
2. **Normalize includes:** With the layout owning global includes, you remove duplication from each view and eliminate drift where some templates forget to import shared assets.
3. **Adopt ES modules:** Serve per-page scripts via `<script type="module">` so modern bundlers (Vite/Rollup) or even Apps Script clasp builds can transpile TypeScript/ESNext if desired.
4. **Introduce lintable assets:** Store client-side JS/SCSS alongside the project and transpile them into `.html` files using clasp or GitHub Actions. This keeps modern tooling in sync with Apps Script deployment without changing the public URL.
5. **Implement caching & perf guards:** Memoize expensive data builders (e.g., dashboards) per tenant for short intervals using `CacheService` to reduce spreadsheet reads when many admins hit `page=admin`.
6. **Document template contracts:** For every partial or data builder, document the expected props (e.g., `Header` expects `{appTitle, logoUrl}`). This contract-first mindset prevents regressions when adding new tenants.

### Migration steps
1. **Introduce `Layout.html`, `MainLayout`, and the view registry without deleting existing pages.** Toggle usage with a feature flag so you can A/B test root vs. ABC tenants.
2. **Incrementally convert templates:** Start with `Admin.html` because it exercises most partials; once stable, port other views.
3. **Refactor `HeaderInit` into modules:** After confirming parity for `brand=root`, switch the `brand=ABC` URL and verify that branding assets, app title, and build info still hydrate correctly.
4. **Automate deployment:** Keep the current `ScriptApp` URL but ensure the build pipeline lints/tests the modular JS before pushing to Apps Script.

Following this architecture yields a consistent, modular, and modern front-end stack that preserves the current deployment URL/UX while making it significantly easier to extend tenant-specific skins such as ABC without copy/pasting template scaffolding.

## Brand parameter permeation checklist

The modernization effort only succeeds if the friendlier `brand` query parameter becomes the single source of truth across every artifact:

1. **Code:** `doGet` (and redirect helpers) should emit `brand=` links while still accepting `Tenant` for backwards compatibility. Shared helpers that build event URLs (public, poster, display, report) must also prefer `brand` so deep links remain user-friendly.
2. **Documentation:** Replace support docs, runbooks, and onboarding guides that previously referenced `?tenant=` with `?brand=` so support engineers and customers copy URLs that match the UI language.
3. **Automated tests:** Centralize Playwright/Newman URL builders so end-to-end suites cover both the new parameter and the deprecated alias. Add one regression test that hits `tenant=` explicitly to ensure the fallback never breaks.
4. **Shell scripts & CI:** Update deployment scripts (`deploy-and-get-urls.sh`, `verify-deployment.sh`, `update-deployment-url.sh`, etc.) plus cron monitors to use `brand=`. This keeps console output and alerting consistent with what stakeholders expect to see.
5. **Release notes:** Communicate the rename in release documentation so partner teams know that `brand` is now the preferred vocabulary.

By driving the rename through every category (code, docs, tests, automation, communications), the admin interface accessed via `...?page=admin&brand=root` or `...?page=admin&brand=ABC` remains fully functional while presenting a friendlier, marketing-aligned URL surface.
