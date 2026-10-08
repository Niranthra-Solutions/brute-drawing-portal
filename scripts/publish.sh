#!/usr/bin/env bash
# Linux/macOS equivalent of publish.ps1.   ./scripts/publish.sh ./publish
set -euo pipefail
OUT="${1:-./publish}"; ROOT="$(cd "$(dirname "$0")/.." && pwd)"
(cd "$ROOT/frontend" && npm ci && npm run build)
dotnet test "$ROOT/backend/DrawingPortal.sln" -c Release
dotnet publish "$ROOT/backend/src/DrawingPortal.Api" -c Release -o "$OUT"
