$root = Split-Path $PSScriptRoot -Parent
$codeFile = Join-Path $root "Code.gs"
$code = Get-Content $codeFile -Raw -Encoding UTF8
$safe = $code.Replace("</textarea>", "<" + "/textarea>")
$out = Join-Path $root "apps-script-copy.html"
$html = @"
<!DOCTYPE html>
<html lang="bn">
<head>
  <meta charset="UTF-8">
  <title>Apps Script কোড</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 16px; max-width: 960px; }
    textarea { width: 100%; height: 72vh; font: 11px Consolas, monospace; }
    button { margin-top: 10px; padding: 12px 20px; font-size: 15px; cursor: pointer; }
  </style>
</head>
<body>
  <h1>সম্পূর্ণ Apps Script কোড</h1>
  <p>Editor-এ <strong>Ctrl+A</strong> → <strong>Ctrl+V</strong> → <strong>Save</strong> → Deploy <strong>New version</strong></p>
  <textarea id="codeBox" readonly>$safe</textarea>
  <br>
  <button type="button" id="copyBtn">সম্পূর্ণ কোড কপি</button>
  <script>
    document.getElementById("copyBtn").onclick = function () {
      var t = document.getElementById("codeBox").value;
      navigator.clipboard.writeText(t).then(function () { alert("কপি হয়েছে!"); });
    };
  </script>
</body>
</html>
"@
Set-Content $out $html -Encoding UTF8
Write-Host "Wrote $out"
