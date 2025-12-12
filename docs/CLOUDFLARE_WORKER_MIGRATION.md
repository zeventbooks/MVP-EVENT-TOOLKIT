# Cloudflare Worker Migration Plan

**Status: Phase 1 IMPLEMENTED**

## Overview

Replace the Apps Script (GAS) backend with a Cloudflare Worker API that talks directly to Google Sheets, without breaking:

- Existing routes: `stg.eventangle.com` / `eventangle.com`
- QR invariants: "If you show it, it works" / "Never show a QR unless verified"
- Event contracts (bundles, public page, display, poster)

## Implementation Status

**Phase 1 (Read-Only APIs): COMPLETE**
- [x] `/api/v2/status` - Worker-native health check
- [x] `/api/v2/events` - List events directly from Sheets
- [x] `/api/v2/events/:id` - Get single event from Sheets
- [x] `/api/v2/events/:id/bundle/public` - Public bundle
- [x] `/api/v2/events/:id/bundle/display` - Display bundle
- [x] `/api/v2/events/:id/bundle/poster` - Poster bundle

**Phase 2 (Write APIs): COMPLETE**
- [x] `POST /api/v2/events` - Create event (requires auth)
- [x] `PUT /api/v2/events/:id` - Update event (requires auth)

**Pending:**
- [ ] Configure secrets (GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, etc.)
- [ ] Deploy to staging
- [ ] Test with real Sheets data
- [ ] Analytics logging endpoints

## Target Architecture

```
Clients (Admin, Public, Display, Poster, SharedReport)
    │
    ▼
Cloudflare Worker (edge)
    ├── /api/v2/status      → Worker health check (NO GAS)
    ├── /api/v2/events      → List events from Sheets (NO GAS)
    ├── /api/v2/events/:id  → Get single event (NO GAS)
    ├── /api/v2/events/:id/bundle/:type → Bundles (NO GAS)
    ├── /api/* (legacy)     → Proxy to GAS (backwards compat)
    ├── /admin, /public, /display, /poster → HTML templates
    │
    ▼
Google Sheets API (via service account)
    ├── EVENTS sheet        → Event data (id, brandId, dataJSON, etc.)
    ├── ANALYTICS sheet     → Event tracking log
    ├── CONFIG sheet        → Brand configuration
    └── SHORTLINKS sheet    → URL shortening
```

## Security & Auth

### Service Account (Worker → Sheets)
Worker holds these secrets (via `wrangler secret put`):
- `GOOGLE_CLIENT_EMAIL` - Service account email
- `GOOGLE_PRIVATE_KEY` - Service account private key (PEM format)
- `SHEETS_SPREADSHEET_ID` - Target spreadsheet ID (or per-brand registry)

### Admin Auth (Client → Worker)
**Phase 1:** Shared admin API token
- Header: `Authorization: Bearer <ADMIN_TOKEN>`
- Token stored as Wrangler secret: `ADMIN_TOKEN`

**Phase 2 (future):** Per-venue keys / JWT / role rings

## Migration Phases

### Phase 1: Read-Only APIs (No GAS dependency for reads)
1. `/api/status` - Worker-native health check
2. `/api/events` - List events directly from Sheets
3. `/api/events/:id` - Get single event from Sheets
4. `/api/events/:id/bundle/public` - Public bundle
5. `/api/events/:id/bundle/display` - Display bundle
6. `/api/events/:id/bundle/poster` - Poster bundle

### Phase 2: Write APIs (Full GAS replacement)
1. `/api/events` (POST) - Create event
2. `/api/events/:id` (PUT) - Update event
3. `/api/analytics/log` - Log analytics events

### Phase 3: GAS Retirement
1. Remove GAS proxy routes
2. Delete GAS deployment
3. Update DNS/routing

## New API Design (v2 Endpoints)

All new endpoints use the `/api/v2/` prefix to avoid breaking existing GAS-proxied endpoints.

### GET /api/v2/status
Worker-native health check (no GAS, no auth required).

**Request:**
```bash
curl https://stg.eventangle.com/api/v2/status
```

**Response:**
```json
{
  "ok": true,
  "worker": {
    "version": "3.0.0",
    "env": "staging",
    "timestamp": "2025-12-12T10:00:00.000Z",
    "buildVersion": "stg-2025.12.12"
  },
  "sheets": {
    "configured": true,
    "connected": true,
    "latencyMs": 45
  },
  "health": {
    "worker": "healthy",
    "sheets": "healthy",
    "overall": "healthy"
  },
  "latencyMs": 52
}
```

### GET /api/v2/ping
Simple ping endpoint for uptime monitoring.

**Request:**
```bash
curl https://stg.eventangle.com/api/v2/ping
```

**Response:**
```json
{
  "ok": true,
  "pong": true,
  "timestamp": "2025-12-12T10:00:00.000Z"
}
```

### GET /api/v2/events
List all events for a brand.

**Query params:**
- `brand` (optional): Brand ID (root, abc, cbc, cbl). Defaults to "root"
- `full` (optional): Include full event data. Defaults to "false"

**Request:**
```bash
curl "https://stg.eventangle.com/api/v2/events?brand=root"
```

**Response:**
```json
{
  "ok": true,
  "value": [
    {
      "id": "EVT_123",
      "slug": "summer-tournament",
      "name": "Summer Tournament",
      "startDateISO": "2025-07-15",
      "venue": "Main Arena",
      "createdAtISO": "2025-06-01T10:00:00.000Z",
      "updatedAtISO": "2025-06-15T14:30:00.000Z"
    }
  ]
}
```

### GET /api/v2/events/:id
Get single event by ID or slug.

**Request:**
```bash
curl "https://stg.eventangle.com/api/v2/events/EVT_123?brand=root"
```

**Response:**
```json
{
  "ok": true,
  "value": {
    "id": "EVT_123",
    "slug": "summer-tournament",
    "name": "Summer Tournament",
    "startDateISO": "2025-07-15",
    "venue": "Main Arena",
    "links": {
      "publicUrl": "https://eventangle.com/events?id=summer-tournament",
      "displayUrl": "https://eventangle.com/display?id=summer-tournament",
      "posterUrl": "https://eventangle.com/poster?id=summer-tournament",
      "signupUrl": "https://forms.google.com/..."
    },
    "qr": {
      "public": "data:image/png;base64,...",
      "signup": "data:image/png;base64,..."
    },
    "ctas": {
      "primary": { "label": "Sign Up", "url": "https://..." }
    },
    "settings": {
      "showSchedule": true,
      "showStandings": true,
      "showBracket": false
    }
  },
  "etag": "W/\"2025-06-15T14:30:00.000Z\""
}
```

### GET /api/v2/events/:id/bundle/:type
Get bundle for specific surface (public, display, poster, admin).

**Bundle Types:**
- `public` - Full event data for public page
- `display` - Event data for TV/kiosk display
- `poster` - Event data with QR codes for printable poster
- `admin` - Full event data (requires auth)

**Request:**
```bash
curl "https://stg.eventangle.com/api/v2/events/EVT_123/bundle/public?brand=root"
```

**Response:**
```json
{
  "ok": true,
  "value": {
    "event": {
      "id": "EVT_123",
      "name": "Summer Tournament",
      ...
    },
    "config": {
      "brandId": "root",
      "brandName": "EventAngle",
      "appTitle": "Events",
      "features": {
        "sponsors": true,
        "analytics": true
      }
    }
  },
  "etag": "W/\"2025-06-15T14:30:00.000Z-public\""
}
```

### POST /api/v2/events
Create a new event (requires admin auth).

**Request:**
```bash
curl -X POST "https://stg.eventangle.com/api/v2/events" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer Tournament 2025",
    "startDateISO": "2025-07-15",
    "venue": "Main Arena",
    "brandId": "root",
    "signupUrl": "https://forms.google.com/..."
  }'
```

**Response:**
```json
{
  "ok": true,
  "value": {
    "id": "EVT_m1x2y3z4_abc123",
    "slug": "summer-tournament-2025",
    "name": "Summer Tournament 2025",
    ...
  }
}
```

### PUT /api/v2/events/:id
Update an existing event (requires admin auth).

**Request:**
```bash
curl -X PUT "https://stg.eventangle.com/api/v2/events/EVT_123" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer Tournament 2025 - Updated",
    "venue": "New Arena"
  }'
```

**Response:**
```json
{
  "ok": true,
  "value": {
    "id": "EVT_123",
    "name": "Summer Tournament 2025 - Updated",
    "venue": "New Arena",
    "updatedAtISO": "2025-12-12T10:00:00.000Z",
    ...
  },
  "etag": "W/\"2025-12-12T10:00:00.000Z\""
}
```

## Directory Structure

```
cloudflare-proxy/
├── worker.js           # Main entry (existing, will be refactored)
├── src/
│   ├── sheets/
│   │   ├── client.js   # Google Sheets API client
│   │   ├── auth.js     # Service account JWT auth
│   │   └── events.js   # Event-specific Sheet operations
│   ├── api/
│   │   ├── status.js   # Health check handler
│   │   ├── events.js   # Events API handlers
│   │   └── bundles.js  # Bundle API handlers
│   ├── utils/
│   │   ├── qr.js       # QR code generation (native)
│   │   ├── jwt.js      # JWT utilities
│   │   └── brand.js    # Brand configuration
│   └── middleware/
│       ├── auth.js     # Admin auth middleware
│       └── cors.js     # CORS handling
├── templates/          # HTML templates (existing)
└── wrangler.toml       # Configuration
```

## Wrangler Secrets

```bash
# Service account credentials
wrangler secret put GOOGLE_CLIENT_EMAIL --env staging
wrangler secret put GOOGLE_PRIVATE_KEY --env staging
wrangler secret put SHEETS_SPREADSHEET_ID --env staging

# Admin auth token
wrangler secret put ADMIN_TOKEN --env staging
```

## QR Code Generation

Since Google Charts API requires server-side fetch with credentials, we'll use a JavaScript QR library that works in Workers:

Option 1: `qrcode-generator` (pure JS, no dependencies)
Option 2: `@paulmillr/qr` (minimal, fast)

QR codes will be generated at event creation/update time and stored in the event data.

## Testing Strategy

1. **Unit tests:** Jest tests for Sheets client, JWT auth, QR generation
2. **Contract tests:** Validate API responses against schemas
3. **Integration tests:** Test actual Sheets API calls (staging only)
4. **E2E tests:** Playwright tests for full user flows

## Rollout Plan

1. Deploy Phase 1 to staging (`stg.eventangle.com`)
2. Run full test suite against staging
3. Shadow traffic: compare Worker responses to GAS responses
4. Gradual rollout to production (feature flag)
5. Monitor for 1 week
6. Remove GAS proxy routes
7. Delete GAS deployment

## Backwards Compatibility

During migration:
- `/api/rpc` endpoint continues to work (proxies to GAS)
- New `/api/events/*` endpoints run in parallel
- Feature flag `USE_WORKER_API` controls which path is used
- Templates can use either backend transparently
