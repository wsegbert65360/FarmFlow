@echo off
setlocal enabledelayedexpansion

echo [FarmFlow] Cleaning previous build...
if exist dist (
    rd /s /q dist
)
mkdir dist

echo [FarmFlow] 1. Generating Production Web Build...
set CI=1
call npx -y expo export --platform web --clear
if %errorlevel% neq 0 (
    echo [ERROR] Web export failed at step 1.
    if "%CI_JOB_ID%"=="" pause
    exit /b %errorlevel%
)

echo [FarmFlow] 1.5. Injecting missing WASM assets...
if exist "node_modules\sql.js\dist\sql-wasm.wasm" (
    copy /y "node_modules\sql.js\dist\sql-wasm.wasm" "dist\sql-wasm.wasm"
    mkdir "dist\_expo\static\js\dist" 2>nul
    copy /y "node_modules\sql.js\dist\sql-wasm.wasm" "dist\_expo\static\js\dist\sql-wasm.wasm"
) else (
    echo [ERROR] sql-wasm.wasm not found in node_modules!
    if "%CI_JOB_ID%"=="" pause
    exit /b 1
)

echo [FarmFlow] 1.6. Copying Vercel config...
copy /y "vercel.json" "dist\vercel.json"

echo [FarmFlow] 2. Deploying to Vercel (PRODUCTION)...
echo.
if "%CI_JOB_ID%"=="" (
    call npx -y vercel deploy ./dist --name farmflow --prod --yes
) else (
    echo [CI] Skipping interactive Vercel deploy. Use Vercel GitHub integration or CLI token.
)

if %errorlevel% neq 0 (
    echo [ERROR] Vercel deployment failed at step 2.
    if "%CI_JOB_ID%"=="" pause
    exit /b %errorlevel%
)

echo.
echo [FarmFlow] Deployment Build Complete!
if "%CI_JOB_ID%"=="" (
    echo [FarmFlow] Visit your app at: https://farmflow-seven.vercel.app
    pause
)
