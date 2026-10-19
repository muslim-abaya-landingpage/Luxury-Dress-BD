@echo off
chcp 65001 >nul
title Muslim Abaya - Apps Script auto deploy (one-time setup)
set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"

echo.
echo === Apps Script অটো-ডিপ্লয়: এককালীন সেটআপ ===
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [ব্যর্থ] Node.js পাওয়া যায়নি। https://nodejs.org থেকে ইনস্টল করে আবার চালান।
  start "" "https://nodejs.org"
  pause
  exit /b 1
)

where clasp >nul 2>nul
if errorlevel 1 (
  echo clasp ইনস্টল হচ্ছে...
  call npm install -g @google/clasp
)

echo.
echo ধাপ ১: Google Apps Script API চালু করুন (ব্রাউজারে খুলছে) - সুইচটা ON করুন।
start "" "https://script.google.com/home/usersettings"
pause

if not exist "%USERPROFILE%\.clasprc.json" (
  echo.
  echo ধাপ ২: Google লগইন - luxurydressbd@gmail.com দিয়ে লগইন করে Allow দিন।
  call clasp login
)

if not exist "%USERPROFILE%\.clasprc.json" (
  echo [ব্যর্থ] লগইন ফাইল তৈরি হয়নি। আবার চালান।
  pause
  exit /b 1
)

type "%USERPROFILE%\.clasprc.json" | clip
echo.
echo ধাপ ৩: লগইন তথ্য কপি হয়ে গেছে (clipboard-এ)।
echo   GitHub পেজ খুলছে। সেখানে:
echo     Name  = CLASPRC_JSON
echo     Secret = Ctrl+V দিয়ে পেস্ট করুন
echo   তারপর "Add secret" চাপুন।
start "" "https://github.com/muslim-abaya-landingpage/Luxury-Dress-BD/settings/secrets/actions/new"
echo.
echo শেষ হলে Claude-কে বলুন: "secret যোগ করেছি"।
echo সতর্কতা: এই লগইন তথ্য কাউকে চ্যাটে/মেসেজে পাঠাবেন না।
pause
