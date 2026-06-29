@echo off
cd /d "%~dp0"
echo ===============================================================
echo   UNICO  -  Connecting the app to your MongoDB database
echo ===============================================================
echo.
echo Step 1 of 2: creating your database + admin user...
echo.
call npm --prefix server run seed
echo.
echo ---------------------------------------------------------------
echo   READ THE LINES ABOVE:
echo.
echo     "Created admin: admin"   =  SUCCESS. Refresh Atlas - your
echo                                 "unico" database now exists.
echo.
echo     "authentication failed"  =  the DB password is wrong (you
echo                                 rotated it). Tell the assistant.
echo.
echo     "timeout" / "ECONNREFUSED" = network/IP problem. Make sure
echo                                 0.0.0.0/0 is in Atlas Network Access.
echo ---------------------------------------------------------------
echo.
echo (Take a screenshot of the lines above and send them.)
echo.
pause
echo.
echo Step 2 of 2: starting the server. KEEP THIS WINDOW OPEN while
echo you use the app. Then sign in as:   admin / Unico@2026
echo.
call npm --prefix server start
pause
