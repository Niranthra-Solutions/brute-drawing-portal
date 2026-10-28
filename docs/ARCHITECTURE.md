# Architecture

**Style:** modular monolith, one deployable. `Controllers` (thin) -> `Services` (rules) -> `AppDbContext` (EF Core). No business logic in controllers.

```
Browser (React SPA) ──HTTPS──► IIS (ASP.NET Core Module, in-process)   [or the Docker container on :8080]
                                 ├─ static UI (hashed assets, immutable cache)
                                 └─ /api/*  JWT-in-HttpOnly-cookie
                                     ├─ Services (Drawing, Request, Search, Master, Users, Bulk…)
                                     ├─ SQL Server (EF Core migrations)  or  SQLite (trial / small installs)
                                     ├─ Local file store  (App_Data/files — outside wwwroot)
                                     └─ Background workers: E-mail outbox · Bulk import · Housekeeping
```

## Data model (all IDs are prefixed NanoIDs)
`User` · `OtpChallenge` · `RefreshToken` · masters (`VehicleCategory`, `VehicleType`, `Make`, `ConnectorType`, `VoltagePreset`, `AhRating`, `VehicleModel` = make+type+category+model+capacity) · **`ModelBattery`** (vehicle model → voltage → optional Ah rating) · `Drawing` (+ `DrawingRevision`, `StoredFile`) · `DrawingRequest` (+ `RequestAttachment`, `RequestEvent`, `RequestComment`) · `Notification` · `EmailOutbox` · `AuditLog` · `AppSetting` · `TicketCounter` · `PortalDocument` · `BulkImportJob` / `BulkImportRowError`.

Key choices
* **Random NanoID primary keys are non-clustered**; each table's clustered index is `(CreatedAtUtc, Id)` so inserts append instead of page-splitting.
* **Simple serial numbers.** `Drawing.Serial` and `VehicleModel.Serial` (1, 2, 3 …) are shown to users instead of the long internal id. They are assigned on insert (highest + 1, never reused) inside `AppDbContext.SaveChanges`; the NanoID stays the real key.
* **Revisions are separate drawings.** Revision B of `25 600 007 A` is its own `Drawing` row (`25 600 007 B`) for the same model with its own file; earlier revisions stay untouched and downloadable. A "family" = same `ModelId` + number without the trailing letter; the **latest revision** is the highest letter. Only the latest can be modified (enforced in `RequestService`, flagged as `IsLatest` in the API).
* `Drawing`: the drawing number is **not unique** on its own (one number may serve several makes/models); the duplicate rule is number + model + voltage + Ah (+ standard). Covering index `(VoltageV, L, W, H) INCLUDE (AhValue, ModelId, Status)` serves the tolerance range scan; `(ModelId, VoltageV, AhValue)` serves exact match.
* Ah rating stored as `AhValue` + `AhStandard` (`""`, `DIN` or `BS`) so `620` and `620(DIN)` are distinct, as in the BRD.
* **Vehicle ↔ Voltage/Ah links (`ModelBattery`).** Each model lists the voltages it uses and the Ah ratings OEM-specified per voltage. They travel in the cached bootstrap payload (`models[].specs`) so the search drop-downs work client-side: Voltage only after the vehicle is chosen (linked voltages only); Ah only after the voltage, grouped "OEM Specified" then "Non-Standard Ratings" (DIN, then BS, then others). Saving a drawing, or a bulk import, adds the missing link automatically.
* Tickets: `DR-2026-000041` / `DM-…` from `TicketCounter` with optimistic concurrency (no gaps under load, no SQL SEQUENCE needed).

## Search
1. Exact: `ModelId, Voltage, AhValue, AhStandard, L, W, H` all equal (index seek).
2. Else range scan on voltage + L/W/H bands (index), then `SuggestionEngine.Rank` in memory on the small candidate set. Pure functions, unit-tested. Results show the drawing's ID and a fit %. The fit-% formula is ours and is pending the client's own formula.
3. Search results have no Modify button. A modification starts only from the Modification Request page: type the 8 digits → **Find Drawing** (`GET /api/drawings/by-number/revisions`) lists every revision per vehicle → only the latest can be selected.

## Database upgrades
* **SQL Server:** EF migrations (`Data/Migrations`, applied at start when `Database:AutoMigrate=true`; `database/schema.sql` is the same as an idempotent script). The latest one is `SerialNumbersAndModelBatteries` (adds serials, numbers existing rows, creates `ModelBatteries`).
* **SQLite:** created with `EnsureCreated`, which never alters an existing file, so `Data/DbUpgrade.cs` runs at start: adds the missing columns/table, numbers existing rows, and links each model to the voltage/Ah its drawings already use. It is idempotent.

## Performance
Server-side paging (max 100) · projections (no entity tracking, no N+1) · one cached, ETag'd `/lookups/bootstrap` so cascading drop-downs need no round trips · `IMemoryCache` with version-bump invalidation (bumped when masters or links change) · Brotli/gzip · lazy-loaded routes · hashed immutable assets · bulk import streams the sheet, batches of 500, throttled, single worker.

## E-mail (transactional outbox)
Business changes and their e-mails/notifications commit in one transaction. `EmailOutboxWorker` sends with exponential back-off (max attempts set by `Email:MaxAttempts`) so an SMTP outage never loses mail or slows requests.

## Requests
Dashboard cards "Open requests" / "My open requests" and "Completed (30 d)" link to the request list through the `scope` filter (`open`, `completed30`). Saving an uploaded drawing against a request closes the ticket and e-mails the requester.