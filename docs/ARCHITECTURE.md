# Architecture

**Style:** modular monolith, one deployable. `Controllers` (thin) -> `Services` (rules) -> `AppDbContext` (EF Core). No business logic in controllers.

```
Browser (React SPA) ──HTTPS──► IIS (ASP.NET Core Module, in-process)
                                 ├─ static UI (hashed assets, immutable cache)
                                 └─ /api/*  JWT-in-HttpOnly-cookie
                                     ├─ Services (Drawing, Request, Search, Master, Users, Bulk…)
                                     ├─ SQL Server (EF Core, migrations)
                                     ├─ Local file store  (App_Data/files — outside wwwroot)
                                     └─ Background workers: E-mail outbox · Bulk import · Housekeeping
```

## Data model (all IDs are prefixed NanoIDs)
`User` · `OtpChallenge` · `RefreshToken` · masters (`VehicleCategory`, `VehicleType`, `Make`, `ConnectorType`, `VoltagePreset`, `AhRating`, `VehicleModel` = make+type+category+model+capacity) · `Drawing` (+ `DrawingRevision`, `StoredFile`) · `DrawingRequest` (+ `RequestAttachment`, `RequestEvent`, `RequestComment`) · `Notification` · `EmailOutbox` · `AuditLog` · `AppSetting` · `TicketCounter` · `PortalDocument` · `BulkImportJob` / `BulkImportRowError`.

Key choices
* **Random NanoID primary keys are non-clustered**; each table's clustered index is `(CreatedAtUtc, Id)` so inserts append instead of page-splitting.
* `Drawing`: filtered unique index on `DrawingNumber` (soft-deleted rows excluded); covering index `(VoltageV, L, W, H) INCLUDE (AhValue, ModelId, Status)` serves the tolerance range scan; `(ModelId, VoltageV, AhValue)` serves exact match.
* Ah rating stored as `AhValue` + `AhStandard` (`""` or `DIN`) so `620` and `620(DIN)` are distinct, as in the BRD.
* Tickets: `DR-2026-000041` / `DM-…` from `TicketCounter` with optimistic concurrency (no gaps under load, no SQL SEQUENCE needed).

## Search
1. Exact: `ModelId, Voltage, AhValue, AhStandard, L, W, H` all equal (index seek).
2. Else range scan on voltage + L/W/H bands (index), then `SuggestionEngine.Rank` in memory on the small candidate set. Pure functions, unit-tested.

## Performance
Server-side paging (max 100) · projections (no entity tracking, no N+1) · one cached, ETag'd `/lookups/bootstrap` so cascading drop-downs need no round trips · `IMemoryCache` with version-bump invalidation · Brotli/gzip · lazy-loaded routes · hashed immutable assets · bulk import streams the sheet, batches of 500, throttled, single worker.

## E-mail (transactional outbox)
Business changes and their e-mails/notifications commit in one transaction. `EmailOutboxWorker` sends with exponential back-off (max 8 attempts) so an SMTP outage never loses mail or slows requests.
