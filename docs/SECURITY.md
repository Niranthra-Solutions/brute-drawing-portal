# Security

| Area | Measure |
|---|---|
| Authentication | E-mail OTP: 6 digits from a CSPRNG, only an HMAC (keyed by server secret) stored, 5-min expiry, single use, 5 guesses/code, account lock-out (10 fails -> 15 min), 60 s resend cool-down, ≤6 codes/hour, identical response for unknown e-mails |
| Sessions | JWT (30 min) + rotating refresh token (8 h, hashed in DB, reuse = all sessions revoked) in **HttpOnly, SameSite=Strict, Secure** cookies — no token in JavaScript/localStorage |
| CSRF | SameSite=Strict **and** mandatory `X-Requested-With` on every state-changing `/api` call |
| Roles | Two roles only: **Admin** (Application Engineering) and **User** (Marketing and any other department added later). Roles are checked on the server, not only in the UI |
| Authorization | Secure-by-default fallback policy (everything needs sign-in); `Admin` policy for upload, edit, delete, master data, settings, users, audit; resource checks (requests visible to owner + admins; attachments follow the request; Marketing sees only Active drawings) |
| Business rules enforced server-side | A modification request is rejected unless the drawing is the **latest revision**; Ah rating type is only DIN or BS; request status changes follow the allowed workflow |
| Input validation | DTO validation + service rules on every endpoint; 3–4 digit dimensions; drawing-number mask (no admin-supplied regex -> no ReDoS); modification lookup accepts exactly 8 digits; problem+json errors with field names |
| SQL injection | EF Core parameterised queries for all data access. The only raw SQL is the fixed start-up schema upgrade for SQLite (`DbUpgrade`) and one index fix — constant strings, no user input |
| XSS | React escaping, no `dangerouslySetInnerHTML`, strict CSP (`script-src 'self'`), all e-mail values HTML-encoded |
| File uploads | Extension allow-list per purpose, **magic-byte** content check, size caps, server-generated names, stored outside web root, SHA-256, `nosniff`, `attachment` unless safe inline type, no SVG/HTML |
| Excel import | Size/row caps, `.xlsx` signature check, streamed read, CSV/formula-injection-safe error export, only URLs of this portal accepted (no SSRF, nothing fetched) |
| API protection | Rate limits (OTP request/verify, uploads, global per user/IP), request size limits, generic 500s with trace id |
| Headers | CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy, COOP, HSTS (prod), no `Server` header |
| Auditing | Append-only audit log: sign-ins, lock-outs, drawing/request/master/settings/user changes, with IP. Deleted drawings are soft-deleted and their audit record is kept |
| Secrets | JWT secret, database password and SMTP password come from environment variables (or a protected `appsettings.Production.json`), never from source control. The app refuses to start in Production with the placeholder JWT secret. If a secret was ever committed, rotate it |
| Test admin | A fixed-code test account exists for trials only. Set `Auth__TestAdmin__Enabled=false` before go-live; the app logs a warning while it is on |
| Containers | The Docker image runs as a non-root user, keeps data in the `/app/App_Data` volume, and generates a JWT secret on first start if none is supplied |

Operational checklist
* Run behind HTTPS only.
* Set `Jwt__Secret` (64 random characters), the database password and the SMTP password as environment variables; keep them out of git.
* Disable the test admin (`Auth__TestAdmin__Enabled=false`).
* Use `Email__Mode=Smtp` with real SMTP settings.
* Restrict the SQL login to the portal database (`db_owner` on that database only).
* Back up the database **and** the file store (`Storage__RootPath`, default `App_Data/files`) together; for SQLite also back up the `.db` file before every upgrade.
* Grant the IIS app pool identity **Modify** only on `App_Data`, `logs` and the file-store folder; **Read & Execute** on the rest.
* Keep .NET 8 patched (Windows Update / Hosting Bundle updates).