@echo off
cd /d "%~dp0"

echo ========================================
echo   ÁúÌÚ·­Òë - Build
echo ========================================
echo.

call npx tauri build

if exist "src-tauri\target\release\ÁúÌÚ·­Òë.exe" (
    copy /y "src-tauri\target\release\ÁúÌÚ·­Òë.exe" ".\" >nul
    echo   ÁúÌÚ·­Òë.exe copied to root.
) else (
    echo.
    echo ========================================
    echo   Build FAILED
    echo ========================================
)

echo.
pause
