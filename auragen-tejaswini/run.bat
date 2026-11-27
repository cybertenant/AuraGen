@echo off
setlocal
cd /d "%~dp0"

echo ============================================
echo   AuraGen - starting local development
echo ============================================
echo.

where pnpm >nul 2>nul
if errorlevel 1 (
    echo pnpm not found - using Corepack instead.
    set "PNPM=corepack pnpm@9"
) else (
    set "PNPM=pnpm"
)

if not exist node_modules (
    echo Installing project dependencies...
    %PNPM% install
)

echo.
echo Starting server and web in separate windows...
start "AuraGen Server" cmd /k "%PNPM% --filter @tejaswini/server dev"
start "AuraGen Web" cmd /k "%PNPM% --filter @tejaswini/web dev"

echo Waiting for the app to boot...
timeout /t 12 /nobreak >nul
start "" http://localhost:3000

echo.
echo Web:    http://localhost:3000
echo Server: http://localhost:4000/health
echo Close the two AuraGen windows to stop the app.
pause
