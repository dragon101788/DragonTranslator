@echo off
chcp 65001 >nul
title Lexi Dev

:: ---- PATH setup ----
set "PATH=C:\Program Files\nodejs;%PATH%"
set "PATH=%USERPROFILE%\.cargo\bin;%PATH%"
set "PATH=C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Tools\MSVC\14.44.35207\bin\Hostx64\x64;%PATH%"
set "PATH=C:\Program Files (x86)\Windows Kits\10\bin\10.0.26100.0\x64;%PATH%"

cd /d "%~dp0"

echo ========================================
echo   Lexi - Dev Mode
echo ========================================
echo   Vite : http://localhost:5175
echo ========================================
echo.

npx tauri dev

pause
