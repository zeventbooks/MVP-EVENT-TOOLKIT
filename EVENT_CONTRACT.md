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
| Version | `2.1.0` |
| Last Updated | 2025-11-24 |
| Status | **ACTIVE** |
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

### Settings
| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `settings.showSchedule` | `boolean` | `false` | Show schedule section |
| `settings.showStandings` | `boolean` | `false` | Show standings section |
| `settings.showBracket` | `boolean` | `false` | Show bracket section |

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
const EVENT_DEFAULTS = {
  schedule: null,
  standings: null,
  bracket: null,
  ctas: {
    primary: { label: 'Sign Up', url: '' },
    secondary: null
  },
  sponsors: null,
  media: null,
  externalData: null,
  analytics: null,
  payments: null,
  settings: {
    showSchedule: false,
    showStandings: false,
    showBracket: false,
    showSponsors: false
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

## Implementation Checklist

- [x] `/schemas/event.schema.json` - Source of truth
- [x] `/schemas/sponsor.schema.json` - Sponsor schema
- [x] `EVENT_CONTRACT.md` - Human docs (this file)
- [x] `ApiSchemas.gs` - GAS runtime validation
- [ ] `Code.gs:EVENT_DEFAULTS_` - Defaults per contract
- [ ] `Code.gs:_buildEventContract_()` - Returns canonical shape
- [ ] `Code.gs:api_get()` - Returns full shape with null defaults
- [ ] `Code.gs:api_list()` - Returns full shape for each item
- [ ] `Code.gs:api_getPublicBundle()` - Returns event + config
- [ ] `Code.gs:api_getDisplayBundle()` - Returns event + config
- [ ] `Code.gs:api_getPosterBundle()` - Returns event + config
- [ ] `Admin.html` - Uses canonical shape
- [ ] `Public.html` - Uses canonical shape
- [ ] `Display.html` - Uses canonical shape
- [ ] `Poster.html` - Uses canonical shape

**Gate**: Do not modify surfaces until backend files agree with this contract.
