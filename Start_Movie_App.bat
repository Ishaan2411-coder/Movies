@echo off
title CineLocal Movie Server
cd /d "%~dp0"

echo ========================================================
echo        Starting CineLocal Movie Web App...
echo ========================================================
echo.
echo Opening browser at http://localhost:3000 ...

start "" http://localhost:3000

node server.js
pause
