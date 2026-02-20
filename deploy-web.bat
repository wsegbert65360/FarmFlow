@echo off
echo [FarmFlow] Cleaning previous build...
rd /s /q dist 2>nul
mkdir dist

echo [FarmFlow] 1. Generating Production Web Build...
set CI=1
call npx -y expo export --platform web --clear
if %errorlevel% neq 0 (
    echo [ERROR] Web export failed at step 1.
    pause
    exit /b %errorlevel%
)

echo [FarmFlow] 1.5. Injecting missing WASM assets...
copy "node_modules\sql.js\dist\sql-wasm.wasm" "dist\sql-wasm.wasm"
if %errorlevel% neq 0 echo [WARN] Could not copy WASM to dist root.
mkdir "dist\_expo\static\js\dist" 2>nul
copy "node_modules\sql.js\dist\sql-wasm.wasm" "dist\_expo\static\js\dist\sql-wasm.wasm"
if %errorlevel% neq 0 echo [WARN] Could not copy WASM to expo static.

echo [FarmFlow] 1.6. Copying Vercel config...
copy "vercel.json" "dist\vercel.json"

echo [FarmFlow] 2. Deploying to Vercel (PRODUCTION)...
echo.
call npx -y vercel deploy ./dist --name farmflow --prod --yes

if %errorlevel% neq 0 (
    echo [ERROR] Vercel deployment failed at step 2.
    pause
    exit /b %errorlevel%
)

echo.
echo [FarmFlow] Deployment Complete!
echo [FarmFlow] Visit your app at: https://farmflow-seven.vercel.app
echo.
pause
