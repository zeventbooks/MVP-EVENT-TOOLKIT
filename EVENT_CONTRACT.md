# Event Contract v1.0 (MVP Frozen)

> **Schema Version:** `1.0.0` (Frozen for MVP)
> **Source of Truth:** `/schemas/event.schema.json`
> **Last Updated:** 2025-11-30
> **Migration Policy:** Breaking changes require a new schema version and migration script

---

## Field Reference (One-Page)

| Field | Type | Required | MVP/V2 | Description |
|-------|------|----------|--------|-------------|
| **Identity** |
| `id` | string | **Required** | MVP | UUID, system-generated |
| `slug` | string | **Required** | MVP | URL-safe identifier |
| `name` | string | **Required** | MVP | Event display name (max 200) |
| `startDateISO` | string | **Required** | MVP | Date YYYY-MM-DD |
| `venue` | string | **Required** | MVP | Venue name (max 200) |
| `templateId` | string\|null | Optional | MVP | Template used to create event |
| **Links** (auto-generated) |
| `links.publicUrl` | string | **Required** | MVP | Public.html URL |
| `links.displayUrl` | string | **Required** | MVP | Display.html URL |
| `links.posterUrl` | string | **Required** | MVP | Poster.html URL |
| `links.signupUrl` | string | **Required** | MVP | Form/signup URL |
| `links.sharedReportUrl` | string\|null | Optional | V2 | Analytics report URL |
| **QR Codes** (auto-generated) |
| `qr.public` | string | **Required** | MVP | Base64 PNG → publicUrl |
| `qr.signup` | string | **Required** | MVP | Base64 PNG → signupUrl |
| **CTAs** |
| `ctas.primary.label` | string | **Required** | MVP | Primary button text |
| `ctas.primary.url` | string | **Required** | MVP | Primary button link |
| `ctas.secondary` | CTA\|null | Optional | V2 | Secondary button |
| **Content** |
| `schedule` | ScheduleRow[] | Optional | MVP | Schedule items |
| `standings` | StandingRow[] | Optional | MVP | Team standings |
| `bracket` | BracketTree\|null | Optional | MVP | Tournament bracket |
| `sponsors` | Sponsor[] | Optional | V2 | Sponsor logos |
| `media.videoUrl` | string\|null | Optional | V2 | Video embed URL |
| `media.mapUrl` | string\|null | Optional | V2 | Map embed URL |
| `media.gallery` | string[]\|null | Optional | V2 | Gallery images |
| `externalData.scheduleUrl` | string\|null | Optional | V2 | External schedule source |
| `externalData.standingsUrl` | string\|null | Optional | V2 | External standings source |
| `externalData.bracketUrl` | string\|null | Optional | V2 | External bracket source |
| **Settings** |
| `settings.showSchedule` | boolean | **Required** | MVP | Show schedule section |
| `settings.showStandings` | boolean | **Required** | MVP | Show standings section |
| `settings.showBracket` | boolean | **Required** | MVP | Show bracket section |
| `settings.showSponsors` | boolean | Optional | MVP | Show sponsors (V2 content) |
| `settings.showVideo` | boolean | Optional | MVP | Template-aware toggle |
| `settings.showMap` | boolean | Optional | MVP | Template-aware toggle |
| `settings.showGallery` | boolean | Optional | MVP | Template-aware toggle |
| `settings.showSponsorBanner` | boolean | Optional | MVP | Public page banner |
| `settings.showSponsorStrip` | boolean | Optional | MVP | Display strip |
| `settings.showLeagueStrip` | boolean | Optional | MVP | Display league links |
| `settings.showQRSection` | boolean | Optional | MVP | Public QR section |
| `settings.displayRotation` | object\|null | Optional | V2 | TV rotation config |
| **Metadata** |
| `createdAtISO` | string | **Required** | MVP | ISO 8601 datetime |
| `updatedAtISO` | string | **Required** | MVP | ISO 8601 datetime |
| **Reserved** (do not use) |
| `analytics` | object\|null | Reserved | V2 | Event analytics |
| `payments` | object\|null | Reserved | V2 | Stripe integration |

---

## Supporting Types

```typescript
// ScheduleRow
{ time: string, title: string, description?: string }

// StandingRow
{ rank: number, team: string, wins: number, losses: number, points?: number }

// BracketTree
{ rounds: [{ name: string, matches: BracketMatch[] }] }

// BracketMatch
{ id: string, team1?: string, team2?: string, score1?: number, score2?: number, winner?: string }

// Sponsor
{ id: string, name: string, logoUrl: string, linkUrl?: string, placement: "poster"|"display"|"public"|"tv-banner" }

// CTA
{ label: string, url: string }
```

---

## API Response Envelope

```json
// Success
{ "ok": true, "etag": "...", "value": { /* Event or Bundle */ } }

// Error
{ "ok": false, "code": "BAD_INPUT|NOT_FOUND|RATE_LIMITED|INTERNAL|UNAUTHORIZED", "message": "..." }
```

---

## Schema Governance

| Rule | Description |
|------|-------------|
| **Frozen Fields** | Required fields cannot be removed or have type changed |
| **New Fields** | Must be Optional with `null` default |
| **Breaking Changes** | Require new schema version (v1.1, v2.0) + migration |
| **CI Guard** | `npm run test:schemas` blocks non-compliant changes |

**Files that MUST stay in sync:**
- `/schemas/event.schema.json` — Source of truth
- `src/mvp/ApiSchemas.gs` — Runtime validation
- Surface HTML headers — Field documentation

---

## Deprecated Fields

| Old Field | New Field |
|-----------|-----------|
| `dateTime` | `startDateISO` |
| `location` | `venue` |
| `ctaLabels[]` | `ctas.primary/secondary` |
| `sections.*` | `settings.show*` |
| `videoUrl` | `media.videoUrl` |
| `mapEmbedUrl` | `media.mapUrl` |
