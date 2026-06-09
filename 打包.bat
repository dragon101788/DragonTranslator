@echo off
cd /d "%~dp0"

echo ========================================
echo   DragonTec Translator - Build
echo ========================================
echo.

npx tauri build

if %errorlevel% equ 0 (
    echo.
    echo ========================================
    echo   Build SUCCESS
    echo ========================================
    copy /y "src-tauri\target\release\app.exe" ".\" >nul
    echo   app.exe copied to root.
) else (
    echo.
    echo ========================================
    echo   Build FAILED (code: %errorlevel%)
    echo ========================================
)

echo.
pause
