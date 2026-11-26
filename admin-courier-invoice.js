/**
 * Muslim Abaya — printable courier invoice / manifest (admin). Prints ONE page listing
 * several parcels being handed over to a courier in one batch (order #, customer, address,
 * COD amount, tracking #) with a total COD sum — distinct from MaInvoice, which prints one
 * customer-facing invoice per order. MaCourierInvoice.print(list, meta) opens the browser
 * print dialog through a hidden iframe (no pop-up blocker involved), same pattern as
 * admin-invoice.js.
 */
(function (g) {
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function num(v) { return parseFloat(String(v == null ? "0" : v).replace(/[^\d.-]/g, "")) || 0; }
  function money(n) { return "৳" + Number(n || 0).toLocaleString("en-US"); }

  var CSS =
    "@page{size:A4;margin:14mm}*{box-sizing:border-box}" +
    "body{margin:0;font-family:'Hind Siliguri','Segoe UI',Arial,sans-serif;color:#1b1a1f;font-size:12px;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
    ".head{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #14121a;padding-bottom:10px;margin-bottom:14px}" +
    ".head h1{margin:0;font:700 20px Georgia,serif;letter-spacing:.08em}" +
    ".head .meta{text-align:right;font-size:11.5px;color:#444}" +
    ".head .meta b{display:block;font-size:14px;color:#14121a}" +
    "table{width:100%;border-collapse:collapse;margin-bottom:14px}" +
    "th{background:#14121a;color:#f3ecda;font-size:10px;letter-spacing:.06em;text-transform:uppercase;padding:7px 8px;text-align:left}" +
    "td{padding:7px 8px;border-bottom:1px solid #e6e1d4;vertical-align:top}" +
    "tr:nth-child(even) td{background:#faf8f2}" +
    ".num{text-align:right;white-space:nowrap}" +
    ".sum{display:flex;justify-content:flex-end;gap:28px;margin-top:6px;font-size:13px}" +
    ".sum b{font-size:16px}" +
    ".sign{display:flex;justify-content:space-between;margin-top:46px}" +
    ".sign div{width:42%;border-top:1px solid #777;padding-top:6px;font-size:11px;color:#555;text-align:center}";

  function rowsHtml(list) {
    return list.map(function (o, i) {
      var addr = [o.address, o.district].filter(Boolean).join(", ");
      return "<tr><td>" + (i + 1) + "</td>" +
        "<td><b>" + esc(o.orderId || "—") + "</b></td>" +
        "<td>" + esc(o.name || "—") + "<br><span style='color:#777'>" + esc(o.phone || "") + "</span></td>" +
        "<td>" + esc(addr || "—") + "</td>" +
        "<td>" + esc(o.tracking || o.consignmentId || "—") + "</td>" +
        "<td class='num'>" + money(o.due != null ? o.due : o.total) + "</td></tr>";
    }).join("");
  }

  function html(list, meta) {
    meta = meta || {};
    var total = list.reduce(function (sum, o) { return sum + num(o.due != null ? o.due : o.total); }, 0);
    var today = new Date().toLocaleDateString("en-GB");
    return "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Courier Invoice</title><style>" + CSS + "</style></head><body>" +
      "<div class='head'><div><h1>কুরিয়ার ইনভয়েস / ম্যানিফেস্ট</h1><div>Muslim Abaya · muslimabaya.com</div></div>" +
      "<div class='meta'><b>" + esc(meta.courier || "সব কুরিয়ার") + "</b>তারিখ: " + today + "<br>মোট পার্সেল: " + list.length + "</div></div>" +
      "<table><thead><tr><th>#</th><th>অর্ডার</th><th>কাস্টমার</th><th>ঠিকানা</th><th>ট্র্যাকিং</th><th class='num'>COD (৳)</th></tr></thead><tbody>" +
      rowsHtml(list) + "</tbody></table>" +
      "<div class='sum'><span>মোট পার্সেল: <b>" + list.length + "</b></span><span>মোট COD: <b>" + money(total) + "</b></span></div>" +
      "<div class='sign'><div>কুরিয়ার প্রতিনিধির স্বাক্ষর</div><div>Muslim Abaya প্রতিনিধির স্বাক্ষর</div></div>" +
      "</body></html>";
  }

  function print(list, meta) {
    if (!list || !list.length) return;
    var f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    var d = f.contentWindow.document;
    d.open(); d.write(html(list, meta)); d.close();
    var done = false;
    function go() {
      if (done) return; done = true;
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { alert("প্রিন্ট চালু করা যায়নি।"); }
      setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 60000);
    }
    f.onload = go;
    setTimeout(go, 400);
  }

  g.MaCourierInvoice = { print: print, html: html };
})(window);
