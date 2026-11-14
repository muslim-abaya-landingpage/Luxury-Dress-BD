(function(g){'use strict';
 function sizes(value){return String(value||'').replace(/[০-৯]/g,function(c){return String('০১২৩৪৫৬৭৮৯'.indexOf(c));}).split(/[,，\n]+/).map(function(s){return s.trim();}).filter(function(s,i,a){return s&&a.indexOf(s)===i;});}
 function money(value){var n=Number(String(value||'').replace(/[০-৯]/g,function(c){return String('০১২৩৪৫৬৭৮৯'.indexOf(c));}));if(!Number.isSafeInteger(n)||n<1||n>1000000)throw Error('পণ্যের সঠিক পূর্ণ টাকার দাম দিন।');return n;}
 function mode(category,name){var p={name:name};return g.isAbayaProduct&&g.isAbayaProduct(p,category)?'abaya':g.isTwoPieceProduct&&g.isTwoPieceProduct(p,category)?'two-piece':'simple';}
 function makeProduct(d,id){
  var name=String(d.name||'').trim();if(name.length<2||name.length>150)throw Error('পণ্যের নাম দিন (২–১৫০ অক্ষর)।');
  var p={id:id,name:name,price:money(d.price),color:String(d.color||'').trim(),colorLabel:String(d.color||'').trim(),fabric:String(d.fabric||'').trim(),detailNote:String(d.note||'').trim(),sizes:sizes(d.sizes)};
  [['sleeve','sleeveSizes'],['dress','dressLengths'],['palazzo','palazzoLengths']].forEach(function(pair){p[pair[1]]=sizes(d[pair[0]]);});
  if(!p.sizes.length)throw Error('যে সাইজগুলো বিক্রি করবেন সেগুলো লিখুন।');
  var kind=mode(d.category,name),body=sizes(d.body);
  if(kind==='abaya'){p.bodySizes=body;p.lengthSizes=p.sizes.slice();if(!p.bodySizes.length||p.bodySizes.concat(p.sizes).some(function(s){return !/^\d{2}$/.test(s);}))throw Error('Body ও Length-এর সঠিক মাপ লিখুন, যেমন 42, 44 এবং 52, 54।');p.types=d.onlyPrice?['Full Set','Abaya Only']:['Full Set'];p.priceByType={'Full Set':p.price};if(d.onlyPrice)p.priceByType['Abaya Only']=money(d.onlyPrice);}
  else if(kind==='two-piece'){p.bodySizes=body.length?body:p.sizes.slice();p.dressLengths=sizes(d.dress);p.palazzoLengths=sizes(d.palazzo);if(!p.dressLengths.length||!p.palazzoLengths.length)throw Error('টু-পিসের Dress Length ও Palazzo Length দিন।');}
  else if(body.length)p.bodySizes=body;
  return p;
 }
 /** Readable product link from the name ("Navy Chiffon Abaya" → "navy-chiffon-abaya"), or '' when the name has too few Latin letters (e.g. Bangla only). */
 /* Bangla product names → English-letter links. Common shop words use their usual English spelling
    (কামিজ → kameez, লিলেন → linen); other words are written by sound (approximate, the owner can edit the slug). */
 var BN_WORDS={'লেপার্ড':'leopard','প্রিন্ট':'print','প্রিন্টেড':'printed','লিলেন':'linen','লিনেন':'linen','কামিজ':'kameez','কামিজের':'kameez','পায়জামা':'pajama','পাজামা':'pajama','পায়জামা':'pajama','সেট':'set','আবায়া':'abaya','আবায়া':'abaya','বোরকা':'borka','বোরখা':'borka','বুরকা':'borka','হিজাব':'hijab','খিমার':'khimar','নিকাব':'niqab','টু':'two','থ্রি':'three','পিস':'piece','থ্রিপিস':'three-piece','টুপিস':'two-piece','কুর্তি':'kurti','টপস':'tops','পাঞ্জাবি':'panjabi','পাঞ্জাবী':'panjabi','কাফতান':'kaftan','গাউন':'gown','ফ্রক':'frock','জামা':'jama','ড্রেস':'dress','শাড়ি':'saree','শাড়ি':'saree','ওড়না':'orna','ওড়না':'orna','কটন':'cotton','সুতি':'cotton','সিল্ক':'silk','জর্জেট':'georgette','শিফন':'chiffon','ভিসকস':'viscose','রেয়ন':'rayon','রেয়ন':'rayon','চেরি':'cherry','দুবাই':'dubai','প্রিমিয়াম':'premium','প্রিমিয়াম':'premium','ফ্লোরাল':'floral','এমব্রয়ডারি':'embroidery','এমব্রয়ডারি':'embroidery','কারচুপি':'karchupi','স্টোন':'stone','লেস':'lace','বাটারফ্লাই':'butterfly','লেডিস':'ladies','মহিলাদের':'womens','মেয়েদের':'girls','মেয়েদের':'girls','কালো':'black','সাদা':'white','লাল':'red','নীল':'blue','গোলাপি':'pink','সবুজ':'green','হলুদ':'yellow','মেরুন':'maroon','খয়েরি':'brown','খয়েরি':'brown','বেগুনি':'purple','ধূসর':'grey','অফ':'off','ও':'and','এবং':'and','নতুন':'new','ডিজাইন':'design','স্টাইল':'style','লং':'long','শর্ট':'short','ফুল':'full','হাফ':'half','হাতা':'sleeve'};
 var BN_C={'ক':'k','খ':'kh','গ':'g','ঘ':'gh','ঙ':'ng','চ':'ch','ছ':'chh','জ':'j','ঝ':'jh','ঞ':'n','ট':'t','ঠ':'th','ড':'d','ঢ':'dh','ণ':'n','ত':'t','থ':'th','দ':'d','ধ':'dh','ন':'n','প':'p','ফ':'f','ব':'b','ভ':'bh','ম':'m','য':'j','র':'r','ল':'l','শ':'sh','ষ':'sh','স':'s','হ':'h','ড়':'r','ঢ়':'rh','য়':'y'};
 var BN_V={'অ':'o','আ':'a','ই':'i','ঈ':'i','উ':'u','ঊ':'u','ঋ':'ri','এ':'e','ঐ':'oi','ও':'o','ঔ':'ou'};
 var BN_S={'া':'a','ি':'i','ী':'i','ু':'u','ূ':'u','ৃ':'ri','ে':'e','ৈ':'oi','ো':'o','ৌ':'ou'};
 var BN_X={'ং':'ng','ঃ':'h','ঁ':'','ৎ':'t','০':'0','১':'1','২':'2','৩':'3','৪':'4','৫':'5','৬':'6','৭':'7','৮':'8','৯':'9'};
 function bnWord(w){
  var k=w.normalize('NFC');if(BN_WORDS[k])return BN_WORDS[k];
  var ch=Array.from(w.normalize('NFD')),out='';
  for(var i=0;i<ch.length;i++){
   var c=ch[i];
   if(ch[i+1]==='়'&&({'ড':1,'ঢ':1,'য':1})[c]){c=c+'়';i++;c=c.normalize('NFC');if(c.length>1)c={'ড়':'ড়','ঢ়':'ঢ়','য়':'য়'}[c]||c;}
   if(BN_C[c]!=null){
    out+=BN_C[c];var nx=ch[i+1];
    if(nx==='্'){i++;continue;}
    if(nx&&BN_S[nx]!=null){out+=BN_S[nx];i++;continue;}
    var last=i+1>=ch.length||!/[ঀ-৿]/.test(nx);
    // Inherent vowel: kept inside a word, dropped at the end, and dropped after a vowel when the next letter
    // carries its own vowel sign (জামদানি → jamdani, মসলিন → moslin, not jamodani / mosolin).
    var dropMid=!last&&/[aeiou]$/.test(out.slice(0,-BN_C[c].length))&&BN_C[nx]!=null&&BN_S[ch[i+2]]!=null;
    if(!last&&!dropMid&&c!=='য়')out+='o';
   }else if(BN_V[c]!=null)out+=BN_V[c];
   else if(BN_S[c]!=null)out+=BN_S[c];
   else if(BN_X[c]!=null)out+=BN_X[c];
   else if(c!=='্'&&c!=='়')out+=c;
  }
  return out;
 }
 function latin(name){return String(name||'').split(/(\s+)/).map(function(w){return /[ঀ-৿]/.test(w)?w.split(/([^ঀ-৿]+)/).map(function(x){return /[ঀ-৿]/.test(x)?bnWord(x):x;}).join(''):w;}).join('');}
 function slug(name){var s=latin(name).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'');if(s.length>50)s=s.slice(0,50).replace(/-[^-]*$/,'');return s.length>=3?s:'';}
 function cut(text,max){text=String(text||'').replace(/\s+/g,' ').trim();if(text.length<=max)return text;var t=text.slice(0,max-1);return t.slice(0,Math.max(t.lastIndexOf(' '),max/2))+'…';}
 /** Search listing written for a new product: title up to 60 characters, description up to 160 (what Google shows). */
 function seo(p){var name=String(p.name||'').trim(),note=(String(p.detailNote||'').trim().match(/^[^.!?।]*[.!?।]?/)||[''])[0];
  var title=name.length+17<=60?name+' | Muslim Abaya':cut(name,60);
  var bits=[name,p.colorLabel?'Color: '+p.colorLabel:'',p.fabric?'Fabric: '+p.fabric:''].filter(Boolean).join('. ');
  var tail=(p.price?' ৳'+p.price+'.':'')+' Cash on delivery across Bangladesh.';
  var desc=bits+'.'+(note?' '+(/[.!?।]$/.test(note)?note:note+'.'):'');
  return {title:title,description:(cut(desc,160-tail.length)+tail).trim()};}
 function validateCatalog(products){var ids={};Object.keys(products).forEach(function(cat){(products[cat]||[]).forEach(function(p){if(!/^[A-Za-z0-9][A-Za-z0-9_-]{1,100}$/.test(String(p.id||''))||ids[p.id])throw Error('পণ্যের ID ফাঁকা বা একই ID একাধিক পণ্যে আছে।');ids[p.id]=true;var unlisted=p.status==='draft'||p.status==='pending'||p.status==='trash';if(!String(p.name||'').trim())throw Error('প্রতিটি পণ্যের নাম প্রয়োজন।');if(!unlisted&&(!Number.isFinite(Number(p.price))||Number(p.price)<=0||!p.image))throw Error((p.name||p.id)+': প্রকাশ করতে দাম ও প্রধান ছবি প্রয়োজন (Draft হিসেবে ছাড়া সেভ করা যায়)।');
  if(p.status!=null&&p.status!=='draft'&&p.status!=='trash'&&p.status!=='pending')throw Error(p.id+': status must be Published, Pending, Draft or Trash.');
  if(p.publishDate!=null&&!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(String(p.publishDate)))throw Error(p.id+': publish date must be YYYY-MM-DDTHH:MM.');
  if(p.visibility!=null&&p.visibility!=='private'&&p.visibility!=='password')throw Error(p.id+': visibility must be Public, Private or Password protected.');
  if(p.visibility==='password'&&!String(p.postPassword||'').trim())throw Error(p.id+': enter the password for this product.');
  if(p.externalUrl!=null&&!/^https?:\/\//i.test(String(p.externalUrl)))throw Error(p.id+': Product URL must start with https://');
  var whole=function(v){return Number.isSafeInteger(Number(v))&&Number(v)>0&&Number(v)<=1000000;};
  if(p.regularPrice!=null&&!whole(p.regularPrice))throw Error(p.id+': before-sale price must be whole taka.');
  if(p.regularPriceByType!=null&&(typeof p.regularPriceByType!=='object'||Object.keys(p.regularPriceByType).some(function(k){return !whole(p.regularPriceByType[k]);})))throw Error(p.id+': option before-sale prices must be whole taka.');
  var day=/^\d{4}-\d{2}-\d{2}$/;
  if((p.saleFrom!=null&&!day.test(String(p.saleFrom)))||(p.saleTo!=null&&!day.test(String(p.saleTo))))throw Error(p.id+': sale dates must be YYYY-MM-DD.');
  if(p.saleFrom&&p.saleTo&&String(p.saleFrom)>String(p.saleTo))throw Error(p.id+': sale end date is before the start date.');
  if(String(p.seoTitle||'').length>120||String(p.seoDescription||'').length>320)throw Error(p.id+': SEO title max 120 and description max 320 characters.');
 });});}
 /* Variable product (WooCommerce): prices live on the variations. A product with no price of its own takes the
    lowest enabled variation price (the "from" price on cards), so Publish works. A published variable product
    with no price anywhere gets a message that points to the variation price boxes. isPublished(p) → boolean. */
 function fillVariablePrices(products,isPublished){Object.keys(products||{}).forEach(function(cat){(products[cat]||[]).forEach(function(p){
  if(!p||!Array.isArray(p.variations)||!p.variations.length||Number(p.price)>0)return;
  var prices=p.variations.filter(function(v){return v&&v.enabled!==false;}).map(function(v){return parseInt(v.price,10);}).filter(function(n){return n>0;});
  if(prices.length){p.price=Math.min.apply(null,prices);return;}
  if(!isPublished||isPublished(p))throw Error((p.name||p.id)+': দাম নেই — Variations-এ প্রতিটি সারির “Price ৳” ঘরে দাম দিন (অথবা Draft হিসেবে সেভ করুন)।');
 });});}
 g.MaProductPublishUtils={sizes:sizes,money:money,mode:mode,makeProduct:makeProduct,validateCatalog:validateCatalog,fillVariablePrices:fillVariablePrices,slug:slug,seo:seo};
})(window);
