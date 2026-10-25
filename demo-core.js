'use strict';
window.DemoViews=Object.create(null);
window.Demo=(()=>{
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 let toastTimer;
 const toast=message=>{const e=document.querySelector('#toast');e.textContent=message;e.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>e.classList.remove('show'),3500)};
 const modal=(title,html)=>{document.querySelector('#modal-title').textContent=title;document.querySelector('#modal-body').innerHTML=html;const e=document.querySelector('#demo-modal');if(!e.open)e.showModal()};
 const person=(name,letter='D')=>`<span class="miu-person"><span class="miu-avatar fallback">${escape(letter)}</span><span><b>${escape(name)}</b><button class="demo-profile" data-explain="profile">プロフィール ↗</button></span></span>`;
 const articles=[{id:'sample-article-1',title:'書き続けるための小さな習慣',pv:840,imp:1500,likes:48,comments:8,date:'2026-10-24'},{id:'sample-article-2',title:'週末に見つけた新しい視点',pv:620,imp:1250,likes:36,comments:5,date:'2026-10-22'},{id:'sample-article-3',title:'日々の記録が、アイデアになる',pv:440,imp:800,likes:30,comments:6,date:'2026-10-20'},{id:'sample-article-4',title:'暮らしを整えるメモ',pv:280,imp:650,likes:27,comments:2,date:'2026-10-17'},{id:'sample-article-5',title:'好きなことを続けてみる',pv:180,imp:480,likes:24,comments:2,date:'2026-10-12'},{id:'sample-article-6',title:'朝の散歩で考えたこと',pv:120,imp:320,likes:21,comments:1,date:'2026-09-28'}];
 // Shared identities and favorites belong to this page only; reloading resets them.
 const names=['あおい','こはる','なぎ','ひなた','りつ','ゆう','そら','もり','つき','かぜ','ほし','あかり','にじ','ゆき'];
 const colors=['blue','green','purple','orange','teal','pink'];
 const creators=names.map((name,i)=>({id:`sample-${String.fromCharCode(97+i)}`,name:`デモ・${name}`,handle:`sample_creator_${String(i+1).padStart(2,'0')}`,letter:name.slice(0,1),color:colors[i%colors.length]}));
 const people=creators.slice(0,6).map(p=>p.name);
 const self={id:'demo-self',name:'サンプルクリエイター',handle:'demo_creator',letter:'D',color:'blue'};
 const favorites={ids:new Set(creators.slice(0,4).map(p=>p.id)),groups:['必ず読む','創作の仲間'],assigned:{'sample-a':'必ず読む','sample-b':'創作の仲間'},filter:'all',newGroup:'',open:'',query:''};
 const isFavorite=id=>favorites.ids.has(id);
 const setFavorite=(id,enabled)=>{
  if(!creators.some(p=>p.id===id))return false;
  const next=typeof enabled==='boolean'?enabled:!favorites.ids.has(id);
  if(next)favorites.ids.add(id);
  else {favorites.ids.delete(id);delete favorites.assigned[id];if(favorites.open===id)favorites.open='';}
  return next;
 };
 return {escape,toast,modal,person,isFavorite,setFavorite,data:{articles,people,creators,self},state:{view:'likes',favorites},render(){},go(){},sectionHead:(key,title,count)=>`<header class="miu-section-head"><div><small>${escape(key)}</small><h2>${escape(title)}</h2></div><div><strong>${escape(count)}</strong></div></header>`};
})();