@echo off
echo [FarmFlow] Cleaning previous build...
rd /s /q dist 2>nul
mkdir dist

echo [FarmFlow] 1. Generating Production Web Build...
call npx expo export --platform web --clear
if %errorlevel% neq 0 (
    echo [ERROR] Web export failed.
    pause
    exit /b %errorlevel%
)

echo [FarmFlow] 1.5. Injecting missing WASM assets...
copy "node_modules\sql.js\dist\sql-wasm.wasm" "dist\sql-wasm.wasm"
mkdir "dist\_expo\static\js\dist" 2>nul
copy "node_modules\sql.js\dist\sql-wasm.wasm" "dist\_expo\static\js\dist\sql-wasm.wasm"

echo [FarmFlow] 2. Deploying to Vercel (PRODUCTION)...
echo.
npx vercel deploy ./dist --name farmflow --prod --yes

if %errorlevel% neq 0 (
    echo [ERROR] Vercel deployment failed.
    pause
    exit /b %errorlevel%
)

echo.
echo [FarmFlow] Deployment Complete!
echo [FarmFlow] Visit your app at: https://farmflow.vercel.app
echo.
pause
