import sourceHashes from './hme/source-map.js';
import bundledSources from './hme/bundled-sources.js';
import {decodeHmeSource} from './source-integrity.js';
import {getLocalDocument,getLocalRaster,getLocalQuestion,studyAssetBase} from './local-media.js?v=local6';
export {getLocalDocument} from './local-media.js?v=local6';
const base=new URL('./',import.meta.url);
let catalog=null,catalogPromise;
const papers=new Map(),pendingPapers=new Map(),bytesCache=new Map();
export async function loadHmeCatalog(){
  if(!catalogPromise)catalogPromise=(async()=>{const r=await fetch(new URL('hme/catalog.json',base));if(!r.ok)throw new Error('기출 목록을 불러오지 못했습니다.');return catalog=await r.json();})().catch(error=>{catalogPromise=null;throw error;});
  return catalogPromise;
}
export function currentCatalog(){return catalog;}
export function cachedHmeQuestions(){return [...papers.values()].flatMap(p=>p.questions||[]);}
export async function loadHmePaper(id){
  if(!/^hme-\d+-[1-9]$/.test(id))throw new Error('잘못된 기출 회차입니다.');
  if(papers.has(id))return papers.get(id);
  if(!pendingPapers.has(id))pendingPapers.set(id,(async()=>{const summary=catalog?.papers.find(p=>p.id===id);const metadata=(async()=>{const r=await fetch(new URL(`hme/papers/${id}.json?v=local6`,base),{cache:'force-cache'});if(!r.ok)throw new Error('기출 자료를 찾지 못했습니다.');return r.json();})();const documents=summary?Promise.all([getLocalDocument(summary.paper),getLocalDocument(summary.solution)]):metadata.then(p=>Promise.all([getLocalDocument(p.paper),getLocalDocument(p.solution)]));const [paper,[problem,solution]]=await Promise.all([metadata,documents]);if(summary&&(summary.paper!==paper.paper||summary.solution!==paper.solution))throw new Error('기출 목록을 새로 열어 주세요.');paper.paperPages=problem.pages.length;paper.solutionPages=solution.pages.length;papers.set(id,paper);return paper;})().finally(()=>pendingPapers.delete(id)));
  return pendingPapers.get(id);
}
export function getCachedHmePaper(id){return papers.get(id);}
export function hmeSourceUrl(filename){if(!Object.hasOwn(sourceHashes,filename))throw new Error('등록되지 않은 공식 자료입니다.');return 'https://hme.chunjae.co.kr/webdata/HME/TestPaperData/'+encodeURIComponent(filename);}
export async function getHmeBytes(filename){
  if(!Object.hasOwn(bundledSources,filename))throw new Error('이 배포에는 원본 PDF가 포함되어 있지 않습니다.');
  if(!bytesCache.has(filename)){
    const promise=(async()=>{const response=await fetch(new URL(`hme/files/${sourceHashes[filename]}.pdf.gz`,studyAssetBase),{cache:'force-cache',signal:AbortSignal.timeout(45000)});if(!response.ok)throw new Error('저장된 원본을 불러오지 못했습니다.');return decodeHmeSource(await response.arrayBuffer(),sourceHashes[filename]);})();
    bytesCache.set(filename,promise);promise.catch(()=>bytesCache.delete(filename));if(bytesCache.size>4)bytesCache.delete(bytesCache.keys().next().value);
  }
  return bytesCache.get(filename);
}
export async function drawHmePage(canvas,filename,pageNumber,{clip=null,highlight=null,width=null,sourceHeight=null,zoom=1}={}){
  const doc=await getLocalDocument(filename),number=Math.min(Math.max(1,pageNumber),doc.pages.length),record=doc.pages[number-1];
  const raster=await getLocalRaster(filename,record),image=new Image();image.src=raster.data;await image.decode();
  const [left,bottom,right,top]=record.bounds,originalWidth=right-left,originalHeight=top-bottom;
  const parent=canvas.parentElement,style=parent?getComputedStyle(parent):null;
  const available=parent?parent.clientWidth-(parseFloat(style.paddingLeft)||0)-(parseFloat(style.paddingRight)||0):620;
  const target=(width||Math.max(280,available||620))*zoom;
  const offsetX=sourceHeight?left:0,offsetY=sourceHeight?sourceHeight-top:0;
  const convert=box=>[box[0]-offsetX,box[1]-offsetY,box[2]-offsetX,box[3]-offsetY];
  const region=clip?convert(clip):[0,0,originalWidth,originalHeight];
  const ratio=width?1:Math.min(devicePixelRatio||1,2),scale=target/(region[2]-region[0]);
  canvas.width=Math.ceil(target*ratio);canvas.height=Math.ceil((region[3]-region[1])*scale*ratio);
  canvas.style.width=target+'px';canvas.style.height=canvas.height/ratio+'px';
  const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(image,region[0]*image.width/originalWidth,region[1]*image.height/originalHeight,(region[2]-region[0])*image.width/originalWidth,(region[3]-region[1])*image.height/originalHeight,0,0,canvas.width,canvas.height);
  if(highlight){const box=convert(highlight);ctx.strokeStyle='#5c9561';ctx.lineWidth=2*ratio;ctx.strokeRect(box[0]*scale*ratio,box[1]*scale*ratio,(box[2]-box[0])*scale*ratio,(box[3]-box[1])*scale*ratio);}
  return {pages:doc.pages.length,page:number};
}
export async function hmeQuestionRaster(question){return getLocalRaster(question.paper,await getLocalQuestion(question));}
export async function hmeQuestionLayout(question){const record=await getLocalQuestion(question);return {shared:record.shared,ratio:record.width/record.height};}
