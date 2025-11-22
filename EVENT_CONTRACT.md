# Event Contract v2.0 (MVP + V2-Ready)

> **Single Source of Truth** for all event data shapes in Zeventbook.
> All backend code (`Code.gs`, `ApiSchemas.gs`) and frontend surfaces (`Admin.html`, `Public.html`, `Display.html`, `Poster.html`) must conform to this contract.

## Contract Version

| Field | Value |
|-------|-------|
| Version | `2.0.0` |
| Last Updated | 2025-11-22 |
| Status | **ACTIVE** |

---

## Canonical Event Shape

The API always returns events in this exact shape. Fields that have no value are returned as `null` (never `undefined`, never omitted).

```typescript
interface Event {
  // ──────────────────────────────────────────
  // IDENTITY (MVP REQUIRED)
  // ──────────────────────────────────────────
  id: string;                        // MVP REQUIRED - UUID, system-generated
  slug: string;                      // MVP REQUIRED - Used in URLs
  name: string;                      // MVP REQUIRED - Event name
  startDateISO: string;              // MVP REQUIRED - YYYY-MM-DD format
  venue: string;                     // MVP REQUIRED - Venue name/location

  // ──────────────────────────────────────────
  // LINKS (MVP REQUIRED)
  // All surfaces must use THESE, never rebuild URLs.
  // ──────────────────────────────────────────
  links: {
    publicUrl: string;               // MVP REQUIRED - Public.html
    displayUrl: string;              // MVP REQUIRED - Display.html
    posterUrl: string;               // MVP REQUIRED - Poster.html
    signupUrl: string;               // MVP REQUIRED - Form or simple page
    sharedReportUrl?: string;        // V2 OPTIONAL
  };

  // ──────────────────────────────────────────
  // QR CODES (MVP REQUIRED)
  // Admin must show these. Poster must print these.
  // ──────────────────────────────────────────
  qr: {
    public: string;                  // MVP REQUIRED - base64 PNG
    signup: string;                  // MVP REQUIRED - base64 PNG
  };

  // ──────────────────────────────────────────
  // SCHEDULE / STANDINGS / BRACKETS
  // ──────────────────────────────────────────
  schedule?: ScheduleRow[];          // MVP OPTIONAL - Display uses if present
  standings?: StandingRow[];         // MVP OPTIONAL
  bracket?: BracketTree;             // MVP OPTIONAL (V2-ready)

  // ──────────────────────────────────────────
  // CTA BLOCK (MVP REQUIRED)
  // MVP MUST support a simple CTA ("Sign Up", "View Bracket", etc.)
  // Admin can edit CTA labels in V2—not MVP.
  // ──────────────────────────────────────────
  ctas: {
    primary: {
      label: string;                 // MVP REQUIRED
      url: string;                   // MVP REQUIRED
    };
    secondary?: {
      label: string;                 // V2 OPTIONAL
      url: string;                   // V2 OPTIONAL
    };
  };

  // ──────────────────────────────────────────
  // SPONSOR BLOCK (V2 OPTIONAL, RESERVED for MVP)
  // MVP hides this unless sponsorsEnabled=true.
  // ──────────────────────────────────────────
  sponsors?: Sponsor[];

  // ──────────────────────────────────────────
  // MEDIA SECTIONS (V2 OPTIONAL)
  // ──────────────────────────────────────────
  media?: {
    videoUrl?: string;
    mapUrl?: string;
    gallery?: string[];
  };

  // ──────────────────────────────────────────
  // EXTERNAL DATA (V2 OPTIONAL)
  // Needed for ABC/CBC integrations later.
  // ──────────────────────────────────────────
  externalData?: {
    scheduleUrl?: string;
    standingsUrl?: string;
    bracketUrl?: string;
  };

  // ──────────────────────────────────────────
  // ANALYTICS (RESERVED)
  // This is your moat. Keep it clean.
  // ──────────────────────────────────────────
  analytics?: {
    enabled: boolean;
    eventViews?: number;
    publicPageViews?: number;
    displayViews?: number;
    signupStarts?: number;
    signupCompletes?: number;
    qrScans?: number;
  };

  // ──────────────────────────────────────────
  // PAYMENTS (RESERVED FOR STRIPE)
  // ──────────────────────────────────────────
  payments?: {
    enabled: boolean;
    provider: 'stripe';
    price: number;
    currency: string;
    checkoutUrl?: string;            // Generated per-event later
  };

  // ──────────────────────────────────────────
  // ADMIN FLAGS (MVP REQUIRED)
  // ──────────────────────────────────────────
  settings: {
    showSchedule: boolean;           // MVP REQUIRED
    showStandings: boolean;          // MVP REQUIRED
    showBracket: boolean;            // MVP OPTIONAL
    showSponsors: boolean;           // V2 OPTIONAL
  };

  // ──────────────────────────────────────────
  // METADATA (MVP REQUIRED)
  // ──────────────────────────────────────────
  createdAtISO: string;              // MVP REQUIRED - ISO 8601 datetime
  updatedAtISO: string;              // MVP REQUIRED - ISO 8601 datetime
}

// === Supporting Types ===

interface ScheduleRow {
  time: string;                      // e.g., "10:00 AM"
  title: string;                     // e.g., "Registration Opens"
  description?: string;              // Optional details
}

interface StandingRow {
  rank: number;
  team: string;
  wins: number;
  losses: number;
  points?: number;
}

interface BracketTree {
  rounds: BracketRound[];
}

interface BracketRound {
  name: string;                      // e.g., "Quarterfinals"
  matches: BracketMatch[];
}

interface BracketMatch {
  id: string;
  team1: string | null;
  team2: string | null;
  score1?: number;
  score2?: number;
  winner?: string;
}

interface Sponsor {
  id: string;                        // V2 REQUIRED
  name: string;                      // V2 REQUIRED
  logoUrl: string;                   // V2 REQUIRED
  linkUrl?: string;                  // V2 OPTIONAL
  placement: 'poster' | 'display' | 'public' | 'tv-banner';
}
```

---

## MVP REQUIRED SUMMARY

These fields **MUST** be in the event object today (the bare minimum the platform must support):

### Identity
- `id`
- `slug`
- `name`
- `startDateISO`
- `venue`

### Links
- `links.publicUrl`
- `links.displayUrl`
- `links.posterUrl`
- `links.signupUrl`

### QR Codes
- `qr.public`
- `qr.signup`

### CTAs
- `ctas.primary.label`
- `ctas.primary.url`

### Settings
- `settings.showSchedule`
- `settings.showStandings`
- `settings.showBracket`

### Metadata
- `createdAtISO`
- `updatedAtISO`

---

## V2 OPTIONAL

These exist in the contract but are not required for MVP:

- `sponsors[]` - Full sponsor objects with placement
- `media` - Video, map, gallery URLs
- `externalData` - External standings/schedule/bracket URLs
- `analytics` - Event analytics data
- `payments` - Stripe integration
- `ctas.secondary` - Secondary CTA button
- `links.sharedReportUrl` - Shared analytics report URL
- `settings.showSponsors` - Sponsor visibility toggle

---

## RESERVED (Do Not Touch Until Ready)

These fields are defined but should remain exactly as specified:

- `payments.*` - Stripe payment integration
- `analytics.eventViews`
- `analytics.qrScans`
- Sponsor `placement` values
- External schedule/standings/bracket integration

---

## DEPRECATED (Remove)

Anything **NOT** listed in this contract should be removed from Code.gs, Admin, Public, Display, and Poster:

- Any legacy NextUp rows
- Any Eventbook/Flow fields
- Any TemplateService extras not in the contract
- Legacy sponsor models (without `placement`)
- Legacy analytics fields
- `formResponsesSheetId` unless used explicitly
- `templateId` for MVP
- `brandId` (moved to bundle/config level)
- `dateTime` (replaced by `startDateISO`)
- `location` / `venueName` (replaced by `venue`)
- `sections` object (replaced by `settings` flags)
- `ctaLabels[]` array (replaced by `ctas` object)
- `checkinUrl` / `feedbackUrl` (use `links.signupUrl`)
- `videoUrl` / `mapEmbedUrl` (moved to `media`)
- `summary` / `notes` / `audience` (not MVP required)

---

## Field Mapping: Storage → API

The backend stores events in a flat `data` JSON blob. This table shows how stored fields map to the API contract.

| API Field | Storage Field | Transform |
|-----------|---------------|-----------|
| `id` | row[0] | Direct |
| `slug` | row[5] or `data.slug` | Direct |
| `name` | `data.name` | Direct |
| `startDateISO` | `data.startDateISO` or `data.dateISO` | Direct (backward compat) |
| `venue` | `data.venue` or `data.location` or `data.venueName` | Direct (backward compat) |
| `links.*` | Generated | Computed at runtime |
| `qr.*` | Generated | Computed at runtime (base64 PNG) |
| `schedule` | `data.schedule` | Direct (array) |
| `standings` | `data.standings` | Direct (array) |
| `bracket` | `data.bracket` | Direct (object) |
| `ctas.primary` | `data.ctas.primary` or from `ctaLabels[0]` | Transform |
| `ctas.secondary` | `data.ctas.secondary` | Direct |
| `sponsors` | `data.sponsors` or hydrated from `data.sponsorIds` | Hydrate |
| `media` | `data.media` | Direct |
| `externalData` | `data.externalData` | Direct |
| `analytics` | `data.analytics` | Direct |
| `payments` | `data.payments` | Direct |
| `settings.showSchedule` | `data.settings?.showSchedule` or `data.sections?.schedule?.enabled` | Transform |
| `settings.showStandings` | `data.settings?.showStandings` or `data.sections?.standings?.enabled` | Transform |
| `settings.showBracket` | `data.settings?.showBracket` or `data.sections?.bracket?.enabled` | Transform |
| `settings.showSponsors` | `data.settings?.showSponsors` or `data.sections?.sponsors?.enabled` | Transform |
| `createdAtISO` | row[4] | Direct |
| `updatedAtISO` | `data.updatedAtISO` or row[4] | Direct |

---

## Default Values

When a field has no stored value, the API returns these defaults:

```javascript
const EVENT_DEFAULTS = {
  // Identity (MVP required - no defaults, must be provided)
  // id: required
  // slug: required
  // name: required
  // startDateISO: required
  // venue: required

  // Links (generated, no defaults needed)

  // QR (generated, no defaults needed)

  // Schedule/Standings/Bracket (MVP optional)
  schedule: null,
  standings: null,
  bracket: null,

  // CTAs
  ctas: {
    primary: {
      label: 'Sign Up',
      url: ''  // Must be set
    },
    secondary: null
  },

  // V2 Optional
  sponsors: null,
  media: null,
  externalData: null,
  analytics: null,
  payments: null,

  // Settings (MVP required)
  settings: {
    showSchedule: false,
    showStandings: false,
    showBracket: false,
    showSponsors: false
  },

  // Metadata
  // createdAtISO: set on creation
  // updatedAtISO: set on creation/update
};
```

---

## API Response Envelope

All API responses wrap the event in this envelope:

```typescript
// Success response (single event)
{
  ok: true,
  etag: string,
  value: Event
}

// List response
{
  ok: true,
  etag: string,
  value: {
    items: Event[],
    pagination: {
      total: number,
      limit: number,
      offset: number,
      hasMore: boolean
    }
  }
}

// Bundle response (for surfaces)
{
  ok: true,
  etag: string,
  value: {
    event: Event,
    config: {
      brandId: string,
      brandName: string,
      appTitle: string
    }
  }
}

// Error response
{
  ok: false,
  code: 'BAD_INPUT' | 'NOT_FOUND' | 'RATE_LIMITED' | 'INTERNAL' | 'UNAUTHORIZED',
  message: string
}
```

---

## Validation Rules

### Required Fields (MVP)
- `name`: Non-empty string, max 200 characters
- `startDateISO`: Valid ISO 8601 date (YYYY-MM-DD)
- `venue`: Non-empty string, max 200 characters
- `ctas.primary.label`: Non-empty string
- `ctas.primary.url`: Valid URL (can be relative or absolute)

### URL Fields
All URL fields must match pattern `^https?://.+` when provided:
- `links.*` (all link URLs)
- `ctas.primary.url`, `ctas.secondary.url`
- `sponsors[].logoUrl`, `sponsors[].linkUrl`
- `media.videoUrl`, `media.mapUrl`, `media.gallery[]`
- `externalData.*`
- `payments.checkoutUrl`

### String Sanitization
All text fields are sanitized to prevent XSS:
- HTML entities encoded
- Script tags stripped
- Max lengths enforced per field

---

## Surface Responsibilities

Each display surface uses specific fields:

| Surface | Fields Used |
|---------|-------------|
| **Admin** | All fields (full edit capability) |
| **Public** | `name`, `startDateISO`, `venue`, `links`, `qr`, `ctas`, `schedule`, `standings`, `sponsors` (if enabled), `media` |
| **Poster** | `name`, `startDateISO`, `venue`, `qr.public`, `qr.signup`, `sponsors` (poster placement only) |
| **Display** | `name`, `startDateISO`, `venue`, `schedule`, `standings`, `sponsors` (display/tv-banner placement), `ctas` |

---

## QR Code Generation

QR codes are generated at runtime and returned as base64-encoded PNG data URIs:

```javascript
// qr.public - Links to Public.html
generateQR(links.publicUrl) → "data:image/png;base64,..."

// qr.signup - Links to signup URL
generateQR(links.signupUrl) → "data:image/png;base64,..."
```

---

## Migration Notes

### Breaking Changes from v1.x
1. `dateTime` split → `startDateISO` (date only, time removed for MVP)
2. `location` + `venueName` → single `venue` field
3. `ctaLabels[]` array → `ctas` object with `primary`/`secondary`
4. `sections` object → `settings` boolean flags
5. `checkinUrl` / `feedbackUrl` removed (use `links.signupUrl`)
6. `videoUrl` / `mapEmbedUrl` → `media.videoUrl` / `media.mapUrl`
7. `brandId` / `templateId` removed from event object (in bundle config)
8. `reportUrl` → `sharedReportUrl` (V2 optional)
9. New `qr` object with generated QR codes

### Backward Compatibility
- Old `data.dateISO` still read, mapped to `startDateISO`
- Old `data.location` or `data.venueName` mapped to `venue`
- Old `data.ctaLabels[0]` mapped to `ctas.primary`
- Old `data.sections.*.enabled` mapped to `settings.show*`
- Old `data.sponsorIds` hydrated to full `sponsors` array

---

## Implementation Checklist

- [ ] `EVENT_CONTRACT.md` - This document (source of truth)
- [ ] `ApiSchemas.gs` - JSON Schema matches contract
- [ ] `Code.gs:EVENT_DEFAULTS_` - Defaults per contract
- [ ] `Code.gs:hydrateEvent_()` - Returns canonical shape
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

---

## Files Modified

| File | Changes |
|------|---------|
| `EVENT_CONTRACT.md` | Updated to v2.0.0 - Canonical MVP + V2-ready schema |
| `ApiSchemas.gs` | Updated - `events._eventShape` schema |
| `Code.gs` | Updated - `hydrateEvent_()`, `EVENT_DEFAULTS_` |
