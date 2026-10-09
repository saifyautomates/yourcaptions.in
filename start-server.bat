@echo off
title YourCaptions.in Dev Server
color 0A
cls
echo =========================================================
echo       Starting YourCaptions.in Development Server
echo =========================================================
echo.
echo [1/3] Checking environment...
where node >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js is not installed or not found in PATH!
    echo Please install Node.js from https://nodejs.org/
    pause
    exit /b 1
)

echo [2/3] Preparing to open application in your browser...
start http://localhost:3000

echo [3/3] Launching server on http://localhost:3000 ...
echo.
echo Press Ctrl+C at any time to stop the server.
echo.
npm run dev
if %errorlevel% neq 0 (
    color 0C
    echo.
    echo [ERROR] Server terminated with an error.
    pause
)
