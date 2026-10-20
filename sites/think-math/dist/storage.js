const KEY = 'think-math-v1';
export function defaults() { return {grade:4,name:'도전자',attempts:[],bookmarks:[],selected:[],custom:[],exams:[],officialCache:[],paperWork:{},checkedLessons:[],dailyGoal:5}; }
export function readState(storage = globalThis.localStorage) {
  try {
    const saved = JSON.parse(storage.getItem(KEY));
    if (!saved || typeof saved !== 'object') return defaults();
    const base=defaults();
    if(saved.paperWork&&typeof saved.paperWork==='object'&&!Array.isArray(saved.paperWork))base.paperWork=Object.fromEntries(Object.entries(saved.paperWork).filter(([id,v])=>/^hme-\d+-[1-9]$/.test(id)&&v&&typeof v==='object').slice(-30));
    for(const key of ['attempts','bookmarks','selected','custom','exams','officialCache','checkedLessons']) if(Array.isArray(saved[key]))base[key]=saved[key];
    if(Number.isInteger(saved.grade) && saved.grade>=1 && saved.grade<=9)base.grade=saved.grade;
    if(typeof saved.name==='string')base.name=saved.name.slice(0,20);
    if(Number.isInteger(saved.dailyGoal)&&saved.dailyGoal>=1&&saved.dailyGoal<=30)base.dailyGoal=saved.dailyGoal;
    return base;
  } catch { return defaults(); }
}
export function writeState(state, storage = globalThis.localStorage) { storage.setItem(KEY,JSON.stringify(state)); }
export function localDay(date=new Date()) {return new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
export function stats(attempts) {
  const graded = attempts.filter(a=>typeof a.correct==='boolean');
  return {solved:new Set(graded.map(a=>a.questionId)).size,accuracy:graded.length?Math.round(graded.filter(a=>a.correct).length/graded.length*100):null,days:new Set(attempts.map(a=>a.day)).size,today:new Set(graded.filter(a=>a.day===localDay()).map(a=>a.questionId)).size};
}
export function latestAttempts(attempts) { const map=new Map();attempts.forEach(a=>map.set(a.questionId,a));return map; }
function openDb() {
  return new Promise((resolve,reject)=>{
    const request=indexedDB.open('think-math-files',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('files');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('이 브라우저에서 파일 저장소를 열지 못했습니다. 일반 브라우저 창에서 다시 시도해 주세요.'));
  });
}
export async function putFile(id,file) {
  const db=await openDb();
  try { await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);}); } finally {db.close();}
}
export async function getFile(id) {
  const db=await openDb();
  try {return await new Promise((resolve,reject)=>{const req=db.transaction('files').objectStore('files').get(id);req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});} finally {db.close();}
}
export async function deleteFile(id) {
  const db=await openDb();
  try {await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');tx.objectStore('files').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);});} finally {db.close();}
}
