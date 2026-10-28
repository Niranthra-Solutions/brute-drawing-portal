@echo off
REM ============================================================
REM  Creates the IIS app pool + site, folders and permissions.
REM  Run on the Windows Server AS ADMINISTRATOR, after the .NET 8
REM  Hosting Bundle is installed and the published folder is in place.
REM  Usage:  deploy-iis.bat [site-folder] [port]
REM  Defaults: C:\inetpub\DrawingPortal  and port 80
REM ============================================================
setlocal
set "SITEDIR=%~1"
if "%SITEDIR%"=="" set "SITEDIR=C:\inetpub\DrawingPortal"
set "PORT=%~2"
if "%PORT%"=="" set "PORT=80"
set "NAME=DrawingPortal"
set "APPCMD=%windir%\system32\inetsrv\appcmd.exe"

net session >nul 2>&1 || (echo Run this as Administrator. & exit /b 1)
if not exist "%APPCMD%" (echo IIS is not installed. Run: dism /online /enable-feature /featurename:IIS-WebServerRole /featurename:IIS-ManagementConsole /all & exit /b 1)
if not exist "%SITEDIR%\DrawingPortal.Api.dll" (echo Published files not found in %SITEDIR% & exit /b 1)

echo Creating folders...
if not exist "%SITEDIR%\App_Data" mkdir "%SITEDIR%\App_Data"
if not exist "%SITEDIR%\logs" mkdir "%SITEDIR%\logs"

echo Creating app pool and site...
"%APPCMD%" list apppool /name:%NAME% >nul 2>&1 || "%APPCMD%" add apppool /name:%NAME% /managedRuntimeVersion:""
"%APPCMD%" list site /name:%NAME% >nul 2>&1 || "%APPCMD%" add site /name:%NAME% /physicalPath:"%SITEDIR%" /bindings:http/*:%PORT%:
"%APPCMD%" set app "%NAME%/" /applicationPool:%NAME%

echo Granting permissions...
icacls "%SITEDIR%" /grant "IIS AppPool\%NAME%":(OI)(CI)RX >nul
icacls "%SITEDIR%\App_Data" /grant "IIS AppPool\%NAME%":(OI)(CI)M >nul
icacls "%SITEDIR%\logs" /grant "IIS AppPool\%NAME%":(OI)(CI)M >nul

echo Restarting IIS...
iisreset >nul

echo.
echo DONE. Open http://localhost:%PORT%  and http://localhost:%PORT%/health
echo Before go-live: edit %SITEDIR%\appsettings.json (Jwt:Secret, connection string, SMTP, TestAdmin:Enabled=false).
endlocal