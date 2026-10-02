$root = Split-Path $PSScriptRoot -Parent
# Live code lives in apps-script\ (clasp rootDir): Code.gs + AdminOrders.gs (order panel backend).
$code = Get-Content (Join-Path $root "apps-script\Code.gs") -Raw -Encoding UTF8
$adm = Get-Content (Join-Path $root "apps-script\AdminOrders.gs") -Raw -Encoding UTF8
# Escape so the textareas show (and copy) the code exactly, incl. "&amp;" literals.
$safe = $code.Replace("&", "&amp;").Replace("<", "&lt;")
$safeAdm = $adm.Replace("&", "&amp;").Replace("<", "&lt;")
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
  <h1>Apps Script কোড (২টি ফাইল)</h1>
  <div class="step">
    <p><strong>অর্ডার প্যানেলে "Error: TOO_FAST" আসলে</strong> বুঝবেন লাইভ Apps Script পুরনো। নিচের দুটি ফাইলই পেস্ট করে নতুন ভার্সন Deploy করুন:</p>
    <ol>
      <li>script.google.com → আপনার প্রজেক্ট → <strong>Code.gs</strong> এ Ctrl+A → নিচের <strong>১ নম্বর</strong> কোড পেস্ট</li>
      <li>বাম পাশে <strong>＋ → Script</strong> চাপুন, নাম দিন <strong>AdminOrders</strong> (AdminOrders.gs তৈরি হবে) → Ctrl+A → নিচের <strong>২ নম্বর</strong> কোড পেস্ট</li>
      <li><strong>Save</strong> (ডিস্ক আইকন)</li>
      <li><strong>Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy</strong> (URL একই থাকবে)</li>
    </ol>
  </div>
  <h2>১. Code.gs</h2>
  <textarea id="codeBox" readonly>$safe</textarea>
  <br>
  <button type="button" id="copyBtn">Code.gs কপি</button>
  <h2>২. AdminOrders.gs (নতুন ফাইল)</h2>
  <textarea id="admBox" readonly>$safeAdm</textarea>
  <br>
  <button type="button" id="copyAdm">AdminOrders.gs কপি</button>
  <script>
    function bind(btn, box) {
      document.getElementById(btn).onclick = function () {
        var t = document.getElementById(box).value;
        navigator.clipboard.writeText(t).then(function () { alert("কপি হয়েছে!"); });
      };
    }
    bind("copyBtn", "codeBox");
    bind("copyAdm", "admBox");
  </script>
</body>
</html>
"@
Set-Content $out $html -Encoding UTF8
Write-Host "Wrote $out"
