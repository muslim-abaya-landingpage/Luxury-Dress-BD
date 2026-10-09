/**
 * Muslim Abaya — printable invoice (admin). MaInvoice.print(order) opens the browser print
 * dialog through a hidden iframe (no pop-up blocker involved).
 */
(function (g) {
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function num(v) { return parseFloat(String(v == null ? "0" : v).replace(/[^\d.]/g, "")) || 0; }
  function money(n) { return "৳" + Number(n || 0).toLocaleString("en-US"); }

  function itemsOf(o) {
    if (o.items && o.items.length) return o.items;
    return String(o.design || "").split(/\n/).map(function (s) { return s.replace(/^\d+\.\s*/, "").trim(); }).filter(Boolean);
  }

  var CSS =
    "@page{size:A5;margin:0}*{box-sizing:border-box}" +
    "body{margin:0;font-family:'Hind Siliguri','Segoe UI',Arial,sans-serif;color:#1b1a1f;font-size:12px;line-height:1.5;-webkit-print-color-adjust:exact;print-color-adjust:exact}" +
    ".inv{width:148mm;min-height:210mm;margin:0 auto;position:relative;overflow:hidden;background:#fff}" +
    ".top{background:#14121a;color:#f3ecda;padding:20px 22px 18px;position:relative}" +
    ".top:after{content:'';position:absolute;right:-40px;top:-50px;width:150px;height:150px;border-radius:50%;border:1px solid rgba(212,167,44,.45);box-shadow:0 0 0 18px rgba(212,167,44,.08)}" +
    ".brand{display:flex;align-items:center;gap:10px;position:relative;z-index:1}" +
    ".brand svg{width:38px;height:38px}.brand b{display:block;font:700 19px Georgia,serif;color:#fff;line-height:1.1}" +
    ".brand small{font-size:8.5px;letter-spacing:.3em;color:#d4a72c;font-weight:700}" +
    ".title{margin-top:14px;display:flex;justify-content:space-between;align-items:flex-end;position:relative;z-index:1}" +
    ".title h1{margin:0;font:700 22px Georgia,serif;letter-spacing:.14em;color:#d4a72c}" +
    ".title div{text-align:right;font-size:11px;color:#d9d2bf}.title div b{color:#fff;font-size:12.5px}" +
    ".gold{height:4px;background:linear-gradient(90deg,#b8860b,#e2b83d,#b8860b)}" +
    ".body{padding:16px 22px 0}" +
    ".meta{display:grid;grid-template-columns:1.2fr 1fr;gap:14px;margin-bottom:14px}" +
    ".box{border:1px solid #e8e1cf;background:#fdfaf2;border-radius:8px;padding:9px 12px}" +
    ".box h4{margin:0 0 3px;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:#8f7428}" +
    ".box p{margin:0}.box .n{font-weight:700;font-size:13.5px}" +
    "table{width:100%;border-collapse:collapse;margin-bottom:10px}" +
    "th{background:#14121a;color:#f3ecda;font-size:9.5px;letter-spacing:.1em;text-transform:uppercase;padding:7px 9px;text-align:left}" +
    "th:first-child{border-radius:6px 0 0 6px;width:26px}th:last-child{border-radius:0 6px 6px 0}" +
    "td{padding:8px 9px;border-bottom:1px solid #eee7d6;vertical-align:top}td:first-child{color:#8f7428;font-weight:700}" +
    ".sum{margin-left:auto;width:58%}.sum div{display:flex;justify-content:space-between;padding:3px 0;color:#555}" +
    ".sum .t{margin-top:4px;padding:8px 10px;border-radius:8px;background:#14121a;color:#fff;font-weight:700;font-size:14px}.sum .t span:last-child{color:#e2b83d}" +
    ".pay{display:inline-block;margin-top:10px;padding:3px 10px;border-radius:99px;border:1px solid #d4a72c;color:#7a5c08;font-weight:700;font-size:10.5px;background:#fbf3df}" +
    ".foot{position:absolute;left:0;right:0;bottom:0;padding:12px 22px;text-align:center;border-top:1px dashed #d9cfae;background:#fdfaf2;color:#6b6450;font-size:10.5px}" +
    ".foot b{display:block;font:700 13px Georgia,serif;color:#14121a;margin-bottom:2px}";

  var LOGO = '<svg viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#0e0d10"/><circle cx="32" cy="32" r="22" fill="none" stroke="#d4a72c" stroke-width="2"/><path d="M32 16c7 8 10 14 10 20a10 10 0 0 1-20 0c0-6 3-12 10-20Z" fill="none" stroke="#d4a72c" stroke-width="2.4" stroke-linejoin="round"/></svg>';

  function html(o) {
    var items = itemsOf(o);
    var total = num(o.total), charge = num(o.charge);
    var advance = num(o.advance), discount = num(o.discount) + num(o.couponDiscount);
    var subtotal = o.subtotal != null ? num(o.subtotal) : Math.max(0, total - charge);
    var due = o.due != null ? num(o.due) : Math.max(0, total - advance);
    var rows = items.length ? items.map(function (it, i) {
      return "<tr><td>" + (i + 1) + "</td><td>" + esc(it) + "</td></tr>";
    }).join("") : '<tr><td>1</td><td>' + esc(o.design || "—") + "</td></tr>";
    var sum = '<div><span>Subtotal</span><span>' + money(subtotal) + "</span></div>" +
      '<div><span>Delivery charge</span><span>' + money(charge) + "</span></div>" +
      (discount ? '<div><span>Discount</span><span>−' + money(discount) + "</span></div>" : "") +
      (advance ? '<div><span>Advance paid</span><span>' + money(advance) + "</span></div>" : "") +
      '<div class="t"><span>' + (advance ? "Due" : "Total") + "</span><span>" + money(advance ? due : total) + "</span></div>";
    return "<!DOCTYPE html><html><head><meta charset='utf-8'><title>Invoice " + esc(o.orderId) + "</title><style>" + CSS + "</style></head><body>" +
      "<div class='inv'><div class='top'><div class='brand'>" + LOGO + "<div><small>MUSLIM</small><b>Abaya</b></div></div>" +
      "<div class='title'><h1>INVOICE</h1><div><b>#" + esc(o.orderId || "—") + "</b><br>" + esc(o.time || "") + "</div></div></div><div class='gold'></div>" +
      "<div class='body'><div class='meta'>" +
      "<div class='box'><h4>Bill to</h4><p class='n'>" + esc(o.name || "—") + "</p><p>" + esc(o.phone || "") + "</p><p>" + esc([o.address, o.district].filter(Boolean).join(", ")) + "</p></div>" +
      "<div class='box'><h4>Order</h4><p>Status: <b>" + esc(o.status || "Pending") + "</b></p><p>Qty: <b>" + esc(o.qty || items.length || 1) + "</b></p>" + (o.tracking ? "<p>Tracking: <b>" + esc(o.tracking) + "</b></p>" : "") + "</div></div>" +
      "<table><thead><tr><th>#</th><th>Product</th></tr></thead><tbody>" + rows + "</tbody></table>" +
      "<div class='sum'>" + sum + "</div>" +
      "<span class='pay'>" + esc(o.payment || "Cash on Delivery") + "</span></div>" +
      "<div class='foot'><b>ধন্যবাদ — Thank you for shopping with us</b>muslimabaya.com · WhatsApp 01971642683</div></div></body></html>";
  }

  function print(o) {
    if (!o) return;
    var f = document.createElement("iframe");
    f.setAttribute("aria-hidden", "true");
    f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(f);
    var d = f.contentWindow.document;
    d.open(); d.write(html(o)); d.close();
    var done = false;
    function go() {
      if (done) return; done = true;
      try { f.contentWindow.focus(); f.contentWindow.print(); } catch (e) { alert("প্রিন্ট চালু করা যায়নি।"); }
      setTimeout(function () { if (f.parentNode) f.parentNode.removeChild(f); }, 60000);
    }
    f.onload = go;
    setTimeout(go, 400);
  }

  g.MaInvoice = { print: print, html: html };
})(window);
