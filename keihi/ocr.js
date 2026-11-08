let worker=null,loading=null,activeRun=0,workerGeneration=0,progressCallback=()=>{};
const asset=path=>new URL(path,import.meta.url).href;
export function isMarkerPixel(r,g,b){
 const max=Math.max(r,g,b),min=Math.min(r,g,b),delta=max-min;
 // Bright, saturated ink. Dark printing and nearly white paper are excluded.
 if(max<125||delta<42||delta/max<0.23||(r+g+b)/3<95)return false;
 const h=(max===r?((g-b)/delta+6)%6:max===g?(b-r)/delta+2:(r-g)/delta+4)*60;
 return (h>=27&&h<=178)||(h>=184&&h<=242)||(h>=280&&h<=350);
}
export function markerCoverage(image,bbox){
 const {width,height,data}=image;
 const x0=Math.max(0,Math.floor(bbox.x0-6)),x1=Math.min(width,Math.ceil(bbox.x1+6));
 const pad=Math.max(4,Math.round((bbox.y1-bbox.y0)*0.35)),y0=Math.max(0,Math.floor(bbox.y0-pad)),y1=Math.min(height,Math.ceil(bbox.y1+pad));
 let colored=0,total=0,bestRow=0;const step=Math.max(1,Math.floor(width/1000));
 for(let y=y0;y<y1;y+=step){let rowColored=0,rowTotal=0;for(let x=x0;x<x1;x+=step){const p=(y*width+x)*4;rowTotal++;total++;if(isMarkerPixel(data[p],data[p+1],data[p+2])){colored++;rowColored++;}}bestRow=Math.max(bestRow,rowTotal?rowColored/rowTotal:0);}
 return {fraction:total?colored/total:0,marked:total>0&&colored/total>0.022&&bestRow>0.12};
}
export async function loadPhoto(file){
 if(!/^image\//.test(file.type)&&!/[.](?:png|jpe?g|webp|bmp|heic|heif)$/i.test(file.name))throw Error('写真（JPEG・PNG・WebP）を選んでください。PDFには対応していません。');
 if(file.size>40*1024*1024)throw Error('写真は1枚40MBまでです。少し小さくして選び直してください。');
 const image=await createImageBitmap(file).catch(()=>{throw Error('この画像を開けません。JPEG・PNGの写真で選び直してください。');});
 const maxDimension=5000,maxPixels=7_000_000;
 const scale=Math.min(1,maxDimension/Math.max(image.width,image.height),Math.sqrt(maxPixels/(image.width*image.height)));
 const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.width*scale));canvas.height=Math.max(1,Math.round(image.height*scale));const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(image,0,0,canvas.width,canvas.height);image.close();return canvas;
}
export function rotatePhoto(canvas){const out=document.createElement('canvas');out.width=canvas.height;out.height=canvas.width;const ctx=out.getContext('2d');ctx.translate(out.width,0);ctx.rotate(Math.PI/2);ctx.drawImage(canvas,0,0);return out;}
export function cropPhoto(canvas,rect){const out=document.createElement('canvas');out.width=Math.round(rect.width);out.height=Math.round(rect.height);out.getContext('2d').drawImage(canvas,rect.x,rect.y,rect.width,rect.height,0,0,out.width,out.height);return out;}
export function preprocess(canvas){
 const ctx=canvas.getContext('2d',{willReadFrequently:true}),original=ctx.getImageData(0,0,canvas.width,canvas.height);
 const out=document.createElement('canvas');out.width=canvas.width;out.height=canvas.height;const target=out.getContext('2d'),image=target.createImageData(out.width,out.height);
 for(let p=0;p<original.data.length;p+=4){const r=original.data[p],g=original.data[p+1],b=original.data[p+2];let gray=isMarkerPixel(r,g,b)?Math.max(r,g,b):0.299*r+0.587*g+0.114*b;gray=Math.max(0,Math.min(255,(gray-115)*1.25+128));image.data[p]=image.data[p+1]=image.data[p+2]=gray;image.data[p+3]=255;}
 target.putImageData(image,0,0);return {canvas:out,original};
}
async function loadEngine(){
 if(globalThis.Tesseract)return;
 if(!loading)loading=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=asset('./vendor/tesseract.min.js');s.onload=resolve;s.onerror=()=>{s.remove();loading=null;reject(Error('文字読取エンジンを読み込めませんでした。通信を確認して再実行してください。'));};document.head.append(s);});
 return loading;
}
const labels={'loading tesseract core':'読取エンジンを準備しています','initializing tesseract':'読取エンジンを起動しています','loading language traineddata':'日本語データを読み込んでいます','initializing api':'日本語の読み取りを準備しています','recognizing text':'文字と金額を読み取っています'};
export function groupOCRRows(lines){
 const groups=[];
 for(const line of [...lines].sort((a,b)=>a.bbox.y0-b.bbox.y0||a.bbox.x0-b.bbox.x0)){
  const center=(line.bbox.y0+line.bbox.y1)/2,height=line.bbox.y1-line.bbox.y0;
  let g=groups.find(g=>Math.abs(g.center-center)<Math.max(g.height,height)*0.6);
  if(!g){g={center,height,parts:[]};groups.push(g);}g.parts.push(line);
 }
 return groups.map(g=>{const p=g.parts.sort((a,b)=>a.bbox.x0-b.bbox.x0);return {text:p.map(l=>l.text.trim()).join(' '),confidence:Math.min(...p.map(l=>l.confidence??100)),bbox:{x0:Math.min(...p.map(l=>l.bbox.x0)),x1:Math.max(...p.map(l=>l.bbox.x1)),y0:Math.min(...p.map(l=>l.bbox.y0)),y1:Math.max(...p.map(l=>l.bbox.y1))}};});
}
export async function recognizePhoto(canvas,onProgress=()=>{}){
 const run=++activeRun;const isCancelled=()=>run!==activeRun;progressCallback=onProgress;await loadEngine();if(isCancelled())throw Error('読み取りを中止しました。');
 if(!worker){
  const generation=++workerGeneration;const made=await globalThis.Tesseract.createWorker('jpn',1,{workerPath:asset('./vendor/worker.min.js'),corePath:asset('./vendor/core'),langPath:asset('./vendor/lang'),cacheMethod:'none',gzip:true,logger:m=>{if(generation===workerGeneration)progressCallback({label:labels[m.status]||'領収証を解析しています',progress:m.status==='recognizing text'?Math.round(m.progress*100):null});},errorHandler:()=>{} });
  if(isCancelled()){await made.terminate();throw Error('読み取りを中止しました。');}worker=made;
  await worker.setParameters({tessedit_pageseg_mode:'6',preserve_interword_spaces:'1',user_defined_dpi:'300'});
 }
 const processed=preprocess(canvas);
 let data,extraLines=[];
 try{
  ({data}=await worker.recognize(processed.canvas,{}, {text:true,blocks:true}));
  if(!/(?:合計|総額|ご利用金額|お支払金額)[^\n]*\d/.test(data.text.replace(/[ \t]/g,''))&&!isCancelled()){
   // Rules/bold print can hide the total in a single-block pass. Read the lower
   // original image again; only total metadata is merged, never extra purchases.
   onProgress({label:'支払総額を追加で確認しています',progress:null});
   const lower=document.createElement('canvas'),top=Math.floor(canvas.height*0.4);lower.width=canvas.width;lower.height=canvas.height-top;lower.getContext('2d').drawImage(canvas,0,top,canvas.width,lower.height,0,0,lower.width,lower.height);
   try{await worker.setParameters({tessedit_pageseg_mode:'11'});const extra=await worker.recognize(lower,{}, {text:true,blocks:true});extraLines=groupOCRRows((extra.data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>p.lines||[]))).filter(l=>/^(?:合\s*計|総合計|総額|ご利用金額|お支払|お買上)/.test(l.text.trim())&&/\d/.test(l.text)).map(l=>({...l,bbox:{...l.bbox,y0:l.bbox.y0+top,y1:l.bbox.y1+top}}));}
   finally{lower.width=lower.height=1;if(worker&&!isCancelled())await worker.setParameters({tessedit_pageseg_mode:'6'});}
  }
 }catch(e){if(isCancelled())throw Error('読み取りを中止しました。');throw Error('読み取りに失敗しました。写真の向きや明るさを確認して再実行してください。');}
 finally{processed.canvas.width=processed.canvas.height=1;}
 if(isCancelled())throw Error('読み取りを中止しました。');
 const lines=[...(data.blocks||[]).flatMap(b=>(b.paragraphs||[]).flatMap(p=>(p.lines||[]))),...extraLines].sort((a,b)=>a.bbox.y0-b.bbox.y0).map(l=>({text:l.text,bbox:l.bbox,confidence:l.confidence,...markerCoverage(processed.original,l.bbox)}));
 const marked=lines.filter(l=>l.marked);const hasHighlight=marked.length>0;
 return {lines,hasHighlight,confidence:data.confidence,possibleColorCast:lines.length>3&&marked.length/lines.length>0.75};
}
export async function cancelOCR(){activeRun++;workerGeneration++;const current=worker;worker=null;if(current)await current.terminate();}
export function releaseOCR(){activeRun++;workerGeneration++;if(worker){worker.terminate();worker=null;}}
