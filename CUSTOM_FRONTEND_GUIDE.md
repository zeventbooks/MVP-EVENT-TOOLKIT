# Building Custom Frontends with MVP Event Toolkit

## 🎯 Overview

The MVP Event Toolkit now supports **BOTH** architectures:

1. **Built-in HTML Pages** - Use `google.script.run` (current Admin/Public/Display pages)
2. **REST API** - Build custom frontends in React, Vue, Angular, mobile apps, etc.

This gives you maximum flexibility to build the UI that fits your needs!

---

## 🚀 Quick Start

### 1. Get Your API URL

After deploying your Apps Script:

```
https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec
```

### 2. Test the API

```bash
# Health check
curl "https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?action=status"

# List events
curl "https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec?action=list&tenant=root&scope=events"
```

### 3. Build Your Frontend!

See examples below for React, Vue, vanilla JavaScript, and mobile apps.

---

## 📋 API Reference

### Public Endpoints (No Auth Required)

#### GET Status
```
GET {BASE_URL}?action=status
```
Response:
```json
{
  "ok": true,
  "value": {
    "build": "mvp-v1.0-events-only",
    "contract": "v1",
    "dbOk": true,
    "tenant": "root"
  }
}
```

#### GET Configuration
```
GET {BASE_URL}?action=config&tenant=root&scope=events
```

#### GET List Events
```
GET {BASE_URL}?action=list&tenant=root&scope=events&etag=abc123
```
Response:
```json
{
  "ok": true,
  "value": {
    "items": [
      {
        "id": "evt_123",
        "data": {
          "eventName": "Summer Concert",
          "eventDate": "2025-07-15",
          "eventTime": "19:00"
        },
        "publicUrl": "https://script.google.com/.../exec?...",
        "posterUrl": "https://script.google.com/.../exec?...",
        "displayUrl": "https://script.google.com/.../exec?..."
      }
    ],
    "etag": "xyz789"
  }
}
```

#### GET Single Event
```
GET {BASE_URL}?action=get&tenant=root&scope=events&id=evt_123
```

---

### Admin Endpoints (Require Auth)

All admin operations use **POST** with JSON body containing `adminKey`.

#### POST Create Event
```bash
curl -X POST "{BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "tenantId": "root",
    "adminKey": "YOUR_ADMIN_SECRET",
    "scope": "events",
    "templateId": "Event",
    "data": {
      "eventName": "Summer Concert Series",
      "eventDate": "2025-07-15",
      "eventTime": "19:00",
      "locationName": "Central Park"
    }
  }'
```

#### POST Update Event
```bash
curl -X POST "{BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "update",
    "tenantId": "root",
    "adminKey": "YOUR_ADMIN_SECRET",
    "scope": "events",
    "id": "evt_123",
    "data": {
      "eventName": "Updated Event Name"
    }
  }'
```

#### POST Get Analytics Report
```bash
curl -X POST "{BASE_URL}" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "getReport",
    "tenantId": "root",
    "adminKey": "YOUR_ADMIN_SECRET",
    "eventId": "evt_123",
    "startDate": "2025-01-01",
    "endDate": "2025-12-31"
  }'
```

---

## 💻 React Example

### Setup API Client

```javascript
// src/api/eventApi.js
const BASE_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
const ADMIN_KEY = process.env.REACT_APP_ADMIN_KEY;

class EventApi {
  // Public endpoints
  async getStatus() {
    const res = await fetch(`${BASE_URL}?action=status`);
    return res.json();
  }

  async listEvents(tenant = 'root', scope = 'events', etag = '') {
    const params = new URLSearchParams({ action: 'list', tenant, scope });
    if (etag) params.append('etag', etag);

    const res = await fetch(`${BASE_URL}?${params}`);
    return res.json();
  }

  async getEvent(id, tenant = 'root', scope = 'events') {
    const params = new URLSearchParams({ action: 'get', tenant, scope, id });
    const res = await fetch(`${BASE_URL}?${params}`);
    return res.json();
  }

  // Admin endpoints
  async createEvent(data) {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create',
        tenantId: 'root',
        adminKey: ADMIN_KEY,
        scope: 'events',
        templateId: 'Event',
        data
      })
    });
    return res.json();
  }

  async updateEvent(id, data) {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update',
        tenantId: 'root',
        adminKey: ADMIN_KEY,
        scope: 'events',
        id,
        data
      })
    });
    return res.json();
  }

  async getReport(eventId, startDate, endDate) {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'getReport',
        tenantId: 'root',
        adminKey: ADMIN_KEY,
        eventId,
        startDate,
        endDate
      })
    });
    return res.json();
  }

  async logEvent(eventId, surface, metric, sponsorId = '', value = 1) {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'logEvents',
        items: [{
          eventId,
          surface,
          metric,
          sponsorId,
          value,
          token: ''
        }]
      })
    });
    return res.json();
  }
}

export default new EventApi();
```

### React Component

```jsx
// src/components/EventList.jsx
import React, { useState, useEffect } from 'react';
import eventApi from '../api/eventApi';

function EventList() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      setLoading(true);
      const result = await eventApi.listEvents();

      if (result.ok) {
        setEvents(result.value.items);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading events...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="event-list">
      <h1>Events</h1>
      {events.map(event => (
        <div key={event.id} className="event-card">
          <h2>{event.data.eventName}</h2>
          <p>📅 {event.data.eventDate} at {event.data.eventTime}</p>
          <p>📍 {event.data.locationName}</p>
          <a href={event.publicUrl} target="_blank" rel="noopener noreferrer">
            View Event →
          </a>
        </div>
      ))}
    </div>
  );
}

export default EventList;
```

### Create Event Form

```jsx
// src/components/CreateEventForm.jsx
import React, { useState } from 'react';
import eventApi from '../api/eventApi';

function CreateEventForm() {
  const [formData, setFormData] = useState({
    eventName: '',
    eventDate: '',
    eventTime: '',
    locationName: '',
    locationCity: '',
    description: ''
  });
  const [status, setStatus] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('Creating...');

    const result = await eventApi.createEvent(formData);

    if (result.ok) {
      setStatus('✅ Event created!');
      console.log('New event:', result.value);
      // Reset form
      setFormData({
        eventName: '',
        eventDate: '',
        eventTime: '',
        locationName: '',
        locationCity: '',
        description: ''
      });
    } else {
      setStatus(`❌ Error: ${result.message}`);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Create Event</h2>

      <input
        type="text"
        placeholder="Event Name"
        value={formData.eventName}
        onChange={e => setFormData({...formData, eventName: e.target.value})}
        required
      />

      <input
        type="date"
        value={formData.eventDate}
        onChange={e => setFormData({...formData, eventDate: e.target.value})}
        required
      />

      <input
        type="time"
        value={formData.eventTime}
        onChange={e => setFormData({...formData, eventTime: e.target.value})}
        required
      />

      <input
        type="text"
        placeholder="Location"
        value={formData.locationName}
        onChange={e => setFormData({...formData, locationName: e.target.value})}
        required
      />

      <textarea
        placeholder="Description"
        value={formData.description}
        onChange={e => setFormData({...formData, description: e.target.value})}
      />

      <button type="submit">Create Event</button>
      {status && <p>{status}</p>}
    </form>
  );
}

export default CreateEventForm;
```

---

## 🎨 Vue.js Example

### API Service

```javascript
// src/services/eventService.js
import axios from 'axios';

const BASE_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';
const ADMIN_KEY = process.env.VUE_APP_ADMIN_KEY;

export default {
  async listEvents(tenant = 'root', scope = 'events') {
    const { data } = await axios.get(BASE_URL, {
      params: { action: 'list', tenant, scope }
    });
    return data;
  },

  async getEvent(id, tenant = 'root', scope = 'events') {
    const { data } = await axios.get(BASE_URL, {
      params: { action: 'get', tenant, scope, id }
    });
    return data;
  },

  async createEvent(eventData) {
    const { data } = await axios.post(BASE_URL, {
      action: 'create',
      tenantId: 'root',
      adminKey: ADMIN_KEY,
      scope: 'events',
      templateId: 'Event',
      data: eventData
    });
    return data;
  },

  async updateEvent(id, eventData) {
    const { data } = await axios.post(BASE_URL, {
      action: 'update',
      tenantId: 'root',
      adminKey: ADMIN_KEY,
      scope: 'events',
      id,
      data: eventData
    });
    return data;
  }
};
```

### Vue Component

```vue
<!-- src/components/EventList.vue -->
<template>
  <div class="event-list">
    <h1>Events</h1>

    <div v-if="loading">Loading...</div>
    <div v-else-if="error" class="error">{{ error }}</div>

    <div v-else class="events">
      <div v-for="event in events" :key="event.id" class="event-card">
        <h2>{{ event.data.eventName }}</h2>
        <p>📅 {{ event.data.eventDate }} at {{ event.data.eventTime }}</p>
        <p>📍 {{ event.data.locationName }}</p>
        <a :href="event.publicUrl" target="_blank">View Event →</a>
      </div>
    </div>
  </div>
</template>

<script>
import eventService from '@/services/eventService';

export default {
  name: 'EventList',
  data() {
    return {
      events: [],
      loading: true,
      error: null
    };
  },
  async mounted() {
    await this.loadEvents();
  },
  methods: {
    async loadEvents() {
      try {
        this.loading = true;
        const result = await eventService.listEvents();

        if (result.ok) {
          this.events = result.value.items;
        } else {
          this.error = result.message;
        }
      } catch (err) {
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.event-card {
  border: 1px solid #ddd;
  padding: 1rem;
  margin: 1rem 0;
  border-radius: 8px;
}
</style>
```

---

## 📱 Mobile App Example (React Native)

```javascript
// src/api/eventApi.js
const BASE_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

export const listEvents = async () => {
  const response = await fetch(`${BASE_URL}?action=list&tenant=root&scope=events`);
  return response.json();
};

export const createEvent = async (eventData, adminKey) => {
  const response = await fetch(BASE_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'create',
      tenantId: 'root',
      adminKey,
      scope: 'events',
      templateId: 'Event',
      data: eventData
    })
  });
  return response.json();
};

// EventListScreen.js
import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { listEvents } from '../api/eventApi';

export default function EventListScreen() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const result = await listEvents();
      if (result.ok) {
        setEvents(result.value.items);
      }
    } catch (error) {
      console.error('Error loading events:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <ActivityIndicator size="large" />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={events}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.title}>{item.data.eventName}</Text>
            <Text>📅 {item.data.eventDate} at {item.data.eventTime}</Text>
            <Text>📍 {item.data.locationName}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  card: {
    backgroundColor: 'white',
    padding: 16,
    marginBottom: 12,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2
  },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 }
});
```

---

## 🌐 Vanilla JavaScript Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Event Viewer</title>
</head>
<body>
  <h1>Upcoming Events</h1>
  <div id="events"></div>

  <script>
    const BASE_URL = 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec';

    async function loadEvents() {
      try {
        const response = await fetch(`${BASE_URL}?action=list&tenant=root&scope=events`);
        const result = await response.json();

        if (result.ok) {
          displayEvents(result.value.items);
        } else {
          document.getElementById('events').innerHTML = `<p>Error: ${result.message}</p>`;
        }
      } catch (error) {
        console.error('Error:', error);
      }
    }

    function displayEvents(events) {
      const html = events.map(event => `
        <div class="event-card">
          <h2>${event.data.eventName}</h2>
          <p>📅 ${event.data.eventDate} at ${event.data.eventTime}</p>
          <p>📍 ${event.data.locationName}</p>
          <a href="${event.publicUrl}" target="_blank">View Event →</a>
        </div>
      `).join('');

      document.getElementById('events').innerHTML = html;
    }

    // Load events on page load
    loadEvents();
  </script>

  <style>
    .event-card {
      border: 1px solid #ddd;
      padding: 1rem;
      margin: 1rem 0;
      border-radius: 8px;
    }
  </style>
</body>
</html>
```

---

## 🔐 Security Best Practices

### 1. Never Expose Admin Keys in Frontend Code

❌ **Bad:**
```javascript
const ADMIN_KEY = 'my-secret-key'; // Don't do this!
```

✅ **Good:**
```javascript
// Use environment variables
const ADMIN_KEY = process.env.REACT_APP_ADMIN_KEY;

// Or prompt user to login
const ADMIN_KEY = await authenticateUser();
```

### 2. Use HTTPS Only

Always use `https://` URLs, never `http://`.

### 3. Validate Responses

```javascript
const result = await eventApi.listEvents();
if (!result.ok) {
  // Handle error
  console.error('API Error:', result.code, result.message);
  return;
}
// Use result.value
```

### 4. Rate Limiting

The API has built-in rate limiting (20 requests/minute per tenant). Handle rate limit errors gracefully:

```javascript
if (result.code === 'RATE_LIMITED') {
  alert('Too many requests. Please wait a moment.');
}
```

---

## 📊 Analytics Integration

Track user interactions in your custom frontend:

```javascript
// Track page views
await eventApi.logEvent('evt_123', 'custom-app', 'view');

// Track sponsor clicks
await eventApi.logEvent('evt_123', 'custom-app', 'click', 'SPONSOR_1');

// Track dwell time
await eventApi.logEvent('evt_123', 'custom-app', 'dwell', '', 45); // 45 seconds
```

---

## 🧪 Testing Your Integration

### 1. Test with Postman

Import the Postman collection: `postman-collection.json`

### 2. Test with curl

```bash
# List events
curl "https://script.google.com/.../exec?action=list&tenant=root&scope=events"

# Create event
curl -X POST "https://script.google.com/.../exec" \
  -H "Content-Type: application/json" \
  -d '{"action":"create","tenantId":"root","adminKey":"YOUR_KEY","scope":"events","templateId":"Event","data":{"eventName":"Test Event","eventDate":"2025-07-15"}}'
```

### 3. Use Browser DevTools

Open your custom app → F12 → Network tab → See all API requests

---

## 📖 Next Steps

1. **Deploy your backend** - See [DEPLOYMENT.md](./DEPLOYMENT.md)
2. **Import Postman collection** - See [postman-collection.json](./postman-collection.json)
3. **Read API documentation** - See [POSTMAN_API_TESTING.md](./POSTMAN_API_TESTING.md)
4. **Build your frontend!** - Use examples above

---

## 💡 Architecture Benefits

### Dual Interface Support

```
┌─────────────────────────┐
│   Your Custom Frontend  │
│   (React/Vue/Mobile)    │
└───────────┬─────────────┘
            │
            │ REST API (GET/POST)
            ▼
┌─────────────────────────┐
│   Apps Script Backend   │
│   (Code.gs)             │
└───────────┬─────────────┘
            │
            │ google.script.run
            ▼
┌─────────────────────────┐
│   Built-in HTML Pages   │
│   (Admin/Public/Display)│
└─────────────────────────┘
```

**Both work simultaneously!** You can:
- Use built-in pages for quick admin work
- Build custom mobile app for end users
- Create React dashboard for analytics
- All using the same backend

---

## 🆘 Support

- **API Issues:** Check [POSTMAN_API_TESTING.md](./POSTMAN_API_TESTING.md)
- **Testing:** See [TESTING.md](./TESTING.md)
- **Deployment:** See [DEPLOYMENT.md](./DEPLOYMENT.md)
- **Architecture:** See [ARCHITECTURE_REVIEW.md](./ARCHITECTURE_REVIEW.md)

---

**Happy building!** 🚀
