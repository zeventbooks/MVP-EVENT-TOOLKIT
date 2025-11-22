# Event Contract v1.0

> **Single Source of Truth** for all event data shapes in Zeventbook.
> All backend code (`Code.gs`, `ApiSchemas.gs`) and frontend surfaces must conform to this contract.

## Contract Version

| Field | Value |
|-------|-------|
| Version | `1.0.0` |
| Last Updated | 2025-11-22 |
| Status | **ACTIVE** |

---

## Canonical Event Shape

The API always returns events in this exact shape. Fields that have no value are returned as `null` (never `undefined`, never omitted).

```typescript
interface Event {
  // === Envelope (system-managed) ===
  id: string;              // UUID, system-generated
  brandId: string;         // Brand identifier
  templateId: string;      // Template used to create this event

  // === Core Identity ===
  name: string;            // Event name (required)
  status: EventStatus;     // 'draft' | 'published' | 'cancelled' | 'completed'
  dateTime: string | null; // ISO 8601 datetime (e.g., "2025-08-15T18:00:00Z")
  location: string | null; // Human-readable location description
  venueName: string | null;// Venue name (separate from location for display)

  // === Content ===
  summary: string | null;  // Short description / tagline
  notes: string | null;    // Internal notes (admin-only, not shown publicly)
  audience: string | null; // Target audience description

  // === Sections (UI visibility toggles + content) ===
  sections: {
    video: SectionConfig | null;    // Video embed section
    map: SectionConfig | null;      // Map/directions section
    schedule: SectionConfig | null; // Schedule/agenda section
    sponsors: SectionConfig | null; // Sponsors section
    notes: SectionConfig | null;    // Public notes section
    gallery: SectionConfig | null;  // Photo gallery section
  };

  // === Call-to-Action Labels ===
  ctaLabels: CTALabel[];   // Customizable CTA button labels

  // === External Data Sources ===
  externalData: ExternalLeagueData;

  // === Media URLs ===
  videoUrl: string | null;    // Primary video URL (YouTube, Vimeo, etc.)
  mapEmbedUrl: string | null; // Google Maps embed URL

  // === Action URLs ===
  signupUrl: string | null;   // Pre-registration URL
  checkinUrl: string | null;  // Day-of check-in URL
  feedbackUrl: string | null; // Post-event survey URL

  // === Sponsors ===
  sponsors: Sponsor[];        // Resolved sponsor objects (not just IDs)

  // === Metadata (system-managed) ===
  createdAt: string;       // ISO 8601 datetime
  slug: string;            // URL-safe slug

  // === Generated Links (read-only) ===
  links: {
    publicUrl: string;     // Public event page
    posterUrl: string;     // Poster generation page
    displayUrl: string;    // TV/kiosk display page
    reportUrl: string;     // Analytics report page
  };
}

// === Supporting Types ===

type EventStatus = 'draft' | 'published' | 'cancelled' | 'completed';

/**
 * External league data links and provider metadata.
 * V1 Rules:
 * - All fields can be null
 * - URLs are stored as-is, no parsing/validation beyond URL format
 * - providerName only seeded by TemplateService for special templates (e.g. "OBL/BBN")
 */
interface ExternalLeagueData {
  // Core league links (generic)
  scheduleUrl: string | null;     // League/game schedule
  standingsUrl: string | null;    // Standings / ladder
  bracketUrl: string | null;      // Playoff bracket

  // Advanced / 3rd-party integrations (BocceLabs / BBN style)
  statsUrl: string | null;        // Stats hub (e.g., BocceLabs league page)
  scoreboardUrl: string | null;   // Live scoreboard / game center
  streamUrl: string | null;       // Live or VOD stream (BBN / YouTube / Twitch)

  // Source metadata (helps in V2)
  providerName: string | null;    // e.g. 'BocceLabs', 'BBN', 'Custom', 'None'
  providerLeagueId: string | null;// External league ID if known
}

interface SectionConfig {
  enabled: boolean;        // Whether section is visible
  title: string | null;    // Custom section title (uses default if null)
  content: string | null;  // Section-specific content/data
}

interface CTALabel {
  key: string;             // CTA identifier (e.g., 'signup', 'checkin')
  label: string;           // Display label (e.g., "Register Now")
  url: string | null;      // Override URL (uses default if null)
}

interface Sponsor {
  id: string;              // Sponsor ID
  name: string;            // Sponsor name
  logoUrl: string | null;  // Logo URL
  website: string | null;  // Sponsor website
  tier: string | null;     // Tier level (e.g., 'gold', 'silver', 'bronze')
}
```

---

## Field Mapping: Storage → API

The backend stores events in a flat `data` JSON blob. This table shows how stored fields map to the API contract.

| API Field | Storage Field | Transform |
|-----------|---------------|-----------|
| `id` | row[0] | Direct |
| `brandId` | row[1] | Direct |
| `templateId` | row[2] | Direct |
| `name` | `data.name` | Direct |
| `status` | `data.status` | Default: `'draft'` |
| `dateTime` | `data.dateISO` + `data.timeISO` | Combine to ISO datetime |
| `location` | `data.location` | Direct |
| `venueName` | `data.venueName` | Direct (NEW) |
| `summary` | `data.summary` | Direct |
| `notes` | `data.notes` | Direct (NEW) |
| `audience` | `data.audience` | Direct (NEW) |
| `sections` | `data.sections` | Object, defaults provided |
| `ctaLabels` | `data.ctaLabels` | Array, default: `[]` |
| `externalData` | `data.externalData` | Object |
| `videoUrl` | `data.videoUrl` | Direct |
| `mapEmbedUrl` | `data.mapEmbedUrl` | Direct (NEW) |
| `signupUrl` | `data.signupUrl` | Direct |
| `checkinUrl` | `data.checkinUrl` | Direct |
| `feedbackUrl` | `data.surveyUrl` | Rename from `surveyUrl` |
| `sponsors` | `data.sponsorIds` → resolve | Hydrate from sponsor store |
| `createdAt` | row[4] | Direct |
| `slug` | row[5] | Direct |
| `links` | Generated | Computed at runtime |

---

## Default Values

When a field has no stored value, the API returns these defaults:

```javascript
const EVENT_DEFAULTS = {
  status: 'draft',
  dateTime: null,
  location: null,
  venueName: null,
  summary: null,
  notes: null,
  audience: null,
  sections: {
    video: null,
    map: null,
    schedule: null,
    sponsors: null,
    notes: null,
    gallery: null
  },
  ctaLabels: [],
  externalData: {
    // Core league links
    scheduleUrl: null,
    standingsUrl: null,
    bracketUrl: null,
    // Advanced integrations
    statsUrl: null,
    scoreboardUrl: null,
    streamUrl: null,
    // Provider metadata
    providerName: null,
    providerLeagueId: null
  },
  videoUrl: null,
  mapEmbedUrl: null,
  signupUrl: null,
  checkinUrl: null,
  feedbackUrl: null,
  sponsors: []
};
```

---

## API Response Envelope

All API responses wrap the event in this envelope:

```typescript
// Success response
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

// Error response
{
  ok: false,
  code: 'BAD_INPUT' | 'NOT_FOUND' | 'RATE_LIMITED' | 'INTERNAL' | 'UNAUTHORIZED',
  message: string
}
```

---

## Validation Rules

### Required Fields
- `name`: Non-empty string, max 200 characters
- `dateTime`: Valid ISO 8601 datetime (when provided)

### URL Fields
All URL fields must match pattern `^https?://.+` when provided:
- `videoUrl`, `mapEmbedUrl`
- `signupUrl`, `checkinUrl`, `feedbackUrl`
- `externalData.scheduleUrl`, `externalData.standingsUrl`, `externalData.bracketUrl`
- `externalData.statsUrl`, `externalData.scoreboardUrl`, `externalData.streamUrl`
- `sponsors[].logoUrl`, `sponsors[].website`

### ExternalLeagueData Fields (V1 Rules)
- All fields are optional and nullable
- URL fields are stored as-is; no parsing or validation beyond URL format
- `providerName`: Free-form string (e.g., 'BocceLabs', 'BBN', 'Custom', 'None')
- `providerLeagueId`: Opaque external identifier, not validated
- TemplateService seeds `providerName` only for special templates (e.g., "OBL/BBN")

### String Sanitization
All text fields are sanitized to prevent XSS:
- HTML entities encoded
- Script tags stripped
- Max lengths enforced per field

---

## Migration Notes

### Breaking Changes from v0.x
1. `surveyUrl` renamed to `feedbackUrl`
2. `dateISO` + `timeISO` combined into single `dateTime`
3. `sponsorIds` (string) replaced with hydrated `sponsors` (array)
4. New required `status` field (defaults to `'draft'`)
5. New `sections` object for UI configuration
6. New `externalData` object for external integrations

### Backward Compatibility
- Old `data.surveyUrl` still read, mapped to `feedbackUrl`
- Old `data.dateISO`/`data.timeISO` combined automatically
- Old `data.sponsorIds` hydrated to full `sponsors` array
- Missing `status` defaults to `'draft'`

---

## Surface Responsibilities

Each display surface uses specific fields:

| Surface | Fields Used |
|---------|-------------|
| **Public** | All except `notes` (admin-only) |
| **Poster** | `name`, `dateTime`, `location`, `venueName`, `summary`, `sponsors` |
| **Display** | `name`, `dateTime`, `location`, `sponsors`, `sections.schedule` |
| **Admin** | All fields |
| **Report** | `id`, `name`, `dateTime`, `sponsors` + analytics |

---

## Implementation Checklist

- [x] `EVENT_CONTRACT.md` - This document (source of truth)
- [x] `ApiSchemas.gs` - JSON Schema matches contract
- [x] `Code.gs:api_get()` - Returns full shape with null defaults
- [x] `Code.gs:api_list()` - Returns full shape for each item
- [x] `Code.gs:api_getPublicBundle()` - Returns full shape
- [x] `Config.gs:TEMPLATES` - Field definitions align with contract

**Gate**: Do not modify Public/Display/Poster until all three backend files agree.

## Files Modified

| File | Changes |
|------|---------|
| `EVENT_CONTRACT.md` | Created - Canonical event shape definition |
| `ApiSchemas.gs` | Updated - `events._eventShape` schema with all fields |
| `Code.gs` | Added `hydrateEvent_()`, `hydrateSponsorIds_()`, `EVENT_DEFAULTS_` |
| `Config.gs` | Updated TEMPLATES with new fields, bumped CONTRACT_VER to 1.0.0 |
