# MVP Event Toolkit

**If it isn't Admin, Public, Display, Poster, or SharedReport, it is not MVP.**

## The 5 Surfaces

| Surface | Purpose |
|---------|---------|
| **Admin** | Event management dashboard. Create, configure, and manage events. |
| **Public** | Public-facing event page. Displays event info, schedule, standings, sponsors. |
| **Display** | TV/kiosk surface. Embeds Public in an iframe with sponsor overlays for 10-foot viewing. |
| **Poster** | Printable poster with event details, QR codes, and sponsor branding. |
| **SharedReport** | Analytics dashboard. Shows impressions, clicks, QR scans, sponsor metrics. |

## Shared Components

| Component | Responsibility |
|-----------|----------------|
| **NUSDK** | RPC client (`NU.rpc`, `NU.swr`). The *only* way surfaces talk to the backend. |
| **Styles** | Global CSS framework. Card layouts, typography, responsive grid. |
| **Header** | Consistent header with logo and build info. |
| **SharedUtils** | UI utilities: alerts, date formatting, debounce, clipboard. |
| **SponsorUtils** | Sponsor rendering, normalization, and analytics tracking. |
| **Spinner** | Loading indicators (`.spinner`, `.spinner-sm`, `.loading-state`). |

## Schemas

| Schema | Used By | Purpose |
|--------|---------|---------|
| **Event** | Admin, Public, Display, Poster | Event identity, links, QR codes, settings, schedule, standings, bracket |
| **Sponsor** | Public, Display, Poster | `{id, name, logoUrl, linkUrl?, placement}` |
| **FormConfig** | Admin, SharedReport | Google Form integration: `{formId, signupUrl, totalResponses}` |
| **SharedAnalytics** | SharedReport | `{summary, surfaces[], sponsors?[], events?[]}` |

## Rules

1. All surfaces use `?page=<surface>` routing—no separate URLs.
2. All API responses use envelope format: `{ok: true, value}` or `{ok: false, code, message}`.
3. Surfaces contain NO business logic. `Code.gs` owns validation and persistence.
4. Schemas are **frozen**. Change the schema, file a PR.
