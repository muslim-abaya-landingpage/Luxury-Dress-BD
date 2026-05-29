@echo off
chcp 65001 >nul
title Muslim Abaya — কোড Paste + Deploy
cd /d "%~dp0"
echo.
echo  সম্পূর্ণ Code.gs ক্লিপবোর্ডে কপি হচ্ছে...
echo  Apps Script Editor + Deploy পেজ খুলবে...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0\scripts\api-one-click.ps1"
echo.
echo  সম্পন্ন। Editor-এ: Ctrl+A → Ctrl+V → Ctrl+S
echo  Deploy-এ: Edit → New version → Deploy
pause
