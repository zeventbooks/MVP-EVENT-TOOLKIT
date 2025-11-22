# Test Matrix

> **Accurate as of November 2025**
>
> This matrix reflects actual tests in the repository. No inflated numbers.

## Test Counts Summary

| Layer | Test Files | Tests | Status |
|-------|------------|-------|--------|
| Unit | 15 | ~512 | ✅ |
| Contract | 12 | ~155 | ✅ |
| E2E | 37+ | varies | ✅ (Playwright) |

---

## Feature Coverage by Test Layer

### Event Creation & Management

| Layer | File | Tests | Coverage |
|-------|------|-------|----------|
| [unit] | `template-service.test.js` | 29 | applyTemplateToEvent_, SectionConfig, CTALabel |
| [contract] | `template-flows.contract.test.js` | 30 | All 5 templates: bar_night, rec_league, school, fundraiser, custom |
| [contract] | `api.contract.test.js` | ~40 | api_create, api_update, api_getPublicBundle |
| [e2e] | `admin-page.spec.js` | varies | Admin UI event CRUD |

### Template System (EVENT_CONTRACT.md v1.0)

| Layer | File | Tests | Coverage |
|-------|------|-------|----------|
| [unit] | `template-service.test.js` | 29 | Template defaults, section/CTA assignment, idempotency |
| [contract] | `template-flows.contract.test.js` | 30 | Bar Night flow, Rec League flow, Fundraiser/School flow, Custom flow |
| [contract] | `api.contract.test.js` | ~15 | EVENT_CONTRACT.md v1.0 compliance (SectionConfig, CTALabel, Sponsor) |

### Sponsor Display

| Layer | File | Tests | Coverage |
|-------|------|-------|----------|
| [unit] | `sponsor-utils.test.js` | 28 | esc() XSS, filterByPlacement(), carousel logic, analytics |
| [contract] | `template-flows.contract.test.js` | 8 | Sponsor rendering across Public/Display/Poster |
| [e2e] | `sponsor-page.spec.js` | varies | Sponsor CRUD UI |

### Public Page

| Layer | File | Tests | Coverage |
|-------|------|-------|----------|
| [contract] | `template-flows.contract.test.js` | 10 | sectionEnabled(), CTA buttons, sponsor badges |
| [e2e] | `public-page.spec.js` | varies | Public event view, responsive |

### Display Page (TV)

| Layer | File | Tests | Coverage |
|-------|------|-------|----------|
| [contract] | `template-flows.contract.test.js` | 6 | Sponsor top/side, league overlay |
| [e2e] | `display-page.spec.js` | varies | Display carousel, sponsor rotation |

### Poster Page

| Layer | File | Tests | Coverage |
|-------|------|-------|----------|
| [contract] | `template-flows.contract.test.js` | 5 | Sponsor strip, QR codes |
| [e2e] | `poster-page.spec.js` | varies | Poster render, print layout |

### Security

| Layer | File | Tests | Coverage |
|-------|------|-------|----------|
| [unit] | `security.test.js` | ~20 | Input validation, XSS prevention |
| [contract] | `jwt-security.contract.test.js` | ~15 | JWT validation, auth flows |
| [e2e] | `security-smoke.spec.js` | varies | Auth smoke tests |

### API Endpoints

| Layer | File | Tests | Coverage |
|-------|------|-------|----------|
| [unit] | `backend.test.js` | ~50 | Core backend functions |
| [contract] | `all-endpoints.contract.test.js` | ~30 | All public API endpoints |
| [e2e] | `api/events-crud-api.spec.js` | varies | Full API integration |

---

## Test Files by Directory

### Unit Tests (`tests/unit/`)

```
template-service.test.js     29 tests - Template application, EVENT_CONTRACT compliance
sponsor-utils.test.js        28 tests - XSS, filtering, analytics
backend.test.js             ~50 tests - Core backend logic
security.test.js            ~20 tests - Security validations
forms.test.js               ~15 tests - Form utilities
validation.test.js          ~15 tests - Input validation
multi-brand.test.js         ~20 tests - Multi-brand logic
config.test.js              ~10 tests - Config utilities
+ 7 more files
```

### Contract Tests (`tests/contract/`)

```
template-flows.contract.test.js    30 tests - Template flow contracts (NEW)
api.contract.test.js              ~40 tests - API contract compliance
jwt-security.contract.test.js     ~15 tests - JWT security contracts
all-endpoints.contract.test.js    ~30 tests - Endpoint contracts
api-client.contract.test.js       ~10 tests - Client contracts
+ triangle/* tests
```

### E2E Tests (`tests/e2e/`)

```
1-smoke/          Critical smoke tests (auth, API, security)
2-pages/          Per-page tests (admin, public, display, poster, sponsor)
3-flows/          User flow tests (admin-flows, customer-flows, template-scenarios)
api/              API integration tests
scenarios/        Full user scenarios
```

---

## Running Tests

```bash
# All unit tests
npm test -- tests/unit

# All contract tests
npm test -- tests/contract

# Specific template tests
npm test -- tests/unit/template-service.test.js
npm test -- tests/contract/template-flows.contract.test.js

# E2E (requires Playwright)
npm run test:e2e
```

---

## CI Gate Coverage

**Stage 1 (Fast):** Unit + Contract tests
- Event schema validation (SectionConfig, CTALabel, Sponsor)
- Template application correctness
- API contract compliance

**Stage 2 (E2E):** Playwright browser tests
- Admin → Public → Display → Poster flows
- Cross-browser compatibility
- Responsive design

---

## What's NOT Tested (Known Gaps)

- Google Forms integration (external service)
- QR code generation (visual output)
- Real email/SMS delivery
- Production Apps Script runtime

---

*Last updated: November 2025*
