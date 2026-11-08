import test from 'node:test';
import assert from 'node:assert/strict';
import {recognizePhoto,releaseOCR} from '../ocr.js';
import {parseReceipt,calculate} from '../core.js';

// Deterministic engine responses preserve the real receipt layout that exposed
// the missing bold total. No browser or external OCR service is used here.
const line=(text,y,x0=20,x1=380,height=15)=>({text,bbox:{x0,x1,y0:y,y1:y+height},confidence:95});
const data=lines=>({data:{text:lines.map(l=>l.text).join('\n'),confidence:95,blocks:[{paragraphs:[{lines}]}]}});
const purchases=()=>[line('道具店',20),line('2026/11/08',40),line('工具 1980',65),line('クーポン値引 -200',90),line('ノート 680',115),line('食材 498',140),line('家庭用品 1250',165),line('商品合計 4208',190),line('会計クーポン -100',220)];
const sparse=()=>data([line('小計',20,20,50),line('4208',20,335,380),line('会計クーポン -100',60),line('会',110,20,40,7),line('口口',118,20,40,7),line('4,108',112,335,380,12),line('内消費税 373',150)]);
class Canvas {
 width=400;height=400;
 getContext(){return {getImageData:()=>({width:this.width,height:this.height,data:new Uint8ClampedArray(this.width*this.height*4).fill(255)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},drawImage(){}};}
}
async function withEngine(responses,run){
 const oldDocument=globalThis.document,oldEngine=globalThis.Tesseract,calls=[],modes=[];
 globalThis.document={createElement:()=>new Canvas()};
 globalThis.Tesseract={createWorker:async()=>({setParameters:async p=>modes.push(p.tessedit_pageseg_mode),recognize:async canvas=>{calls.push({width:canvas.width,height:canvas.height});const response=responses.shift();if(response instanceof Error)throw response;assert.ok(response,'unexpected additional OCR pass');return response;},terminate:async()=>{}})};
 try{await run({calls,modes});}
 finally{releaseOCR();globalThis.document=oldDocument;globalThis.Tesseract=oldEngine;}
}
test('bold total is recovered from an enlarged row without adding purchases twice',async()=>{
 await withEngine([data(purchases()),sparse(),data([line('合計 4,108',10)])],async({calls,modes})=>{
  const result=await recognizePhoto(new Canvas()),receipt=parseReceipt(result.lines);
  assert.equal(receipt.declaredTotal,4108);assert.equal(receipt.items.length,4);assert.equal(calculate(receipt).difference,0);
  assert.equal(calls.length,3);assert.equal(calls[2].width,800);assert.deepEqual(modes,['6','11','7','6']);
 });
});
test('a readable total skips all supplementary OCR passes',async()=>{
 await withEngine([data([...purchases(),line('合計 4108',260)])],async({calls})=>{
  const result=await recognizePhoto(new Canvas());assert.equal(parseReceipt(result.lines).declaredTotal,4108);assert.equal(calls.length,1);
 });
});
test('an optional retry failure preserves the successfully read purchases',async()=>{
 await withEngine([data(purchases()),new Error('supplementary OCR failed')],async({modes})=>{
  const result=await recognizePhoto(new Canvas()),receipt=parseReceipt(result.lines);
  assert.equal(receipt.items.length,4);assert.equal(receipt.declaredTotal,null);assert.equal(calculate(receipt).total,4108);assert.equal(modes.at(-1),'6');
 });
});
test('a cropped subtotal is never promoted to the receipt payment total',async()=>{
 await withEngine([data(purchases()),sparse(),data([line('小計 4208',10)])],async()=>{
  const result=await recognizePhoto(new Canvas());assert.equal(parseReceipt(result.lines).declaredTotal,null);
 });
});
