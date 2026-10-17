const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync('product-manager.html','utf8');
function between(start,end){return html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));}
const ui={stockPublishing:false,savedSnapshot:'saved',catalogSnapshot:()=> 'saved',document:{getElementById:()=>({disabled:false})},setSaveStatus(){},renderCatList(){},renderMain(){},saveAll:()=>Promise.resolve({sha:'test'})};
vm.createContext(ui);
vm.runInContext(between('  function setProductAvailability(', '  function setSaveStatus('),ui);
vm.runInContext(between('  function productToJsLines(', '  function generateProductsFile('),ui);
ui.jsStr=s=>JSON.stringify(s);
const helpers={window:{}};vm.createContext(helpers);vm.runInContext(fs.readFileSync('product-utils.js','utf8'),helpers);
const U=helpers.window.maCatalog;
(async()=>{
  for(const category of ['abaya','cover-up','premium-two-piece','tops-kurti','embroidery','karchupi','kaftan','hijab','panjabi']){
    const p={id:category,name:category,price:100,image:'photo.webp'};
    assert.equal(await ui.publishStockToggle(p,()=>{}),true);
    assert.equal(p.inStock,false);assert.equal(U.getStockStatus(p).label,'Out of Stock');
    assert.match(ui.productToJsLines(p).join('\n'),/inStock: false/);
    assert.equal(await ui.publishStockToggle(p,()=>{}),true);
    assert.equal(p.inStock,true);assert.equal(p.stock,undefined);
    const serialized=ui.productToJsLines(p).join('\n');assert.match(serialized,/inStock: true/);
    const restored=vm.runInNewContext('('+serialized+')');
    const normalized=U.normalizeProductEntry(restored,category,0);
    assert.equal(normalized.inStock,true);assert.equal(U.getStockStatus(normalized).label,'In Stock');
    assert.equal(U.getStockStatus(normalized).qty,null); // no invented quantities
  }
  const rows=[{id:'a',stock:4},{id:'b',inStock:true}];let writes=0;
  ui.saveAll=()=>{writes++;return Promise.resolve({});};
  await ui.publishStockChanges(rows,false,()=>{});assert.equal(writes,1);assert.ok(rows.every(p=>p.inStock===false));
  const prior=JSON.stringify(rows);ui.saveAll=()=>Promise.reject(Error('network'));
  assert.equal(await ui.publishStockChanges(rows,true,()=>{}),false);assert.deepEqual(JSON.parse(JSON.stringify(rows)),JSON.parse(prior));
  ui.catalogSnapshot=()=> 'unsaved';writes=0;ui.saveAll=()=>{writes++;return Promise.resolve({});};
  assert.equal(await ui.publishStockToggle(rows[0],()=>{}),false);assert.equal(writes,0);
  const tracked={inStock:true,stockVariants:{M:{tracked:true,available:0},L:{tracked:true,available:3}}};
  assert.equal(U.getStockQty(tracked,'M'),0);assert.equal(U.getStockQty(tracked,'L'),3);
  tracked.inStock=false;assert.equal(U.getStockQty(tracked,'L'),0);
  const syncSource=fs.readFileSync('stock-sync.js','utf8');
  let catalog={test:[{id:'LIVE'}]};
  const sync={getCategories:()=>catalog};vm.createContext(sync);
  vm.runInContext(syncSource.slice(syncSource.indexOf('  function applyStockMap('),syncSource.indexOf('  function notifyStockUpdated(')),sync);
  sync.applyStockMap({LIVE:{qty:0,inStock:false,legacyTracked:true}});
  assert.equal(catalog.test[0].inStock,false);
  catalog.test[0]=U.normalizeProductEntry(catalog.test[0],'test',0);
  sync.applyStockMap({LIVE:{qty:7,inStock:true,legacyTracked:true}});
  assert.equal(catalog.test[0].stock,7);assert.equal(catalog.test[0].inStock,true);
  catalog={test:[{id:'MANUAL',inStock:false,stock:0}]};
  sync.applyStockMap({MANUAL:{qty:7,inStock:true,legacyTracked:true}});
  assert.equal(catalog.test[0].inStock,false);assert.equal(U.getStockQty(catalog.test[0]),0);
  const snapshot={sections:[],products:{x:[{stock:0,inStock:false}]},categoryTypePrices:{}};
  vm.createContext(snapshot);vm.runInContext(between('  function catalogSnapshot()', '  var categoryTypePrices'),snapshot);
  const before=snapshot.catalogSnapshot();delete snapshot.products.x[0].stock;snapshot.products.x[0].stock=0;
  assert.equal(snapshot.catalogSnapshot(),before);
  console.log('PASS: all nine categories persist stock on/off, bulk autosaves once, failed saves rollback, dirty edits stay protected, live zero stock can restock after normalization, and manual off overrides remain authoritative.');
})().catch(e=>{console.error(e);process.exitCode=1;});
