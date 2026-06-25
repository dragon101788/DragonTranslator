@echo off
cd /d "%~dp0"

set "PATH=C:\Program Files\nodejs;%USERPROFILE%\.cargo\bin;%PATH%"
set "PATH=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64;%PATH%"
set "PATH=C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64;%PATH%"

echo ========================================
echo   DragonTec Translator - Dev Mode
echo ========================================
echo   Vite : http://localhost:5157
echo ========================================
echo.

REM === Auto-detect and install Node.js dependencies ===
if not exist "node_modules\" (
    echo [1/2] Installing Node.js dependencies...
    call npm install
    if errorlevel 1 (
        echo ERROR: npm install failed. Check your network or proxy settings.
        pause
        exit /b 1
    )
    echo Done.
) else (
    echo [1/2] Node.js dependencies: already installed.
)

echo [2/2] Starting Tauri dev server...
echo   Tauri will handle Rust dependency resolution automatically.
echo.

taskkill /f /im app.exe 2>nul
taskkill /f /im node.exe /fi "WindowTitle eq *vite*" 2>nul
npx tauri dev

pause
