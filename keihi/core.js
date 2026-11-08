export const VERSION = 1;
export const CATEGORIES = ['未分類','消耗品費','通信費','水道光熱費','地代家賃','旅費交通費','車両費','広告宣伝費','接待交際費','会議費','新聞図書費','損害保険料','修繕費','外注工賃','支払手数料','租税公課','仕入','雑費'];
export const DEFAULT_SETTINGS = { persistence:true, theme:'system', rounding:'floor', profiles:[{id:'business',name:'全額事業用',ratio:100,basis:''},{id:'home',name:'自宅・家賃',ratio:null,basis:''},{id:'utilities',name:'光熱費',ratio:null,basis:''},{id:'phone',name:'通信費',ratio:null,basis:''},{id:'car',name:'車両・ガソリン',ratio:null,basis:''}] };
export const uid = () => globalThis.crypto?.randomUUID?.() || `k${Date.now()}${Math.random().toString(36).slice(2)}`;
export const yen = n => new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(n || 0);
export const normalize = s => String(s ?? '').normalize('NFKC').replace(/[−－–—△▲]/g,'-').replace(/[￥]/g,'¥').replace(/[\u200b-\u200d]/g,'');
export function validDate(s){ if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d=new Date(s+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s; }
export function money(value){ const s=normalize(value).trim(); if(!/^-?\d{1,12}$/.test(s))return NaN; const n=Number(s);return Number.isSafeInteger(n)?n:NaN; }
export function ratioValue(value){ if(value===null||value===undefined||String(value).trim()==='') return NaN;const n=Number(value);return Number.isFinite(n)&&n>=0&&n<=100&&Math.abs(n*100-Math.round(n*100))<1e-6?n:NaN; }
export function roundRatio(amount,ratio,mode='floor'){
  const bp=ratioValue(ratio);if(!Number.isSafeInteger(amount)||!Number.isFinite(bp))return NaN;
  const n=BigInt(amount)*BigInt(Math.round(bp*100));const base=10000n;const q=n/base;const rem=n%base;
  return Number(q+(mode==='ceil'&&rem>0n?1n:mode==='round'&&rem>=5000n?1n:0n));
}
// Largest-remainder apportionment preserves every yen, including mixed private items.
export function apportion(total,weights){
  if(!Number.isSafeInteger(total)||total<0||weights.some(n=>!Number.isSafeInteger(n)||n<0))throw Error('配分する金額が不正です');
  const sum=weights.reduce((a,b)=>a+BigInt(b),0n);if(sum===0n){if(total>0)throw Error('配分先の金額が0円です');return weights.map(()=>0);}
  const parts=weights.map((w,i)=>({i,value:Number(BigInt(total)*BigInt(w)/sum),rem:BigInt(total)*BigInt(w)%sum}));
  let left=total-parts.reduce((a,p)=>a+p.value,0);const order=[...parts].sort((a,b)=>a.rem===b.rem?a.i-b.i:a.rem>b.rem?-1:1);
  for(let i=0;i<left;i++)order[i%order.length].value++;
  return parts.map(p=>p.value);
}
function amountAtEnd(text){
  const m=normalize(text).match(/(?:¥\s*|[Yy]EN\s*)?(-?\s*\d[\d,]*(?:\.\d{3})*)\s*(?:円|[※*軽]|[ABab])?\s*$/);
  if(!m)return null;const s=m[1].replace(/[\s,.]/g,'');const amount=Number(s);if(!Number.isSafeInteger(amount)||Math.abs(amount)>999999999)return null;
  return {amount,index:m.index,raw:m[0]};
}
const compact=s=>normalize(s).replace(/\s/g,'');
const totalRe=/^(?:総合計|ご?合計|お買(?:上|い上)(?:げ)?(?:合計|金額|計)|お支払(?:い)?(?:金額|合計)|ご利用金額|総額|TOTAL|AMOUNT)/i;
const subtotalRe=/小計|税抜計|税込計|値引前合計|割引前合計|商品合計|SUBTOTAL/i;
const discountRe=/値引|割引|クーポン|サービス値|特別割|割戻|DISCOUNT|COUPON|OFF/i;
const paymentRe=/お?預(?:り|かり)|お?釣(?:り|銭)?|釣銭|支払方法|現金|クレジット|電子マネー|ポイント(?:利用|使用|充当|残高|付与|獲得|支払)|利用ポイント|PayPay|残高|お買上点数|買上点数|商品点数|点数合計|領収証|領収書|レシート|お客様|担当|責任者|レジ|会員|登録番号|TEL|電話|住所|営業時間|カード番号|承認番号|取引番号|伝票番号|お問合せ|お問い合せ/i;
export function receiptTotalAmount(text){
 const c=compact(text);if(!totalRe.test(c)||subtotalRe.test(c)||discountRe.test(c)||/点数|数量/.test(c))return null;
 const a=amountAtEnd(text);return a?Math.abs(a.amount):null;
}
function extractDate(lines){
 for(const line of lines){const s=normalize(line.text);let m=s.match(/(20\d{2})\s*[年\/.-]\s*(\d{1,2})\s*[月\/.-]\s*(\d{1,2})\s*日?/);if(!m){const r=s.match(/(?:令和|R)\s*(\d{1,2})\s*[年\/.-]\s*(\d{1,2})\s*[月\/.-]\s*(\d{1,2})/i);if(r)m=[r[0],String(2018+Number(r[1])),r[2],r[3]];}if(m){const d=`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;if(validDate(d))return d;}}
 return '';
}
export function parseReceipt(input,{hasHighlight=false}={}){
 const lines=input.map((l,i)=>typeof l==='string'?{text:normalize(l),index:i,marked:false,confidence:100}:{...l,text:normalize(l.text),index:i});
 const items=[],discounts=[],warnings=[];let declaredTotal=null,subtotalSeen=false,totalSeen=false,merchant='';const taxes={};let lastItem=null;
 const date=extractDate(lines);let pricing='inclusive';
 if(lines.some(l=>/外税|税抜(?:き)?(?:価格|表示|金額)|税別/.test(compact(l.text))))pricing='exclusive';
 const firstItemAt=lines.findIndex(l=>{const a=amountAtEnd(l.text);return a&&a.index>0&&!paymentRe.test(compact(l.text))&&!/\d[\/年]\d|\d[\/月]\d|税|合計|小計/.test(compact(l.text));});
 for(const l of lines.slice(0,Math.max(0,firstItemAt<0?6:firstItemAt))){const t=l.text.trim();if(!merchant&&t.length>1&&!/\d{2,}|領収|レシート|登録番号|電話|TEL|年|月|住所|様|^-+$/.test(t))merchant=t;}
 for(const line of lines){
  const text=line.text.trim(),c=compact(text),a=amountAtEnd(text);if(!c)continue;
  if(totalRe.test(c)&&!subtotalRe.test(c)&&!discountRe.test(c)&&!/点数|数量/.test(c)){const total=receiptTotalAmount(text);if(total!==null){declaredTotal=total;totalSeen=true;if((line.confidence??100)<78)warnings.push('支払総額の文字が不鮮明です。紙の合計金額と照合してください。');}lastItem=null;continue;}
  if(subtotalRe.test(c)){subtotalSeen=true;lastItem=null;continue;}
  if(/^(?:\(?内\)?)?(?:外税|内税|消費税(?:額)?|税額|税率)|^(?:8|10)%.*(?:対象|税|計)|^非課税対象|^軽減税率対象/.test(c)&&!discountRe.test(c)){
    // Tax totals are information, never another purchased item.
    const rate=c.match(/(10|8)%/);if(a&&/外税|消費税|税額/.test(c)&&!/対象|内税|内消費税|内訳/.test(c))taxes[rate?.[1]||'unknown']=Math.abs(a.amount);continue;
  }
  if(paymentRe.test(c)||/\d{4}[年\/.-]\d{1,2}[月\/.-]\d{1,2}|^T\d{13}|^\d{2,4}-\d{2,4}-\d{3,4}|^\d{3}-\d{4}/.test(c))continue;
  if(discountRe.test(c)||(a&&a.amount<0)){
    const explicitGlobal=/全体|全品|全商品|会計|総額|一括/.test(c);
    const target=!explicitGlobal&&!subtotalSeen&&!totalSeen&&lastItem?lastItem.id:'all';
    let amount=a?Math.abs(a.amount):null;
    // A percentage alone is not a cash amount; derive it visibly and require review.
    const percentage=c.match(/(\d{1,2}(?:\.\d+)?)%/);
    if(percentage&&(!a||/%(?:引|割引|OFF)?$/i.test(c))){amount=target!=='all'?Math.floor(lastItem.amount*Number(percentage[1])/100):null;warnings.push('割合だけの値引きがあります。計算した値引き額を確認してください。');}
    if(amount===null){warnings.push(`値引き額を読み取れませんでした：${text}`);continue;}
    discounts.push({id:uid(),name:text.replace(/\s*[-¥]?\s*[\d,]+\s*円?\s*$/,'').trim()||'値引き',amount,target,sourceIndex:line.index,needsReview:target==='all'||/クーポン/.test(c)});continue;
  }
  if(totalSeen||subtotalSeen)continue;
  if(!a)continue;
  let name=text.slice(0,a.index).replace(/[¥*※\s]+$/,'').trim();
  if(!name){const prev=lines[line.index-1];if(prev&&!amountAtEnd(prev.text)&&!paymentRe.test(compact(prev.text))){name=prev.text.trim();warnings.push('商品名と金額が別の行にある明細を結び付けました。確認してください。');}else continue;}
  if(a.amount<0||a.amount===0||/単価|\d+点[×x]|^@|^\d+[個点本枚袋]$/.test(name))continue;
  const taxRate=/[※*軽]/.test(text)||/8%/.test(text)?8:10;
  const item={id:uid(),name,amount:a.amount,selected:!hasHighlight||!!line.marked,marked:!!line.marked,taxRate,ratio:null,category:'',sourceIndex:line.index,confidence:line.confidence??100,needsReview:(line.confidence??100)<78};
  items.push(item);lastItem=item;
 }
 if(!date)warnings.push('日付を読み取れませんでした。紙の領収証を見て入力してください。');
 if(!merchant)warnings.push('店名を確認してください。');
 if(!items.length)warnings.push('明細を読み取れませんでした。撮り直すか、手入力してください。');
 if(hasHighlight&&!items.some(i=>i.marked))warnings.push('蛍光色は見つかりましたが商品行と一致しません。対象の商品を選んでください。');
 if(declaredTotal===null)warnings.push('OCRでは支払総額を読み取れませんでした。紙の合計を入力・確認してください。');
 if(pricing==='exclusive')warnings.push('税抜き表示として読み取りました。税率と外税額を確認してください。');
 if(taxes.unknown&&new Set(items.map(i=>i.taxRate)).size>1)warnings.push('税率別の外税額が不明です。8%・10%の外税額を入力してください。');
 return {id:uid(),date,merchant,declaredTotal,pricing,taxes,items,discounts,category:'未分類',profileId:'business',ratio:100,basis:'',payment:'未指定',memo:'',paperRef:'',hasHighlight,warnings:[...new Set(warnings)],rawText:lines.map(l=>l.text).join('\n'),acknowledged:false,ackReason:'',duplicateAcknowledged:false};
}
export function calculate(draft,settings=DEFAULT_SETTINGS){
 const errors=[],rows=draft.items.map(i=>({...i,gross:money(String(i.amount)),directDiscount:0,sharedDiscount:0,tax:0,net:0,expense:0}));
 if(rows.some(r=>!Number.isFinite(r.gross)||r.gross<0))errors.push('商品金額は0円以上の整数を入力してください。');
 const index=new Map(rows.map((r,i)=>[r.id,i]));let shared=0,discountTotal=0;
 for(const d of draft.discounts){const a=money(String(d.amount));if(!Number.isFinite(a)||a<0){errors.push('値引き額は0円以上の整数を入力してください。');continue;}discountTotal+=a;if(d.target==='all')shared+=a;else if(index.has(d.target))rows[index.get(d.target)].directDiscount+=a;else errors.push('値引きの対象商品を選び直してください。');}
 for(const r of rows){if(r.directDiscount>r.gross)errors.push(`${r.name}：値引きが商品金額を超えています。`);r.net=Math.max(0,(r.gross||0)-r.directDiscount);}
 const preShared=rows.reduce((a,r)=>a+r.net,0);if(shared>preShared)errors.push('会計全体の値引きが商品合計を超えています。');
 if(preShared>0){const allocation=apportion(Math.min(shared,preShared),rows.map(r=>r.net));rows.forEach((r,i)=>{r.sharedDiscount=allocation[i];r.net-=allocation[i];});}
 if(draft.pricing==='exclusive'){
   const rates=[...new Set(rows.map(r=>Number(r.taxRate)))];
   for(const rate of rates){if(![0,8,10].includes(rate)){errors.push('税率を確認してください。');continue;}const group=rows.filter(r=>Number(r.taxRate)===rate),base=group.reduce((s,r)=>s+r.net,0);let tax;
     if(rate===0)tax=0;else if(draft.taxes?.[rate]!==undefined&&draft.taxes?.[rate]!=='')tax=money(String(draft.taxes[rate]));else if(rates.filter(x=>x>0).length===1&&draft.taxes?.unknown!==undefined)tax=money(String(draft.taxes.unknown));else tax=Math.floor(base*rate/100);
     if(!Number.isFinite(tax)||tax<0){errors.push('外税額を確認してください。');tax=0;}
     if(base>0){const amounts=apportion(tax,group.map(r=>r.net));group.forEach((r,i)=>{r.tax=amounts[i];r.net+=r.tax;});}
   }
 }
 let selected=0,expense=0;
 for(const r of rows){const ratio=r.ratio===null||r.ratio===''?draft.ratio:r.ratio;if(r.selected){selected+=r.net;r.expense=roundRatio(r.net,ratio,draft.rounding||settings.rounding);if(!Number.isFinite(r.expense))errors.push('事業割合を0～100%で入力してください。');else expense+=r.expense;}}
 const total=rows.reduce((s,r)=>s+r.net,0),declared=draft.declaredTotal===null||draft.declaredTotal===''?null:money(String(draft.declaredTotal));
 if(declared!==null&&(!Number.isFinite(declared)||declared<0))errors.push('支払総額を確認してください。');
 return {rows,total,declared,difference:declared===null?null:total-declared,selected,expense,privateAmount:selected-expense,discountTotal,selectedCount:rows.filter(r=>r.selected).length,errors:[...new Set(errors)]};
}
export function validateDraft(draft,settings){
 const result=calculate(draft,settings),errors=[...result.errors];if(!validDate(draft.date))errors.push('日付を入力してください。');if(!draft.merchant?.trim())errors.push('店名・支払先を入力してください。');if(!result.selectedCount)errors.push('経費にする商品を1つ以上選んでください。');
 if(result.rows.some(r=>r.selected&&(r.category||draft.category)==='未分類'))errors.push('経費科目を選んでください。');
 const discrepancy=result.difference===null||result.difference!==0;
 if(!draft.acknowledged)errors.push('対象商品・値引き・金額を確認し、確認済みにチェックしてください。');
 if(discrepancy&&!draft.ackReason?.trim())errors.push('合計の差異または合計不明の理由を入力してください。');
 return {result,errors:[...new Set(errors)]};
}
export function recordFromDraft(draft,settings,existing=null){
 const {result,errors}=validateDraft(draft,settings);if(errors.length)throw Error(errors.join('\n'));
 const year=draft.date.slice(0,4);return {id:existing?.id||uid(),date:draft.date,merchant:draft.merchant.trim(),paperRef:draft.paperRef.trim(),payment:draft.payment,memo:draft.memo.trim(),basis:draft.basis?.trim()||'',pricing:draft.pricing,declaredTotal:result.declared,total:result.total,expense:result.expense,selected:result.selected,discountTotal:result.discountTotal,ratio:ratioValue(draft.ratio),category:draft.category,profileId:draft.profileId,hasHighlight:!!draft.hasHighlight,ackReason:draft.ackReason||'',imageHash:draft.imageHash||'',year,createdAt:existing?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),rounding:draft.rounding||settings.rounding,items:result.rows.map(r=>({id:r.id,name:r.name,amount:r.gross,selected:!!r.selected,marked:!!r.marked,taxRate:Number(r.taxRate),ratio:r.ratio===null||r.ratio===''?null:ratioValue(r.ratio),category:r.category||'',net:r.net,expense:r.expense,directDiscount:r.directDiscount,sharedDiscount:r.sharedDiscount,tax:r.tax})),discounts:draft.discounts.map(d=>({id:d.id,name:d.name,amount:Number(d.amount),target:d.target})),taxes:Object.fromEntries(Object.entries(draft.taxes||{}).map(([k,v])=>[k,v===''?'':Number(v)]))};
}
export function draftFromRecord(record){return {...structuredClone(record),warnings:[],rawText:'',acknowledged:true,duplicateAcknowledged:false,ackReason:record.ackReason||'',editingId:record.id};}
export function findDuplicates(draft,records){return records.filter(r=>r.id!==draft.editingId&&((draft.imageHash&&r.imageHash===draft.imageHash)||(draft.date&&r.date===draft.date&&compact(r.merchant)===compact(draft.merchant)&&r.declaredTotal!==null&&r.declaredTotal===Number(draft.declaredTotal))));}
export function summarize(records,year){const filtered=records.filter(r=>r.date.startsWith(String(year))),months=Array.from({length:12},(_,i)=>({month:i+1,amount:0,count:0})),categories={};for(const r of filtered){months[Number(r.date.slice(5,7))-1].amount+=r.expense;months[Number(r.date.slice(5,7))-1].count++;for(const i of r.items.filter(x=>x.selected)){const cat=i.category||r.category;categories[cat]=(categories[cat]||0)+i.expense;}}return {total:filtered.reduce((a,r)=>a+r.expense,0),selected:filtered.reduce((a,r)=>a+r.selected,0),count:filtered.length,months,categories};}
function csvCell(value){let s=String(value??'');if(/^[\s]*[=+@-]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
export function toCSV(records){const rows=[['日付','紙の整理番号','支払先','商品名','科目','購入金額','商品値引き','会計値引き配分','外税配分','値引き後税込金額','事業割合(%)','経費計上額','支払方法','按分根拠','メモ','合計差異理由']];for(const r of [...records].sort((a,b)=>a.date.localeCompare(b.date))){for(const i of r.items.filter(i=>i.selected))rows.push([r.date,r.paperRef,r.merchant,i.name,i.category||r.category,i.amount,i.directDiscount,i.sharedDiscount,i.tax,i.net,i.ratio??r.ratio,i.expense,r.payment,r.basis,r.memo,r.ackReason]);}return '\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');}
export function summaryCSV(records,year){const s=summarize(records,year);return '\ufeff'+[['年分','科目','経費計上額'],...Object.entries(s.categories).map(([k,v])=>[year,k,v]),[year,'合計',s.total]].map(row=>row.map(csvCell).join(',')).join('\r\n');}
export function readBackup(text){
 const data=JSON.parse(text);if(data.format!=='keihi-local'||data.version!==VERSION||!Array.isArray(data.records)||data.records.length>50000)throw Error('対応する経費帳のバックアップではありません。');
 const clean=[];const ids=new Set();
 for(const r of data.records){
  if(!r||typeof r.id!=='string'||ids.has(r.id)||!validDate(r.date)||!Array.isArray(r.items)||r.items.length>1000||!Array.isArray(r.discounts)||r.discounts.length>1000)throw Error('バックアップの明細形式が不正です。');
  ids.add(r.id);const short=(s,n=2000)=>String(s??'').slice(0,n);
  const draft={id:short(r.id,100),date:r.date,merchant:short(r.merchant,300),paperRef:short(r.paperRef,100),payment:short(r.payment,100),memo:short(r.memo),basis:short(r.basis),pricing:r.pricing==='exclusive'?'exclusive':'inclusive',declaredTotal:r.declaredTotal===null?null:r.declaredTotal,ratio:r.ratio,category:CATEGORIES.includes(r.category)?r.category:'未分類',profileId:short(r.profileId,100),hasHighlight:!!r.hasHighlight,ackReason:short(r.ackReason)||'バックアップから復元',imageHash:/^[a-f\d]{64}$/.test(r.imageHash)?r.imageHash:'',warnings:[],acknowledged:true,items:r.items.map(i=>({id:short(i.id,100),name:short(i.name,300),amount:i.amount,selected:!!i.selected,marked:!!i.marked,taxRate:Number(i.taxRate),ratio:i.ratio===null?null:i.ratio,category:CATEGORIES.includes(i.category)?i.category:''})),discounts:r.discounts.map(d=>({id:short(d.id,100),name:short(d.name,300),amount:d.amount,target:short(d.target,100)})),taxes:Object.fromEntries(Object.entries(r.taxes||{}).filter(([k])=>['0','8','10','unknown'].includes(k)))};
  if(new Set(draft.items.map(i=>i.id)).size!==draft.items.length)throw Error('商品IDが重複しています。');
  const record=recordFromDraft(draft,{rounding:['floor','round','ceil'].includes(r.rounding)?r.rounding:'floor'}, {id:draft.id,createdAt:short(r.createdAt,40)});clean.push(record);
 }
 return clean;
}
