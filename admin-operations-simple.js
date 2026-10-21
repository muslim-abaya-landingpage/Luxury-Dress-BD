(function(){'use strict';
function setup(){
 var main=document.querySelector('main');if(!main||document.getElementById('opsWorkspaceNav'))return;
 var summary=document.getElementById('opsSummary'),finance=document.getElementById('opsFinanceOrder'),returns=document.getElementById('opsReturns'),health=document.getElementById('opsHealth');
 if(!summary||!finance||!returns||!health)return;
 function section(el){return el.closest('section');}
 var panels=[section(summary),section(finance),section(returns),section(health)];
 if(panels.some(function(p){return !p;}))return;
 var names=['ওভারভিউ','অর্ডার হিসাব','রিটার্ন ও এক্সচেঞ্জ','সিস্টেমের অবস্থা'];
 var intro=document.createElement('div');intro.className='ops-workspace-intro';intro.textContent='প্রথমে সারসংক্ষেপ দেখুন। অর্ডারের হিসাব বা রিটার্ন করতে উপরের বিভাগ নির্বাচন করুন। অসম্পূর্ণ তথ্য দিয়ে চূড়ান্ত লাভ দেখানো হবে না।';
 var nav=document.createElement('div');nav.id='opsWorkspaceNav';nav.className='ops-workspace-nav';nav.setAttribute('role','tablist');nav.setAttribute('aria-label','হিসাব ব্যবস্থাপনা');
 panels.forEach(function(p,i){p.classList.add('ops-workspace-panel');p.id='opsWorkspacePanel'+i;p.setAttribute('role','tabpanel');var b=document.createElement('button');b.type='button';b.id='opsWorkspaceTab'+i;b.setAttribute('role','tab');b.setAttribute('aria-controls',p.id);b.textContent=names[i];b.addEventListener('click',function(){activate(i);});b.addEventListener('keydown',function(e){if(e.key==='ArrowRight'||e.key==='ArrowLeft'){e.preventDefault();var next=(i+(e.key==='ArrowRight'?1:panels.length-1))%panels.length;activate(next);nav.children[next].focus();}});nav.appendChild(b);});
 function activate(index){panels.forEach(function(p,i){p.hidden=i!==index;var b=nav.children[i];b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;});}
 function showFor(target){var node=target.closest('[data-finance],[data-case]');if(!node)return;activate(node.hasAttribute('data-finance')?1:2);}
 document.getElementById('opsFinanceRows').addEventListener('click',showFor,true);document.getElementById('opsReturns').addEventListener('click',showFor,true);
 var first=panels[0];first.parentNode.insertBefore(nav,first);first.parentNode.insertBefore(intro,first);activate(0);
 var financeForm=document.getElementById('opsFinanceForm'),returnForm=document.getElementById('opsReturnForm');
 var notice=document.createElement('p');notice.className='ops-workspace-hint';notice.textContent='খরচ বা জমার অঙ্ক অজানা হলে ঘর ফাঁকা রাখুন; ০ লিখবেন শুধু নিশ্চিত হলে।';financeForm.insertBefore(notice,financeForm.firstChild);
 var retNotice=document.createElement('p');retNotice.className='ops-workspace-hint';retNotice.textContent='রিটার্ন আবেদন সংরক্ষণ করলেই টাকা ফেরত বা স্টক পরিবর্তন হয় না। পণ্য যাচাই ও প্রকৃত লেনদেন আলাদাভাবে নিশ্চিত করুন।';returnForm.insertBefore(retNotice,returnForm.firstChild);
 function financeCheck(){var id=document.getElementById('opsFinanceOrder').value.trim();var btn=document.getElementById('opsFinanceSave');if(!id)btn.disabled=true;}financeForm.addEventListener('input',financeCheck);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();

(function(){
'use strict';
function ready(){
 var list=document.getElementById('opsOrderIds'),finance=document.getElementById('opsFinanceOrder'),ret=document.getElementById('retOrder');
 if(!list||!finance||!ret)return;
 function picker(input,loadButton){
  var label=document.createElement('label');label.className='ops-order-picker-label';label.textContent='অর্ডার তালিকা থেকে নির্বাচন';
  var select=document.createElement('select');select.className='ops-order-picker';select.setAttribute('aria-label','অর্ডার নির্বাচন করুন');
  label.appendChild(select);input.parentNode.insertBefore(label,input);
  function populate(){
   var old=select.value,ids=Array.from(list.querySelectorAll('option')).map(function(o){return o.value;}).filter(Boolean);
   select.replaceChildren();var first=document.createElement('option');first.value='';first.textContent=ids.length?'অর্ডার বেছে নিন':'অর্ডার লোড হচ্ছে…';select.appendChild(first);
   ids.forEach(function(id){var option=document.createElement('option');option.value=id;option.textContent=id;select.appendChild(option);});
   if(ids.includes(old))select.value=old;else if(ids.includes(input.value))select.value=input.value;
  }
  select.addEventListener('change',function(){input.value=select.value;input.dispatchEvent(new Event('input',{bubbles:true}));if(loadButton&&select.value)loadButton.click();});
  input.addEventListener('input',function(){select.value=Array.from(select.options).some(function(o){return o.value===input.value;})?input.value:'';});
  var observer=new MutationObserver(populate);observer.observe(list,{childList:true,subtree:true,attributes:true});populate();
 }
 picker(finance,document.getElementById('opsFinanceLoad'));picker(ret,null);
 var form=document.getElementById('opsFinanceForm'),check=document.getElementById('opsFinalized');
 var hint=document.createElement('p');hint.className='ops-workspace-hint';hint.setAttribute('role','status');check.closest('label').insertAdjacentElement('afterend',hint);
 function validate(){
  var missing=Array.from(document.querySelectorAll('#opsMoneyFields input')).filter(function(x){return x.value.trim()==='';});
  if(check.checked&&missing.length){hint.textContent='চূড়ান্ত হিসাবের আগে '+missing.length+'টি টাকার ঘর পূরণ করুন। অজানা হলে খসড়া রাখুন।';}
  else hint.textContent=check.checked?'সব তথ্য ও প্রমাণ যাচাই করে সংরক্ষণ করুন।':'খসড়া হিসাব সংরক্ষণ করা যাবে; লাভ চূড়ান্ত দেখাবে না।';
 }
 form.addEventListener('input',validate);form.addEventListener('change',validate);validate();
 form.addEventListener('submit',function(e){if(!check.checked)return;var missing=Array.from(document.querySelectorAll('#opsMoneyFields input')).some(function(x){return x.value.trim()==='';});if(missing){e.preventDefault();e.stopImmediatePropagation();validate();hint.scrollIntoView({block:'center'});}},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ready);else ready();
})();


(function(){
'use strict';
function init(){
 var get=function(id){return document.getElementById(id);};
 var ids=['opsStatementCollected','opsStatementDelivery','opsStatementCod'];
 if(!get('opsStatementApply'))return;
 function amount(id){var s=get(id).value.trim();if(!s)return null;var n=Number(s);return Number.isFinite(n)&&n>=0&&Math.round(n*100)===n*100?n:null;}
 function calc(){
  var values=ids.map(amount),out=get('opsStatementResult');
  if(values.some(function(v){return v===null;})){out.textContent='Collected, Delivery bill এবং COD charge—তিনটি সঠিক অঙ্ক প্রয়োজন।';return null;}
  var net=Math.round((values[0]-values[1]-values[2])*100)/100;
  if(net<0){out.textContent='চার্জ সংগ্রহের চেয়ে বেশি; স্টেটমেন্ট যাচাই করুন।';return null;}
  out.textContent='স্টেটমেন্ট অনুযায়ী প্রাপ্য: ৳'+net.toFixed(2)+' (ব্যাংকে জমা নিশ্চিত নয়)';
  return {collected:values[0],charge:Math.round((values[1]+values[2])*100)/100,net:net};
 }
 ids.forEach(function(id){get(id).addEventListener('input',calc);});
 get('opsStatementApply').addEventListener('click',function(){
  var data=calc(),statement=get('opsStatementId').value.trim(),order=get('opsFinanceOrder').value.trim();
  if(!data||!order){get('opsStatementResult').textContent='প্রথমে একটি অর্ডার নির্বাচন করুন এবং সঠিক অঙ্ক দিন।';return;}
  if(!/^SFC-[0-9]{4,20}$/i.test(statement)){get('opsStatementResult').textContent='বৈধ Steadfast Statement ID দিন।';return;}
  if(!window.confirm('স্টেটমেন্টটি এই অর্ডারের সঙ্গে মিলেছে এবং চার্জ যাচাই করেছেন?'))return;
  get('money_courierCollected').value=data.collected;
  get('money_courierCost').value=data.charge;
  var note=get('opsFinanceNote'),tag='Steadfast statement '+statement+'; expected payout ৳'+data.net.toFixed(2)+'; bank receipt NOT verified.';
  if(!note.value.includes('Steadfast statement '+statement))note.value=(note.value?note.value+'\n':'')+tag;
  get('opsFinalized').checked=false;
  get('opsStatementResult').textContent='Collected ও courier cost বসানো হয়েছে; ব্যাংকে জমা এবং অন্য খরচ যাচাই করে হিসাব সংরক্ষণ করুন।';
  get('opsFinanceForm').dispatchEvent(new Event('input',{bubbles:true}));
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
