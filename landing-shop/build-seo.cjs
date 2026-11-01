/* Run node build-seo.cjs after changing config.js; commits crawlable product copy. */
const fs=require('node:fs'), vm=require('node:vm');
const box={window:{}, location:{search:''}};
vm.runInNewContext(fs.readFileSync(__dirname+'/config.js','utf8'),box);
const c=box.window.LANDING_CONFIG, url=new URL(c.brand.siteUrl);
const esc=s=>String(s??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
let html=fs.readFileSync(__dirname+'/index.html','utf8');
const fill=(id,tag,body)=>{html=html.replace(new RegExp('(<'+tag+'[^>]*id="'+id+'"[^>]*>)[\\s\\S]*?(</'+tag+'>)'),(_,a,b)=>a+body+b)};
fill('featureTitle','h2',esc(c.sections.featuresTitle));
fill('featureList','ul',c.sections.features.map(x=>'<li>'+esc(x)+'</li>').join(''));
fill('productsTitle','h2',esc(c.sections.productsTitle));
fill('orderTitle','h2',esc(c.sections.orderTitle));
fill('productList','div',c.products.map(p=>`<article><h3>${esc(p.name)}</h3><p>${esc(p.details)} — ৳${esc(p.price)}</p><a href="#orderForm">অর্ডার করুন</a></article>`).join(''));
html=html.replace(/<title>.*?<\/title>/,'<title>'+esc(c.brand.pageTitle)+'</title>');
html=html.replace(/(<meta name="description" content=")[^"]*/, '$1'+esc(c.brand.description));
html=html.replace(/(<link rel="canonical" href=")[^"]*/, '$1'+esc(url.href));
for(const [key,value] of Object.entries({'og:title':c.brand.pageTitle,'og:description':c.brand.description,'og:site_name':c.brand.name,'og:url':url.href,'og:image':new URL(c.hero.images[0],url).href})) html=html.replace(new RegExp('(<meta property="'+key+'" content=")[^"]*'),(_,a)=>a+esc(value));
html=html.replace(/\s*<meta name="twitter:(title|description|image)"[^>]*>/g,'');
html=html.replace('</head>',Object.entries({title:c.brand.pageTitle,description:c.brand.description,image:new URL(c.hero.images[0],url).href}).map(([k,v])=>`<meta name="twitter:${k}" content="${esc(v)}">`).join('\n')+'\n</head>');
const data=c.products.map(p=>({'@context':'https://schema.org','@type':'Product',name:p.name,description:[p.name,p.details].filter(Boolean).join(' '),image:new URL(p.image,url).href,brand:{'@type':'Brand',name:c.brand.name},offers:{'@type':'Offer',url:url.href+'#products',priceCurrency:'BDT',price:p.variants?.[0]?.price??p.price,availability:p.inStock===false?'https://schema.org/OutOfStock':'https://schema.org/InStock'}}));
html=html.replace(/\s*<script id="product-schema"[\s\S]*?<\/script>/g,'').replace('</head>','<script id="product-schema" type="application/ld+json">'+JSON.stringify(data).replace(/</g,'\\u003c')+'</script>\n</head>');
fs.writeFileSync(__dirname+'/index.html',html);
fs.writeFileSync(__dirname+'/sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>'+esc(url.href)+'</loc></url></urlset>\n');
fs.writeFileSync(__dirname+'/robots.txt','User-agent: *\nAllow: /\nSitemap: '+new URL('sitemap.xml',url).href+'\n');
console.log('SEO HTML, schema, robots and sitemap rebuilt.');
// Per-site metadata for social crawlers that do not execute JavaScript.
const metadata={};
for(const file of fs.readdirSync(__dirname+'/sites').filter(f=>f.endsWith('.js'))){
 const site={window:{LANDING_CONFIG:JSON.parse(JSON.stringify(c))},location:{origin:url.origin}};
 vm.runInNewContext(fs.readFileSync(__dirname+'/sites/'+file,'utf8'),site);
 const cfg=site.window.LANDING_CONFIG;
 metadata[file.slice(0,-3)]={brand:cfg.brand,hero:cfg.hero,products:cfg.products,deliveryAreas:cfg.deliveryAreas,discount:cfg.discount||null,order:{freeShippingThreshold:cfg.order?.freeShippingThreshold||0,coupons:cfg.order?.coupons||[]}};
}
const workerPath=__dirname+'/_worker.js';
let worker=fs.readFileSync(workerPath,'utf8').replace(/import siteMetadata from '\.\/seo-data\.js';\n/, '').replace(/\/\* SEO-DATA-START \*\/[\s\S]*?\/\* SEO-DATA-END \*\/\n/, '');
const dsrc=fs.readFileSync(__dirname+'/discount.js','utf8');const discountFn=dsrc.slice(dsrc.indexOf('/* DISCOUNT-FN-START */')+23,dsrc.indexOf('/* DISCOUNT-FN-END */')).trim();
fs.writeFileSync(workerPath,'/* SEO-DATA-START */\nconst siteMetadata = '+JSON.stringify(metadata)+';\n'+discountFn+'\n/* SEO-DATA-END */\n'+worker);

require('./build-runtime.cjs');
