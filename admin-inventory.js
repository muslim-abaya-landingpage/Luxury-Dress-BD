(function () {
  "use strict";
  function byId(id) { return document.getElementById(id); }
  function esc(v) { return String(v == null ? "" : v).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;"); }
  function money(v) { return "৳" + (Number(v)||0).toLocaleString("en-BD",{maximumFractionDigits:2}); }
  var state = { suppliers: [], purchases: [], busy: false };
  function message(text) { byId("invError").textContent=text; byId("invError").hidden=!text; }
  function buttonBusy(id, busy, label) { var b=byId(id); if(!b)return; b.disabled=!!busy; if(label){if(!b.dataset.label)b.dataset.label=b.textContent;b.textContent=busy?label:b.dataset.label;} }
  function renderSuppliers() {
    var rows=state.suppliers||[];
    byId("invSupplierBody").innerHTML=rows.length?rows.map(function(s){
      return "<tr><td><b>"+esc(s.name)+"</b><small>"+esc(s.id)+"</small></td><td>"+esc(s.phone||"—")+"</td><td>"+money(s.purchaseTotal)+"</td><td>"+money(s.paidTotal)+"</td><td><b>"+money(s.due)+"</b></td></tr>";
    }).join(""):'<tr><td colspan="5" class="adm-empty">এখনো কোনো সাপ্লায়ার যোগ করা হয়নি।</td></tr>';
    var opts='<option value="">সাপ্লায়ার নির্বাচন করুন</option>'+rows.filter(function(s){return s.status!=="inactive";}).map(function(s){return '<option value="'+esc(s.id)+'">'+esc(s.name)+' · বকেয়া '+money(s.due)+'</option>';}).join("");
    byId("invPurchaseSupplier").innerHTML=opts;
    byId("invPaymentSupplier").innerHTML=opts;
  }
  function renderPurchases() {
    var rows=state.purchases||[];
    byId("invPurchaseBody").innerHTML=rows.length?rows.map(function(p){
      var action=p.status==="DRAFT"?'<button type="button" class="adm-btn adm-btn-primary inv-receive" data-id="'+esc(p.id)+'">স্টকে যোগ করুন</button>':(p.status==="RECEIVED"?'স্টকে যোগ হয়েছে':esc(p.status));
      return "<tr><td><b>"+esc(p.date||"—")+"</b><small>"+esc(p.invoiceNo||p.id)+"</small></td><td>"+esc(p.supplierName)+"</td><td>"+money(p.total)+"</td><td>"+money(p.paid)+"</td><td>"+money(p.due)+"</td><td>"+esc(p.status)+"</td><td>"+action+"</td></tr>";
    }).join(""):'<tr><td colspan="7" class="adm-empty">এখনো কোনো Purchase নেই।</td></tr>';
  }
  function renderPayments(rows) {
    rows=rows||[];
    byId("invPaymentBody").innerHTML=rows.length?rows.map(function(p){
      var s=state.suppliers.find(function(x){return x.id===p.supplierId;});
      return "<tr><td>"+esc(p.date||"—")+"</td><td>"+esc(s?s.name:p.supplierId)+"</td><td>"+esc(p.purchaseId||"সাপ্লায়ার অ্যাকাউন্ট")+"</td><td><b>"+money(p.amount)+"</b></td><td>"+esc(p.method||"—")+"</td><td>"+esc(p.reference||"—")+"</td></tr>";
    }).join(""):'<tr><td colspan="6" class="adm-empty">এখনো কোনো পেমেন্ট নেই।</td></tr>';
  }
  function refreshAll() {
    if(state.busy)return;
    state.busy=true; message("");
    Promise.all([
      MaAdmin.getInventorySummary(),
      MaAdmin.listInventorySuppliers(""),
      MaAdmin.listInventoryPurchases(100),
      MaAdmin.listInventoryPayments(100)
    ]).then(function(results){
      var summary=results[0]||{};
      state.suppliers=results[1].items||[];
      state.purchases=results[2].items||[];
      byId("invStock").textContent=Number(summary.stockUnits||0).toLocaleString("en-BD");
      byId("invLow").textContent=Number(summary.lowStock||0).toLocaleString("en-BD")+" / "+Number(summary.outOfStock||0)+" শেষ";
      byId("invPurchaseTotal").textContent=money(summary.purchaseTotal);
      byId("invDue").textContent=money(summary.supplierDue);
      renderSuppliers(); renderPurchases(); renderPayments(results[3].items);
    }).catch(function(err){message("তথ্য লোড হয়নি: "+String(err&&err.message||err));})
    .finally(function(){state.busy=false;});
  }
  function addItemRow() {
    var tr=document.createElement("tr"); tr.className="inv-item-row";
    tr.innerHTML='<td><input class="inv-product-id" required placeholder="Product ID"></td><td><input class="inv-product-name" required placeholder="পণ্যের নাম"></td><td><input class="inv-variant" placeholder="Black · 52"></td><td><input class="inv-qty" type="number" min="1" step="1" required value="1"></td><td><input class="inv-unit-cost" type="number" min="0" step="0.01" required value="0"></td><td><button type="button" class="adm-btn adm-btn-secondary inv-remove" aria-label="সারি মুছুন">×</button></td>';
    byId("invPurchaseItems").appendChild(tr);
  }
  byId("invAddItem").addEventListener("click",addItemRow);
  byId("invPurchaseItems").addEventListener("click",function(e){
    var b=e.target.closest(".inv-remove"); if(!b)return;
    if(byId("invPurchaseItems").querySelectorAll(".inv-item-row").length<=1){message("কমপক্ষে একটি পণ্য রাখতে হবে।");return;}
    b.closest("tr").remove();
  });
  byId("invSupplierForm").addEventListener("submit",function(e){
    e.preventDefault(); message("");
    buttonBusy("invSupplierSave",true,"সেভ হচ্ছে…");
    MaAdmin.saveInventorySupplier({name:byId("invSupplierName").value,phone:byId("invSupplierPhone").value,address:byId("invSupplierAddress").value,notes:byId("invSupplierNotes").value})
      .then(function(){byId("invSupplierForm").reset();refreshAll();})
      .catch(function(err){message("সাপ্লায়ার সেভ হয়নি: "+String(err&&err.message||err));})
      .finally(function(){buttonBusy("invSupplierSave",false);});
  });
  byId("invPurchaseForm").addEventListener("submit",function(e){
    e.preventDefault(); message("");
    var items=Array.prototype.map.call(byId("invPurchaseItems").querySelectorAll(".inv-item-row"),function(row){
      return {productId:row.querySelector(".inv-product-id").value.trim(),productName:row.querySelector(".inv-product-name").value.trim(),variant:row.querySelector(".inv-variant").value.trim(),qty:Number(row.querySelector(".inv-qty").value),unitCost:Number(row.querySelector(".inv-unit-cost").value),category:""};
    });
    if(!items.length||items.some(function(x){return !x.productId||!x.productName||!Number.isInteger(x.qty)||x.qty<1||!Number.isFinite(x.unitCost)||x.unitCost<0;})){message("প্রতিটি পণ্যের ID, নাম, সঠিক পরিমাণ ও ক্রয়মূল্য দিন।");return;}
    buttonBusy("invPurchaseSave",true,"সেভ হচ্ছে…");
    MaAdmin.createInventoryPurchase({supplierId:byId("invPurchaseSupplier").value,invoiceNo:byId("invInvoice").value,date:byId("invPurchaseDate").value,otherCost:byId("invOtherCost").value,paid:byId("invPaid").value,items:items})
      .then(function(res){byId("invPurchaseForm").reset();byId("invOtherCost").value="0";byId("invPaid").value="0";byId("invPurchaseItems").innerHTML="";addItemRow();message("Purchase Draft সেভ হয়েছে। পণ্য হাতে পাওয়ার পর ক্রয়ের তালিকা থেকে ‘স্টকে যোগ করুন’ চাপুন।");refreshAll();})
      .catch(function(err){message("Purchase সেভ হয়নি: "+String(err&&err.message||err));})
      .finally(function(){buttonBusy("invPurchaseSave",false);});
  });
  byId("invPurchaseBody").addEventListener("click",function(e){
    var b=e.target.closest(".inv-receive");if(!b)return;
    var id=b.getAttribute("data-id");
    if(!window.confirm("এই Purchase-এর পণ্যগুলো বর্তমান স্টকে যোগ করবেন?"))return;
    b.disabled=true;b.textContent="যোগ হচ্ছে…";
    MaAdmin.receiveInventoryPurchase(id).then(function(res){message(res.message||"পণ্য স্টকে যোগ হয়েছে।");refreshAll();})
      .catch(function(err){message("স্টকে যোগ হয়নি: "+String(err&&err.message||err));b.disabled=false;b.textContent="স্টকে যোগ করুন";});
  });
  byId("invPaymentForm").addEventListener("submit",function(e){
    e.preventDefault();message("");
    buttonBusy("invPaymentSave",true,"সেভ হচ্ছে…");
    MaAdmin.createInventorySupplierPayment({supplierId:byId("invPaymentSupplier").value,amount:byId("invPaymentAmount").value,method:byId("invPaymentMethod").value,reference:byId("invPaymentReference").value,date:byId("invPaymentDate").value})
      .then(function(){byId("invPaymentForm").reset();refreshAll();})
      .catch(function(err){message("পেমেন্ট সেভ হয়নি: "+String(err&&err.message||err));})
      .finally(function(){buttonBusy("invPaymentSave",false);});
  });
  byId("invRefreshPurchases").addEventListener("click",refreshAll);
  var today=new Date();byId("invPurchaseDate").value=today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
  addItemRow();
  MaAdminShell.start(function(){refreshAll();});
})();