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

:: --- Strip user-downloadable files (save ~300MB) ---
:: Piper voice models — downloaded via TTS settings page
del /q "%PKG_DIR%\piper-voices\*.onnx" 2>nul
:: Bergamot compressed model backups
del /q "%PKG_DIR%\bergamot\*.gz" 2>nul
del /q "%PKG_DIR%\bergamot\*\*.gz" 2>nul
:: Duplicate DLL directory (same files in piper root)
rmdir /s /q "%PKG_DIR%\piper\piper" 2>nul
:: User-downloaded GGUF models (just in case)
del /q "%PKG_DIR%\*.gguf" 2>nul

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

if not "%1"=="silent" pause
