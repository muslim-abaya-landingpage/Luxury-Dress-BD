$root = Split-Path $PSScriptRoot -Parent
$sourceDir = Join-Path $root "apps-script"
$preferred = @("Code.gs", "AdminOrders.gs", "FixSheetHeaders.gs")
$files = @()
foreach ($name in $preferred) {
  $candidate = Join-Path $sourceDir $name
  if (Test-Path $candidate) { $files += Get-Item $candidate }
}
$extras = Get-ChildItem $sourceDir -File | Where-Object { $_.Extension -eq ".gs" -or $_.Extension -eq ".html" } | Sort-Object Name
foreach ($file in $extras) {
  if ($preferred -notcontains $file.Name) { $files += $file }
}

$sections = New-Object System.Text.StringBuilder
$bindings = @()
$index = 0
foreach ($file in $files) {
  $index++
  $name = $file.Name
  $content = Get-Content $file.FullName -Raw -Encoding UTF8
  $safe = $content.Replace("&", "&amp;").Replace("<", "&lt;")
  switch ($name) {
    "Code.gs" { $box = "codeBox"; $button = "copyBtn" }
    "AdminOrders.gs" { $box = "admBox"; $button = "copyAdm" }
    "FixSheetHeaders.gs" { $box = "fixBox"; $button = "copyFix" }
    default { $box = "fileBox$index"; $button = "copyFile$index" }
  }
  $safeName = $name.Replace("&", "&amp;").Replace("<", "&lt;")
  [void]$sections.AppendLine("<h2>$index. $safeName</h2>")
  [void]$sections.AppendLine("<textarea id=`"$box`" readonly>$safe</textarea><br>")
  [void]$sections.AppendLine("<button type=`"button`" id=`"$button`">$safeName কপি</button>")
  $bindings += "bind('$button', '$box');"
}

$fileNames = ($files | ForEach-Object { $_.Name }) -join ", "
$out = Join-Path $root "apps-script-copy.html"
$html = @"
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <title>Apps Script কোড</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 16px; max-width: 960px; }
    textarea { width: 100%; height: 52vh; font: 11px Consolas, monospace; }
    button { margin-top: 10px; padding: 12px 20px; font-size: 15px; cursor: pointer; }
    .step { background: #fff8e1; border: 1px solid #f0d58a; padding: 10px 14px; border-radius: 6px; }
  </style>
</head>
<body>
  <h1>Apps Script কোড (সম্পূর্ণ project)</h1>
  <p>এই page-এ canonical project-এর সব source file আছে: $fileNames</p>
  <div class="step">
    <p><strong>গুরুত্বপূর্ণ:</strong> Admin dashboard-এর সব API চালাতে নিচের সব ফাইল একই Apps Script project-এ রাখতে হবে। <code>.gs</code> ফাইলের জন্য <strong>＋ → Script</strong>, আর <code>.html</code> ফাইলের জন্য <strong>＋ → HTML</strong> ব্যবহার করুন; একই নাম রেখে প্রতিটি কোড সংশ্লিষ্ট ফাইলে কপি করুন। একাধিক <code>doGet</code> function রাখবেন না—canonical router শুধু <code>Code.gs</code>-এ।</p>
    <ol>
      <li>প্রতিটি source file-এর নাম অনুযায়ী Apps Script file তৈরি বা update করুন।</li>
      <li><strong>Save</strong> চাপুন এবং <code>npm run test:backend</code> parity test পাস হয়েছে কি নিশ্চিত করুন।</li>
      <li><strong>Deploy → Manage deployments → Edit → Version: New version → Deploy</strong> করে বিদ্যমান Web App URL রাখুন।</li>
    </ol>
  </div>
  $($sections.ToString())
  <script>
    function bind(btn, box) {
      document.getElementById(btn).onclick = function () {
        var t = document.getElementById(box).value;
        navigator.clipboard.writeText(t).then(function () { alert("কপি হয়েছে!"); });
      };
    }
    $($bindings -join "`n    ")
  </script>
</body>
</html>
"@
Set-Content $out $html -Encoding UTF8
Write-Host "Wrote $out"
