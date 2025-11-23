# Integration Flows

**Last Updated:** 2025-11-23
**Status:** MVP v1.0 - Focus Group Ready
**Story:** ZEVENT-004

---

## Overview

This document captures the wiring diagram between Admin surfaces, backend APIs (Code.gs), and output surfaces (Public/Display/Poster/Analytics). Use this as a reference when tracing data flow or debugging integration issues.

---

## Flow: Admin → Code.gs

The Admin surface (`Admin.html`) communicates with backend APIs in `Code.gs` via the NUSDK RPC client. All requests use the standard envelope pattern.

### APIs Used

| API | Purpose | Line |
|-----|---------|------|
| `api_getEventTemplates` | Fetch available templates for brand | Code.gs:1347 |
| `api_create` | Create new event | Code.gs:3816 |
| `api_get` | Retrieve single event | Code.gs:3053 |
| `api_updateEventData` | Update existing event | Code.gs:3869 |
| `api_createFormFromTemplate` | Generate Google Form from template | Code.gs:4766 |
| `api_generateFormShortlink` | Create trackable shortlink for form | Code.gs:4863 |

---

### api_getEventTemplates

**Purpose:** Retrieve available event templates for a brand.

**Payload:**
```javascript
{
  brandId: string,      // Optional - defaults from context
  ctx: { brandId }      // Alternative context parameter
}
```

**Response:**
```javascript
{
  ok: true,
  value: {
    items: [{
      id: string,           // 'bar_night', 'rec_league', 'school', 'fundraiser', 'custom'
      label: string,        // Human-readable label
      description: string,  // Template description
      icon: string,         // Emoji icon
      sections: { video, map, schedule, sponsors, notes, gallery },
      defaultCtas: string[],
      defaults: { audience, notesLabel, sponsorStripLabel }
    }],
    defaultTemplateId: string
  }
}
```

**Helpers:** `getBrandTemplateConfig_()`, `getTemplatesForBrand_()`

---

### api_create

**Purpose:** Create a new event (normalized to canonical Event structure).

**Payload:**
```javascript
{
  brandId: string,           // Required
  adminKey: string,          // Required - auth
  scope: string,             // 'events' | 'leagues' | 'tournaments' (default: 'events')
  templateId: string,        // Default: 'custom'
  idemKey: string,           // Idempotency key (optional)
  data: {
    name: string,            // REQUIRED (1-200 chars)
    startDateISO: string,    // REQUIRED (YYYY-MM-DD)
    venue: string,           // REQUIRED (1-200 chars)
    signupUrl: string,
    ctas: { primary: { label, url }, secondary: { label, url } },
    settings: { showSchedule, showStandings, showBracket, showSponsors },
    schedule: ScheduleRow[],
    sponsors: Sponsor[],
    media: { videoUrl, mapUrl, gallery }
  }
}
```

**Response:**
```javascript
{
  ok: true,
  etag: string,
  value: {
    id: string,              // UUID v4 (auto-generated)
    slug: string,            // URL slug (auto-generated from name)
    name: string,
    startDateISO: string,
    venue: string,
    links: { publicUrl, displayUrl, posterUrl, signupUrl, sharedReportUrl },
    qr: { public, signup },  // base64 PNG data URIs
    ctas: { primary, secondary },
    // ... full canonical Event per EVENT_CONTRACT.md v2.0
    createdAtISO: string,
    updatedAtISO: string
  }
}
```

**Helpers:** `gate_()`, `normalizeCreatePayloadToEvent_()`, `saveEvent_()`

---

### api_get

**Purpose:** Retrieve a single event by ID with full hydration.

**Payload:**
```javascript
{
  brandId: string,        // Required
  scope: string,          // 'events' | 'leagues' | 'tournaments'
  id: string,             // Event ID (required)
  ifNoneMatch: string     // ETag for caching (optional)
}
```

**Response:**
```javascript
{
  ok: true,
  etag: string,           // MD5 hash for caching
  notModified: boolean,   // true if ifNoneMatch matches (304 cache hit)
  value: {
    id: string,
    slug: string,
    name: string,
    startDateISO: string,
    venue: string,
    links: { publicUrl, displayUrl, posterUrl, signupUrl, sharedReportUrl },
    qr: { public, signup },
    schedule: ScheduleRow[] | null,
    standings: StandingRow[] | null,
    bracket: BracketTree | null,
    ctas: { primary, secondary },
    sponsors: Sponsor[],
    media: { videoUrl, mapUrl, gallery },
    externalData: { scheduleUrl, standingsUrl, bracketUrl },
    analytics: { enabled: boolean },
    payments: { enabled, provider, price, currency, checkoutUrl },
    settings: { showSchedule, showStandings, showBracket, showSponsors },
    createdAtISO: string,
    updatedAtISO: string
  }
}
```

**Helpers:** `getEventById_()`, `hydrateEvent_()`, `validateEventContract_()`

---

### api_updateEventData

**Purpose:** Update an existing event using Load-Merge-Save pattern.

**Payload:**
```javascript
{
  brandId: string,        // Required
  adminKey: string,       // Required - auth
  scope: string,          // 'events' | 'leagues' | 'tournaments'
  id: string,             // Event ID (required)
  data: {
    // Partial update - only include fields to change
    name: string,
    startDateISO: string,
    venue: string,
    ctas: { primary, secondary },
    settings: { ... },
    schedule: ScheduleRow[],
    sponsors: Sponsor[],
    media: { videoUrl, mapUrl, gallery }
  }
}
```

**Response:**
```javascript
{
  ok: true,
  etag: string,
  value: {
    // Full canonical Event with updates applied
    id: string,           // Immutable
    slug: string,         // Immutable
    name: string,
    // ... all fields from Event contract
    updatedAtISO: string  // Updated timestamp
  }
}
```

**Helpers:** `gate_()`, `getEventById_()`, `mergeEventUpdate_()`, `saveEvent_()`

---

### api_createFormFromTemplate

**Purpose:** Create a Google Form from a predefined template and link to an event.

**Payload:**
```javascript
{
  templateType: string,    // Required: 'sign-up', 'check-in', 'walk-in', 'survey'
  eventName: string,       // Event name for form title (optional)
  eventId: string,         // Event ID to associate (optional)
  adminKey: string,        // Required - auth
  brandId: string          // Default: 'root'
}
```

**Response:**
```javascript
{
  ok: true,
  value: {
    formId: string,           // Google Form ID
    editUrl: string,          // URL to edit form
    publishedUrl: string,     // Public form URL
    responseSheetUrl: string, // Google Sheet for responses
    templateType: string,     // Template used
    eventId: string           // Associated event ID
  }
}
```

**Form Templates:**

| Template | Description | Key Questions |
|----------|-------------|---------------|
| `sign-up` | Pre-registration | Name, Email, Phone, Attendees, Dietary, Source |
| `check-in` | Day-of check-in | Name, Email, Confirmation#, Party Size |
| `walk-in` | Walk-in registration | Name, Email, Phone, Party Size, Source |
| `survey` | Post-event feedback | Rating (1-5), Enjoyed, Improve, Recommend (NPS) |

**Helpers:** `gate_()`, `findFormTemplate_()`, `FormApp.create()`

---

### api_generateFormShortlink

**Purpose:** Generate a trackable shortlink for a form URL.

**Payload:**
```javascript
{
  formUrl: string,        // Required - full form URL (validated)
  formType: string,       // Form type label (optional)
  eventId: string,        // Event ID to associate (optional)
  adminKey: string,       // Required - auth
  brandId: string         // Default: 'root'
}
```

**Response:**
```javascript
{
  ok: true,
  value: {
    token: string,        // UUID shortlink token
    shortlink: string,    // Full shortlink URL (?p=r&t=<token>)
    targetUrl: string     // Original form URL
  }
}
```

**Helpers:** `isUrl()`, `api_createShortlink()`

---

## Flow: Code.gs → Public/Display/Poster

Output surfaces consume event data via `api_get` or `api_list`:

```
┌─────────────────────────────────────────────────────────────────┐
│  Admin.html                                                      │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │ api_create / api_updateEventData                            │ │
│  └──────────────────────────┬──────────────────────────────────┘ │
└─────────────────────────────┼───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Code.gs                                                         │
│  ┌─────────────┐   ┌─────────────┐   ┌─────────────────────────┐│
│  │ saveEvent_  │ → │ EVENTS      │ ← │ getEventById_ /         ││
│  │             │   │ Sheet       │   │ hydrateEvent_           ││
│  └─────────────┘   └─────────────┘   └─────────────────────────┘│
└─────────────────────────────┬───────────────────────────────────┘
                              │
         ┌────────────────────┼────────────────────┐
         │                    │                    │
         ▼                    ▼                    ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  Public.html    │  │  Display.html   │  │  Poster.html    │
│  ───────────────│  │  ───────────────│  │  ───────────────│
│  Mobile-first   │  │  TV/Kiosk mode  │  │  Print/QR view  │
│  event page     │  │  auto-rotate    │  │  sponsor strip  │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## Flow: Analytics Tracking

All surfaces log metrics to `AnalyticsService.gs`:

```
User Action → Surface → api_logMetric → ANALYTICS Sheet
                │
                ├── surface: 'public' | 'display' | 'poster' | 'sponsor'
                ├── metric: 'view' | 'click' | 'cta_click' | 'sponsor_click'
                ├── eventId: string
                ├── sponsorId: string (if applicable)
                └── sessionId: string (anonymous tracking)
```

**Analytics consumption:** `SharedReport.html` uses `api_getAnalyticsSummary` to aggregate metrics.

---

## Authentication & Error Handling

### Authentication

All write operations require `adminKey` validated via `gate_()`:
- Rate limited: 10 req/min per brand/IP
- Lockout: 15 minutes after 5 failed attempts

### Response Envelope

```javascript
// Success
{ ok: true, value: { ... }, etag: string }

// Error
{ ok: false, code: 'BAD_INPUT' | 'NOT_FOUND' | 'RATE_LIMITED' | 'INTERNAL', message: string }
```

---

## Related Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - System architecture overview
- **[MVP_SURFACES.md](./MVP_SURFACES.md)** - Frontend surfaces detail
- **[EVENT_CONTRACT.md](../src/mvp/EVENT_CONTRACT.md)** - Canonical Event schema

---

*Integration Flows - ZEVENT-004*
