@echo off
chcp 65001 >nul
title Muslim Abaya — ব্রাউজার প্রক্সি বন্ধ
echo.
echo ========================================
echo   Windows LAN প্রক্সি বন্ধ করা হচ্ছে
echo ========================================
echo.
echo (127.0.0.1:52811 চালু থাকলে Chrome/Firefox কাজ করে না)
echo.

reg add "HKCU\Software\Microsoft\Windows\CurrentVersion\Internet Settings" /v ProxyEnable /t REG_DWORD /d 0 /f >nul
if %errorlevel% neq 0 (
  echo [ত্রুটি] রেজিস্ট্রি আপডেট হয়নি — Settings হাতে বন্ধ করুন।
  pause
  exit /b 1
)

echo [OK] "Use a proxy server for your LAN" বন্ধ করা হয়েছে।
echo.
echo এখন ব্রাউজার বন্ধ করে আবার খুলুন।
echo.
echo যদি আবার চালু হয় — সম্ভবত Cursor IDE খোলা আছে।
echo   Cursor বন্ধ করে ব্রাউজ করুন, অথবা Cursor Settings এ proxy খুঁজুন।
echo.
pause
