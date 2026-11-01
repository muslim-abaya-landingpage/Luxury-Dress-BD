/* No npm dependencies. Run after editing any JS source. */
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=__dirname, bundles={};
for(const [kind,files] of Object.entries({landing:['discount.js','theme.js','seo.js','tracking.js','app.js'],thanks:['discount.js','theme.js','tracking.js','thank-you.js']})){
 const source=files.map(file=>'\n/* '+file+' */\n'+fs.readFileSync(path.join(root,file),'utf8')).join('\n;\n');
 const hash=crypto.createHash('sha256').update(source).digest('hex').slice(0,12), name=`runtime-${kind}.${hash}.js`;
 fs.writeFileSync(path.join(root,name),source);bundles[kind]=name;
}
let router=fs.readFileSync(path.join(root,'site-router.js'),'utf8');
router=router.replace(/const runtimeFiles = .*?;/, 'const runtimeFiles = '+JSON.stringify(bundles)+';');
fs.writeFileSync(path.join(root,'site-router.js'),router);
for(const [file,kind] of [['index.html','landing'],['thank-you.html','thanks']]){
 let html=fs.readFileSync(path.join(root,file),'utf8').replace(/\s*<link[^>]*data-runtime-preload[^>]*>/g,'');
 html=html.replace('</head>',`<link data-runtime-preload rel="preload" as="script" href="${bundles[kind]}">\n</head>`);
 fs.writeFileSync(path.join(root,file),html);
}
// Only remove our previous generated bundles, never editable source files.
for(const file of fs.readdirSync(root))if(/^runtime-(landing|thanks)\.[a-f0-9]{12}\.js$/.test(file)&&!Object.values(bundles).includes(file))fs.unlinkSync(path.join(root,file));
console.log('Preloaded bundles generated:',bundles);
