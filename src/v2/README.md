# V2 Features (Non-MVP)

**These features are NOT part of the MVP.** They exist for future expansion and should
not be enabled for early bar pilots without explicit approval.

---

## Why This Directory Exists

Google Apps Script requires all deployable files (`.gs`, `.html`) to reside in a single
`rootDir` (see `/.clasp.json`). Therefore, V2 files physically live in `src/mvp/` but are
**logically separated** as non-MVP features.

This directory serves as the **documentation hub** for V2 features.

---

## V2 File Inventory

| File | Location | Purpose |
|------|----------|---------|
| `AdminTemplateV2.html` | `src/mvp/` | Template editing UI for SEM staff and bar owners |
| `Randomizer.html` | `src/mvp/` | Quick team picker utility |
| `SponsorPortfolioV2.gs` | `src/mvp/` | Multi-event portfolio analytics for cross-brand ROI |
| `TemplateManagementService.gs` | `src/mvp/` | Backend CRUD for custom templates |

---

## Feature Flags

| Flag | Default | Controls |
|------|---------|----------|
| `TEMPLATE_MANAGEMENT_V2` | `false` | AdminTemplateV2.html + TemplateManagementService.gs |

The Randomizer and SponsorPortfolioV2 modules do not require feature flags:
- **Randomizer**: Standalone utility, accessed via `?p=randomizer`
- **SponsorPortfolioV2**: Analytics-only (read), accessed via API

---

## V2 Surfaces

### AdminTemplateV2.html

**Purpose**: Allow SEM staff and bar owners to create and edit event templates.

**Access**: `?page=templates-v2` (requires `TEMPLATE_MANAGEMENT_V2` flag enabled)

**Features**:
- List all templates (built-in + custom)
- View template details
- Create new custom templates
- Edit custom templates (built-in are read-only)
- Clone templates
- Delete custom templates

**Related**: `TemplateManagementService.gs`, `TemplateService.gs`

---

### Randomizer.html

**Purpose**: Quick team picker - add names, click Go, get random teams.

**Access**: `?p=randomizer` or `/teams` or `/picker`

**Features**:
- Paste or type participant names
- Choose number of teams
- Randomize with one click
- Copy results to clipboard

**Status**: Standalone utility, no feature flag required.

---

## V2 Services

### SponsorPortfolioV2.gs

**Purpose**: Multi-event portfolio mode for cross-brand sponsor ROI tracking.

**Schema**: `/schemas/sponsor-portfolio-v2.schema.json`

**Modes**:
1. `single-brand` (default): Standard SharedAnalytics behavior
2. `multi-event-portfolio`: Cross-brand aggregation for parent organizations

**Endpoints**:
- `api_getPortfolioAnalyticsV2(params)` - Full portfolio analytics
- `api_getPortfolioSummaryV2(params)` - Summary metrics
- `api_getPortfolioSponsorReportV2(params)` - Per-sponsor report

---

### TemplateManagementService.gs

**Purpose**: Backend CRUD for custom event templates.

**Feature Flag**: `TEMPLATE_MANAGEMENT_V2`

**Operations**:
- `listTemplatesV2` - List all templates
- `getTemplateV2` - Get template by ID
- `createTemplateV2` - Create custom template
- `updateTemplateV2` - Update custom template
- `deleteTemplateV2` - Delete custom template
- `cloneTemplateV2` - Clone existing template
- `validateTemplateV2` - Validate against schema

**Storage**: Custom templates stored in `TemplatesV2` sheet.

---

## Related Schemas

| Schema | Version | Purpose |
|--------|---------|---------|
| `/schemas/sponsor-portfolio-v2.schema.json` | 2.0.0 | Portfolio analytics response shape |
| `/schemas/event.schema.json` | - | Template field validation (templates must produce valid events) |

---

## Related Tests

| Test | Covers |
|------|--------|
| `tests/unit/template-management-v2.test.js` | TemplateManagementService.gs |
| `tests/contract/sponsor-portfolio-v2.contract.test.js` | SponsorPortfolioV2.gs schema compliance |
| `tests/e2e/api/portfolio-analytics-v2-api.spec.js` | Portfolio API endpoints |

---

## When to Enable V2

- **Template Management**: When bar owners request template customization beyond presets
- **Portfolio Analytics**: When sponsors need cross-brand ROI dashboards
- **Randomizer**: Always available (low-risk standalone utility)
