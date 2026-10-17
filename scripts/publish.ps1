<#
 Builds the React UI into the API's wwwroot and publishes one self-contained-folder for IIS.
 Usage:  .\scripts\publish.ps1 -Output C:\inetpub\DrawingPortal
 Needs: Node 20+, .NET 8 SDK on the build machine; .NET 8 Hosting Bundle on the IIS server.
#>
param([string]$Output = ".\publish")
$ErrorActionPreference = "Stop"
$root = Split-Path $PSScriptRoot -Parent
Push-Location "$root\frontend"; npm ci; npm run build; Pop-Location
dotnet test "$root\backend\DrawingPortal.sln" -c Release
dotnet publish "$root\backend\src\DrawingPortal.Api" -c Release -o $Output
Write-Host "Published to $Output. Next: set Jwt__Secret, ConnectionStrings__Default and SMTP settings (see docs/DEPLOYMENT.md)."
