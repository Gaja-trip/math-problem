import sourceHashes from './hme/source-map.js';
import bundledSources from './hme/bundled-sources.js';
import {decodeHmeSource} from './source-integrity.js';
const base=new URL('./',import.meta.url);
let catalog=null;
const papers=new Map(),pdfs=new Map();
let library;
const sharedPageRanges=new Map();
export async function loadHmeCatalog(){if(!catalog){const r=await fetch(new URL('hme/catalog.json',base));if(!r.ok)throw new Error('기출 목록을 불러오지 못했습니다.');catalog=await r.json();}return catalog;}
export function currentCatalog(){return catalog;}
export function cachedHmeQuestions(){return [...papers.values()].flatMap(p=>p.questions||[]);}
export async function loadHmePaper(id){
  if(!/^hme-\d+-[1-9]$/.test(id))throw new Error('잘못된 기출 회차입니다.');
  if(!papers.has(id)){const r=await fetch(new URL(`hme/papers/${id}.json`,base));if(!r.ok)throw new Error('기출 자료를 찾지 못했습니다.');papers.set(id,await r.json());}
  return papers.get(id);
}
export function getCachedHmePaper(id){return papers.get(id);}
export function hmeSourceUrl(filename){if(!Object.hasOwn(sourceHashes,filename))throw new Error('등록되지 않은 공식 자료입니다.');return 'https://hme.chunjae.co.kr/webdata/HME/TestPaperData/'+encodeURIComponent(filename);}
export async function getHmeBytes(filename){
  if(!Object.hasOwn(bundledSources,filename))throw new Error('이 자료는 HME 공식 사이트에서 확인해 주세요.');
  const response=await fetch(new URL(`hme/files/${sourceHashes[filename]}.pdf.gz`,base),{signal:AbortSignal.timeout(45000)});
  if(!response.ok)throw new Error('공식 원본을 불러오지 못했습니다.');
  return decodeHmeSource(await response.arrayBuffer(),sourceHashes[filename]);
}
export async function getHmePdf(filename){
  if(!pdfs.has(filename)){
    if(!library)library=import('./vendor/pdfjs/pdf.min.mjs');
    const promise=(async()=>{const pdfjs=await library;pdfjs.GlobalWorkerOptions.workerSrc=new URL('vendor/pdfjs/pdf.worker.min.mjs',base).href;
      const data=await getHmeBytes(filename);
      return pdfjs.getDocument({data,cMapUrl:new URL('vendor/pdfjs/cmaps/',base).href,cMapPacked:true,standardFontDataUrl:new URL('vendor/pdfjs/standard_fonts/',base).href,wasmUrl:new URL('vendor/pdfjs/wasm/',base).href,isEvalSupported:false,enableXfa:false,disableRange:true}).promise;})();
    pdfs.set(filename,promise);
    promise.catch(()=>pdfs.delete(filename));
    if(pdfs.size>4){const [old,doc]=pdfs.entries().next().value;pdfs.delete(old);doc.then(p=>p.destroy()).catch(()=>{});}
  }
  return pdfs.get(filename);
}
export async function drawHmePage(canvas,filename,pageNumber,{clip=null,highlight=null,width=null,sourceHeight=null,zoom=1}={}){
  const doc=await getHmePdf(filename);const page=await doc.getPage(Math.min(Math.max(1,pageNumber),doc.numPages));
  const original=page.getViewport({scale:1});
  const parent=canvas.parentElement,style=parent?getComputedStyle(parent):null;
  const available=parent?parent.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0):620;
  const target=(width||Math.max(280,available||620))*zoom;
  const offsetX=sourceHeight?page.view[0]:0,offsetY=sourceHeight?sourceHeight-page.view[3]:0;
  const convert=box=>[box[0]-offsetX,box[1]-offsetY,box[2]-offsetX,box[3]-offsetY];
  const region=clip?convert(clip):[0,0,original.width,original.height];
  if(highlight)highlight=convert(highlight);
  const scale=target/(region[2]-region[0]);
  const pixelRatio=width?1:Math.min(devicePixelRatio||1,2);
  const viewport=page.getViewport({scale:scale*pixelRatio});
  canvas.width=Math.ceil((region[2]-region[0])*scale*pixelRatio);canvas.height=Math.ceil((region[3]-region[1])*scale*pixelRatio);
  canvas.style.width=target+'px';canvas.style.height=canvas.height/pixelRatio+'px';
  const transform=[1,0,0,1,-region[0]*scale*pixelRatio,-region[1]*scale*pixelRatio];
  await page.render({canvasContext:canvas.getContext('2d'),viewport,transform}).promise;
  if(highlight){const ctx=canvas.getContext('2d');ctx.strokeStyle='#5c9561';ctx.lineWidth=2*pixelRatio;ctx.strokeRect(highlight[0]*scale*pixelRatio,highlight[1]*scale*pixelRatio,(highlight[2]-highlight[0])*scale*pixelRatio,(highlight[3]-highlight[1])*scale*pixelRatio);}
  return {pages:doc.numPages,page:pageNumber};
}
export async function hmeQuestionRaster(question){
  const doc=await getHmePdf(question.paper);const page=await doc.getPage(question.paperPage);
  const {shared}=await hmeQuestionLayout(question);
  const canvas=document.createElement('canvas');
  await drawHmePage(canvas,question.paper,question.paperPage,{clip:shared?null:question.paperClip,width:1000,sourceHeight:question.paperDimensions?.[1]});
  return {data:canvas.toDataURL('image/jpeg',.94),width:canvas.width,height:canvas.height,shared};
}
export async function hmeQuestionLayout(question){
  const key=question.paper+':'+question.paperPage;
  if(!sharedPageRanges.has(key))sharedPageRanges.set(key,(async()=>{const doc=await getHmePdf(question.paper),page=await doc.getPage(question.paperPage),content=await page.getTextContent();return [...content.items.map(v=>v.str||'').join(' ').matchAll(/\[\s*(\d{1,2})\s*[~∼～]\s*(\d{1,2})\s*\]/g)].map(m=>[Number(m[1]),Number(m[2])]);})());
  const groups=await sharedPageRanges.get(key),shared=groups.some(([first,last])=>question.number>=first&&question.number<=last);
  return {shared,ratio:shared?(question.paperDimensions?.[0]||600)/(question.paperDimensions?.[1]||850):(question.paperClip[2]-question.paperClip[0])/(question.paperClip[3]-question.paperClip[1])};
}
