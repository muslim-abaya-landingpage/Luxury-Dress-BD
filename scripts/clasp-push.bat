@echo off
chcp 65001 >nul
title Muslim Abaya — clasp push
set "PATH=C:\Program Files\nodejs;%APPDATA%\npm;%PATH%"
cd /d "D:\Luxury-Dress-BD"

echo.
echo === clasp push (অর্ডার শিট Code.gs) ===
echo.

clasp push --force
if errorlevel 1 (
  echo.
  echo [ব্যর্থ] clasp login বা Apps Script API ON আছে কিনা দেখুন।
  echo   API: https://script.google.com/home/usersettings
  pause
  exit /b 1
)

echo.
echo [সফল] কোড Google Editor-এ গেছে।
echo.
echo এখন বাধ্যতামূলক:
echo   1. Apps Script Editor খুলুন (অর্ডার শিট)
echo   2. Deploy -^> Manage deployments -^> Edit -^> New version -^> Deploy
echo   3. API টেস্ট: Muslim Abaya API OK
echo.
start "" "https://script.google.com/home/projects/1LFd_vDAiSJMdWrHJf2s_7fEVVxTt6g6q8cEVWfhVJhYJN-xpNcTFExCD/edit"
pause
