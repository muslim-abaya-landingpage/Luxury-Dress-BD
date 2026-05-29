@echo off
chcp 65001 >nul
title Muslim Abaya — Admin হোস্টিং প্যাক
cd /d "%~dp0"

echo.
echo [1/3] Google Apps Script — clasp push...
set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
clasp push --force 2>nul
if errorlevel 1 (
  echo      clasp push ব্যর্থ — হাতে Deploy করুন অথবা scripts\clasp-push.bat
) else (
  echo      clasp push OK
)

echo.
echo [2/3] hosting-pack ফোল্ডার তৈরি...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\admin-hosting-pack.ps1"
if errorlevel 1 (
  echo ব্যর্থ।
  pause
  exit /b 1
)

echo.
echo [3/3] Apps Script Deploy মনে করিয়ে দিচ্ছি...
echo      Editor -^> Deploy -^> New version
start "" "https://script.google.com/home/projects/1LFd_vDAiSJMdWrHJf2s_7fEVVxTt6g6q8cEVWfhVJhYJN-xpNcTFExCD/edit"

echo.
echo hosting-pack খুলছি — সব ফাইল cPanel/FTP তে আপলোড করুন।
start "" "%~dp0hosting-pack"

echo.
echo লগইন: https://muslimabaya.com/admin-login.html
echo.
pause
