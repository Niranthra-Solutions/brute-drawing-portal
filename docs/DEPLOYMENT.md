# Deployment (IIS, single site)

1. **Server prerequisites:** Windows Server + IIS, **.NET 8 Hosting Bundle**, SQL Server (2019+).
2. **Build:** on a build machine run `scripts\publish.ps1 -Output C:\inetpub\DrawingPortal` (builds UI, runs tests, publishes).
3. **Database:** create an empty database and a SQL login with `db_owner` on it. Either let the app migrate on first start (`Database:AutoMigrate=true`) or have a DBA run `database/schema.sql`.
4. **IIS:** new site -> physical path above, app pool "No Managed Code", identity with **modify** rights on `App_Data` and `logs`. Bind HTTPS.
5. **Configuration** (environment variables on the app pool, or `appsettings.Production.json`):

```
ASPNETCORE_ENVIRONMENT=Production
ConnectionStrings__Default=Server=SQL01;Database=DrawingPortal;User Id=dp_app;Password=…;TrustServerCertificate=True
Jwt__Secret=<64 random characters>
Portal__PublicBaseUrl=https://drawings.company.local        # used in e-mail links
Storage__RootPath=D:\DrawingPortalFiles                      # local folder or UNC share
Email__Mode=Smtp
Email__FromAddress=drawing-portal@company.com
Email__Smtp__Host=smtp.company.com   Email__Smtp__Port=587   Email__Smtp__UseStartTls=true
Email__Smtp__Username=…              Email__Smtp__Password=…
Auth__TestAdmin__Enabled=false
Portal__SeedSampleData=false
```
6. **First admin:** with the test admin still enabled, sign in, create the real admin users (Admin > Users), then set `Auth__TestAdmin__Enabled=false` and recycle.
7. **Initial data load (2,000+ drawings):** upload each file on *Upload drawing* (copy URLs), fill the Excel template, import with *Create missing master data* ticked.
8. **Backups:** SQL database + the `Storage__RootPath` folder together. Logs: `logs/portal-YYYYMMDD.log` (30 days).
9. **Health check:** `GET /health` -> `{"status":"ok"}` (503 if the DB is unreachable).
