@echo off
title Voice Server (Groq Whisper)
cd /d "%~dp0voice-server"

echo ==============================================
echo    Starting Voice Server on http://localhost:3000
echo ==============================================
echo.

if exist "C:\Program Files\nodejs\node.exe" (
    "C:\Program Files\nodejs\node.exe" server.js
) else (
    node server.js
)

pause
