$root = Split-Path $PSScriptRoot -Parent
# Live code lives in apps-script\ (clasp rootDir).
$code = Get-Content (Join-Path $root "apps-script\Code.gs") -Raw -Encoding UTF8
$adm = Get-Content (Join-Path $root "apps-script\AdminOrders.gs") -Raw -Encoding UTF8
$fix = Get-Content (Join-Path $root "apps-script\FixSheetHeaders.gs") -Raw -Encoding UTF8
# Escape so the textareas show (and copy) the code exactly, incl. "&amp;" literals.
$safe = $code.Replace("&", "&amp;").Replace("<", "&lt;")
$safeAdm = $adm.Replace("&", "&amp;").Replace("<", "&lt;")
$safeFix = $fix.Replace("&", "&amp;").Replace("<", "&lt;")
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
  <h1>Apps Script কোড (৩টি ফাইল)</h1>
  <div class="step">
    <p><strong>H কলামে পণ্যের সাইজ:</strong> এই কোড নতুন বিন্যাসে I-তে টাকা, J-তে অর্ডার আইডি ও K-তে স্ট্যাটাস ব্যবহার করে। নিচের তিনটি ফাইল সেভ করে বর্তমান ডিপ্লয়মেন্টের নতুন ভার্সন Deploy করুন:</p>
    <ol>
      <li>script.google.com → আপনার প্রজেক্ট → <strong>Code.gs</strong> এ Ctrl+A → নিচের <strong>১ নম্বর</strong> কোড পেস্ট</li>
      <li>বাম পাশে <strong>＋ → Script</strong> চাপুন, নাম দিন <strong>AdminOrders</strong> (AdminOrders.gs তৈরি হবে) → Ctrl+A → নিচের <strong>২ নম্বর</strong> কোড পেস্ট</li>
      <li><strong>FixSheetHeaders.gs</strong> ফাইল থাকলে নিচের <strong>৩ নম্বর</strong> কোড দিয়ে আপডেট করুন। না থাকলে <strong>＋ → Script → FixSheetHeaders</strong> তৈরি করুন।</li>
      <li><strong>Save</strong> (ডিস্ক আইকন)</li>
      <li><strong>Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy</strong> (URL একই থাকবে)</li>
      <li>একবার <strong>setupOnlineOrderExtraHeaders</strong> Run করুন; এটি সঠিক কলামে হেডার ও স্ট্যাটাস ড্রপডাউন ঠিক করবে। নোট ও JSON নিজের কলামে থাকবে, হেডার স্থির থাকবে এবং অভ্যন্তরীণ ট্র্যাকিং কলাম লুকানো হবে। বর্তমান H-তে সাইজ থাকলে আবার সাইজ সিঙ্ক করার প্রয়োজন নেই।</li>
    </ol>
  </div>
  <h2>১. Code.gs</h2>
  <textarea id="codeBox" readonly>$safe</textarea>
  <br>
  <button type="button" id="copyBtn">Code.gs কপি</button>
  <h2>২. AdminOrders.gs</h2>
  <textarea id="admBox" readonly>$safeAdm</textarea>
  <br>
  <button type="button" id="copyAdm">AdminOrders.gs কপি</button>
  <h2>৩. FixSheetHeaders.gs</h2>
  <textarea id="fixBox" readonly>$safeFix</textarea>
  <br>
  <button type="button" id="copyFix">FixSheetHeaders.gs কপি</button>
  <script>
    function bind(btn, box) {
      document.getElementById(btn).onclick = function () {
        var t = document.getElementById(box).value;
        navigator.clipboard.writeText(t).then(function () { alert("কপি হয়েছে!"); });
      };
    }
    bind("copyBtn", "codeBox");
    bind("copyAdm", "admBox");
    bind("copyFix", "fixBox");
  </script>
</body>
</html>
"@
Set-Content $out $html -Encoding UTF8
Write-Host "Wrote $out"
