@echo off
cd /d "%~dp0"

echo ========================================
echo   DragonTranslator - Build
echo ========================================
echo.

call npx tauri build

:: Find the built exe (Chinese name, avoid encoding issues)
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
echo   Packaging user/ -^> appending ZIP to exe...

:: Create ZIP of user/ directory (no compression)
powershell -NoProfile -Command "Compress-Archive -Path 'user\*' -DestinationPath '%SRC_DIR%\user.zip' -CompressionLevel NoCompression -Force"
if not exist "%SRC_DIR%\user.zip" (
    echo   Failed to create user.zip
    pause
    exit /b 1
)

:: Append ZIP to exe -> self-extracting single exe
copy /b "%SRC_DIR%\%EXE_FILE%" + "%SRC_DIR%\user.zip" ".\DragonTranslator.exe" >nul

:: Clean up temp zip
del "%SRC_DIR%\user.zip" 2>nul

:: Also copy to release folder
copy /y ".\DragonTranslator.exe" "%SRC_DIR%\DragonTranslator.exe" >nul

echo.
echo ========================================
echo   Build SUCCESS
echo   .\DragonTranslator.exe  (single exe)
echo ========================================

echo.
pause
