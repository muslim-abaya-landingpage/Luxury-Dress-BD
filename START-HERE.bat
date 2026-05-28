@echo off
chcp 65001 >nul
title Muslim Abaya — API ঠিক করুন
cd /d "%~dp0"
echo.
echo  API ঠিক করা হচ্ছে — Editor + Deploy খুলবে...
echo  Editor-এ: + Script ^> Fix-doGet ^> Ctrl+V ^> Save ^> Deploy New version
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0\scripts\api-quick-fix.ps1" -Quick
echo.
echo  api-setup.html খুলছে...
start "" "%~dp0\api-setup.html"
pause
