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

taskkill /f /im app.exe 2>nul
taskkill /f /im node.exe /fi "WindowTitle eq *vite*" 2>nul
npx tauri dev

pause
