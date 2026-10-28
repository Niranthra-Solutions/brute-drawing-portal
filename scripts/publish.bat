@echo off
REM ============================================================
REM  Builds the React UI and publishes the API for IIS.
REM  Run on a PC that has Node 20+ and the .NET 8 SDK.
REM  Usage:  scripts\publish.bat [output-folder]
REM  Default output: C:\inetpub\DrawingPortal  (or .\publish if you pass one)
REM ============================================================
setlocal
set "ROOT=%~dp0.."
set "OUT=%~1"
if "%OUT%"=="" set "OUT=C:\inetpub\DrawingPortal"

echo.
echo [1/3] Building frontend...
pushd "%ROOT%\frontend" || goto :fail
call npm ci || goto :fail
call npm run build || goto :fail
popd

echo.
echo [2/3] Running backend tests (skip with SKIPTESTS=1)...
if not "%SKIPTESTS%"=="1" (
  dotnet test "%ROOT%\backend\DrawingPortal.sln" -c Release || goto :fail
)

echo.
echo [3/3] Publishing to %OUT% ...
dotnet publish "%ROOT%\backend\src\DrawingPortal.Api" -c Release -o "%OUT%" || goto :fail

echo.
echo DONE. Published to %OUT%
echo Next: copy that folder to the server (if built elsewhere), then run scripts\deploy-iis.bat as Administrator.
endlocal
exit /b 0

:fail
echo.
echo *** FAILED - see the error above. ***
endlocal
exit /b 1