/**
 * Inventory Management — Phase 1 data foundation.
 * Suppliers, purchase drafts/receiving and supplier payments live in the same
 * Apps Script spreadsheet as StockVariants/StockLedger. This intentionally
 * avoids creating a second stock source of truth in Supabase.
 */
var INV_SUPPLIERS_SHEET_ = 'Inventory Suppliers';
var INV_PURCHASES_SHEET_ = 'Inventory Purchases';
var INV_PURCHASE_ITEMS_SHEET_ = 'Inventory Purchase Items';
var INV_PAYMENTS_SHEET_ = 'Inventory Supplier Payments';

function invSheet_(name, headers) {
  var sh = ensureSheet_(name, headers);
  if (sh.getLastRow() === 0) sh.getRange(1, 1, 1, headers.length).setValues([headers]);
  return sh;
}
function invSuppliersSheet_() {
  return invSheet_(INV_SUPPLIERS_SHEET_, ['Supplier ID','Name','Phone','Address','Notes','Status','Created At','Updated At','Updated By']);
}
function invPurchasesSheet_() {
  return invSheet_(INV_PURCHASES_SHEET_, ['Purchase ID','Supplier ID','Supplier Name','Invoice No','Purchase Date','Subtotal','Other Cost','Total','Paid','Due','Status','Notes','Created At','Created By','Received At','Received By']);
}
function invPurchaseItemsSheet_() {
  return invSheet_(INV_PURCHASE_ITEMS_SHEET_, ['Purchase ID','Product ID','Product Name','Category','Variant','Qty','Unit Cost','Line Total']);
}
function invPaymentsSheet_() {
  return invSheet_(INV_PAYMENTS_SHEET_, ['Payment ID','Supplier ID','Purchase ID','Amount','Method','Reference','Payment Date','Notes','Created At','Created By']);
}
function invText_(v, max) {
  return String(v == null ? '' : v).replace(/[\r\n\t]+/g, ' ').trim().slice(0, max || 200);
}
function invMoney_(v, field) {
  var n = Number(v);
  if (!isFinite(n) || n < 0 || n > 100000000) throw new Error('INVALID_' + field);
  return Math.round(n * 100) / 100;
}
function invRows_(sheet, width) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  return sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
}
function invSupplierMap_() {
  var map = {};
  invRows_(invSuppliersSheet_(), 9).forEach(function(r) {
    var id = String(r[0] || '').trim();
    if (id) map[id] = { id:id, name:String(r[1] || ''), phone:String(r[2] || ''), address:String(r[3] || ''), notes:String(r[4] || ''), status:String(r[5] || 'active') };
  });
  return map;
}
function invSupplierBalances_() {
  var suppliers = invSupplierMap_(), purchases = {}, payments = {};
  invRows_(invPurchasesSheet_(), 16).forEach(function(r) {
    var sid=String(r[1]||''), status=String(r[10]||'');
    if (!sid || status === 'VOID') return;
    purchases[sid]=(purchases[sid]||0)+(Number(r[7])||0);
  });
  invRows_(invPaymentsSheet_(), 10).forEach(function(r) {
    var sid=String(r[1]||'');
    if (sid) payments[sid]=(payments[sid]||0)+(Number(r[3])||0);
  });
  Object.keys(suppliers).forEach(function(id) {
    suppliers[id].purchaseTotal=Math.round((purchases[id]||0)*100)/100;
    suppliers[id].paidTotal=Math.round((payments[id]||0)*100)/100;
    suppliers[id].due=Math.round((suppliers[id].purchaseTotal-suppliers[id].paidTotal)*100)/100;
  });
  return suppliers;
}
function invListSuppliers_(e) {
  var auth=verifyAdminSession_(param_(e,'Token')); if(!auth.ok) return auth;
  var map=invSupplierBalances_(), q=invText_(param_(e,'Search'),100).toLowerCase();
  var items=Object.keys(map).map(function(id){return map[id];}).filter(function(s){
    return !q || (s.name+' '+s.phone+' '+s.id).toLowerCase().indexOf(q)!==-1;
  }).sort(function(a,b){return a.name.localeCompare(b.name);});
  return {ok:true,items:items,count:items.length};
}
function invSaveSupplier_(e) {
  var auth=verifyAdminSession_(param_(e,'Token')); if(!auth.ok) return auth;
  var id=invText_(param_(e,'SupplierId'),80), name=invText_(param_(e,'Name'),120);
  var phone=invText_(param_(e,'Phone'),30), address=invText_(param_(e,'Address'),300), notes=invText_(param_(e,'Notes'),500);
  if(!name) return {ok:false,error:'NAME_REQUIRED',message:'সাপ্লায়ারের নাম লিখুন।'};
  if(phone && !/^[0-9+()\- ]{6,30}$/.test(phone)) return {ok:false,error:'INVALID_PHONE',message:'সঠিক ফোন নম্বর দিন।'};
  var lock=LockService.getScriptLock(); if(!lock.tryLock(15000)) return {ok:false,error:'BUSY',message:'একটু পরে আবার চেষ্টা করুন।'};
  try {
    var sh=invSuppliersSheet_(), rows=invRows_(sh,9), at=-1;
    for(var i=0;i<rows.length;i++) if(id && String(rows[i][0])===id){at=i+2;break;}
    if(!id) id='SUP-'+Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase();
    var now=new Date(), who=auth.email||auth.phone||'admin';
    var old=at>0?sh.getRange(at,1,1,9).getValues()[0]:null;
    var row=[id,name,phone,address,notes,old?String(old[5]||'active'):'active',old?old[6]:now,now,who];
    if(at>0) sh.getRange(at,1,1,9).setValues([row]); else sh.appendRow(row);
    return {ok:true,supplier:{id:id,name:name,phone:phone,address:address,notes:notes,status:row[5]}};
  } finally {lock.releaseLock();}
}
function invListPurchases_(e) {
  var auth=verifyAdminSession_(param_(e,'Token')); if(!auth.ok) return auth;
  var limit=Math.min(500,Math.max(1,parseInt(param_(e,'Limit'),10)||100));
  var rows=invRows_(invPurchasesSheet_(),16), items=[];
  for(var i=rows.length-1;i>=0 && items.length<limit;i--){
    var r=rows[i]; items.push({id:String(r[0]),supplierId:String(r[1]),supplierName:String(r[2]),invoiceNo:String(r[3]),date:formatCell_(r[4]),subtotal:Number(r[5])||0,otherCost:Number(r[6])||0,total:Number(r[7])||0,paid:Number(r[8])||0,due:Number(r[9])||0,status:String(r[10]||'DRAFT'),notes:String(r[11]||'')});
  }
  return {ok:true,items:items,count:items.length};
}
function invCreatePurchase_(e) {
  var auth=verifyAdminSession_(param_(e,'Token')); if(!auth.ok) return auth;
  var supplierId=invText_(param_(e,'SupplierId'),80), invoiceNo=invText_(param_(e,'InvoiceNo'),100);
  var dateRaw=invText_(param_(e,'PurchaseDate'),10), notes=invText_(param_(e,'Notes'),500);
  var suppliers=invSupplierMap_(), supplier=suppliers[supplierId];
  if(!supplier || supplier.status==='inactive') return {ok:false,error:'SUPPLIER_NOT_FOUND',message:'সক্রিয় সাপ্লায়ার নির্বাচন করুন।'};
  var lines;
  try {lines=JSON.parse(param_(e,'ItemsJSON')||'[]');} catch(err){return {ok:false,error:'INVALID_ITEMS',message:'পণ্যের তালিকা পড়া যায়নি।'};}
  if(!Array.isArray(lines)||!lines.length||lines.length>100) return {ok:false,error:'INVALID_ITEMS',message:'১ থেকে ১০০টি পণ্য যোগ করুন।'};
  var clean=[], subtotal=0, seenVariants={};
  try {
    lines.forEach(function(x){
      var productId=invText_(x.productId,100), productName=invText_(x.productName,160), category=invText_(x.category,100), variant=invText_(x.variant,180);
      var qty=Number(x.qty), unitCost=invMoney_(x.unitCost,'UNIT_COST');
      if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(productId)||!productName||!isFinite(qty)||Math.floor(qty)!==qty||qty<1||qty>100000) throw new Error('INVALID_ITEM');
      var variantKey=productId+'|'+variant.toLowerCase(); if(seenVariants[variantKey]) throw new Error('DUPLICATE_VARIANT'); seenVariants[variantKey]=true;
      var line=Math.round(qty*unitCost*100)/100; subtotal+=line;
      clean.push({productId:productId,productName:productName,category:category,variant:variant,qty:qty,unitCost:unitCost,lineTotal:line});
    });
  } catch(err2){return {ok:false,error:err2.message==='INVALID_UNIT_COST'?'INVALID_ITEM':'INVALID_ITEM',message:'প্রতিটি পণ্যের ID, নাম, পরিমাণ ও ক্রয়মূল্য যাচাই করুন।'};}
  var otherCost;
  try {otherCost=invMoney_(param_(e,'OtherCost')||0,'OTHER_COST');} catch(err3){return {ok:false,error:'INVALID_OTHER_COST',message:'অতিরিক্ত খরচ সঠিক নয়।'};}
  var total=Math.round((subtotal+otherCost)*100)/100, paid;
  try {paid=invMoney_(param_(e,'Paid')||0,'PAID');} catch(err4){return {ok:false,error:'INVALID_PAID',message:'পরিশোধের পরিমাণ সঠিক নয়।'};}
  if(paid>total) return {ok:false,error:'OVERPAYMENT',message:'পরিশোধ মোট বিলের বেশি হতে পারবে না।'};
  if(dateRaw && !/^\d{4}-\d{2}-\d{2}$/.test(dateRaw)) return {ok:false,error:'INVALID_DATE',message:'তারিখ YYYY-MM-DD ফরম্যাটে দিন।'};
  var lock=LockService.getScriptLock(); if(!lock.tryLock(20000)) return {ok:false,error:'BUSY',message:'একটু পরে আবার চেষ্টা করুন।'};
  try {
    var id='PUR-'+Utilities.getUuid().replace(/-/g,'').slice(0,14).toUpperCase(), now=new Date(), who=auth.email||auth.phone||'admin';
    invPurchasesSheet_().appendRow([id,supplierId,supplier.name,invoiceNo,dateRaw||now,subtotal,otherCost,total,paid,total-paid,'DRAFT',notes,now,who,'','']);
    var itemRows=clean.map(function(x){return [id,x.productId,x.productName,x.category,x.variant,x.qty,x.unitCost,x.lineTotal];});
    var itemSheet=invPurchaseItemsSheet_(); itemSheet.getRange(itemSheet.getLastRow()+1,1,itemRows.length,8).setValues(itemRows);
    if(paid>0) invPaymentsSheet_().appendRow(['PAY-'+Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase(),supplierId,id,paid,'','',dateRaw||now,'Initial purchase payment',now,who]);
    return {ok:true,purchaseId:id,status:'DRAFT',total:total,paid:paid,due:Math.round((total-paid)*100)/100,message:'ক্রয় খসড়া হিসেবে সেভ হয়েছে। স্টকে যোগ করতে Receive Purchase চাপুন।'};
  } finally {lock.releaseLock();}
}
function invReceivePurchase_(e) {
  var auth=verifyAdminSession_(param_(e,'Token')); if(!auth.ok) return auth;
  var id=invText_(param_(e,'PurchaseId'),80); if(!id) return {ok:false,error:'PURCHASE_ID_REQUIRED'};
  var lock=LockService.getScriptLock(); if(!lock.tryLock(20000)) return {ok:false,error:'BUSY',message:'একটু পরে আবার চেষ্টা করুন।'};
  try {
    var sh=invPurchasesSheet_(), rows=invRows_(sh,16), rowNo=-1, purchase=null;
    for(var i=0;i<rows.length;i++) if(String(rows[i][0])===id){rowNo=i+2;purchase=rows[i];break;}
    if(!purchase) return {ok:false,error:'PURCHASE_NOT_FOUND',message:'ক্রয় রেকর্ড পাওয়া যায়নি।'};
    if(String(purchase[10])==='RECEIVED') return {ok:true,alreadyReceived:true,purchaseId:id,message:'এই ক্রয় আগে থেকেই স্টকে যোগ করা আছে।'};
    if(String(purchase[10])!=='DRAFT') return {ok:false,error:'INVALID_PURCHASE_STATUS',message:'এই ক্রয় গ্রহণ করা যাবে না।'};
    var items=invRows_(invPurchaseItemsSheet_(),8).filter(function(r){return String(r[0])===id;});
    if(!items.length) return {ok:false,error:'PURCHASE_ITEMS_MISSING',message:'ক্রয়ের পণ্য পাওয়া যায়নি।'};
    // Use the existing append-only stock ledger as a retry guard if execution stops mid-receive.
    var ledgerRows=invRows_(ensureStockLedgerSheet_(),11), received={};
    ledgerRows.forEach(function(r){
      if(String(r[9])===id && String(r[3])==='PURCHASE') received[String(r[1])+'|'+String(r[2]).toLowerCase()]=true;
    });
    items.forEach(function(r){
      var key=String(r[1])+'|'+String(r[4]).toLowerCase();
      if(received[key]) return;
      mutateStockVariant_({productId:String(r[1]),productName:String(r[2]),category:String(r[3]),variant:String(r[4]),deltaAvailable:Number(r[5])||0,deltaReserved:0,setTracked:true,changeType:'PURCHASE',reason:'Purchase received '+id,orderId:id,admin:auth.email||'admin'});
      received[key]=true;
    });
    sh.getRange(rowNo,11,1,6).setValues([['RECEIVED',purchase[11],purchase[12],purchase[13],new Date(),auth.email||auth.phone||'admin']]);
    return {ok:true,purchaseId:id,status:'RECEIVED',itemsReceived:items.length,message:'ক্রয়ের পণ্য স্টকে যোগ হয়েছে।'};
  } finally {lock.releaseLock();}
}
function invCreateSupplierPayment_(e) {
  var auth=verifyAdminSession_(param_(e,'Token')); if(!auth.ok) return auth;
  var supplierId=invText_(param_(e,'SupplierId'),80), purchaseId=invText_(param_(e,'PurchaseId'),80);
  var amount;
  try {amount=invMoney_(param_(e,'Amount'),'AMOUNT');} catch(err){return {ok:false,error:'INVALID_AMOUNT',message:'পেমেন্টের পরিমাণ সঠিক নয়।'};}
  if(!supplierId||amount<=0) return {ok:false,error:'INVALID_PAYMENT',message:'সাপ্লায়ার ও পেমেন্টের পরিমাণ দিন।'};
  // Lock before checking the balance; concurrent payment requests must not both spend the same due.
  var lock=LockService.getScriptLock(); if(!lock.tryLock(15000)) return {ok:false,error:'BUSY'};
  try {
    var suppliers=invSupplierBalances_(), supplier=suppliers[supplierId];
    if(!supplier) return {ok:false,error:'SUPPLIER_NOT_FOUND'};
    var purchase=null, purchaseRow=-1, purchases=invRows_(invPurchasesSheet_(),16);
    if(purchaseId){
      for(var i=0;i<purchases.length;i++) if(String(purchases[i][0])===purchaseId){purchase=purchases[i];purchaseRow=i+2;break;}
      if(!purchase||String(purchase[1])!==supplierId) return {ok:false,error:'PURCHASE_NOT_FOUND',message:'এই সাপ্লায়ারের ক্রয় পাওয়া যায়নি।'};
      if(amount>Number(purchase[9]||0)) return {ok:false,error:'OVERPAYMENT',message:'এই ক্রয়ের বকেয়ার বেশি পেমেন্ট করা যাবে না।'};
    } else if(amount>supplier.due) return {ok:false,error:'OVERPAYMENT',message:'সাপ্লায়ারের মোট বকেয়ার বেশি পেমেন্ট করা যাবে না।'};
    var now=new Date(), who=auth.email||auth.phone||'admin', paymentId='PAY-'+Utilities.getUuid().replace(/-/g,'').slice(0,12).toUpperCase();
    invPaymentsSheet_().appendRow([paymentId,supplierId,purchaseId,amount,invText_(param_(e,'Method'),40),invText_(param_(e,'Reference'),100),invText_(param_(e,'PaymentDate'),10)||now,invText_(param_(e,'Notes'),300),now,who]);
    if(purchaseId && purchaseRow>0){
      var paidNow=(Number(purchase[8])||0)+amount;
      invPurchasesSheet_().getRange(purchaseRow,9,1,2).setValues([[paidNow,Math.max(0,(Number(purchase[7])||0)-paidNow)]]);
    }
    return {ok:true,paymentId:paymentId,amount:amount,message:'সাপ্লায়ার পেমেন্ট সেভ হয়েছে।'};
  } finally {lock.releaseLock();}
}
function invListPayments_(e) {
  var auth=verifyAdminSession_(param_(e,'Token')); if(!auth.ok) return auth;
  var limit=Math.min(500,Math.max(1,parseInt(param_(e,'Limit'),10)||100)), rows=invRows_(invPaymentsSheet_(),10), items=[];
  for(var i=rows.length-1;i>=0&&items.length<limit;i--){var r=rows[i];items.push({id:String(r[0]),supplierId:String(r[1]),purchaseId:String(r[2]||''),amount:Number(r[3])||0,method:String(r[4]||''),reference:String(r[5]||''),date:formatCell_(r[6]),notes:String(r[7]||'')});}
  return {ok:true,items:items,count:items.length};
}
function invSummary_(e) {
  var auth=verifyAdminSession_(param_(e,'Token')); if(!auth.ok) return auth;
  var stock=ensureStockVariantsSheet_(), stockRows=invRows_(stock,10), totalQty=0,low=0,out=0;
  stockRows.forEach(function(r){if(!(r[4]===true||String(r[4]).toUpperCase()==='TRUE'))return;var qty=Math.max(0,(Number(r[5])||0)-(Number(r[6])||0)),threshold=r[7]===''?STOCK_LOW_DEFAULT_THRESHOLD_:Number(r[7]);totalQty+=qty;if(qty===0)out++;else if(qty<=threshold)low++;});
  var suppliers=invSupplierBalances_(), supplierList=Object.keys(suppliers).map(function(k){return suppliers[k];});
  var purchases=invRows_(invPurchasesSheet_(),16), purchaseTotal=0, due=0;
  purchases.forEach(function(r){if(String(r[10])==='VOID')return;purchaseTotal+=Number(r[7])||0;});
  // Sum supplier account balances, so unallocated supplier-level payments also reduce the dashboard due.
  supplierList.forEach(function(s){due+=Number(s.due)||0;});
  return {ok:true,stockUnits:totalQty,lowStock:low,outOfStock:out,supplierCount:supplierList.length,purchaseTotal:Math.round(purchaseTotal*100)/100,supplierDue:Math.round(due*100)/100};
}
