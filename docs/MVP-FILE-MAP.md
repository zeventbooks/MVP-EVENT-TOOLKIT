# MVP File Classification Map

**Story Card:** ZEVENT-001 - Label & Separate MVP vs V2 vs Archive
**Last Updated:** 2025-11-23

This document classifies every `.gs` and `.html` file in the Apps Script project into clear tiers to eliminate guesswork about what belongs in the MVP.

---

## Tier Definitions

| Tier | Description |
|------|-------------|
| **MVP_CORE** | Essential runtime files required for MVP focus group testing. These are production-critical. |
| **MVP_INFRA** | Supporting infrastructure files (shared utilities, styles, components) that MVP_CORE surfaces depend on. |
| **V2_PLUS** | Experimental or deferred features. Feature-flagged OFF or not included in MVP focus group. |
| **ARCHIVE** | Historical/deprecated files moved to `docs/archived/`. Not deployed. |

---

## Backend Services (.gs files)

| File | Tier | Purpose |
|------|------|---------|
| `Code.gs` | MVP_CORE | Router + API endpoints (doGet/doPost), request handling, response envelopes |
| `Config.gs` | MVP_CORE | Brands, environment config, templates, feature flags |
| `EventService.gs` | MVP_CORE | Event CRUD operations with LockService for concurrency |
| `TemplateService.gs` | MVP_CORE | Event templates (bar, rec, school, fundraiser, custom) |
| `SponsorService.gs` | MVP_CORE | Sponsor management, tier config, ROI tracking |
| `FormService.gs` | MVP_CORE | Google Forms creation for event signups |
| `SharedReporting.gs` | MVP_CORE | Analytics views and data aggregation |
| `AnalyticsService.gs` | MVP_CORE | Logging, metrics, diagnostics (DIAG sheet) |
| `SecurityMiddleware.gs` | MVP_CORE | Auth, JWT, rate limiting, CSRF protection, input sanitization |
| `ApiSchemas.gs` | MVP_CORE | JSON Schema validation for API contracts |
| `i18nService.gs` | V2_PLUS | Multi-language support (feature-flagged OFF via `ZEB.FEATURES.I18N`) |
| `WebhookService.gs` | V2_PLUS | External integrations - Zapier, Slack, etc. (feature-flagged OFF via `ZEB.FEATURES.WEBHOOKS`) |

---

## Frontend Surfaces (.html files)

### MVP Core Surfaces (6 total)

These are the **LOCKED** surfaces for focus group testing. See `docs/MVP_SURFACES.md`.

| File | Tier | Purpose |
|------|------|---------|
| `Admin.html` | MVP_CORE | Event management dashboard - template picker, section toggles, event lifecycle |
| `Public.html` | MVP_CORE | Mobile-first public event page - map, calendar, share, YouTube/Vimeo embeds |
| `Display.html` | MVP_CORE | TV/kiosk display layout - auto-rotate, iframe stage, fallback handling |
| `Poster.html` | MVP_CORE | Print/share with QR - QR grid, sponsor strip, print CSS |
| `Sponsor.html` | MVP_CORE | Sponsor management portal - tier management, placement config |
| `SharedReport.html` | MVP_CORE | Analytics dashboard - 5-metric grid, data tables |

### MVP Infrastructure (Supporting HTML)

These files are `<?!= include() ?>` dependencies of MVP_CORE surfaces.

| File | Tier | Purpose | Used By |
|------|------|---------|---------|
| `Styles.html` | MVP_INFRA | CSS design system, base styles | All 6 MVP surfaces |
| `NUSDK.html` | MVP_INFRA | RPC client for API calls | Admin, Sponsor, SharedReport |
| `Header.html` | MVP_INFRA | Page header component with navigation | Admin, Sponsor, SharedReport |
| `HeaderInit.html` | MVP_INFRA | Header initialization scripts | Admin, Sponsor, SharedReport |
| `DemoMode.html` | MVP_INFRA | Demo/sandbox mode support (`?demo=true`) | Admin, Public, Display, Poster |
| `SponsorUtils.html` | MVP_INFRA | Shared sponsor rendering utilities | Public, Display, Poster |
| `DesignTokens.html` | MVP_INFRA | CSS variables (colors, spacing, typography) | Poster, Sponsor, SharedReport |
| `DesignAdapter.html` | MVP_INFRA | Brand theming adapter | Admin, Poster |
| `CollapsibleSections.html` | MVP_INFRA | Accordion UI component | Admin |
| `SharedUtils.html` | MVP_INFRA | Utility functions (formatting, validation) | Sponsor |
| `APIClient.html` | MVP_INFRA | API wrapper functions | Sponsor |

### V2+ Experimental Surfaces

These pages are **NOT included** in MVP focus group testing. Each has a header comment marking it as experimental.

| File | Tier | Purpose |
|------|------|---------|
| `Test.html` | V2_PLUS | Triangle Framework testing dashboard for developers |
| `ApiDocs.html` | V2_PLUS | Interactive API documentation for developers |
| `Diagnostics.html` | V2_PLUS | System diagnostics and health checks for administrators |
| `DiagnosticsDashboard.html` | V2_PLUS | DevOps dashboard for system monitoring |
| `Signup.html` | V2_PLUS | Sign-up forms management interface |
| `ConfigHtml.html` | V2_PLUS | System configuration interface for administrators |
| `PlannerCards.html` | V2_PLUS | Event planner card-based interface (experimental UI) |
| `PersonalizedCTA.html` | V2_PLUS | Dynamic CTA component based on event status |

### V2+ UI Components

Components not currently used by MVP_CORE surfaces.

| File | Tier | Purpose |
|------|------|---------|
| `EmptyStates.html` | V2_PLUS | Empty state placeholders with CTAs |
| `AccessibilityUtils.html` | V2_PLUS | WCAG 2.1 AA accessibility utilities |
| `ImageOptimization.html` | V2_PLUS | Lazy loading, responsive images |
| `Tooltips.html` | V2_PLUS | Inline help and feature explanations |
| `components/QRRegenerator.html` | V2_PLUS | QR code regeneration component |
| `components/StateManager.html` | V2_PLUS | Client-side state management with auto-save |
| `components/CardComponent.html` | V2_PLUS | Base card component template |
| `components/DashboardCard.html` | V2_PLUS | Event dashboard analytics card |

---

## Archived Files

Files in `docs/archived/` are historical/deprecated and **NOT deployed**.

### Archived Experimental Frontends

| File | Tier | Purpose |
|------|------|---------|
| `docs/archived/experimental-frontends/AdminEnhanced.html` | ARCHIVE | Enhanced admin UI experiment |
| `docs/archived/experimental-frontends/AdminWizard.html` | ARCHIVE | Wizard-style admin flow experiment |
| `docs/archived/experimental-frontends/SponsorDashboard.html` | ARCHIVE | Sponsor dashboard experiment |
| `docs/archived/experimental-frontends/SponsorPreview.html` | ARCHIVE | Sponsor preview experiment |

### Archived Experimental Dashboards

| File | Tier | Purpose |
|------|------|---------|
| `docs/archived/experimental-dashboards/test-dashboard.html` | ARCHIVE | Test dashboard experiment |
| `docs/archived/experimental-dashboards/dashboard/public/index.html` | ARCHIVE | Public dashboard experiment |

### Test Fixtures

| File | Tier | Purpose |
|------|------|---------|
| `tests/e2e/scenarios/dashboard.html` | ARCHIVE | E2E test scenario fixture (not deployed) |

---

## Summary by Tier

| Tier | .gs Files | .html Files | Total |
|------|-----------|-------------|-------|
| **MVP_CORE** | 10 | 6 | 16 |
| **MVP_INFRA** | 0 | 11 | 11 |
| **V2_PLUS** | 2 | 12 | 14 |
| **ARCHIVE** | 0 | 7 | 7 |
| **Total** | 12 | 36 | 48 |

---

## Quick Reference

### What gets deployed to production?

```
MVP_CORE + MVP_INFRA = 27 files
```

### What's feature-flagged OFF?

```javascript
// In Config.gs
ZEB.FEATURES = {
  WEBHOOKS: false,  // WebhookService.gs
  I18N: false       // i18nService.gs
};
```

### How to identify V2+ pages?

All V2+ HTML files have this header comment:

```html
<!--
================================================================================
EXPERIMENTAL - v2+ (Not MVP)
================================================================================
-->
```

---

## Related Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Technical architecture overview
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment and CI/CD
- **[../README.md](../README.md)** - Project overview

---

*MVP File Classification - ZEVENT-001*
