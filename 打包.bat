@echo off
cd /d "%~dp0"

echo ========================================
echo   DragonTranslator - Build
echo ========================================
echo.

call npx tauri build

:: Find the built exe (Chinese name)
set "SRC_DIR=src-tauri\target\release"
set "EXE_FILE="
for %%f in ("%SRC_DIR%\*.exe") do (
    if not "%%~nxf"=="DragonTranslator.exe" set "EXE_FILE=%%~nxf"
)

if "%EXE_FILE%"=="" (
    echo.
    echo   Build FAILED - no exe found
    echo.
    pause
    exit /b 1
)

echo.
echo   Packaging runtime/ + exe -^> DragonTranslator.zip ...

:: Create release directory
set "PKG_DIR=DragonTranslator"
if exist "%PKG_DIR%" rmdir /s /q "%PKG_DIR%"
mkdir "%PKG_DIR%"

:: Copy runtime files (no compression, just structure)
xcopy "runtime\*" "%PKG_DIR%\" /E /I /Y /Q >nul

:: Copy exe into package
copy /y "%SRC_DIR%\%EXE_FILE%" "%PKG_DIR%\%EXE_FILE%" >nul

:: Create ZIP
powershell -NoProfile -Command "Compress-Archive -Path '%PKG_DIR%' -DestinationPath 'DragonTranslator.zip' -Force"

:: Clean up temp dir
rmdir /s /q "%PKG_DIR%"

:: Copy ZIP to release dir for reference
copy /y "DragonTranslator.zip" "%SRC_DIR%\DragonTranslator.zip" >nul

echo.
echo ========================================
echo   Build SUCCESS
echo   .\DragonTranslator.zip  (unzip anywhere)
echo ========================================

echo.
pause
