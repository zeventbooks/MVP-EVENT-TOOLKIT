# MVP Architecture

**Last Updated:** 2025-11-22
**Status:** MVP v1.0 - Focus Group Ready

---

## Overview

The MVP Event Toolkit is a Google Apps Script web application with 12 backend services and 5 frontend surfaces. This document defines the runtime architecture for the MVP focus group.

---

## Backend Services (.gs files)

These 12 files form the **runtime spine** of the MVP:

| File | Purpose | Lines | MVP Status |
|------|---------|-------|------------|
| **Code.gs** | Router + API endpoints (doGet/doPost) | ~900+ | Core |
| **Config.gs** | Brands, environment, templates, feature flags | ~400 | Core |
| **TemplateService.gs** | Event templates (bar, rec, school, fundraiser, custom) | ~800 | Core |
| **ApiSchemas.gs** | JSON Schema validation for API contracts | ~300 | Core |
| **EventService.gs** | Event CRUD operations with LockService | ~500 | Core |
| **FormService.gs** | Google Forms creation for signups | ~300 | Core |
| **SponsorService.gs** | Sponsor management and ROI tracking | ~400 | Core |
| **SharedReporting.gs** | Analytics views and aggregation | ~300 | Core |
| **AnalyticsService.gs** | Logging and metrics aggregation | ~400 | Core |
| **SecurityMiddleware.gs** | Auth, JWT, rate limiting, CSRF | ~350 | Core |
| **i18nService.gs** | Multi-language support (feature-flagged OFF) | ~600 | Deferred |
| **WebhookService.gs** | External integrations (feature-flagged OFF) | ~650 | Deferred |

### Feature Flags

Non-MVP features are gated via `Config.gs`:

```javascript
ZEB.FEATURES = {
  WEBHOOKS: false,  // External integrations - v2
  I18N: false       // Multi-language - v2
};
```

### Router Architecture

`Code.gs` handles all routing:

```
doGet(e) → Route by ?p= parameter
  ├─ p=admin    → Admin.html        [MVP]
  ├─ p=public   → Public.html       [MVP]
  ├─ p=display  → Display.html      [MVP]
  ├─ p=poster   → Poster.html       [MVP]
  ├─ p=report   → SharedReport.html [MVP]
  ├─ p=sponsor  → Sponsor.html      [V2+]
  └─ p=status   → Health check JSON

doPost(e) → REST API by action parameter
  ├─ action=create  → EventService
  ├─ action=update  → EventService
  ├─ action=delete  → EventService
  └─ action=*       → Routed to appropriate service
```

### HTML Serving

Pages are served via `HtmlService` with iframe support enabled:

```javascript
return tpl.evaluate()
  .setTitle(title)
  .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
```

This enables:
- YouTube embeds
- Vimeo embeds
- Google Maps embeds
- Any external iframe content

---

## Frontend Surfaces (.html files)

These 5 files are the **only user-visible surfaces** for MVP:

| Surface | Purpose | Key Features |
|---------|---------|--------------|
| **Admin.html** | Event management control room | Template picker, section toggles, event lifecycle |
| **Public.html** | Mobile-first public event page | Map, Calendar, Share, Skeleton loaders, YouTube/Vimeo |
| **Display.html** | TV/kiosk display layout | Auto-rotate, iframe stage, fallback handling |
| **Poster.html** | Print/share with QR | QR grid, sponsor strip, print CSS |
| **SharedReport.html** | Analytics dashboard | 5-metric grid, data tables |

### V2+ Surfaces (NOT in MVP)

| Surface | Purpose | Status |
|---------|---------|--------|
| **Sponsor.html** | Sponsor self-service portal | V2+ |

### Supporting HTML (included via templates)

These files provide shared functionality across surfaces:

| File | Purpose |
|------|---------|
| NUSDK.html | RPC client for API calls |
| Styles.html | CSS design system |
| DesignTokens.html | CSS variables (colors, spacing) |
| DesignAdapter.html | Brand theming |
| DemoMode.html | Demo/sandbox mode support |
| SponsorUtils.html | Shared sponsor rendering |
| Header.html | Page header component |
| HeaderInit.html | Header initialization |
| CollapsibleSections.html | Accordion UI component |
| SharedUtils.html | Utility functions |
| APIClient.html | API wrapper functions |

### Video Embedding

Both Public.html and Display.html support video embeds:

**Public.html** - Full YouTube/Vimeo handling:
```javascript
// YouTube URL validation and embed generation
const youtubeRegex = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11}).*$/;
const youtubeMatch = videoUrl.match(youtubeRegex);
if (youtubeMatch) {
  const videoId = youtubeMatch[3];
  embedUrl = `https://www.youtube.com/embed/${videoId}`;
}
```

**Display.html** - Generic iframe stage:
```html
<iframe id="stage"
  allow="autoplay; fullscreen"
  sandbox="allow-scripts allow-same-origin allow-popups allow-forms">
</iframe>
```

---

## Data Storage

### Google Sheets Structure

Each brand has a dedicated spreadsheet with these sheets:

| Sheet | Purpose | Auto-created |
|-------|---------|--------------|
| EVENTS | Event data storage | Yes |
| SPONSORS | Sponsor configurations | Yes |
| ANALYTICS | Usage metrics | Yes |
| DIAG | Diagnostic logs | Yes |

### Sheet Auto-Creation

Sheets are created on-demand when first accessed:

```javascript
function getOrCreateSheet_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
  }
  return sheet;
}
```

---

## API Design

### Envelope Pattern

All API responses use a consistent envelope:

```javascript
// Success
{ "ok": true, "value": { ... } }

// Error
{ "ok": false, "code": "ERROR_CODE", "message": "Human-readable message" }
```

### Authentication Methods

1. **Admin Key** (header) - For admin operations
2. **JWT Tokens** - For session-based auth
3. **API Keys** - For programmatic access

### CSRF Protection

POST requests require a valid CSRF token:

```javascript
function validateCsrf_(token, brandId) {
  // Token validation logic
  return isValid;
}
```

---

## Security Model

### Request Flow

```
Request → SecurityMiddleware
  ├─ Rate limiting check
  ├─ Authentication check
  ├─ CSRF validation (POST)
  ├─ Input sanitization
  └─ Route to handler
```

### Input Sanitization

All user input is sanitized before use:

```javascript
function sanitizeInput_(input, maxLength) {
  if (typeof input !== 'string') return '';
  return input.substring(0, maxLength).replace(/[<>]/g, '');
}
```

---

## Templates

### Available Templates

The MVP includes 18 event templates:

| Category | Templates |
|----------|-----------|
| **Bar/Restaurant** | Happy Hour, Trivia Night, Live Music |
| **Recreation** | Tournament, League, Pickup Game |
| **School** | Sports Event, Fundraiser, Community Event |
| **Fundraiser** | Charity Event, Auction, Benefit |
| **Custom** | Generic Event, Custom Template |

### Template Structure

```javascript
{
  id: 'tournament-v1',
  version: 1,
  label: 'Tournament Event',
  category: 'recreation',
  fields: [
    { id: 'name', label: 'Event Name', type: 'text', required: true },
    { id: 'date', label: 'Date', type: 'date', required: true },
    { id: 'bracketSize', label: 'Bracket Size', type: 'number' }
  ]
}
```

---

## Deferred Features (v2+)

### Webhooks (WebhookService.gs)

External integrations for Zapier, Slack, etc. Feature-flagged OFF for MVP.

**When enabled:**
- Event notifications (event.created, event.updated)
- Sponsor alerts (sponsor.ctr.low, sponsor.ctr.high)
- Analytics reports (analytics.report)

### Internationalization (i18nService.gs)

Multi-language support. Feature-flagged OFF for MVP.

**When enabled:**
- Locale detection (URL, preferences, Accept-Language)
- Translation system with parameter interpolation
- Date/number/currency formatting

---

## Development Workflow

### File Organization

```
MVP-EVENT-TOOLKIT/
├── *.gs              # Backend services (12 files)
├── *.html            # Frontend surfaces (5 MVP + supporting)
├── docs/             # Documentation
├── tests/            # Test suites
├── scripts/          # Build/deploy scripts
└── .github/          # CI/CD workflows
```

### Testing Strategy

| Level | Purpose | Location |
|-------|---------|----------|
| Unit | Service function testing | tests/unit/ |
| Contract | API schema validation | tests/contract/ |
| E2E | Full user flows | tests/e2e/ |
| Smoke | Critical path validation | tests/smoke/ |

---

## Quick Reference

### Key URLs

```
# Admin (event management)
?p=admin&brand=root

# Public (event listing)
?p=public&brand=root

# Display (TV/kiosk)
?p=display&brand=root

# Poster (print view)
?p=poster&brand=root&eventId=EVT_xxx

# Status (health check)
?p=status&brand=root
```

### API Endpoints

```
POST ?action=create     # Create event
POST ?action=update     # Update event
POST ?action=delete     # Delete event
POST ?action=list       # List events
POST ?action=get        # Get single event
```

---

## Related Documentation

- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Deployment and CI/CD
- **[FRIENDLY_URLS.md](./FRIENDLY_URLS.md)** - URL aliasing system
- **[SETUP_DIAGNOSTICS.md](./SETUP_DIAGNOSTICS.md)** - Setup verification

---

*MVP Architecture - Focus Group v1.0*
