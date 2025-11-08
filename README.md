# Zeventbook MVP (Events-only)

**Build:** mvp-v1.0-events-only  
**Date:** 20251107-194908

## What’s here
- Multi-tenant config (events-only flags)
- Uniform API envelopes, DIAG logging, idempotency, rate-limits
- SWR helper (etag + localStorage)
- Pages: Admin, Public, Poster, Test
- Styles: your patched `Styles.html` + DesignAdapter map

## Files to paste into Apps Script
- appsscript.json
- Config.gs
- Code.gs
- Styles.html
- NUSDK.html
- DesignAdapter.html
- Header.html
- Admin.html
- Public.html
- Poster.html
- Test.html

## Deploy
1. New Apps Script → add all files above (names must match).
2. Edit `Config.gs`: set real `adminSecret` values.
3. Deploy → New deployment → Web app → Execute as **User accessing**, Access **Anyone**.
4. Open `/exec?page=test` → all ✅.
5. Open `/exec?page=admin&p=events&tenant=root` → create an event → get Public/Poster links.

## Notes
- Poster shows a QR only when the server returns a verified `posterUrl`.
- `EVENTS` & `DIAG` sheets are created on-demand in the bound spreadsheet.
- Add tenants by extending `TENANTS` in `Config.gs`; later enable more scopes by adding `'leagues'` or `'tournaments'`.

