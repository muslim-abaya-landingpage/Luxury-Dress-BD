/**
 * অর্ডার প্যানেল — WhatsApp/ফোনে পাওয়া অর্ডার যোগ করার ফর্ম।
 * Order ID, তারিখ ও ডেলিভারি চার্জ সার্ভারে নিজে বসে (AdminManualOrderCreate)।
 */
(function () {
  "use strict";
  var STYLE =
    "#moOverlay{position:fixed;inset:0;background:rgba(15,15,25,.55);display:flex;align-items:flex-start;justify-content:center;z-index:9999;overflow:auto;padding:24px 12px}" +
    "#moOverlay[hidden]{display:none}" +
    "#moBox{background:var(--adm-surface,#fff);color:inherit;border-radius:14px;max-width:560px;width:100%;padding:20px 20px 16px;box-shadow:0 20px 60px rgba(0,0,0,.25)}" +
    "#moBox h2{margin:0 0 4px;font-size:1.15rem}#moBox p.mo-note{margin:0 0 14px;font-size:.85rem;opacity:.75}" +
    "#moForm{display:grid;grid-template-columns:1fr 1fr;gap:10px}#moForm label{display:flex;flex-direction:column;gap:4px;font-size:.85rem}" +
    "#moForm .mo-wide{grid-column:1/-1}#moForm input,#moForm select,#moForm textarea{padding:8px 10px;border:1px solid #ccc;border-radius:8px;font:inherit;background:inherit;color:inherit}" +
    "#moActions{grid-column:1/-1;display:flex;gap:8px;justify-content:flex-end;align-items:center;margin-top:4px}" +
    "#moStatus{flex:1;font-size:.85rem}#moStatus.is-error{color:#c62828}#moStatus.is-ok{color:#2e7d32}" +
    "@media (max-width:560px){#moForm{grid-template-columns:1fr}}";

  function el(html) { var d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; }

  function build() {
    if (document.getElementById("moOverlay")) return;
    var style = document.createElement("style"); style.textContent = STYLE; document.head.appendChild(style);
    var overlay = el(
      '<div id="moOverlay" hidden role="dialog" aria-modal="true" aria-labelledby="moTitle"><div id="moBox">' +
      '<h2 id="moTitle">হাতে অর্ডার যোগ করুন</h2>' +
      '<p class="mo-note">WhatsApp বা ফোনে পাওয়া অর্ডার। Order ID, তারিখ ও ডেলিভারি চার্জ নিজে বসবে।</p>' +
      '<form id="moForm" autocomplete="off">' +
      '<label>ক্রেতার নাম<input name="Name" required minlength="2" maxlength="80"></label>' +
      '<label>মোবাইল নম্বর<input name="Phone" required inputmode="numeric" pattern="01[0-9]{9}" placeholder="01XXXXXXXXX"></label>' +
      '<label>জেলা<input name="District" list="moDistricts" placeholder="যেমন: ঢাকা"><datalist id="moDistricts"><option value="ঢাকা"></option></datalist></label>' +
      '<label>পরিমাণ<input name="Qty" type="number" min="1" value="1" required></label>' +
      '<label class="mo-wide">পূর্ণ ঠিকানা<textarea name="Address" rows="2" required minlength="8" maxlength="400"></textarea></label>' +
      '<label class="mo-wide">পণ্য ও সাইজ<textarea name="Design" rows="2" required maxlength="1000" placeholder="যেমন: Premium Black Hafeza Set (Body 42 · Length 52) × 1"></textarea></label>' +
      '<label>মোট টাকা (ডেলিভারি চার্জসহ)<input name="Total" type="number" min="1" required></label>' +
      '<label>পেমেন্ট<select name="Payment"><option>Cash On Delivery</option><option>bKash</option><option>Nagad</option><option>Rocket</option></select></label>' +
      '<label>Txn / Sender (অগ্রিম দিলে)<input name="Txn" maxlength="80"></label>' +
      '<label>নোট<input name="Notes" maxlength="300"></label>' +
      '<div id="moActions"><span id="moStatus" role="status"></span>' +
      '<button type="button" class="pn-btn" id="moCancel">বাতিল</button>' +
      '<button type="submit" class="pn-btn pn-btn-primary" id="moSubmit">অর্ডার যোগ করুন</button></div>' +
      "</form></div></div>"
    );
    document.body.appendChild(overlay);
    overlay.addEventListener("click", function (e) { if (e.target === overlay) close(); });
    document.getElementById("moCancel").addEventListener("click", close);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !overlay.hidden) close(); });
    document.getElementById("moForm").addEventListener("submit", submit);
  }

  function status(text, kind) {
    var s = document.getElementById("moStatus");
    s.textContent = text || "";
    s.className = kind ? "is-" + kind : "";
  }
  function open() { build(); status(""); document.getElementById("moOverlay").hidden = false; document.querySelector("#moForm [name=Name]").focus(); }
  function close() { var o = document.getElementById("moOverlay"); if (o) o.hidden = true; }

  function submit(e) {
    e.preventDefault();
    var form = e.target, btn = document.getElementById("moSubmit");
    var fields = {};
    Array.prototype.forEach.call(form.elements, function (x) { if (x.name) fields[x.name] = String(x.value || "").trim(); });
    if (!/^01\d{9}$/.test(fields.Phone)) { status("সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন।", "error"); return; }
    btn.disabled = true; status("যোগ হচ্ছে…");
    window.MaAdmin.call("AdminManualOrderCreate", fields).then(function (res) {
      status("অর্ডার যোগ হয়েছে: " + res.orderId, "ok");
      form.reset();
      var refresh = document.getElementById("ordRefresh");
      if (refresh) refresh.click();
      setTimeout(close, 1200);
    }).catch(function (err) {
      if (err && err.code === "PHONE_BLOCKED" && window.confirm("এই নম্বরটি Blocked তালিকায় আছে। তবুও অর্ডার যোগ করবেন?")) {
        fields.AllowBlocked = "1";
        return window.MaAdmin.call("AdminManualOrderCreate", fields).then(function (res) {
          status("অর্ডার যোগ হয়েছে: " + res.orderId, "ok"); form.reset();
          var r = document.getElementById("ordRefresh"); if (r) r.click();
        });
      }
      status((err && err.message) || "অর্ডার যোগ করা যায়নি।", "error");
    }).then(function () { btn.disabled = false; }, function (err2) { btn.disabled = false; status((err2 && err2.message) || "অর্ডার যোগ করা যায়নি।", "error"); });
  }

  function addButton() {
    var refresh = document.getElementById("ordRefresh");
    if (!refresh || document.getElementById("moOpen")) return;
    var b = document.createElement("button");
    b.type = "button"; b.className = "pn-btn pn-btn-primary"; b.id = "moOpen"; b.textContent = "+ হাতে অর্ডার";
    b.addEventListener("click", open);
    refresh.parentNode.insertBefore(b, refresh);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", addButton); else addButton();
})();
