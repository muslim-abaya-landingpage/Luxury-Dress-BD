param([switch]$Quick, [switch]$Full)

$root = Split-Path $PSScriptRoot -Parent
$fullFile = Join-Path $root "apps-script\Code.gs"
$scriptId = "1LFd_vDAiSJMdWrHJf2s_7fEVVxTt6g6q8cEVWfhVJhYJN-xpNcTFExCD"
$editorUrl = "https://script.google.com/home/projects/$scriptId/edit"

if (-not (Test-Path $fullFile)) {
  [System.Windows.Forms.MessageBox]::Show("apps-script/Code.gs পাওয়া যায়নি।", "API ঠিক করুন", "OK", "Error") | Out-Null
  exit 1
}

Add-Type -AssemblyName System.Windows.Forms
$choice = [System.Windows.Forms.MessageBox]::Show(
@"
সম্পূর্ণ Apps Script backend-ই আপডেট করতে হবে।

আলাদা Fix-doGet ফাইল যোগ করবেন না—এটি মূল Code.gs router-কে override করে StockStatus, login ও অন্যান্য API বন্ধ করতে পারে।

Yes চাপলে সম্পূর্ণ Code.gs ক্লিপবোর্ডে কপি হবে।
"@,
  "Muslim Abaya API আপডেট",
  "YesNoCancel",
  "Warning"
)

if ($choice -ne "Yes") { exit 0 }

$code = Get-Content $fullFile -Raw -Encoding UTF8
Set-Clipboard -Value $code
Start-Process $editorUrl
[System.Windows.Forms.MessageBox]::Show(
@"
সম্পূর্ণ Code.gs কপি হয়েছে।

Apps Script Editor-এ:
1) Code.gs খুলে Ctrl+A → Ctrl+V → Save
2) Deploy → Manage deployments → Edit → New version → Deploy
3) আলাদা Fix-doGet.gs-এ doGet থাকলে সেটি সরান
"@,
  "API update প্রস্তুত",
  "OK",
  "Information"
)

Start-Process (Join-Path $root "api-setup.html")
