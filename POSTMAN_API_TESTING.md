# API Testing with Postman

## ⚠️ Important: API Architecture Limitation

The **MVP Event Toolkit** uses **Google Apps Script's `google.script.run`** architecture, which means most API functions are **NOT directly accessible via HTTP/REST**.

### How the API Works

```
┌─────────────────┐
│  HTML Frontend  │
│  (Admin.html)   │
└────────┬────────┘
         │
         │ google.script.run.api_list()
         │ google.script.run.api_create()
         ▼
┌─────────────────┐
│  Apps Script    │
│  Backend        │
│  (Code.gs)      │
└─────────────────┘
```

**Key Point:** `google.script.run` is a special Apps Script RPC mechanism that:
- Only works from HTML pages served by the same Apps Script project
- Cannot be called directly via HTTP/REST clients like Postman
- Handles authentication and authorization automatically

---

## ✅ Endpoints You CAN Test with Postman

### 1. Status Endpoint (GET)

**URL:**
```
https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?page=status
```

**Method:** `GET`

**Headers:**
```
None required
```

**Response:**
```json
{
  "ok": true,
  "value": {
    "build": "mvp-v1.0-events-only",
    "contract": "v1",
    "dbOk": true,
    "tenant": "root",
    "uptime": "OK"
  }
}
```

**Postman Setup:**
1. Create new GET request
2. Set URL: `https://script.google.com/macros/s/{YOUR_DEPLOYMENT_ID}/exec?page=status`
3. No auth required
4. Click Send

---

### 2. Shortlink Redirect (GET)

**URL:**
```
https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?page=r&t={TOKEN}
```

**Method:** `GET`

**Parameters:**
- `page=r` - Redirect page
- `t={token}` - Shortlink token

**Response:**
```html
<meta http-equiv="refresh" content="0;url=https://example.com">
<p>Redirecting...</p>
```

**Postman Setup:**
1. Create new GET request
2. Set URL with token parameter
3. Postman will follow redirects automatically
4. Check final URL in response

---

## ❌ Endpoints You CANNOT Test with Postman

These require `google.script.run` and are only callable from the HTML frontend:

- ❌ `api_list()` - List events
- ❌ `api_get()` - Get single event
- ❌ `api_create()` - Create event (requires admin key)
- ❌ `api_updateEventData()` - Update event
- ❌ `api_logEvents()` - Log analytics
- ❌ `api_getReport()` - Get analytics report
- ❌ `api_createShortlink()` - Create shortlink
- ❌ `api_getConfig()` - Get configuration

---

## 🔧 Alternative Testing Methods

### Option 1: Use the Test.html Page

The app includes a built-in test page with diagnostics:

**URL:**
```
https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?page=test
```

This page:
- ✅ Tests all API endpoints
- ✅ Validates responses
- ✅ Shows OK/ERR status
- ✅ Includes timing information

**In Postman:**
1. GET the test page URL
2. You'll receive the HTML page
3. Open it in a browser to see test results

### Option 2: Automated E2E Tests (Recommended)

Use the Playwright E2E tests that are already set up:

```bash
# Set deployment URL
export BASE_URL="https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec"
export ADMIN_KEY="your_admin_secret"

# Run all E2E tests
npm run test:e2e

# Run specific test file
npx playwright test tests/e2e/test-page.spec.js
```

These tests:
- ✅ Call all API functions via the HTML pages
- ✅ Validate responses
- ✅ Check error handling
- ✅ Test admin workflows

### Option 3: Browser DevTools

1. Open the Admin page: `{BASE_URL}?page=admin&p=events&tenant=root`
2. Open Browser DevTools Console (F12)
3. Call API functions directly:

```javascript
// List events
google.script.run
  .withSuccessHandler(data => console.log('Success:', data))
  .withFailureHandler(err => console.error('Error:', err))
  .api_list({
    tenantId: 'root',
    scope: 'events',
    adminKey: 'YOUR_ADMIN_KEY'
  });

// Create event
google.script.run
  .withSuccessHandler(data => console.log('Created:', data))
  .withFailureHandler(err => console.error('Error:', err))
  .api_create({
    tenantId: 'root',
    adminKey: 'YOUR_ADMIN_KEY',
    scope: 'events',
    templateId: 'Event',
    data: {
      eventName: 'Test Event',
      eventDate: '2025-12-01',
      eventTime: '18:00',
      locationName: 'Test Venue'
    }
  });

// Get status
google.script.run
  .withSuccessHandler(data => console.log('Status:', data))
  .api_status();
```

### Option 4: Create a REST Wrapper

If you need REST API access, you could modify the `doGet` function to add HTTP API routes:

```javascript
// Add to doGet() in Code.gs
if (e.parameter.action) {
  const action = e.parameter.action;

  if (action === 'list') {
    const result = api_list({
      tenantId: e.parameter.tenant || 'root',
      scope: e.parameter.scope || 'events',
      adminKey: e.parameter.adminKey,
      etag: e.parameter.etag
    });
    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // Similar for other actions...
}
```

**Then test with Postman:**
```
GET {BASE_URL}?action=list&tenant=root&scope=events&adminKey=SECRET
```

⚠️ **Security Warning:** This exposes admin keys in URLs (visible in logs). Use POST with body instead.

---

## 📋 Postman Collection Template

Here's a minimal Postman collection for the available endpoints:

```json
{
  "info": {
    "name": "MVP Event Toolkit",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "base_url",
      "value": "https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec"
    }
  ],
  "item": [
    {
      "name": "Status - Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}?page=status",
          "host": ["{{base_url}}"],
          "query": [
            {
              "key": "page",
              "value": "status"
            }
          ]
        }
      }
    },
    {
      "name": "Shortlink Redirect",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{base_url}}?page=r&t=abc123",
          "host": ["{{base_url}}"],
          "query": [
            {
              "key": "page",
              "value": "r"
            },
            {
              "key": "t",
              "value": "abc123"
            }
          ]
        }
      }
    }
  ]
}
```

---

## 🎯 Recommended Testing Workflow

1. **Unit/Contract Tests (Jest)** - Test backend logic in isolation
   ```bash
   npm test
   ```

2. **E2E Tests (Playwright)** - Test complete user workflows
   ```bash
   npm run test:e2e
   ```

3. **Manual Testing** - Use Test.html page in browser
   ```
   Open: {BASE_URL}?page=test
   ```

4. **Smoke Tests** - Use status endpoint in Postman/curl
   ```bash
   curl "{BASE_URL}?page=status"
   ```

---

## 📊 Test Coverage

| Testing Method | Unit | Contract | E2E | Manual |
|----------------|------|----------|-----|--------|
| Jest | ✅ 73 | ✅ 21 | ❌ | ❌ |
| Playwright | ❌ | ❌ | ✅ 15+ | ❌ |
| Browser DevTools | ❌ | ✅ | ✅ | ✅ |
| Postman | ❌ | ⚠️ Limited | ❌ | ✅ |
| Test.html | ❌ | ✅ | ✅ | ✅ |

**Legend:**
- ✅ Full support
- ⚠️ Limited/partial support
- ❌ Not applicable

---

## 🔐 Security Note

If you add HTTP/REST endpoints for Postman testing:

1. **Never use GET for admin operations** - Use POST with body
2. **Don't put admin keys in URLs** - They're logged everywhere
3. **Add CORS headers** if calling from web apps
4. **Consider OAuth** instead of admin keys in URLs
5. **Rate limit aggressively** on public endpoints

---

## 📖 Related Documentation

- [TESTING.md](./TESTING.md) - Full test infrastructure
- [TEST_INFRASTRUCTURE_SUMMARY.md](./TEST_INFRASTRUCTURE_SUMMARY.md) - 94 tests documented
- [E2E_TESTING_GUIDE.md](./E2E_TESTING_GUIDE.md) - Playwright testing guide
- [DEPLOYMENT.md](./DEPLOYMENT.md) - Get deployment URL

---

**Last Updated:** 2025-11-10
**Status:** Apps Script uses `google.script.run`, not REST API
**Alternative:** Use E2E tests (Playwright) or Test.html page
