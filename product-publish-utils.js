(function(g){'use strict';
 function sizes(value){return String(value||'').replace(/[০-৯]/g,function(c){return String('০১২৩৪৫৬৭৮৯'.indexOf(c));}).split(/[,，\n]+/).map(function(s){return s.trim();}).filter(function(s,i,a){return s&&a.indexOf(s)===i;});}
 function money(value){var n=Number(String(value||'').replace(/[০-৯]/g,function(c){return String('০১২৩৪৫৬৭৮৯'.indexOf(c));}));if(!Number.isSafeInteger(n)||n<1||n>1000000)throw Error('পণ্যের সঠিক পূর্ণ টাকার দাম দিন।');return n;}
 function mode(category,name){var p={name:name};return g.isAbayaProduct&&g.isAbayaProduct(p,category)?'abaya':g.isTwoPieceProduct&&g.isTwoPieceProduct(p,category)?'two-piece':'simple';}
 function makeProduct(d,id){
  var name=String(d.name||'').trim();if(name.length<2||name.length>150)throw Error('পণ্যের নাম দিন (২–১৫০ অক্ষর)।');
  var p={id:id,name:name,price:money(d.price),color:String(d.color||'').trim(),colorLabel:String(d.color||'').trim(),fabric:String(d.fabric||'').trim(),detailNote:String(d.note||'').trim(),sizes:sizes(d.sizes)};
  [['sleeve','sleeveSizes'],['dress','dressLengths'],['palazzo','palazzoLengths']].forEach(function(pair){p[pair[1]]=sizes(d[pair[0]]);});
  if(!p.sizes.length)throw Error('যে সাইজগুলো বিক্রি করবেন সেগুলো লিখুন।');
  var kind=mode(d.category,name);
  if(kind==='abaya'){p.bodySizes=sizes(d.body);p.lengthSizes=p.sizes.slice();if(!p.bodySizes.length||p.bodySizes.concat(p.sizes).some(function(s){return !/^\d{2}$/.test(s);}))throw Error('Body ও Length-এর সঠিক মাপ লিখুন, যেমন 42, 44 এবং 52, 54।');p.types=d.onlyPrice?['Full Set','Abaya Only']:['Full Set'];p.priceByType={'Full Set':p.price};if(d.onlyPrice)p.priceByType['Abaya Only']=money(d.onlyPrice);}
  if(kind==='two-piece'){p.bodySizes=p.sizes.slice();p.dressLengths=sizes(d.dress);p.palazzoLengths=sizes(d.palazzo);if(!p.dressLengths.length||!p.palazzoLengths.length)throw Error('টু-পিসের Dress Length ও Palazzo Length দিন।');}
  return p;
 }
 function validateCatalog(products){var ids={};Object.keys(products).forEach(function(cat){(products[cat]||[]).forEach(function(p){if(!/^[A-Za-z0-9][A-Za-z0-9_-]{1,100}$/.test(String(p.id||''))||ids[p.id])throw Error('পণ্যের ID ফাঁকা বা একই ID একাধিক পণ্যে আছে।');ids[p.id]=true;if(!String(p.name||'').trim()||!Number.isFinite(Number(p.price))||Number(p.price)<=0||!p.image)throw Error('প্রতিটি পণ্যের নাম, দাম ও প্রধান ছবি প্রয়োজন।');
  if(p.status!=null&&p.status!=='draft'&&p.status!=='trash')throw Error(p.id+': status must be Published, Draft or Trash.');
  var whole=function(v){return Number.isSafeInteger(Number(v))&&Number(v)>0&&Number(v)<=1000000;};
  if(p.regularPrice!=null&&!whole(p.regularPrice))throw Error(p.id+': before-sale price must be whole taka.');
  if(p.regularPriceByType!=null&&(typeof p.regularPriceByType!=='object'||Object.keys(p.regularPriceByType).some(function(k){return !whole(p.regularPriceByType[k]);})))throw Error(p.id+': option before-sale prices must be whole taka.');
  if(String(p.seoTitle||'').length>120||String(p.seoDescription||'').length>320)throw Error(p.id+': SEO title max 120 and description max 320 characters.');
  if(String(p.shortDescription||'').length>300)throw Error(p.id+': short description max 300 characters.');
  if(p.upsellIds!=null&&(!Array.isArray(p.upsellIds)||p.upsellIds.length>8||p.upsellIds.some(function(id){return !/^[A-Za-z0-9][A-Za-z0-9_-]{1,100}$/.test(String(id||''));})))throw Error(p.id+': upsells must be up to 8 product SKUs.');
  if(p.menuOrder!=null&&!Number.isSafeInteger(Number(p.menuOrder)))throw Error(p.id+': menu order must be a whole number.');
  if(p.lowStockAmount!=null&&!(Number.isSafeInteger(Number(p.lowStockAmount))&&Number(p.lowStockAmount)>=0))throw Error(p.id+': low stock threshold must be 0 or more.');
 });});}
 g.MaProductPublishUtils={sizes:sizes,money:money,mode:mode,makeProduct:makeProduct,validateCatalog:validateCatalog};
})(window);
