# MVP Scope Definition

> **Source of Truth**: https://github.com/zeventbooks/MVP-EVENT-TOOLKIT branch `main`

This document defines what's in scope for the MVP versus future releases.

---

## The Triangle Value Proposition

```
┌─────────────────────────────────────────────────────────────┐
│                     EVENT ORGANIZERS                         │
│         Easy setup → Marketing assets → Data sharing         │
└─────────────────────────────────────────────────────────────┘
                              │
                ┌─────────────▼─────────────┐
                │      SHARED ANALYTICS      │
                │   Impressions + CTR + ROI  │
                └─────────────┬─────────────┘
                              │
        ┌─────────────────────┼─────────────────────────┐
        ▼                     ▼                         ▼
┌───────────────┐   ┌─────────────────┐       ┌─────────────────┐
│   SPONSORS    │   │    CUSTOMERS    │       │    SURFACES     │
│ Real numbers  │   │ Quality exp     │       │ Mobile+Display  │
│ Not bullshit  │   │ Before/During/  │       │ +Poster+Public  │
│               │   │ After           │       │                 │
└───────────────┘   └─────────────────┘       └─────────────────┘
```

**The WOW Factor**: Sponsors get real ROI data (impressions, CTR, dwell time) across all surfaces. This is not optional for MVP.

---

## MVP Surfaces (Frontend)

| File | Purpose | Status |
|------|---------|--------|
| `Admin.html` | Single control room for event management | MVP |
| `Poster.html` | Printable/shareable pre-event asset | MVP |
| `Display.html` | TV board with sponsor rotation | MVP |
| `Public.html` | Mobile-first attendee view | MVP |
| `Sponsor.html` | Sponsor management & package view | MVP |
| `SharedReport.html` | Shared analytics for sponsors/admins | MVP |

---

## MVP Backend (Services)

| File | Purpose | Status |
|------|---------|--------|
| `Code.gs` | Main router (doGet/doPost) | MVP |
| `Config.gs` | Brand + environment config | MVP |
| `SecurityMiddleware.gs` | Auth & validation | MVP |
| `EventService.gs` | Event CRUD | MVP |
| `FormService.gs` | Registration handling | MVP |
| `SponsorService.gs` | Sponsor logic | MVP |
| `AnalyticsService.gs` | Tracking & metrics | MVP |
| `SharedReporting.gs` | Report generation | MVP |
| `ApiSchemas.gs` | Request/response validation | MVP |

---

## MVP Frontend Bridge

| File | Purpose | Status |
|------|---------|--------|
| `NUSDK.html` | `NU.rpc('api_*')` + SWR cache | MVP |
| `DesignAdapter.html` | Theme/brand switching | MVP |
| `Styles.html` | Global CSS | MVP |
| `Header.html` / `HeaderInit.html` | Navigation | MVP |

---

## API Tiers

### @tier mvp - Must Work Today

These APIs form the core analytics loop that makes the product valuable:

```
Event Management:
  api_create              - Create event
  api_get                 - Get event by ID
  api_list                - List events (paginated)
  api_updateEventData     - Update event data
  api_getPublicBundle     - Bundled data for public pages

System:
  api_status              - Health check
  api_healthCheck         - Simple ping
  api_getConfig           - Brand/env configuration
  api_setupCheck          - First-time setup validation
  api_checkPermissions    - Permission verification
  api_runDiagnostics      - Full diagnostic suite

Auth:
  api_generateToken       - JWT token generation

Analytics (THE WOW FACTOR):
  api_logEvents           - Track impressions, clicks, dwell time
  api_getReport           - Event analytics report
  api_getSponsorAnalytics - Sponsor performance metrics (impressions, CTR, ROI by surface)
  api_getSponsorROI       - ROI dashboard with financials & insights

Sponsors:
  api_getSponsorSettings         - Placement configuration
  api_validateSponsorPlacements  - Validate placements

Tracking:
  api_createShortlink       - Create trackable links (CTR tracking)
  api_generateFormShortlink - Trackable form links

Forms:
  api_listFormTemplates      - Available templates
  api_createFormFromTemplate - Create registration forms
```

### @tier v2 - Future Releases

These features work but are not critical for initial launch:

```
Portfolio Analytics (Multi-event):
  api_getPortfolioSponsorReport - Cross-event sponsor reports
  api_getPortfolioSummary       - Portfolio-wide summary
  api_getPortfolioSponsors      - All sponsors across events

Advanced Exports:
  api_exportReport - Spreadsheet export matrix

Not Yet Built:
  Full i18n system
  Multi-brand beyond primary tenant
```

---

## What's Out of Scope

Everything in `docs/archived/` is explicitly NOT part of the MVP:
- Experimental dashboards
- Hostinger deployment docs (outdated)
- Alternative admin interfaces

---

## Testing Priority

1. **Critical Path**: Event create → Sponsor add → Surface view → Analytics log → Report view
2. **Sponsor Value**: Impressions tracked across Display + Public + Poster → CTR calculated → ROI displayed
3. **Admin Flow**: Login → Create event → Configure sponsors → Generate assets → View reports

---

## Definition of Done for MVP

- [ ] Single event can be created and managed
- [ ] All 6 surfaces render correctly with event data
- [ ] Impressions tracked on Display.html, Public.html, Poster.html
- [ ] CTR tracked via shortlinks
- [ ] Sponsor analytics show real numbers (not mocked)
- [ ] SharedReport.html displays data sponsors can use
- [ ] ROI calculation works with sponsor cost input

---

*Last updated: 2025-11-21*
