@echo off
cd /d "%~dp0"
echo ===============================================================
echo   UNICO  -  Connect / update your MongoDB connection
echo ===============================================================
echo.
echo You will paste your Atlas connection string, then choose a
echo login password. It will test the connection and set everything up.
echo.
echo Get the string from Atlas:  Cluster0 - Connect - Drivers - copy.
echo Replace ^<db_password^> in it with your REAL (new) password.
echo.
call npm --prefix server run setup
echo.
pause
