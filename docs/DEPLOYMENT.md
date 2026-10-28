# Deployment

Three supported ways. **IIS on Windows Server (on-premises)** is the main one; Docker is optional.

## A. IIS on Windows Server (single site, UI + API)

1. **Server prerequisites** (run CMD as Administrator):
   ```
   dism /online /enable-feature /featurename:IIS-WebServerRole /featurename:IIS-ManagementConsole /all
   ```
   Install the **.NET 8 Hosting Bundle** (`dotnet-hosting-8.0.x-win.exe`), then `iisreset`.
   Database: SQL Server 2019+ **or** SQLite (no extra install; fine for a small team).
2. **Build** on a PC with Node 20+ and the .NET 8 SDK (no PowerShell needed):
   ```
   scripts\publish.bat C:\inetpub\DrawingPortal
   ```
   It builds the UI, runs the tests (`set SKIPTESTS=1` to skip) and publishes. Copy the output folder to the server if you built elsewhere. (`scripts\publish.ps1` does the same in PowerShell.)
3. **Create the site** on the server, as Administrator:
   ```
   scripts\deploy-iis.bat C:\inetpub\DrawingPortal 80
   ```
   It creates `App_Data` and `logs`, the app pool "DrawingPortal" (**No Managed Code**), the site, the permissions (**Modify** for the pool identity on `App_Data` and `logs`) and restarts IIS. Bind HTTPS afterwards in IIS Manager (Site > Bindings).
4. **Database**
   * *SQL Server:* create an empty database and a SQL login with `db_owner` on it. Let the app migrate on first start (`Database:AutoMigrate=true`) or have a DBA run `database/schema.sql`.
   * *SQLite:* `Database__Provider=Sqlite` and `ConnectionStrings__Default=Data Source=App_Data\portal.db`.
5. **Configuration** (environment variables on the app pool, or `appsettings.Production.json` next to the site):
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
   Setting a variable from CMD:
   `%windir%\system32\inetsrv\appcmd set config -section:system.applicationHost/applicationPools /+"[name='DrawingPortal'].environmentVariables.[name='Jwt__Secret',value='…']" /commit:apphost`
6. **First admin:** with the test admin still enabled, sign in (`admin@drawingportal.test`, code `123456`), create the real admin users (Admin > Users, roles **Admin** / **User**), then set `Auth__TestAdmin__Enabled=false` and recycle the pool.
7. **Initial data load (2,000+ drawings):** upload each file on *Upload drawing* (copy URLs), fill the Excel template, import with *Create missing master data* ticked. On *Upload drawing* an admin can also type a brand-new vehicle; it is added to Master data when saved. In *Master data > Models* link each vehicle to its voltage(s) and OEM Ah ratings (they are filled in automatically from existing drawings the first time).
8. **Backups:** database + `Storage__RootPath` folder together. Logs: `logs/portal-YYYYMMDD.log` (30 days).
9. **Health check:** `GET /health` -> `{"status":"ok"}` (503 if the DB is unreachable).

## B. Docker (optional)

* `Dockerfile` builds the UI and the API and serves on port **8080**; data lives in the `/app/App_Data` volume. A JWT secret is generated on first start if `Jwt__Secret` is not set.
* Default is SQLite in the volume. For SQL Server set `Database__Provider=SqlServer` and `ConnectionStrings__Default=…`.
* If the repo has a `docker-compose.yml`, `docker compose up --build` starts the app (and SQL Server when it is defined there).
* CI (`.github/workflows/ci.yml`) builds the image and deploys it; keep secrets in the CI/server secret store, not in the repo.

## Upgrading an existing installation

1. **Back up** the database (or the SQLite `.db` file) and the file store.
2. Publish the new version (`scripts\publish.bat`), stop the site (`appcmd stop site DrawingPortal`), copy the new files over the old ones **without overwriting** your `appsettings.Production.json`, `App_Data` and `logs`, then start the site.
3. The database upgrades itself on first start:
   * SQL Server: the migration `SerialNumbersAndModelBatteries` runs automatically (the migration is hand-written, so try it on a copy first).
   * SQLite: `DbUpgrade` adds the new columns and table, numbers existing drawings and models (1, 2, 3 …) and links each vehicle to the voltage/Ah its drawings use.
4. Check `/health`, then open Drawing search and Master data > Models.

## Troubleshooting
* **HTTP 500.30 / app does not start:** read `logs\` and Event Viewer > Windows Logs > Application. Usual causes: Hosting Bundle missing, placeholder `Jwt__Secret` in Production, wrong connection string, no write access to `App_Data`.
* **E-mails not arriving:** with `Email__Mode=File` they are only written to `App_Data/mail`. Set `Smtp` and the SMTP values; failed sends retry automatically.
* **Uploads fail:** check the file-store folder permission and `maxAllowedContentLength` in `web.config` (set to ~220 MB).