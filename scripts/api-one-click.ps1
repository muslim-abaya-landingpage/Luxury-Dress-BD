# Muslim Abaya — Apps Script এক-ক্লিক সেটআপ
$root = Split-Path $PSScriptRoot -Parent
$codeFile = Join-Path $root "Code.gs"
if (-not (Test-Path $codeFile)) {
  $codeFile = Join-Path $root "google-apps-script-backend.gs"
}

$scriptId = "1LFd_vDAiSJMdWrHJf2s_7fEVVxTt6g6q8cEVWfhVJhYJN-xpNcTFExCD"
$editorUrl = "https://script.google.com/home/projects/$scriptId/edit"

if (-not (Test-Path $codeFile)) {
  Write-Host "Code.gs not found in $root"
  exit 1
}

$code = Get-Content $codeFile -Raw -Encoding UTF8
Set-Clipboard -Value $code
Start-Process $editorUrl

Add-Type -AssemblyName System.Windows.Forms
$msg = @"
সম্পূর্ণ কোড ক্লিপবোর্ডে কপি হয়েছে।
Apps Script Editor খুলেছে।

এখন শুধু:
Ctrl+A → Ctrl+V → Ctrl+S

তারপর OK চাপুন।

Editor-এ উপরে ডানে নীল **Deploy** বাটন:
Deploy → Manage deployments → Edit → New version → Deploy
"@

[void][System.Windows.Forms.MessageBox]::Show(
  $msg,
  "Muslim Abaya API",
  "OK",
  "Information"
)
