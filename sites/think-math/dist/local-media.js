import sourceHashes from './hme/source-map.js';
import assetOrigin from './asset-origin.js?v=local6';
export const studyAssetBase=new URL(assetOrigin||'./',import.meta.url);
const base=studyAssetBase;
const documents=new Map(),images=new Map();

export function validateLocalDocument(data,expected){
  const asset=value=>value&&/^[a-zA-Z0-9-]+\.webp$/.test(value.file)&&/^[a-f0-9]{64}$/.test(value.sha256)&&Number.isInteger(value.width)&&value.width>0&&value.width<10000&&Number.isInteger(value.height)&&value.height>0&&value.height<10000;
  if(data?.sourceSha256!==expected||!Array.isArray(data.pages)||!data.pages.length||!data.pages.every(p=>asset(p)&&Array.isArray(p.bounds)&&p.bounds.length===4&&Array.isArray(p.mediaBox)&&p.mediaBox.length===4)||!data.questions||!Object.values(data.questions).every(asset))throw new Error('저장된 원문 이미지의 출처를 확인하지 못했습니다.');
  return data;
}
export function getLocalDocument(filename){
  if(!Object.hasOwn(sourceHashes,filename))return Promise.reject(new Error('등록되지 않은 자료입니다.'));const hash=sourceHashes[filename];
  if(!documents.has(hash)){
    const promise=(async()=>{const response=await fetch(new URL(`hme/media/v6/${hash}/index.json`,base),{cache:'force-cache',signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error('저장된 문제 자료를 불러오지 못했습니다.');return validateLocalDocument(await response.json(),hash);})();
    documents.set(hash,promise);promise.catch(()=>{if(documents.get(hash)===promise)documents.delete(hash);});
  }
  return documents.get(hash);
}
export async function verifyMediaBytes(bytes,expected){
  const digest=await crypto.subtle.digest('SHA-256',bytes),hash=Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');
  if(hash!==expected)throw new Error('저장된 문제 이미지가 변경되어 학습을 중단했습니다.');
  return bytes;
}
export async function getLocalRaster(filename,record){
  if(!Object.hasOwn(sourceHashes,filename))throw new Error('등록되지 않은 자료입니다.');const hash=sourceHashes[filename];
  const key=hash+'/'+record.file;
  if(!images.has(key)){
    const promise=(async()=>{
      const response=await fetch(new URL(`hme/media/v6/${key}`,base),{cache:'force-cache',signal:AbortSignal.timeout(15000)});
      if(!response.ok)throw new Error('저장된 문제 이미지를 불러오지 못했습니다.');
      const bytes=await verifyMediaBytes(await response.arrayBuffer(),record.sha256);
      // Keep worksheet image URLs valid when the bounded response cache evicts them.
      const data=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(new Blob([bytes],{type:'image/webp'}));});
      return {...record,data};
    })();images.set(key,promise);promise.catch(()=>{if(images.get(key)===promise)images.delete(key);});
    if(images.size>100)images.delete(images.keys().next().value);
  }
  return images.get(key);
}
export async function getLocalQuestion(question){
  const doc=await getLocalDocument(question.paper),record=doc.questions[question.id];
  if(!record||record.sourcePage!==question.paperPage||JSON.stringify(record.clip)!==JSON.stringify(question.paperClip))throw new Error('문항 번호와 저장된 원문 이미지가 일치하지 않습니다.');
  return record;
}
