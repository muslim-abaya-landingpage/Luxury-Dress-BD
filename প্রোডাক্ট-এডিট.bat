@echo off
chcp 65001 >nul
cd /d "%~dp0"
title Muslim Abaya — প্রোডাক্ট এডিট
echo.
echo প্রোডাক্ট ম্যানেজার খুলছে...
echo ব্রাউজারে দাম, ছবি, সাইজ, রঙ বদলে সেভ করুন।
echo.
call "%~dp0scripts\serve-local.bat" product-manager.html
