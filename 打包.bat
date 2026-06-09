@echo off
cd /d "%~dp0"

echo ========================================
echo   DragonTec Translator - Build
echo ========================================
echo.

:: Capture the output path before building, then rebuild
del /q "src-tauri\target\release\app.exe" 2>nul

call npx tauri build



if exist "src-tauri\target\release\app.exe" (
    echo.
    echo ========================================
    echo   Build SUCCESS
    echo ========================================
    copy /y "src-tauri\target\release\app.exe" ".\" >nul
    echo   app.exe copied to root.
) else (
    echo.
    echo ========================================
    echo   Build FAILED
    echo ========================================
)

echo.
pause
