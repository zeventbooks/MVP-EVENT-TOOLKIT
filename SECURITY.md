# Security Considerations

This document outlines security considerations, known limitations, and recommended best practices for the MVP-EVENT-TOOLKIT.

## Known Security Limitations

### 1. Admin Session Tokens (Bug #15 mitigation)

**Issue:** The platform previously stored raw admin keys in `sessionStorage`, exposing long‑lived credentials to any XSS defect.

**Current State:** All privileged surfaces now exchange the admin key for a short‑lived session token via `api_createAdminSession`. The browser only stores the opaque `token:xyz` handle plus its expiration timestamp, and the server revokes it automatically when the cache entry expires.

**Residual Risk:** The token still lives in sessionStorage (Apps Script does not support HTTP-only cookies), so XSS remains the primary threat. Tokens last 5–60 minutes instead of indefinitely, reducing blast radius for stolen secrets.

**Mitigations in Place:**
1. ✅ `api_createAdminSession` issues tenant-scoped tokens with enforced TTL and metadata logging
2. ✅ Front-end pages purge legacy `ADMIN_KEY:*` entries and store only the short-lived session token
3. ✅ `gate_()` validates either the admin key or a cached session token and rejects expired/mismatched tenants
4. ✅ Rate limiting and lockouts still apply when exchanging the admin key for a token
5. ✅ Diagnostics/Admin/Sponsor UI automatically invalidate sessions and prompt for re-auth when the token expires

**Recommended Additional Measures:**
- Keep rotating admin keys via `npm run secrets:sync` (session tokens inherit the server-side secret)
- Enable Content Security Policy + strict sanitization to minimize XSS vectors
- Monitor `ops/security/admin-secret-rotation.json` and the new session issuance logs for anomalies

**Future Improvements:**
- Add MFA or OAuth brokering once Apps Script is replaced with a server that supports HTTP-only cookies
- Store the session state in an external datastore to allow server-side revocation lists

### 2. Multi-Tenant Database Separation (Bug #11)

**Issue:** All tenants share the same spreadsheet with logical separation only

**Risk:** A critical bug in tenant filtering could expose data across tenants

**Mitigations in Place:**
1. ✅ Tenant ID validation on every request
2. ✅ Filter by tenantId in all data queries
3. ✅ Comprehensive tests for cross-tenant access prevention
4. ✅ Analytics queries isolated by tenant

**Recommended for Production:**
- Physical database separation per tenant
- Separate spreadsheets per tenant
- Database-level row-level security

### 3. Apps Script Platform Limitations

**General Limitations:**
- No support for HTTP-only cookies
- No support for server-side sessions
- No database-level query filtering (loads all data then filters in-memory)
- Limited control over HTTP security headers
- No support for WebSockets or real-time features

**Workarounds:**
- Pagination support added to limit memory usage (Bug #50)
- User-friendly error messages to avoid information disclosure (Bug #48)
- Comprehensive input validation and sanitization
- ETag-based caching to reduce data transfer

## Security Features Implemented

### Automated Secret Management
- ✅ `npm run secrets:sync` pushes admin secrets directly to Script Properties via the Apps Script Execution API (no manual copy/paste)
- ✅ `ops/security/admin-secret-rotation.json` tracks the last rotation timestamp per tenant so audits have proof
- ✅ Enforcement policy rejects weak secrets (length < 16, missing upper/lower/number, or containing banned words)
- ✅ Rotation log updates on every sync, enabling scripted reminders + CI enforcement

### Input Validation & Sanitization
- ✅ XSS prevention via `sanitizeInput_()` function
- ✅ SQL injection prevention via `sanitizeId_()` validation
- ✅ Formula injection prevention via `sanitizeSpreadsheetValue_()`
- ✅ URL validation with protocol checks (javascript:, data:, file: blocked)
- ✅ Comprehensive regex validation for all user inputs

### Authentication & Authorization
- ✅ Admin key validation via `gate_()` function
- ✅ Short-lived admin session tokens minted via `api_createAdminSession`
- ✅ JWT implementation with algorithm verification (HS256 only)
- ✅ Token expiration and not-before (nbf) validation
- ✅ Timing-safe signature comparison
- ✅ Tenant-scoped authentication

### CSRF Protection
- ✅ CSRF tokens required for all POST requests
- ✅ Token validation before processing mutations
- ✅ Origin validation for API requests

### Rate Limiting
- ✅ Per-tenant rate limiting
- ✅ Progressive backoff on repeated failures
- ✅ Configurable rate limit thresholds

### Data Protection
- ✅ Tenant isolation in all queries
- ✅ Sensitive data redaction in logs (adminKey, tokens, passwords)
- ✅ ETag support for efficient caching
- ✅ Input length validation to prevent DoS

### Open Redirect Prevention
- ✅ Warning page for external redirects (Bug #1)
- ✅ Hostname validation against tenant whitelist
- ✅ URL sanitization before redirects

### CORS Configuration
- ✅ Origin validation against tenant hostnames (Bug #16)
- ✅ Localhost allowed for development
- ✅ Google domains allowed for Apps Script execution

## Security Testing

### Unit Tests
- 372 unit tests covering all security fixes
- Tests for XSS, CSRF, SQL injection, formula injection
- JWT security tests (algorithm verification, expiration, nbf)
- Cross-tenant isolation tests

### E2E Tests
- 261+ E2E tests covering security workflows
- Authentication and authorization flows
- Input validation on all forms
- CSRF protection verification

## Incident Response

If you discover a security vulnerability:

1. **DO NOT** open a public GitHub issue
2. Contact the maintainers privately
3. Provide detailed information:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
   - Suggested fix (if any)

## Security Checklist for Deployment

Before deploying to production:

- [ ] Rotate all admin keys
- [ ] Run `npm run secrets:sync` and commit the updated rotation log
- [ ] Enable rate limiting
- [ ] Configure CORS allowed origins
- [ ] Set up monitoring and alerting
- [ ] Review diagnostic logs for sensitive data
- [ ] Test all authentication flows
- [ ] Verify tenant isolation
- [ ] Run full security test suite
- [ ] Enable HTTPS-only access
- [ ] Document admin key rotation policy
- [ ] Set up regular security audits

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Google Apps Script Security Best Practices](https://developers.google.com/apps-script/guides/security)
- [BUG_CATALOG.md](./BUG_CATALOG.md) - Full list of identified and fixed security issues

---

**Last Updated:** 2025-11-15
**Security Test Coverage:** 372 unit tests, 261+ E2E tests
**Known Critical Issues:** 0 (all addressed with mitigations)
