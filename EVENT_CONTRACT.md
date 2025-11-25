# Event Contract v2.1 (Schema-Driven)

> **JSON Schema is the Single Source of Truth**
>
> - `/schemas/event.schema.json` - Canonical Event schema
> - `/schemas/sponsor.schema.json` - Canonical Sponsor schema
>
> If a field isn't in the schema, it doesn't exist. If it's in the schema, it's wired.

## Contract Version

| Field | Value |
|-------|-------|
| Version | `2.2.0` |
| Last Updated | 2025-11-25 |
| Status | **MVP-FROZEN** |
| Schema | `/schemas/event.schema.json` |

---

## Schema Files

| File | Purpose |
|------|---------|
| `/schemas/event.schema.json` | **Source of Truth** - JSON Schema for Event entity |
| `/schemas/sponsor.schema.json` | **Source of Truth** - JSON Schema for Sponsor entity |
| `EVENT_CONTRACT.md` | Human-readable version (you're reading it) |
| `ApiSchemas.gs` | GAS runtime validation (mirrors JSON Schema) |

---

## MVP Required Fields

These fields **MUST** be present in every event object:

### Identity
| Field | Type | Description |
|-------|------|-------------|
| `id` | `string` | UUID, system-generated |
| `slug` | `string` | URL-safe identifier |
| `name` | `string` | Event display name (max 200 chars) |
| `startDateISO` | `string` | Date in YYYY-MM-DD format |
| `venue` | `string` | Venue name/location (max 200 chars) |
| `templateId` | `string\|null` | Template ID used to create event (optional) |

### Links (Generated - never rebuild manually)
| Field | Type | Description |
|-------|------|-------------|
| `links.publicUrl` | `string` | Public.html URL |
| `links.displayUrl` | `string` | Display.html URL |
| `links.posterUrl` | `string` | Poster.html URL |
| `links.signupUrl` | `string` | Form/signup page URL |

### QR Codes (Generated at runtime)
| Field | Type | Description |
|-------|------|-------------|
| `qr.public` | `string` | Base64 PNG linking to publicUrl |
| `qr.signup` | `string` | Base64 PNG linking to signupUrl |

### CTAs
| Field | Type | Description |
|-------|------|-------------|
| `ctas.primary.label` | `string` | Primary button label |
| `ctas.primary.url` | `string` | Primary button destination |

### Settings (MVP-frozen)
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `settings.showSchedule` | `boolean` | `false` | MVP Required - Show schedule section |
| `settings.showStandings` | `boolean` | `false` | MVP Required - Show standings section |
| `settings.showBracket` | `boolean` | `false` | MVP Optional - Show bracket section |
| `settings.showSponsors` | `boolean` | `false` | MVP Optional - Show sponsors section (V2 content) |
| `settings.showSponsorBanner` | `boolean` | `true` | MVP Optional - Show sponsor banner on public page |
| `settings.showSponsorStrip` | `boolean` | `true` | MVP Optional - Show sponsor strip on display |
| `settings.showLeagueStrip` | `boolean` | `true` | MVP Optional - Show league/broadcast strip on display |
| `settings.showQRSection` | `boolean` | `true` | MVP Optional - Show QR code section on public page |

### Metadata
| Field | Type | Description |
|-------|------|-------------|
| `createdAtISO` | `string` | ISO 8601 datetime |
| `updatedAtISO` | `string` | ISO 8601 datetime |

---

## MVP Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `schedule` | `ScheduleRow[]` | Event schedule items |
| `standings` | `StandingRow[]` | Team/player standings |
| `bracket` | `BracketTree` | Tournament bracket |

---

## V2 Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `sponsors` | `Sponsor[]` | Sponsor logos with placement |
| `media.videoUrl` | `string` | Video embed URL |
| `media.mapUrl` | `string` | Map embed URL |
| `media.gallery` | `string[]` | Gallery image URLs |
| `externalData.scheduleUrl` | `string` | External schedule source |
| `externalData.standingsUrl` | `string` | External standings source |
| `externalData.bracketUrl` | `string` | External bracket source |
| `ctas.secondary` | `CTA` | Secondary CTA button |
| `links.sharedReportUrl` | `string` | Shared analytics report URL |
| `settings.showSponsors` | `boolean` | Show sponsors section |

---

## Reserved Fields (Do Not Touch Until Ready)

| Field | Type | Description |
|-------|------|-------------|
| `analytics.enabled` | `boolean` | Analytics toggle |
| `analytics.eventViews` | `integer` | Total event views |
| `analytics.publicPageViews` | `integer` | Public page views |
| `analytics.displayViews` | `integer` | Display views |
| `analytics.signupStarts` | `integer` | Signup form starts |
| `analytics.signupCompletes` | `integer` | Signup completions |
| `analytics.qrScans` | `integer` | QR code scans |
| `payments.enabled` | `boolean` | Payments toggle |
| `payments.provider` | `"stripe"` | Payment provider |
| `payments.price` | `number` | Event price |
| `payments.currency` | `string` | 3-letter currency code |
| `payments.checkoutUrl` | `string` | Stripe checkout URL |

---

## Supporting Types

### ScheduleRow
```json
{
  "time": "10:00 AM",
  "title": "Registration Opens",
  "description": "Optional details"
}
```

### StandingRow
```json
{
  "rank": 1,
  "team": "Team Alpha",
  "wins": 5,
  "losses": 1,
  "points": 15
}
```

### BracketTree
```json
{
  "rounds": [
    {
      "name": "Quarterfinals",
      "matches": [
        {
          "id": "match-1",
          "team1": "Team A",
          "team2": "Team B",
          "score1": 3,
          "score2": 1,
          "winner": "Team A"
        }
      ]
    }
  ]
}
```

### Sponsor
```json
{
  "id": "sponsor-123",
  "name": "Acme Corp",
  "logoUrl": "https://example.com/logo.png",
  "linkUrl": "https://acme.com",
  "placement": "poster"
}
```

**Placement values:** `poster` | `display` | `public` | `tv-banner`

### CTA
```json
{
  "label": "Sign Up Now",
  "url": "https://forms.google.com/..."
}
```

---

## API Response Envelope

### Success (single event)
```json
{
  "ok": true,
  "etag": "abc123",
  "value": { /* Event */ }
}
```

### Success (list)
```json
{
  "ok": true,
  "etag": "abc123",
  "value": {
    "items": [ /* Event[] */ ],
    "pagination": {
      "total": 100,
      "limit": 20,
      "offset": 0,
      "hasMore": true
    }
  }
}
```

### Bundle (for surfaces)
```json
{
  "ok": true,
  "etag": "abc123",
  "value": {
    "event": { /* Event */ },
    "config": {
      "brandId": "my-brand",
      "brandName": "My Brand",
      "appTitle": "Event Toolkit"
    }
  }
}
```

### Error
```json
{
  "ok": false,
  "code": "BAD_INPUT | NOT_FOUND | RATE_LIMITED | INTERNAL | UNAUTHORIZED",
  "message": "Human-readable error message"
}
```

---

## Default Values

When a field has no stored value:

```javascript
// Must match /schemas/event.schema.json (MVP-frozen v2.2)
const EVENT_DEFAULTS = {
  // MVP Optional
  schedule: null,
  standings: null,
  bracket: null,
  // MVP Required
  ctas: {
    primary: { label: 'Sign Up', url: '' },
    secondary: null
  },
  // V2 Optional (null per schema)
  sponsors: null,
  media: null,
  externalData: null,
  // Reserved (null per schema)
  analytics: null,
  payments: null,
  // MVP Required - Settings (MVP-frozen)
  settings: {
    // Section visibility
    showSchedule: false,
    showStandings: false,
    showBracket: false,
    showSponsors: false,
    // Surface toggles (default true)
    showSponsorBanner: true,
    showSponsorStrip: true,
    showLeagueStrip: true,
    showQRSection: true
  }
};
```

---

## Deprecated Fields (Remove from codebase)

| Deprecated | Replaced By |
|------------|-------------|
| `dateTime` | `startDateISO` |
| `location` / `venueName` | `venue` |
| `ctaLabels[]` | `ctas.primary` / `ctas.secondary` |
| `sections.*` | `settings.show*` |
| `checkinUrl` / `feedbackUrl` | `links.signupUrl` |
| `videoUrl` / `mapEmbedUrl` | `media.*` |
| `brandId` / `templateId` | Bundle config |
| `reportUrl` | `links.sharedReportUrl` |

---

## Surface Responsibilities

| Surface | Fields Used |
|---------|-------------|
| **Admin** | All fields (full edit) |
| **Public** | `name`, `startDateISO`, `venue`, `links`, `qr`, `ctas`, `schedule`, `standings`, `sponsors`, `media` |
| **Poster** | `name`, `startDateISO`, `venue`, `qr.*`, `sponsors` (poster placement) |
| **Display** | `name`, `startDateISO`, `venue`, `schedule`, `standings`, `sponsors` (display/tv-banner), `ctas` |

---

## Implementation Checklist (MVP-frozen v2.2)

- [x] `/schemas/event.schema.json` - Source of truth (MVP-frozen v2.2)
- [x] `/schemas/sponsor.schema.json` - Sponsor schema
- [x] `EVENT_CONTRACT.md` - Human docs (this file)
- [x] `ApiSchemas.gs` - GAS runtime validation (mirrors schema)
- [x] `Code.gs:EVENT_DEFAULTS_` - Defaults per contract
- [x] `Code.gs:_buildEventContract_()` - Returns canonical shape
- [x] `Code.gs:api_get()` - Returns full shape with null defaults
- [x] `Code.gs:api_list()` - Returns full shape for each item
- [x] `Code.gs:api_getPublicBundle()` - Returns event + config
- [x] `Code.gs:api_getDisplayBundle()` - Returns event + config
- [x] `Code.gs:api_getPosterBundle()` - Returns event + config
- [x] `Admin.html:buildEventFromForm()` - Matches schema (no extras)
- [x] `Public.html` - Uses canonical shape (no legacy fallbacks)
- [x] `Display.html` - Uses canonical shape (V2 dynamic mode removed)
- [x] `Poster.html` - Uses canonical shape
- [x] `TemplateService.gs` - Only sets schema fields (V2 legacy removed)

**Status**: MVP contract frozen. All surfaces aligned to schema v2.2.
