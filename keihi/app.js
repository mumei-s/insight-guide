import {VERSION,CATEGORIES,DEFAULT_SETTINGS,uid,yen,parseReceipt,calculate,validateDraft,recordFromDraft,draftFromRecord,findDuplicates,summarize,toCSV,summaryCSV,readBackup,ratioValue} from './core.js';
import {loadPhoto,rotatePhoto,cropPhoto,recognizePhoto,cancelOCR,releaseOCR} from './ocr.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon=name=>`<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const STORE='keihi.records.v1',PREFS='keihi.settings.v1';
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let settings=structuredClone(DEFAULT_SETTINGS),records=[],view='scan',year=today().slice(0,4),draft=null,photo=null,queue=[],queueTotal=0,queueDone=0,busy=false,sample=false,photoHash='',cropMode=false,cropRect=null,toastTimer=null,loadingPhoto=false,filters={query:'',month:'',category:''},storageFailed=false;
let dialogResolve=null,wakeLock=null,ocrToken=0;
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,5500);}
function modal(title,body,buttons=[{value:'ok',label:'閉じる',primary:true}]){
 const dialog=$('#dialog');if(dialog.open){dialog.close('cancel');dialogResolve?.('cancel');}
 $('#dialog-title').textContent=title;$('#dialog-body').innerHTML=body;$('#dialog-actions').innerHTML=buttons.map(b=>`<button class="button ${b.primary?'primary':'subtle'} ${b.danger?'danger':''}" value="${esc(b.value)}">${esc(b.label)}</button>`).join('');
 dialog.showModal();return new Promise(resolve=>{dialogResolve=resolve;});
}
$('#dialog').addEventListener('close',()=>{const fn=dialogResolve;dialogResolve=null;fn?.($('#dialog').returnValue||'cancel');});
async function confirm(title,text,button='続ける',danger=false){return await modal(title,`<p class="help-content">${esc(text)}</p>`,[{value:'cancel',label:'戻る'},{value:'yes',label:button,primary:!danger,danger}])==='yes';}
function loadData(){
 try{const raw=localStorage.getItem(PREFS);if(raw){const s=JSON.parse(raw);settings={...settings,persistence:typeof s.persistence==='boolean'?s.persistence:true,theme:['light','dark','system'].includes(s.theme)?s.theme:'system',rounding:['floor','round','ceil'].includes(s.rounding)?s.rounding:'floor',profiles:Array.isArray(s.profiles)?s.profiles.slice(0,30).map(p=>({id:String(p.id).slice(0,100),name:String(p.name||'按分設定').slice(0,100),ratio:p.ratio===null?null:ratioValue(p.ratio),basis:String(p.basis||'').slice(0,2000)})):settings.profiles};}}
 catch{toast('設定を読み込めなかったため、初期設定で開きました。');}
 try{const raw=localStorage.getItem(STORE);if(raw&&settings.persistence)records=readBackup(raw);}
 catch{settings.persistence=false;storageFailed=true;$('#fatal-notice').textContent='保存データを読み込めませんでした。元のデータは残しています。設定の「元データを取り出す」から確認できます。';$('#fatal-notice').hidden=false;}
 applyTheme();
}
function applyTheme(){document.documentElement.dataset.theme=settings.theme;}
function backupText(){return JSON.stringify({format:'keihi-local',version:VERSION,exportedAt:new Date().toISOString(),records});}
function persist(){
 try{localStorage.setItem(PREFS,JSON.stringify(settings));if(settings.persistence&&!storageFailed)localStorage.setItem(STORE,backupText());}
 catch{settings.persistence=false;storageFailed=true;$('#fatal-notice').textContent='端末への明細保存ができません。現在の明細はこのタブ内にあります。設定からバックアップを書き出してください。';$('#fatal-notice').hidden=false;}
 updateStorageLabel();
}
function updateStorageLabel(){ $('#storage-status').textContent=settings.persistence?'画像保存なし · 明細のみ端末に保存':'画像保存なし · 明細はこのタブのみ'; }
function updateYears(){const years=[...new Set([today().slice(0,4),String(Number(today().slice(0,4))-1),year,...records.map(r=>r.year)])].sort().reverse();$('#year-select').innerHTML=years.map(y=>`<option ${y===year?'selected':''}>${esc(y)}</option>`).join('');}
function updateOverview(){const s=summarize(records,year);$('#overview-year').textContent=year+'年分の経費計上額';$('#overview-total').textContent=yen(s.total);$('#overview-count').textContent=s.count;$('#nav-count').textContent=records.length;updateYears();updateStorageLabel();renderRecent();}
function renderRecent(){const recent=[...records].sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).slice(0,3);$('#recent-list').innerHTML=recent.length?recent.map(receiptRow).join(''):'<div class="empty-row">まだ登録はありません。最初の1枚から始めましょう。</div>';}
function receiptRow(r){return `<button class="receipt-row" data-open-record="${esc(r.id)}"><span class="receipt-badge">${icon('ledger')}</span><span><span class="row-merchant">${esc(r.merchant)}</span><span class="row-meta">${esc(r.date.replaceAll('-','/'))} · ${esc(r.category)}${r.paperRef?' · '+esc(r.paperRef):''}</span></span><span class="row-amount">${yen(r.expense)}</span><svg class="row-arrow"><use href="#i-arrow"/></svg></button>`;}
function switchView(next){if(!['scan','ledger','reports','settings'].includes(next))next='scan';view=next;$$('.view').forEach(e=>e.classList.toggle('active',e.id===next+'-view'));$$('[data-view]').forEach(e=>{if(e.closest('nav')){e.classList.toggle('active',e.dataset.view===next);if(e.dataset.view===next)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current');}});$('#view-label').textContent={scan:'読み取り',ledger:'経費帳',reports:'集計',settings:'設定・按分'}[next];if(next==='ledger')renderLedger();if(next==='reports')renderReports();if(next==='settings')renderSettings();history.replaceState(null,'','#'+next);window.scrollTo({top:0,behavior:'instant'});}
function defaultProfile(d){const p=settings.profiles.find(p=>p.id==='business')||settings.profiles[0];if(p){d.profileId=p.id;d.ratio=p.ratio;d.basis=p.basis;}return d;}
function categoryOptions(value,inherit=false){return (inherit?'<option value="">領収証の科目を使う</option>':'')+CATEGORIES.map(c=>`<option value="${esc(c)}" ${c===value?'selected':''}>${esc(c)}</option>`).join('');}
function profileOptions(value){return `<option value="custom" ${value==='custom'?'selected':''}>個別に指定</option>`+settings.profiles.map(p=>`<option value="${esc(p.id)}" ${p.id===value?'selected':''}>${esc(p.name)}${p.ratio===null?'（未設定）':` · ${p.ratio}%`}</option>`).join('');}
function clearPhoto(){if(photo){photo.width=photo.height=1;photo=null;}photoHash='';cropMode=false;cropRect=null;}
function showWorkbench(){ $('#scanner-home').hidden=false;$('#workbench').hidden=true;if(draft||photo||busy||loadingPhoto){$('#scanner-home').hidden=true;$('#workbench').hidden=false;} }
async function selectFiles(files){
 if(busy||loadingPhoto){toast('読み取りが終わるか、中止してから選び直してください。');return;}
 if((draft||photo)&&!await confirm('今の読み取りを入れ替える','未登録の明細と写真を破棄して、新しい領収証を開きます。','入れ替える'))return;
 const accepted=Array.from(files).filter(f=>/^image\//.test(f.type)||/[.](png|jpe?g|webp|bmp|heic|heif)$/i.test(f.name));
 if(!accepted.length){toast('JPEG・PNG・WebPの写真を選んでください。');return;}if(accepted.length>20){toast('一度に選べる写真は20枚までです。最初の20枚を開きます。');}
 queue=accepted.slice(0,20);queueTotal=queue.length;queueDone=0;draft=null;sample=false;switchView('scan');await nextPhoto();
}
async function nextPhoto(){
 clearPhoto();draft=null;sample=false;const file=queue.shift();if(!file){queueTotal=0;queueDone=0;renderWorkbench();return;}
 loadingPhoto=true;renderWorkbench();
 try{const [canvas,buffer]=await Promise.all([loadPhoto(file),file.arrayBuffer()]);photo=canvas;photoHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');queueDone++;}
 catch(e){toast(e.message);queueDone++;}
 finally{loadingPhoto=false;renderWorkbench();if(!photo&&queue.length)await nextPhoto();}
}
function renderWorkbench(){
 showWorkbench();const root=$('#workbench');if(!draft&&!photo&&!busy&&!loadingPhoto){root.innerHTML='';return;}
 const bar=`<div class="workbench-bar"><button class="back-button" data-action="leave-draft">${icon('back')}読み取りを終了</button><span class="queue-status">${queueTotal?`${queueDone} / ${queueTotal}枚`:'1枚'}${queue.length?` · 残り${queue.length}枚`:''}</span></div>`;
 if(loadingPhoto){root.innerHTML=bar+'<div class="progress-box"><h2>写真を開いています</h2><p>写真はこのタブ内だけで扱います。</p></div>';return;}
 if(busy){root.innerHTML=bar+`<div class="review-grid"><div id="photo-slot"></div><div class="progress-box"><span class="eyebrow">PRIVATE OCR</span><h2 id="progress-label">読取エンジンを準備しています</h2><p>画像は送信しません。初回はエンジンの読み込みに少し時間がかかります。</p><div class="progress-track"><div class="progress-fill indeterminate" id="progress-fill"></div></div><p id="progress-number">準備中</p><button class="text-button" data-action="cancel-ocr">読み取りを中止</button></div></div>`;renderPhoto(false);return;}
 if(!draft){root.innerHTML=bar+`<div class="review-grid"><div id="photo-slot"></div><div class="form-panel"><span class="eyebrow">READY TO READ</span><h2>向きと範囲を確認</h2><p class="settings-note">文字が正しい向きで、領収証ができるだけ大きく写っていれば準備完了です。余白が多いときは写真の「切り抜き」を使ってください。</p><div class="form-divider"></div><button class="button primary large" data-action="start-ocr">${icon('scan')}この写真を読み取る</button><p class="input-note">日本語をブラウザ内で解析します。OCRエンジンの自動保存は行いません。</p><div class="button-row"><button class="text-button" data-action="manual-with-photo">写真を見ながら手入力</button>${queue.length?'<button class="text-button" data-action="skip-photo">この写真をスキップ</button>':''}</div></div></div>`;renderPhoto(true);return;}
 renderDraft(bar);
}
function renderPhoto(editable){
 const slot=$('#photo-slot');if(!slot)return;
 slot.innerHTML=`<div class="photo-panel"><div class="photo-toolbar"><span>照合用プレビュー</span><div class="photo-tools">${photo&&editable?'<button data-action="rotate">回転 ↻</button><button data-action="crop">切り抜き</button>':''}${photo&&draft&&!busy?'<button data-action="reread">読み直す</button>':''}</div></div>${photo?'<div class="photo-stage" id="photo-stage"></div>':sample?'<div class="photo-stage"><div class="sample-receipt"><h3>くらしと仕事の店</h3><div>2026年11月08日</div><div class="sample-line marked"><span>作業用手袋</span><span>1,980</span></div><div class="sample-line"><span>クーポン値引</span><span>-200</span></div><div class="sample-line marked"><span>ノート</span><span>680</span></div><div class="sample-line"><span>食材</span><span>498</span></div><div class="sample-line"><span>家庭用洗剤</span><span>1,250</span></div><div class="sample-line"><span>小計</span><span>4,208</span></div><div class="sample-line"><span>会計クーポン</span><span>-100</span></div><div class="sample-line sample-total"><span>合計</span><span>4,108</span></div></div></div>':'<div class="photo-placeholder">'+icon('ledger')+'紙の領収証を見ながら入力<br>登録済みの画像は保存していません。</div>'}<p class="photo-note">${sample?'操作を確認するためのサンプルです。':'画像は送信・保存しません。登録後、このプレビューも破棄します。'}</p></div>`;
 if(photo){$('#photo-stage').append(photo);photo.setAttribute('aria-label','読み取り中の領収証');photo.setAttribute('role','img');}
}
function field(label,html,wide=false){return `<label class="${wide?'wide':''}"><span class="field-label">${label}</span>${html}</label>`;}
function renderDraft(bar){
 const result=calculate(draft,settings),warn=[...draft.warnings];const low=draft.items.filter(i=>i.needsReview).length;if(low)warn.push(`${low}件の明細で文字の判別が不確かです。商品名と金額を確認してください。`);
 $('#workbench').innerHTML=bar+`${sample?'<div class="sample-label">サンプル体験中 · この明細は経費帳に登録されません。</div>':''}<div class="review-grid"><div id="photo-slot"></div><div class="form-panel"><div class="minor-heading"><h2>読み取り内容の確認</h2><div class="pills">${draft.hasHighlight?'<span class="pill"><span class="marker-dot"></span>マーカー優先</span>':'<span class="pill">全商品を選択して開始</span>'}</div></div><div class="form-grid">
 ${field('購入日',`<input type="date" data-field="date" value="${esc(draft.date)}" required>`)}
 ${field('店名・支払先',`<input data-field="merchant" value="${esc(draft.merchant)}" maxlength="300" placeholder="紙に記載の店名" required>`)}
 ${field('経費科目',`<select data-field="category">${categoryOptions(draft.category)}</select>`)}
 ${field('按分プリセット',`<select data-field="profileId">${profileOptions(draft.profileId)}</select>`)}
 ${field('事業で使う割合',`<span class="ratio-input"><input type="number" data-field="ratio" min="0" max="100" step="0.01" inputmode="decimal" value="${esc(draft.ratio??'')}" placeholder="割合を入力"><span>%</span></span>`)}
 ${field('紙の整理番号',`<input data-field="paperRef" value="${esc(draft.paperRef)}" maxlength="100" placeholder="登録時に自動採番">`)}
 </div><div class="form-divider"></div><div class="minor-heading"><h3>経費にする商品</h3><div class="pills"><button class="text-button" data-action="select-all">全て</button><button class="text-button" data-action="select-none">解除</button>${draft.hasHighlight?'<button class="text-button" data-action="select-marked">蛍光のみ</button>':''}</div></div><div id="item-list" class="item-list">${draft.items.map(renderItem).join('')}</div><button class="text-button" data-action="add-item">${icon('plus')}商品を追加</button><div class="form-divider"></div><div class="minor-heading"><h3>値引き・クーポン</h3><button class="text-button" data-action="add-discount">${icon('plus')}追加</button></div><div id="discount-list">${draft.discounts.map(renderDiscount).join('')}</div><p class="adjustment-note">値引き額は正の金額で入力。会計全体の値引きは、家庭用の商品も含めて金額に応じて配分します。</p><div class="form-divider"></div><div class="form-grid">${field('商品金額の表示',`<select data-field="pricing"><option value="inclusive" ${draft.pricing==='inclusive'?'selected':''}>税込み</option><option value="exclusive" ${draft.pricing==='exclusive'?'selected':''}>税抜き（外税を加算）</option></select>`)}${field('紙に記載の支払総額',`<input type="number" data-field="declaredTotal" value="${esc(draft.declaredTotal??'')}" min="0" step="1" inputmode="numeric" placeholder="合計金額">`)}<div class="wide" id="tax-inputs">${renderTaxInputs()}</div></div><div id="reconciliation"></div>${warn.length?`<div class="warnings"><ul>${[...new Set(warn)].map(w=>`<li>${esc(w)}</li>`).join('')}</ul></div>`:''}<details class="raw-details"><summary>用途・按分根拠・支払方法を追加</summary><div class="form-grid">${field('支払方法',`<select data-field="payment">${['未指定','現金','クレジットカード','電子マネー','口座振替','銀行振込','その他'].map(p=>`<option ${draft.payment===p?'selected':''}>${p}</option>`).join('')}</select>`)}${field('按分の根拠',`<input data-field="basis" value="${esc(draft.basis)}" maxlength="2000" placeholder="例：使用面積・走行距離">`)}${field('用途・メモ',`<textarea data-field="memo" rows="2" maxlength="2000" placeholder="何の仕事に使ったか">${esc(draft.memo)}</textarea>`,true)}</div></details>${draft.rawText?`<details class="raw-details"><summary>読み取った文字を確認・修正</summary><textarea id="raw-text" aria-label="読み取った文字">${esc(draft.rawText)}</textarea><button class="text-button" data-action="reparse">修正した文字から明細を作り直す</button></details>`:''}<div class="form-divider"></div><div id="duplicate-warning"></div><label class="check-label"><input type="checkbox" data-field="acknowledged" ${draft.acknowledged?'checked':''}><span>紙と照合し、対象商品・値引き・事業割合を確認しました。</span></label><div class="error-text" id="draft-errors" role="alert"></div><div class="confirm-bar"><div class="confirm-amount"><span>按分後の経費計上額 <span id="selected-count"></span></span><strong id="expense-total">${yen(result.expense)}</strong></div><button class="button primary save-button" data-action="save-record">${sample?'サンプルを終了':draft.editingId?'変更を保存':queue.length?'登録して次へ':'経費帳に登録'}${icon(sample?'close':'check')}</button></div></div></div>`;
 renderPhoto(false);updateCalculation();
}
function renderItem(i){return `<div class="item-card ${i.selected?'selected':'excluded'}" data-item-card="${esc(i.id)}"><div class="item-main"><input type="checkbox" data-item-field="selected" data-id="${esc(i.id)}" ${i.selected?'checked':''} aria-label="${esc(i.name||'商品')}を経費にする"><input class="item-name" data-item-field="name" data-id="${esc(i.id)}" value="${esc(i.name)}" maxlength="300" aria-label="商品名"><input class="item-money" type="number" min="0" step="1" inputmode="numeric" data-item-field="amount" data-id="${esc(i.id)}" value="${esc(i.amount)}" aria-label="商品金額"><button class="icon-button" data-remove-item="${esc(i.id)}" aria-label="商品を削除">${icon('close')}</button></div><div class="item-sub">${i.marked?'<span class="marker-dot" title="蛍光マーカーを検出"></span>':''}<select data-item-field="category" data-id="${esc(i.id)}" aria-label="商品の経費科目">${categoryOptions(i.category,true)}</select><input class="item-ratio" type="number" min="0" max="100" step="0.01" inputmode="decimal" data-item-field="ratio" data-id="${esc(i.id)}" value="${esc(i.ratio??'')}" placeholder="共通%" aria-label="商品の事業割合（空欄は共通）">${draft.pricing==='exclusive'?`<select data-item-field="taxRate" data-id="${esc(i.id)}" aria-label="商品の税率">${[10,8,0].map(n=>`<option value="${n}" ${Number(i.taxRate)===n?'selected':''}>${n}%</option>`).join('')}</select>`:''}<span class="net-amount" data-net="${esc(i.id)}"></span></div></div>`;}
function renderDiscount(d){return `<div class="discount-card"><input data-discount-field="name" data-id="${esc(d.id)}" value="${esc(d.name)}" aria-label="値引き名" maxlength="300"><input type="number" min="0" step="1" inputmode="numeric" data-discount-field="amount" data-id="${esc(d.id)}" value="${esc(d.amount)}" aria-label="値引き額"><button class="icon-button" data-remove-discount="${esc(d.id)}" aria-label="値引きを削除">${icon('close')}</button><select class="discount-target" data-discount-field="target" data-id="${esc(d.id)}" aria-label="値引きを適用する対象"><option value="all" ${d.target==='all'?'selected':''}>会計全体に配分</option>${draft.items.map(i=>`<option value="${esc(i.id)}" ${d.target===i.id?'selected':''}>${esc(i.name||'名称未入力の商品')} に適用</option>`).join('')}</select></div>`;}
function renderTaxInputs(){return draft.pricing==='exclusive'?`<div class="form-grid">${[10,8].map(rate=>field(`${rate}%の外税額（空欄で自動計算）`,`<input data-tax="${rate}" type="number" min="0" step="1" inputmode="numeric" value="${esc(draft.taxes?.[rate]??'')}" placeholder="税額">`)).join('')}</div>${draft.taxes?.unknown?`<p class="input-note">読み取った税率不明の外税額：${yen(draft.taxes.unknown)}。複数税率の場合は税率別に入力してください。</p>`:''}`:'';}
function updateCalculation(){
 if(!draft||!$('#expense-total'))return;const r=calculate(draft,settings);$('#expense-total').textContent=yen(r.expense);$('#selected-count').textContent=`· ${r.selectedCount}点`;
 for(const row of r.rows){const el=$(`[data-net="${CSS.escape(row.id)}"]`);if(el)el.textContent=`値引後 ${yen(row.net)} / 経費 ${yen(row.expense)}`;const card=$(`[data-item-card="${CSS.escape(row.id)}"]`);card?.classList.toggle('selected',row.selected);card?.classList.toggle('excluded',!row.selected);}
 $('#reconciliation').innerHTML=`<div class="reconcile"><div class="reconcile-line"><span>全商品の値引き後合計${draft.pricing==='exclusive'?'（税込）':''}</span><b>${yen(r.total)}</b></div><div class="reconcile-line"><span>うち選択した商品</span><b>${yen(r.selected)}</b></div><div class="reconcile-line"><span>うち家事分（選択商品内）</span><b>${yen(r.privateAmount)}</b></div><div class="reconcile-line ${r.difference===0?'matching':'mismatch'}"><span>${r.difference===0?'✓ 紙の支払総額と一致':r.difference===null?'紙の支払総額が未入力':'紙の支払総額との差額'}</span><b>${r.difference===0?'照合OK':r.difference===null?'要確認':`${r.difference>0?'+':''}${yen(r.difference)}`}</b></div>${r.difference!==0?`<label><span class="field-label">差異・合計不明の理由（登録前に必須）</span><input id="ack-reason" data-field="ackReason" value="${esc(draft.ackReason)}" placeholder="不足明細や税額を直すか、差異の理由を記録" maxlength="2000"></label>`:''}</div>`;
 const dup=findDuplicates(draft,records);$('#duplicate-warning').innerHTML=dup.length?`<div class="warnings">同じ写真、または同日・同店・同じ支払総額の登録が${dup.length}件あります。<label class="check-label"><input type="checkbox" data-field="duplicateAcknowledged" ${draft.duplicateAcknowledged?'checked':''}>別の領収証であることを確認しました</label></div>`:'';
}
async function beginOCR(){
 if(!photo||busy||loadingPhoto)return;const token=++ocrToken;busy=true;renderWorkbench();
 try{if(navigator.wakeLock)wakeLock=await navigator.wakeLock.request('screen').catch(()=>null);const result=await recognizePhoto(photo,p=>{if(!$('#progress-label'))return;$('#progress-label').textContent=p.label;$('#progress-number').textContent=p.progress===null?'準備中':`${p.progress}%`;$('#progress-fill').classList.toggle('indeterminate',p.progress===null);$('#progress-fill').style.width=p.progress===null?'30%':`${Math.max(3,p.progress)}%`;});if(token!==ocrToken)return;draft=defaultProfile(parseReceipt(result.lines,{hasHighlight:result.hasHighlight}));draft.imageHash=photoHash;if(result.possibleColorCast)draft.warnings.push('広い範囲で色を検出しています。照明の色や背景をマーカーと誤認していないか確認してください。');if(result.confidence<65)draft.warnings.push('写真全体の文字が不鮮明です。金額が不正確なら、明るい場所で撮り直してください。');}
 catch(e){if(token===ocrToken)toast(e.message||'読み取りに失敗しました。');}
 finally{if(token===ocrToken){busy=false;await wakeLock?.release().catch(()=>{});wakeLock=null;renderWorkbench();}}
}
async function makeManual(){
 if(busy||loadingPhoto)return;if((draft||photo)&&!await confirm('手入力を始める','今の未登録の明細と写真を破棄し、新しい領収証を手入力します。','手入力する'))return;
 queue=[];queueTotal=0;queueDone=0;clearPhoto();sample=false;draft=defaultProfile(parseReceipt([]));draft.date=today();draft.warnings=[];draft.items=[newItem()];draft.declaredTotal='';switchView('scan');renderWorkbench();
}
function newItem(){return {id:uid(),name:'',amount:'',selected:true,marked:false,taxRate:10,ratio:null,category:'',needsReview:false};}
function nextPaperRef(date){const prefix=date.slice(0,7).replace('-','');const numbers=records.filter(r=>r.paperRef.startsWith(prefix+'-')).map(r=>Number(r.paperRef.slice(prefix.length+1))).filter(Number.isFinite);return `${prefix}-${String(Math.max(0,...numbers)+1).padStart(3,'0')}`;}
async function saveRecord(){
 if(sample){await leaveDraft(false);return;}
 const {errors}=validateDraft(draft,settings);if(!draft.acknowledged&&!errors.some(e=>e.includes('確認済み')))errors.push('紙と照合し、確認済みにチェックしてください。');
 const dup=findDuplicates(draft,records);if(dup.length&&!draft.duplicateAcknowledged)errors.push('重複の可能性がある登録を確認してください。');
 if(errors.length){$('#draft-errors').textContent=errors.join('\n');$('#draft-errors').scrollIntoView({block:'center',behavior:'smooth'});return;}
 if(!draft.paperRef?.trim())draft.paperRef=nextPaperRef(draft.date);if(records.some(r=>r.paperRef===draft.paperRef&&r.id!==draft.editingId)&&!await confirm('紙の整理番号が重複しています','同じ整理番号がすでにあります。この番号で登録しますか。','この番号で登録'))return;
 const existing=records.find(r=>r.id===draft.editingId);let record;
 try{record=recordFromDraft(draft,settings,existing);}catch(e){$('#draft-errors').textContent=e.message;return;}
 if(existing)records=records.map(r=>r.id===existing.id?record:r);else records.push(record);
 const paperRef=record.paperRef;persist();year=record.year;draft=null;clearPhoto();releaseOCR();updateOverview();toast(`${paperRef} · ${yen(record.expense)}を${existing?'更新':'登録'}しました。紙にも同じ番号を。`);
 if(queue.length)await nextPhoto();else{queueTotal=queueDone=0;renderWorkbench();}
}
async function leaveDraft(ask=true){
 if(ask&&(draft||photo||queue.length||busy)&&!await confirm('読み取りを終了する','未登録の明細・写真と、残りの写真を破棄します。登録済みの経費帳は残ります。','終了する'))return;
 if(busy){ocrToken++;await cancelOCR();busy=false;await wakeLock?.release().catch(()=>{});wakeLock=null;}queue=[];queueTotal=queueDone=0;draft=null;sample=false;clearPhoto();releaseOCR();renderWorkbench();
}
function filteredRecords(){return records.filter(r=>r.year===year&&(!filters.month||r.date.slice(5,7)===filters.month)&&(!filters.category||r.items.some(i=>i.selected&&(i.category||r.category)===filters.category))&&(!filters.query||[r.merchant,r.memo,r.paperRef,...r.items.map(i=>i.name)].join(' ').toLowerCase().includes(filters.query.toLowerCase()))).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt));}
function renderLedger(){const list=filteredRecords();$('#ledger-view').innerHTML=`<div class="page-heading"><div><div class="eyebrow">EXPENSE BOOK / ${year}</div><h1>ひとつずつ、記録に。</h1><p>画像は残さず、金額と使い道を見渡せる経費帳。</p></div><button class="button subtle" data-action="new-manual">${icon('plus')}追加</button></div><div class="toolbar"><input id="ledger-search" type="search" placeholder="店名・商品名・整理番号で探す" aria-label="経費帳を検索" value="${esc(filters.query)}"><select id="month-filter" aria-label="月で絞り込み"><option value="">すべての月</option>${Array.from({length:12},(_,i)=>`<option value="${String(i+1).padStart(2,'0')}" ${filters.month===String(i+1).padStart(2,'0')?'selected':''}>${i+1}月</option>`).join('')}</select><select id="category-filter" aria-label="科目で絞り込み"><option value="">すべての科目</option>${CATEGORIES.map(c=>`<option ${filters.category===c?'selected':''}>${esc(c)}</option>`).join('')}</select><button class="button subtle" data-action="export-csv">${icon('download')}CSV</button></div><div id="ledger-results">${ledgerResults(list)}</div><p class="report-note">CSVはこの年分の表示中の領収証に含まれる、選択した全明細を出力します。科目の絞り込みは、その科目を含む領収証を抽出します。</p>`;}
function ledgerResults(list){return list.length?`<div class="table-wrap ledger-desktop"><table class="ledger-table"><thead><tr><th>日付</th><th>支払先 / 科目</th><th class="table-ref-col">紙の整理番号</th><th class="number">経費計上額</th><th></th></tr></thead><tbody>${list.map(r=>`<tr data-open-record="${esc(r.id)}" tabindex="0" role="button" aria-label="${esc(r.merchant)}の詳細"><td class="table-date">${esc(r.date.replaceAll('-','/'))}</td><td>${esc(r.merchant)}<span class="subtext">${esc(r.category)} · ${r.items.filter(i=>i.selected).length}点</span></td><td class="table-ref-col table-ref">${esc(r.paperRef)}</td><td class="number">${yen(r.expense)}</td><td>${icon('arrow')}</td></tr>`).join('')}</tbody></table></div><div class="mobile-ledger-list">${list.map(receiptRow).join('')}</div><div class="list-foot"><span>${list.length}枚の領収証</span><span>経費計上額 <strong>${yen(list.reduce((s,r)=>s+r.expense,0))}</strong></span></div>`:'<div class="empty-row">この条件に合う領収証はありません。</div>';}
function updateLedgerResults(){ $('#ledger-results').innerHTML=ledgerResults(filteredRecords()); }
async function openRecord(id){
 const r=records.find(r=>r.id===id);if(!r)return;const action=await modal(r.merchant,`<div class="eyebrow">${esc(r.paperRef)} / ${esc(r.date)}</div><div class="detail-amount">${yen(r.expense)}</div><p class="input-note">按分後の経費計上額</p><dl class="detail-list"><div><dt>支払総額</dt><dd>${r.declaredTotal===null?'未入力':yen(r.declaredTotal)}</dd></div><div><dt>選択商品の合計</dt><dd>${yen(r.selected)}</dd></div><div><dt>事業割合</dt><dd>共通 ${r.ratio}% · ${esc({floor:'切り捨て',round:'四捨五入',ceil:'切り上げ'}[r.rounding])}</dd></div><div><dt>支払方法</dt><dd>${esc(r.payment)}</dd></div>${r.basis?`<div><dt>按分根拠</dt><dd>${esc(r.basis)}</dd></div>`:''}${r.memo?`<div><dt>用途・メモ</dt><dd>${esc(r.memo)}</dd></div>`:''}${r.ackReason?`<div><dt>差異確認</dt><dd>${esc(r.ackReason)}</dd></div>`:''}</dl><h3>経費にした商品</h3>${r.items.filter(i=>i.selected).map(i=>`<div class="detail-item"><span>${esc(i.name)}<small>${esc(i.category||r.category)} · ${i.ratio??r.ratio}%${i.directDiscount+i.sharedDiscount?' · 値引 '+yen(i.directDiscount+i.sharedDiscount):''}</small></span><b>${yen(i.expense)}</b></div>`).join('')}<p class="input-note">画像は保存していません。紙の整理番号で原本を確認してください。</p>`,[{value:'delete',label:'削除',danger:true},{value:'edit',label:'編集する'},{value:'ok',label:'閉じる',primary:true}]);
 if(action==='edit'){if((draft||photo||busy)&&!await confirm('編集に切り替える','今の未登録の読み取りは破棄して、この領収証を編集します。','編集する'))return;await leaveDraft(false);draft=draftFromRecord(r);switchView('scan');renderWorkbench();}
 if(action==='delete'&&await confirm('この領収証を削除する',`${r.paperRef} ${r.merchant} の登録を削除します。`,'削除する',true)){records=records.filter(x=>x.id!==id);persist();updateOverview();if(view==='ledger')renderLedger();if(view==='reports')renderReports();toast('領収証の登録を削除しました。');}
}
function renderReports(){const s=summarize(records,year),max=Math.max(1,...s.months.map(m=>m.amount));$('#reports-view').innerHTML=`<div class="page-heading"><div><div class="eyebrow">YEAR IN VIEW / ${year}</div><h1>経費の全体像。</h1><p>月ごと、科目ごとの経費計上額。選択した年分を集計しています。</p></div><button class="button subtle" data-action="print">印刷</button></div><div class="report-overview"><div><span>${year}年分の経費計上額</span><strong>${yen(s.total)}</strong></div><div><span>按分前の選択商品合計</span><strong>${yen(s.selected)}</strong></div><div><span>登録した領収証</span><strong>${s.count}<small> 枚</small></strong></div></div><div class="report-grid"><div class="report-panel"><h2>月別の経費計上額</h2><div class="month-list">${s.months.map(m=>`<div class="month-row"><span>${m.month}月</span><div class="month-track" aria-hidden="true"><div class="month-bar" data-width="${m.amount/max*100}"></div></div><b>${yen(m.amount)}</b></div>`).join('')}</div></div><div class="report-panel"><h2>科目別の経費計上額</h2>${Object.keys(s.categories).length?Object.entries(s.categories).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`<div class="category-row"><span>${esc(k)}</span><strong>${yen(v)}</strong></div>`).join(''):'<div class="empty-row">登録すると科目別に表示されます。</div>'}<div class="button-row"><button class="button subtle" data-action="export-summary">${icon('download')}科目別CSV</button><button class="button subtle" data-action="export-year">明細CSV</button></div><p class="report-note">この画面は経費の整理・集計用です。確定申告書や消費税申告書は作成しません。税込金額で集計します。</p></div></div>`;$$('.month-bar').forEach(el=>el.style.width=el.dataset.width+'%');}
function renderSettings(){
 const bytes=new TextEncoder().encode(backupText()).length;
 $('#settings-view').innerHTML=`<div class="page-heading"><div><div class="eyebrow">YOUR PREFERENCES</div><h1>使い方に合わせて。</h1><p>按分は登録時の割合を記録。設定変更で過去の経費は変わりません。</p></div></div><div class="settings-layout"><div><div class="settings-panel"><h2>家事按分のプリセット</h2><p>仕事に使う割合と、その根拠を登録します。未設定の割合は、領収証の確認時に入力してください。</p><div id="profile-list">${settings.profiles.map(renderProfile).join('')}</div><div class="button-row"><button class="button subtle" data-action="add-profile">${icon('plus')}按分を追加</button><button class="button primary" data-action="save-profiles">設定を保存</button></div><p class="report-note">按分率は使用実態に合わせて設定してください。<a href="https://www.nta.go.jp/taxes/shiraberu/taxanswer/shotoku/2210.htm" target="_blank" rel="noopener noreferrer">国税庁「必要経費の知識」</a></p></div></div><div><div class="settings-panel"><h2>表示・計算</h2><div class="settings-row"><div class="row-label">画面の色<small>端末の明暗設定にも対応</small></div><select id="theme-setting" aria-label="画面の色">${[['system','端末に合わせる'],['light','ライト'],['dark','ダーク']].map(([v,n])=>`<option value="${v}" ${settings.theme===v?'selected':''}>${n}</option>`).join('')}</select></div><div class="settings-row"><div class="row-label">按分の1円未満<small>商品ごとに処理。今後の登録に適用</small></div><select id="rounding-setting" aria-label="端数処理">${[['floor','切り捨て'],['round','四捨五入'],['ceil','切り上げ']].map(([v,n])=>`<option value="${v}" ${settings.rounding===v?'selected':''}>${n}</option>`).join('')}</select></div></div><div class="settings-panel"><h2>データと保存</h2><p>写真は送信・保存しません。明細の保存先は、このブラウザだけです。他の端末には自動で移りません。</p><div class="settings-row"><div class="row-label">明細を端末に残す<small>OFFの場合、タブを閉じると明細が消えます</small></div><input type="checkbox" id="persistence-setting" ${settings.persistence?'checked':''} aria-label="明細を端末に残す"></div><div class="data-meter">明細 ${records.length}枚 · 約${(bytes/1024).toFixed(1)}KB / 画像 0枚</div><p class="settings-note">通常のブラウザキャッシュにはアプリやOCRエンジンが残る場合があります。画像やOCRの一時ファイルを自動保存する機能はありません。</p><div class="button-row"><button class="button subtle" data-action="backup">${icon('download')}バックアップ</button><button class="button subtle" data-action="restore">復元</button>${storageFailed?'<button class="button subtle" data-action="recover">元データを取り出す</button>':''}</div><p class="report-note">ブラウザのデータ消去や端末変更に備え、区切りのよいときにバックアップしてください。画像を含まない明細JSONを出力します。</p><div class="danger-zone"><button class="text-button" data-action="clear-records">登録済みの明細をすべて削除</button></div></div></div></div>`;
}
function renderProfile(p){return `<div class="profile-card" data-profile="${esc(p.id)}"><div class="profile-top"><input class="profile-name" value="${esc(p.name)}" aria-label="按分名" maxlength="100"><input class="profile-ratio" type="number" min="0" max="100" step="0.01" inputmode="decimal" value="${esc(p.ratio??'')}" placeholder="未設定" aria-label="事業割合"><span>%</span><button class="icon-button" data-remove-profile="${esc(p.id)}" aria-label="按分を削除">${icon('close')}</button></div><input class="profile-basis" value="${esc(p.basis)}" aria-label="按分根拠" maxlength="2000" placeholder="根拠：例）事務所として使う面積 / 自宅の面積"></div>`;}
function collectProfiles(){return $$('#profile-list .profile-card').map(el=>({id:el.dataset.profile,name:el.querySelector('.profile-name').value.trim()||'按分設定',ratio:el.querySelector('.profile-ratio').value===''?null:ratioValue(el.querySelector('.profile-ratio').value),basis:el.querySelector('.profile-basis').value.trim()}));}
function download(text,name,type='text/plain;charset=utf-8'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);}
async function restoreFile(file){
 if(!file)return;if(file.size>20*1024*1024){toast('バックアップは20MBまでです。');return;}
 let incoming;try{incoming=readBackup(await file.text());}catch(e){toast(e.message||'バックアップを開けませんでした。');return;}
 const known=new Set(records.map(r=>r.id)),newRows=incoming.filter(r=>!known.has(r.id));if(!newRows.length){toast('追加できる新しい明細はありません。同じIDの明細はそのまま保持します。');return;}
 if(!await confirm('バックアップを復元する',`${newRows.length}枚を現在の経費帳に追加します。同じIDの明細は上書きしません。`,'追加して復元'))return;
 records.push(...newRows);persist();updateOverview();renderSettings();toast(`${newRows.length}枚の明細を復元しました。`);
}
function help(){modal('KEIHIの使い方',`<div class="help-content"><ol><li><b>紙に蛍光マーカー。</b> 家庭用品と混ざった領収証は、経費にしたい商品の「名前から金額まで」をマークすると安定します。黄色・緑・桃色・水色などに対応。蛍光がなければ全商品を選んで開始します。</li><li><b>撮影・写真選択。</b> 平らな場所で影を避け、紙が大きく写るように撮影。複数の写真は20枚まで、順番に読み取れます。必要なら回転・切り抜き。</li><li><b>値引きを確認。</b> 商品直下の値引きはその商品へ。会計全体のクーポンは全商品の金額に応じて配分します。対象が違えばプルダウンで変更できます。</li><li><b>科目と事業割合を設定。</b> 家事按分は設定で登録でき、商品ごとにも変更できます。商品金額が税抜きのときは「税抜き」に切り替え、外税額も確認してください。</li><li><b>紙と照合して登録。</b> 支払総額の一致を確認。登録した整理番号を紙にも書いて、月ごとにまとめると見つけやすくなります。集計は月別・科目別、明細はCSVに出力できます。</li></ol><h3>画像と保存について</h3><p>OCR・色検出はブラウザ内で実行し、写真や経費データは外部送信しません。登録・読み取り終了時に画像を破棄します。明細の保存はOFFにもできます。OFFではタブを閉じると明細が消えるため、終了前にバックアップしてください。</p><p>ダウンロードやクラウド保存は自動では行いません。カメラで撮った写真をカメラアプリ側が保存するかは、端末の設定によります。</p><h3>読み取りを確認する理由</h3><p>蛍光の薄さ、レシートの書式、印字のかすれで認識がずれる場合があります。商品の選択や値引き先を確認して確定します。ポイント支払いは自動で値引き扱いにしません。複雑なセット割引などは手動で対象を指定してください。</p><p>紙の整理・計算を補助するアプリです。電子帳簿保存法のスキャナ保存や、原本保存の代わりにはなりません。</p></div>`);}
// All actions are explicit UI operations; no analytics, upload or remote API calls.
document.addEventListener('click',async e=>{
 const nav=e.target.closest('[data-view]');if(nav){switchView(nav.dataset.view);return;}
 const opened=e.target.closest('[data-open-record]');if(opened){await openRecord(opened.dataset.openRecord);return;}
 const removeItem=e.target.closest('[data-remove-item]');if(removeItem&&draft){const id=removeItem.dataset.removeItem;if(draft.discounts.some(d=>d.target===id)&&!await confirm('関連する値引きも削除する','この商品と、この商品を対象にする値引きを一緒に削除します。','削除する'))return;draft.items=draft.items.filter(i=>i.id!==id);draft.discounts=draft.discounts.filter(d=>d.target!==id);draft.acknowledged=false;renderWorkbench();return;}
 const removeDiscount=e.target.closest('[data-remove-discount]');if(removeDiscount&&draft){draft.discounts=draft.discounts.filter(d=>d.id!==removeDiscount.dataset.removeDiscount);draft.acknowledged=false;renderWorkbench();return;}
 const removeProfile=e.target.closest('[data-remove-profile]');if(removeProfile){if($$('#profile-list .profile-card').length===1){toast('按分は1つ以上残してください。');return;}removeProfile.closest('.profile-card').remove();return;}
 const action=e.target.closest('[data-action]')?.dataset.action;if(!action)return;
 switch(action){
  case 'help':help();break;
  case 'leave-draft':await leaveDraft();break;
  case 'start-ocr':await beginOCR();break;
  case 'cancel-ocr':ocrToken++;await cancelOCR();busy=false;await wakeLock?.release().catch(()=>{});wakeLock=null;renderWorkbench();toast('読み取りを中止しました。');break;
  case 'reread':if(await confirm('写真を読み直す','現在の未登録の明細を作り直します。','読み直す')){draft=null;renderWorkbench();await beginOCR();}break;
  case 'rotate':{const rotated=rotatePhoto(photo),hash=photoHash;clearPhoto();photo=rotated;photoHash=hash;renderWorkbench();break;}
  case 'crop':startCrop();break;
  case 'manual-with-photo':draft=defaultProfile(parseReceipt([]));draft.date=today();draft.warnings=[];draft.items=[newItem()];draft.imageHash=photoHash;renderWorkbench();break;
  case 'skip-photo':await nextPhoto();break;
  case 'new-manual':await makeManual();break;
  case 'add-item':draft.items.push(newItem());draft.acknowledged=false;renderWorkbench();break;
  case 'select-all':case 'select-none':case 'select-marked':draft.items.forEach(i=>i.selected=action==='select-all'||(action==='select-marked'&&i.marked));draft.acknowledged=false;renderWorkbench();break;
  case 'add-discount':draft.discounts.push({id:uid(),name:'値引き',amount:'',target:'all'});draft.acknowledged=false;renderWorkbench();break;
  case 'save-record':await saveRecord();break;
  case 'reparse':{if(!await confirm('明細を作り直す','修正した文字を解析します。明細の編集内容と選択状態はリセットします。蛍光がある写真は対象を選び直してください。','作り直す'))break;const parsed=parseReceipt($('#raw-text').value.split('\n'),{hasHighlight:draft.hasHighlight});for(const key of ['merchant','date','category','profileId','ratio','basis','paperRef','memo','payment','imageHash','editingId'])parsed[key]=draft[key];draft=parsed;renderWorkbench();break;}
  case 'export-csv':download(toCSV(filteredRecords()),`KEIHI-${year}-明細.csv`,'text/csv;charset=utf-8');break;
  case 'export-year':download(toCSV(records.filter(r=>r.year===year)),`KEIHI-${year}-明細.csv`,'text/csv;charset=utf-8');break;
  case 'export-summary':download(summaryCSV(records,year),`KEIHI-${year}-科目別.csv`,'text/csv;charset=utf-8');break;
  case 'print':window.print();break;
  case 'add-profile':if($$('#profile-list .profile-card').length>=30){toast('按分設定は30件までです。');break;}$('#profile-list').insertAdjacentHTML('beforeend',renderProfile({id:uid(),name:'新しい按分',ratio:null,basis:''}));break;
  case 'save-profiles':{const p=collectProfiles();if(p.some(x=>x.ratio!==null&&!Number.isFinite(x.ratio))){toast('割合は0～100%、小数点以下2桁までで入力してください。');break;}settings.profiles=p;persist();toast('按分設定を保存しました。過去の明細には影響しません。');break;}
  case 'backup':download(backupText(),`KEIHI-backup-${today()}.json`,'application/json');toast('明細のバックアップを書き出しました。');break;
  case 'restore':$('#restore-input').click();break;
  case 'recover':download(localStorage.getItem(STORE)||'{}',`KEIHI-recovery-${today()}.json`,'application/json');break;
  case 'clear-records':if(await confirm('登録済みの明細をすべて削除','すべての年分の明細を削除します。必要な場合は先にバックアップしてください。','すべて削除',true)){records=[];localStorage.removeItem(STORE);storageFailed=false;$('#fatal-notice').hidden=true;persist();updateOverview();renderSettings();toast('すべての年分の明細を削除しました。');}break;
 }
});
function handleDraftInput(el){
 if(!draft)return;let recalc=true;
 if(el.dataset.field){const key=el.dataset.field;draft[key]=el.type==='checkbox'?el.checked:el.value;
  if(key==='ratio'){draft.profileId='custom';const preset=$('[data-field="profileId"]');if(preset)preset.value='custom';}
  if(key==='profileId'){const p=settings.profiles.find(p=>p.id===el.value);if(p){draft.ratio=p.ratio;draft.basis=p.basis;draft.acknowledged=false;renderWorkbench();}return;}
  if(key==='pricing'){draft.acknowledged=false;renderWorkbench();return;}
  if(['ackReason','memo','basis','paperRef','payment','acknowledged','duplicateAcknowledged'].includes(key))recalc=false;
 }
 if(el.dataset.itemField){const i=draft.items.find(i=>i.id===el.dataset.id);if(i)i[el.dataset.itemField]=el.type==='checkbox'?el.checked:el.dataset.itemField==='ratio'&&el.value===''?null:el.value;}
 if(el.dataset.discountField){const d=draft.discounts.find(d=>d.id===el.dataset.id);if(d)d[el.dataset.discountField]=el.value;}
 if(el.dataset.tax){draft.taxes[el.dataset.tax]=el.value;}
 if(recalc){draft.acknowledged=false;const ack=$('[data-field="acknowledged"]');if(ack)ack.checked=false;const active=document.activeElement,id=active?.id;
  // Keep the discrepancy-reason field stable while typing in it.
  updateCalculation();if(id==='ack-reason')$('#ack-reason')?.focus();
 }
}
$('#workbench').addEventListener('input',e=>{if(e.target.matches('input:not([type=checkbox]),textarea'))handleDraftInput(e.target);});
$('#workbench').addEventListener('change',e=>{if(e.target.matches('select,input[type=checkbox]'))handleDraftInput(e.target);});
document.addEventListener('input',e=>{if(e.target.id==='ledger-search'){filters.query=e.target.value;updateLedgerResults();}});
document.addEventListener('change',async e=>{const el=e.target;
 if(el.id==='year-select'){year=el.value;updateOverview();if(view==='ledger')renderLedger();if(view==='reports')renderReports();}
 if(el.id==='month-filter'){filters.month=el.value;updateLedgerResults();}
 if(el.id==='category-filter'){filters.category=el.value;updateLedgerResults();}
 if(el.id==='theme-setting'){settings.theme=el.value;applyTheme();persist();}
 if(el.id==='rounding-setting'){settings.rounding=el.value;persist();if(draft){draft.acknowledged=false;renderWorkbench();}toast('今後の登録に適用します。登録済みの金額は変わりません。');}
 if(el.id==='persistence-setting'){
  if(!el.checked){if(!await confirm('明細の保存を停止する','このブラウザに保存した明細を消し、開いているタブ内だけで扱います。タブを閉じる前にバックアップしてください。','保存を停止')){el.checked=true;return;}settings.persistence=false;localStorage.removeItem(STORE);storageFailed=false;$('#fatal-notice').hidden=true;}
  else{settings.persistence=true;storageFailed=false;$('#fatal-notice').hidden=true;}persist();renderSettings();
 }
});
$('#camera-button').onclick=()=>$('#camera-input').click();$('#photo-button').onclick=()=>$('#photo-input').click();$('#manual-button').onclick=makeManual;
for(const id of ['camera-input','photo-input'])$('#'+id).onchange=e=>{const files=Array.from(e.target.files);e.target.value='';selectFiles(files);};
$('#restore-input').onchange=e=>{const file=e.target.files[0];e.target.value='';restoreFile(file);};
$('#sample-button').onclick=async()=>{if(draft||photo){if(!await confirm('サンプルを開く','未登録の内容を破棄してサンプルを開きます。','サンプルを開く'))return;}await leaveDraft(false);sample=true;draft=parseReceipt([{text:'くらしと仕事の店'},{text:'2026年11月08日'},{text:'作業用手袋 1,980',marked:true},{text:'クーポン値引 -200'},{text:'ノート 680',marked:true},{text:'食材 498'},{text:'家庭用洗剤 1,250'},{text:'小計 4,208'},{text:'会計クーポン -100'},{text:'合計 4,108'}],{hasHighlight:true});draft.category='消耗品費';switchView('scan');renderWorkbench();};
const drop=$('#drop-zone');for(const type of ['dragenter','dragover'])drop.addEventListener(type,e=>{e.preventDefault();drop.classList.add('dragover');});for(const type of ['dragleave','drop'])drop.addEventListener(type,e=>{e.preventDefault();drop.classList.remove('dragover');});drop.addEventListener('drop',e=>selectFiles(e.dataTransfer.files));
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('tr[data-open-record]')){e.preventDefault();openRecord(e.target.dataset.openRecord);}});
function startCrop(){
 if(!photo||busy||draft)return;const stage=$('#photo-stage');cropMode=!cropMode;stage.classList.toggle('cropping',cropMode);stage.querySelector('.crop-rect')?.remove();if(!cropMode)return;
 toast('写真の上で、残したい範囲をなぞってください。');let start=null,rectEl=null;
 const point=e=>{const b=photo.getBoundingClientRect();return {x:Math.max(0,Math.min(photo.width,(e.clientX-b.left)*photo.width/b.width)),y:Math.max(0,Math.min(photo.height,(e.clientY-b.top)*photo.height/b.height))};};
 stage.onpointerdown=e=>{if(!cropMode||e.target!==photo)return;e.preventDefault();start=point(e);stage.setPointerCapture(e.pointerId);rectEl=document.createElement('div');rectEl.className='crop-rect';stage.append(rectEl);};
 stage.onpointermove=e=>{if(!start||!cropMode)return;const end=point(e);cropRect={x:Math.min(start.x,end.x),y:Math.min(start.y,end.y),width:Math.abs(end.x-start.x),height:Math.abs(end.y-start.y)};const a=photo.getBoundingClientRect(),b=stage.getBoundingClientRect(),s=a.width/photo.width;Object.assign(rectEl.style,{left:`${a.left-b.left+stage.scrollLeft+cropRect.x*s}px`,top:`${a.top-b.top+stage.scrollTop+cropRect.y*s}px`,width:`${cropRect.width*s}px`,height:`${cropRect.height*s}px`});};
 stage.onpointerup=()=>{start=null;if(cropRect&&cropRect.width>80&&cropRect.height>80){const cropped=cropPhoto(photo,cropRect),hash=photoHash;clearPhoto();photo=cropped;photoHash=hash;renderWorkbench();}else{rectEl?.remove();toast('もう少し広い範囲を指定してください。');}};
}
window.addEventListener('beforeunload',e=>{releaseOCR();if(draft||queue.length||(!settings.persistence&&records.length)){e.preventDefault();e.returnValue='';}});
window.addEventListener('pagehide',()=>{releaseOCR();clearPhoto();queue=[];});
window.addEventListener('storage',e=>{if(e.key===STORE){$('#fatal-notice').textContent='別のタブで経費帳が変更されました。現在の入力をバックアップし、再読み込みしてから登録してください。';$('#fatal-notice').hidden=false;settings.persistence=false;storageFailed=true;}});
loadData();updateOverview();switchView(location.hash.slice(1)||'scan');
