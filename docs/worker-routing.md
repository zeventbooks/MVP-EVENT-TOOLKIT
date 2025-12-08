# Worker Routing & HTML Asset Wiring

**Date:** 2025-12-08
**Author:** Discovery / Story 1
**Purpose:** Map current Worker routing & asset loading for /events diagnosis

---

## Architecture Overview

```
                  +-----------------------+
                  |   eventangle.com/*    |
                  +-----------+-----------+
                              |
                              v
                  +-----------+-----------+
                  |  Cloudflare Worker    |
                  |  cloudflare-proxy/    |
                  |     worker.js         |
                  +-----------+-----------+
                              |
               +--------------+--------------+
               |              |              |
               v              v              v
         [HTML Routes]  [JSON Routes]  [Static/Stub]
               |              |              |
               v              v              v
          GAS doGet      GAS doPost     Worker-gen
          (proxy)        (proxy)        (local)
               |              |
               v              v
         HtmlService   ContentService
```

**Worker Entry File:** `cloudflare-proxy/worker.js` (v1.5.0)

---

## Route Categories

### 1. HTML-Returning Routes (Proxied to GAS)

| URL Pattern | Aliases | `?page=` Value | GAS Template | Handler |
|-------------|---------|----------------|--------------|---------|
| `/events` | `/schedule`, `/calendar` | `public` | `Public.html` | `proxyPageRequest()` |
| `/manage` | `/admin`, `/dashboard`, `/create`, `/docs` | `admin` | `Admin.html` | `proxyPageRequest()` |
| `/display` | `/tv`, `/kiosk`, `/screen` | `display` | `Display.html` | `proxyPageRequest()` |
| `/poster` | `/posters`, `/flyers` | `poster` | `Poster.html` | `proxyPageRequest()` |
| `/analytics` | `/reports`, `/insights`, `/stats` | `report` | `SharedReport.html` | `proxyPageRequest()` |
| `/` (root, no page param) | - | `public` (default) | `Public.html` | `proxyPageRequest()` |

**Path-to-Page Mapping (worker.js:123-154):**
```javascript
const CANONICAL_PATH_TO_PAGE = {
  'events': 'public',
  'schedule': 'public',
  'calendar': 'public',
  'manage': 'admin',
  'admin': 'admin',
  'dashboard': 'admin',
  'create': 'admin',
  'docs': 'admin',
  'display': 'display',
  'tv': 'display',
  'kiosk': 'display',
  'screen': 'display',
  'poster': 'poster',
  'posters': 'poster',
  'flyers': 'poster',
  'analytics': 'report',
  'reports': 'report',
  'insights': 'report',
  'stats': 'report',
  'status': 'status',
  'health': 'status',
  'ping': 'ping',
  'api': 'api'
};
```

### 2. JSON-Returning Routes (Proxied to GAS)

| URL Pattern | Handler | Response |
|-------------|---------|----------|
| `?page=status` or `/status` | GAS `api_statusPure()` | JSON status |
| `?page=ping` or `/ping` | GAS (simple) | `{"status":"ok"}` |
| `?action=*` | GAS `doPost()` via `proxyToAppsScript()` | JSON API response |
| `POST /api/rpc` | `handleRpcRequest()` → GAS | JSON RPC response |
| `POST /api/<path>` | `handleApiRequest()` → GAS | JSON API response |

**Whitelisted API Actions (worker.js:90-117):**
```javascript
const CANONICAL_API_ACTIONS = [
  'api_status', 'api_statusPure', 'api_events', 'api_eventById', 'api_sponsors',
  'api_createEvent', 'api_updateEvent', 'api_deleteEvent', 'api_uploadImage',
  'api_displayData', 'api_nextEvent', 'api_posterData', 'api_reportData',
  'api_analytics', 'list', 'getPublicBundle', 'getSponsorReportQr',
  'getSharedAnalytics', 'getSharedReportBundle'
];
```

### 3. Routes Handled Locally by Worker (NOT proxied)

| URL Pattern | Handler | Response |
|-------------|---------|----------|
| `/static/*` | `Response.redirect()` | 302 to `script.google.com/static/*` |
| `/wardeninit*`, `/warden*`, `/jserror*`, `/_/*` | Stub response | `)]}'` + `[]` (Google internal endpoints) |
| Unknown routes | `create404Response()` | Worker-generated 404 HTML |
| Unknown API actions | `create404Response()` | Worker-generated 404 JSON |

### 4. Brand-Prefixed Routes

| Pattern | Example | Resolved |
|---------|---------|----------|
| `/{brand}/{alias}` | `/abc/events` | brand=abc, page=public |
| `/{brand}/{alias}` | `/cbc/manage` | brand=cbc, page=admin |

**Valid Brands (worker.js:159):**
```javascript
const VALID_BRANDS = ['root', 'abc', 'cbc', 'cbl'];
```

---

## `/events` Route - Current Behavior

### Worker Processing Flow

```
1. Request: GET https://eventangle.com/events
                    |
                    v
2. Worker receives request
   - URL parsed: pathname = '/events', search = ''
                    |
                    v
3. validateRoute() called (worker.js:834)
   - First segment: 'events'
   - isValidPathSegment('events') → true (maps to 'public')
   - Returns: { valid: true, isApiRequest: false }
                    |
                    v
4. proxyPageRequest() called (worker.js:866)
   - Strips /events prefix
   - Adds ?page=public
   - Target: https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?page=public
                    |
                    v
5. GAS doGet(e) receives request
   - e.parameter.page = 'public'
   - routePage_(e, 'public', brand, demoMode, {})
   - HtmlService.createTemplateFromFile('Public')
                    |
                    v
6. Response: Public.html rendered by GAS
```

### Key Code Paths

**Worker - Route Validation (worker.js:579-639):**
```javascript
function validateRoute(url) {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return { valid: true, isApiRequest }; // Root

  const firstSegment = segments[0].toLowerCase();
  if (!isValidPathSegment(firstSegment)) {
    return { valid: false, reason: `Unknown path: ${pathname}`, isApiRequest };
  }
  return { valid: true, isApiRequest };
}
```

**Worker - Page Proxy (worker.js:940-1005):**
```javascript
async function proxyPageRequest(request, appsScriptBase, url, env) {
  // Build query params, adding page= if not present
  const params = new URLSearchParams(url.search);
  if (!params.has('page')) {
    const firstSegment = url.pathname.split('/').filter(Boolean)[0] || 'events';
    const mappedPage = CANONICAL_PATH_TO_PAGE[firstSegment];
    if (mappedPage && mappedPage !== 'api') {
      params.set('page', mappedPage);
    }
  }
  // Proxy to GAS
  const targetUrl = `${appsScriptBase}${queryString}`;
  const response = await fetch(targetUrl, {...});
  return response;
}
```

**GAS - Page File Mapping (Code.gs:1724-1734):**
```javascript
function pageFile_(page){
  if (page==='admin') return 'Admin';
  if (page==='poster') return 'Poster';
  if (page==='display') return 'Display';
  if (page==='report' || page==='analytics') return 'SharedReport';
  return 'Public';  // Default
}
```

### Current Status

| Question | Answer |
|----------|--------|
| Is `/events` proxied to GAS? | **YES** - via `proxyPageRequest()` |
| Is it hitting a fallback route? | **NO** - explicitly handled by `CANONICAL_PATH_TO_PAGE['events'] = 'public'` |
| What template is served? | `Public.html` (via GAS `pageFile_('public')`) |
| Can it return GAS HTML? | **YES** - this is the normal flow |

---

## Template Loading Mechanism

### How Templates Are Loaded (GAS-side)

1. **Template Files Location:** `src/mvp/*.html`
   - `Admin.html` - Event management dashboard
   - `Public.html` - Public event listing
   - `Display.html` - TV/kiosk display
   - `Poster.html` - Printable poster
   - `SharedReport.html` - Analytics/sponsor report

2. **Loading Method:** GAS `HtmlService.createTemplateFromFile()`
   ```javascript
   // Code.gs:1200
   const tpl = HtmlService.createTemplateFromFile(pageFile_(page));
   ```

3. **Template Includes:** Partial HTML files included via `<?!= include('FileName') ?>`
   - `Header.html` - Page header
   - `Styles.html` - CSS styles
   - `FooterComponent.html` - Page footer
   - `NUSDK.html` - SDK scripts

4. **Template Variables Injected:**
   ```javascript
   tpl.appTitle = brand.name + ' · ' + scope;
   tpl.brandId = brand.id;
   tpl.scope = scope;
   tpl.execUrl = ScriptApp.getService().getUrl();
   tpl.ZEB = ZEB;  // Global config
   tpl.demoMode = demoMode;
   tpl.brand = brand;
   tpl.brandFeatures = getBrandFeatures_(brand.id);
   ```

### Template Type Summary

| Loading Method | Description |
|----------------|-------------|
| Bundled strings? | **NO** |
| KV / R2? | **NO** |
| Imported assets? | **NO** |
| GAS HtmlService? | **YES** - templates are `.html` files in GAS project |

---

## Routes That Can Return GAS HTML

| Route | Returns GAS HTML | Condition |
|-------|------------------|-----------|
| `/events` | YES | Always |
| `/manage` | YES | Always |
| `/display` | YES | Always |
| `/poster` | YES | Always |
| `/analytics` | YES | If brand feature `sharedReportEnabled` = true |
| `/?page=*` | YES | If page is valid MVP surface |
| `/{brand}/{alias}` | YES | If alias resolves to HTML page |

---

## Fallback / Error Handling

### Unknown Route (Worker-side 404)

If a route is not in `CANONICAL_PATH_TO_PAGE` or `VALID_BRANDS`:

```javascript
// worker.js:836-850
if (!validation.valid) {
  const corrId = generateCorrId();
  return create404Response(url, validation.isApiRequest, corrId);
}
```

**Result:** Worker-generated 404 HTML (NOT proxied to GAS)

### GAS-side Surface Blocking

If page param is not a valid MVP surface:

```javascript
// Code.gs:1151-1157
if (pageParam && !_isMvpSurface_(pageParam)) {
  return HtmlErrorWithCorrId_(
    'Surface Not Available',
    `Surface "${pageParam}" is not enabled in this build`
  );
}
```

**Valid MVP Surfaces (Code.gs:1687-1689):**
```javascript
function _listMvpSurfaces_() {
  return ['admin', 'public', 'display', 'poster', 'report'];
}
```

---

## GAS Blue Banner Detection

### What Is the "GAS Blue Banner"?

When Google Apps Script returns HTML directly (not through the Worker proxy), the page may include Google's infrastructure banners, typically containing:
- Google Apps Script domain references
- `script.google.com` in URLs
- Google's error/warning styling

### Detection Markers

To detect if a response is coming directly from GAS vs. through the Worker proxy, check for:

1. **Response Headers:**
   - Worker adds: `X-Proxied-By: eventangle-worker`
   - Worker adds: `X-Worker-Version: 1.5.0`

2. **HTML Content Markers:**
   - GAS direct: May contain `script.google.com` URLs in HTML
   - GAS direct: May contain Google's blue-banner error page styling

3. **URL Patterns:**
   - Worker-proxied: URL stays as `eventangle.com/events`
   - GAS direct: URL would redirect to `script.google.com/macros/s/.../exec`

---

## Configuration Reference

### Environment Variables (wrangler.toml)

| Variable | Purpose |
|----------|---------|
| `GAS_DEPLOYMENT_BASE_URL` | Full GAS exec URL (preferred) |
| `DEPLOYMENT_ID` | GAS deployment ID (fallback) |
| `UPSTREAM_TIMEOUT_MS` | Timeout for GAS requests (default: 30000ms) |
| `ERROR_LOG_ENDPOINT` | External error logging URL (optional) |

### Deployment Environments

| Environment | Domain | Config |
|-------------|--------|--------|
| Production | `eventangle.com/*` | `[env.production]` |
| Staging | `stg.eventangle.com/*` | `[env.staging]` |
| API-only | `api.eventangle.com/*` | `[env.api-only]` |
| Development | `*.workers.dev` | Default |

---

## Summary

1. **Worker Role:** Transparent proxy - routes requests to GAS, adds headers, handles CORS
2. **Template Loading:** GAS `HtmlService.createTemplateFromFile()` - templates are `.html` files in GAS project
3. **`/events` Path:** Explicitly handled, proxied to GAS with `?page=public`, returns `Public.html`
4. **Fallback Behavior:** Unknown routes return Worker-generated 404 (NOT proxied to GAS)
5. **All HTML pages are served by GAS** - Worker does not generate any page HTML except error pages
