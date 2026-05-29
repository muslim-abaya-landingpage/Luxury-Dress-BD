param([switch]$Quick, [switch]$Full)

$root = Split-Path $PSScriptRoot -Parent
$quickFile = Join-Path $root "apps-script\Fix-doGet.gs"
$fullFile = Join-Path $root "Code.gs"
$scriptId = "1LFd_vDAiSJMdWrHJf2s_7fEVVxTt6g6q8cEVWfhVJhYJN-xpNcTFExCD"
$editorUrl = "https://script.google.com/home/projects/$scriptId/edit"

Add-Type -AssemblyName System.Windows.Forms
if ($Quick) {
  $choice = "Yes"
} elseif ($Full) {
  $choice = "No"
} else {
  $choice = [System.Windows.Forms.MessageBox]::Show(
@"
কোনটা করবেন?

[Yes] দ্রুত (৩০ সেকেন্ড) — নতুন ফাইলে শুধু doGet যোগ

[No]  সম্পূর্ণ — পুরো Code.gs বদলে Sign Up সহ সব
"@,
    "Muslim Abaya API ঠিক করুন",
    "YesNoCancel",
    "Question"
  )
}

if ($choice -eq "Cancel") { exit 0 }

if ($choice -eq "Yes") {
  $code = Get-Content $quickFile -Raw -Encoding UTF8
  Set-Clipboard -Value $code
  Start-Process $editorUrl
  [void][System.Windows.Forms.MessageBox]::Show(
@"
ক্লিপবোর্ডে ছোট কোড কপি হয়েছে।

Editor-এ:
1) বামে + → Script
2) নাম: Fix-doGet
3) Ctrl+V → Save
4) Deploy → Manage → Edit → New version → Deploy

পুরনো Code.gs মুছবেন না।
"@,
    "দ্রুত ঠিক",
    "OK",
    "Information"
  )
} else {
  if (-not (Test-Path $fullFile)) { $fullFile = Join-Path $root "google-apps-script-backend.gs" }
  $code = Get-Content $fullFile -Raw -Encoding UTF8
  Set-Clipboard -Value $code
  Start-Process $editorUrl
  [void][System.Windows.Forms.MessageBox]::Show(
@"
পুরো কোড কপি হয়েছে।

Code.gs → Ctrl+A → Ctrl+V → Save
Deploy → Manage deployments → Edit → New version → Deploy
"@,
    "সম্পূর্ণ ঠিক",
    "OK",
    "Information"
  )
}

Start-Process (Join-Path $root "api-setup.html")
