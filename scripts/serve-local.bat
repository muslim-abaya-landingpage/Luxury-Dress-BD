@echo off
chcp 65001 >nul
title Muslim Abaya — Local site (admin login test)
cd /d "%~dp0.."

echo.
echo ========================================
echo   Local server — file:// এর বদলে http://
echo ========================================
echo.
set "OPEN_PAGE=%~1"
if "%OPEN_PAGE%"=="" set "OPEN_PAGE=checkout.html"

echo সাইট:
echo   http://localhost:5500/%OPEN_PAGE%
echo প্রোডাক্ট এডিট:
echo   http://localhost:5500/product-manager.html
echo Admin:
echo   http://localhost:5500/admin-login.html
echo.
echo বন্ধ করতে: এই উইন্ডোতে Ctrl+C
echo.

where py >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:5500/%OPEN_PAGE%"
  py -m http.server 5500
  goto :done
)

where python >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:5500/%OPEN_PAGE%"
  python -m http.server 5500
  goto :done
)

where npx >nul 2>&1
if %errorlevel%==0 (
  start "" "http://localhost:5500/%OPEN_PAGE%"
  npx --yes serve -l 5500
  goto :done
)

echo Python বা Node লাগবে। অথবা muslimabaya.com এ admin-login.html আপলোড করুন।
pause
exit /b 1

:done
pause
