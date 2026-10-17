# Amaron Brute Drawing Portal

ASP.NET Core 8 (LTS) Web API + React (TypeScript, Tailwind + shadcn/ui) + SQL Server. One IIS site serves both the UI and the API.

```
backend/   ASP.NET Core API (src/DrawingPortal.Api) + 35 automated tests and an opt-in load test (tests/DrawingPortal.Tests)
frontend/  React + Vite + TypeScript + Tailwind v4 + shadcn/ui (builds into backend/.../wwwroot)
database/  schema.sql  - idempotent SQL Server script generated from the EF migration
docs/      ARCHITECTURE.md · SECURITY.md · DEPLOYMENT.md
scripts/   publish.ps1 / publish.sh
```

## Run it 

**Option A – SQLite trial (no SQL Server needed)**
```bash
cd frontend && npm install && npm run build        # builds UI into the API's wwwroot
cd ../backend/src/DrawingPortal.Api
ASPNETCORE_ENVIRONMENT=Trial dotnet run --no-launch-profile --urls http://localhost:5080
```
**Option B – SQL Server** – edit `ConnectionStrings:Default` in `appsettings.json`, then
`dotnet run` (the EF migration creates the database and seeds master data + the BRD sample drawings).
For UI development: `dotnet run` (API on :5080) and `cd frontend && npm run dev` (UI on :5173, proxies `/api`).

Open http://localhost:5080
