# Muslim Abaya — Admin প্যানেল হোস্টিং প্যাক (FTP/cPanel আপলোড)
$ErrorActionPreference = "Stop"
$root = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path

$out = Join-Path $root "hosting-pack"
if (Test-Path $out) { Remove-Item $out -Recurse -Force }
New-Item -ItemType Directory -Path $out | Out-Null

$adminCore = @(
  "admin-login.html",
  "admin-dashboard.html",
  "admin-links.html",
  "admin.css",
  "admin-api.js",
  "admin-config.js",
  "admin-guard.js",
  "site-api-config.js"
)

$adminTools = @(
  "product-manager.html",
  "product-links.html",
  "product-manager-admin.css",
  "product-links-admin.css",
  "product-manager-admin.js",
  "product-links-admin.js"
)

if (Test-Path (Join-Path $root "admin\index.html")) {
  $adminDir = Join-Path $out "admin"
  New-Item -ItemType Directory -Path $adminDir -Force | Out-Null
  Copy-Item (Join-Path $root "admin\index.html") (Join-Path $adminDir "index.html") -Force
}

$copied = @()
foreach ($f in ($adminCore + $adminTools)) {
  $src = Join-Path $root $f
  if (Test-Path $src) {
    Copy-Item $src (Join-Path $out $f) -Force
    $copied += $f
  }
}

$readme = @"
Muslim Abaya — Admin হোস্টিং প্যাক
================================

এই ফোল্ডারের সব ফাইল সাইটের মূল ফোল্ডারে আপলোড করুন
(যেখানে index.html আছে — public_html / www)

লগইন URL:
  https://muslimabaya.com/admin-login.html

Apps Script (অবশ্য):
  Deploy → Manage deployments → New version → Deploy

আপলোড করা ফাইল ($($copied.Count)):
$($copied -join "`n")

প্রোডাক্ট ম্যানেজার চালাতে সাইটে আগে থেকে থাকা লাগে:
  category-products.js, product-config.js, product-catalog-*.js ইত্যাদি
  (ইতিমধ্যে সাইটে থাকলে আবার লাগে না)

তারিখ: $(Get-Date -Format "yyyy-MM-dd HH:mm")
"@
Set-Content -Path (Join-Path $out "UPLOAD-README.txt") -Value $readme -Encoding UTF8

Write-Host ""
Write-Host "=== Admin hosting pack ready ===" -ForegroundColor Green
Write-Host $out
Write-Host ""
Write-Host "Files: $($copied.Count)"
$copied | ForEach-Object { Write-Host "  - $_" }
