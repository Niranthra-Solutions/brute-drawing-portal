# syntax=docker/dockerfile:1
# Amaron Brute Drawing Portal - single image: React UI is served by the ASP.NET Core 8 API.
# Build from the project root:  docker build -t drawing-portal .

# ---------- 1) build the React UI (Vite writes into the API's wwwroot) ----------
FROM node:20-bookworm-slim AS web
WORKDIR /src/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN mkdir -p /src/backend/src/DrawingPortal.Api && npm run build

# ---------- 2) build + publish the API ----------
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS api
WORKDIR /src
COPY backend/global.json backend/DrawingPortal.sln ./backend/
COPY backend/src/DrawingPortal.Api/DrawingPortal.Api.csproj ./backend/src/DrawingPortal.Api/
COPY backend/tests/DrawingPortal.Tests/DrawingPortal.Tests.csproj ./backend/tests/DrawingPortal.Tests/
RUN dotnet restore backend/src/DrawingPortal.Api/DrawingPortal.Api.csproj
COPY backend/ ./backend/
COPY --from=web /src/backend/src/DrawingPortal.Api/wwwroot ./backend/src/DrawingPortal.Api/wwwroot
RUN dotnet publish backend/src/DrawingPortal.Api/DrawingPortal.Api.csproj -c Release -o /out --no-restore /p:UseAppHost=false
# the App_Data folder committed in the repo (SQLite db + uploaded files) travels with the image as first-run seed data
RUN mkdir -p /seed && cp -R backend/src/DrawingPortal.Api/App_Data/. /seed/ 2>/dev/null || true

# ---------- 3) runtime ----------
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=api /out ./

# start-up script:
#  1) first run only: if the volume is empty, copy the App_Data that was committed in the repo into it
#  2) uses the SQLite file found there (e.g. trial.db or portal.db)
#  3) creates a random JWT secret on first run (kept in the volume) unless you pass -e Jwt__Secret=...
COPY <<'EOF' /app/entrypoint.sh
#!/bin/sh
set -e
DATA=/app/App_Data
if [ ! -f "$DATA/.seeded" ] && [ -z "$(ls "$DATA"/*.db 2>/dev/null)" ]; then
  if [ -n "$(ls -A /app/seed 2>/dev/null)" ]; then
    echo "First start: restoring App_Data bundled from the repository into $DATA"
    cp -R /app/seed/. "$DATA"/
  fi
  touch "$DATA/.seeded"
fi
if [ "$Database__Provider" = "Sqlite" ] && [ ! -f "$DATA/portal.db" ]; then
  DBFILE="$(ls "$DATA"/*.db 2>/dev/null | head -n 1)"
  [ -z "$DBFILE" ] || export ConnectionStrings__Default="Data Source=$DBFILE"
fi
if [ -z "$Jwt__Secret" ]; then
  [ -s "$DATA/.jwt_secret" ] || head -c 48 /dev/urandom | base64 | tr -d '\n' > "$DATA/.jwt_secret"
  export Jwt__Secret="$(cat "$DATA/.jwt_secret")"
fi
exec dotnet DrawingPortal.Api.dll
EOF
COPY --from=api /seed /app/seed
RUN chmod -R a+rX /app/seed

# uploaded drawings, e-mail drop folder and the SQLite database live here - mount a volume on it
RUN chmod +x /app/entrypoint.sh && mkdir -p /app/App_Data/files /app/App_Data/mail && chown -R app:app /app/App_Data
VOLUME /app/App_Data

# Defaults = works out of the box with a built-in SQLite database. Override any of them with  docker run -e NAME=value
#   SQL Server instead:  -e Database__Provider=SqlServer -e "ConnectionStrings__Default=Server=HOST;Database=DrawingPortal;User Id=sa;Password=...;TrustServerCertificate=True"
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_EnableDiagnostics=0 \
    Database__Provider=Sqlite \
    Database__AutoMigrate=true \
    ConnectionStrings__Default="Data Source=/app/App_Data/trail.db" \
    Storage__RootPath=/app/App_Data/files \
    Email__FileDropPath=/app/App_Data/mail \
    Email__Mode=Smtp \
    Auth__TestAdmin__Enabled=true \
    Portal__SeedSampleData=true

USER app
EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]