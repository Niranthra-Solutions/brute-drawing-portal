# Security

| Area | Measure |
|---|---|
| Authentication | E-mail OTP: 6 digits from a CSPRNG, only an HMAC (keyed by server secret) stored, 5-min expiry, single use, 5 guesses/code, account lock-out (10 fails -> 15 min), 60 s resend cool-down, ≤6 codes/hour, identical response for unknown e-mails |
| Sessions | JWT (30 min) + rotating refresh token (8 h, hashed in DB, reuse = all sessions revoked) in **HttpOnly, SameSite=Strict, Secure** cookies — no token in JavaScript/localStorage |
| CSRF | SameSite=Strict **and** mandatory `X-Requested-With` on every state-changing `/api` call |
| Authorization | Secure-by-default fallback policy (everything needs sign-in); `AdminOnly` policy; resource checks (requests visible to owner + admins; attachments follow the request) |
| Input validation | DTO validation + service rules on every endpoint; 3–4 digit dimensions; drawing-number mask (no admin-supplied regex -> no ReDoS); problem+json errors with field names |
| SQL injection | EF Core parameterised queries only; no raw SQL |
| XSS | React escaping, no `dangerouslySetInnerHTML`, strict CSP (`script-src 'self'`), all e-mail values HTML-encoded |
| File uploads | Extension allow-list per purpose, **magic-byte** content check, size caps, server-generated names, stored outside web root, SHA-256, `nosniff`, `attachment` unless safe inline type, no SVG/HTML |
| Excel import | Size/row caps, `.xlsx` signature check, streamed read, CSV/formula-injection-safe error export, only URLs of this portal accepted (no SSRF, nothing fetched) |
| API protection | Rate limits (OTP request/verify, uploads, global per user/IP), request size limits, generic 500s with trace id |
| Headers | CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, HSTS (prod), no `Server` header |
| Auditing | Append-only audit log: sign-ins, lock-outs, drawing/request/master/settings/user changes, with IP |
| Secrets | JWT secret from environment; app refuses to start in Production with the placeholder |

Operational checklist: run behind HTTPS only · set `Jwt__Secret` (64 random chars) · disable the test admin · restrict the SQL login to the portal database · back up the DB **and** `App_Data/files` together · grant the app pool write access only to `App_Data` and `logs`.
