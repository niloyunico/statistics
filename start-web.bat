@echo off
cd /d "%~dp0"
echo ================================================================
echo   UNICO Statistics Suite  -  Web (Express) edition
echo ================================================================
echo.
echo Starting the local web server and opening your browser.
echo KEEP THIS WINDOW OPEN while you use the app. Close it (or press
echo Ctrl+C) to stop the server.
echo.

REM Install server dependencies on first run (no-op if already installed).
if not exist "server\node_modules\express" (
  echo Installing dependencies (first run only)...
  call npm --prefix server install
  echo.
)

REM Open the browser a few seconds after the server starts.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:8080"

REM Run the web server (blocks until you close this window).
call npm --prefix server run web

echo.
echo Server stopped.
pause
