import test from 'node:test';
import assert from 'node:assert/strict';
import {QUESTIONS,LESSONS,isCorrect,normalizeAnswer} from '../dist/data.js';
import {defaults,readState,writeState,stats,latestAttempts,localDay} from '../dist/storage.js';
import {jpegPdf,wrapText,safeFilename} from '../dist/pdf.js';

test('equivalent mathematical answers and Korean units are accepted without evaluating code',()=>{
  for(const [a,b] of [['2/4','1/2'],['0.5','1/2'],['6,800원','6800'],['２８ cm²','28'],['−2','-2'],['△','△']])assert.equal(isCorrect(a,b),true,`${a} = ${b}`);
  for(const a of ['','1/0','NaN','alert(1)','0.5001'])assert.equal(isCorrect(a,'1/2'),false);
  assert.equal(isCorrect('12','21'),false);assert.equal(normalizeAnswer(' 10 개 '),'10');
});
test('every exercise has a unique id, grade, valid concept, answer, hint and solution',()=>{
  assert.equal(new Set(QUESTIONS.map(q=>q.id)).size,QUESTIONS.length);
  for(let grade=1;grade<=9;grade++)assert.equal(QUESTIONS.filter(q=>q.grade===grade).length,4);
  for(const q of QUESTIONS){assert(LESSONS.some(l=>l.id===q.lesson));assert(q.hint);assert(q.steps.length>=3);assert(isCorrect(q.answer,q.answer));assert.equal(q.origin,'created');}
});
test('selected contest-style exercises agree with independently computed answers',()=>{
  const answer=id=>QUESTIONS.find(q=>q.id===id).answer;
  assert.equal(Number(answer('g3-3')),2*(4*2+4));
  assert.equal(Number(answer('g4-3')),26+11);
  assert.equal(Number(answer('g6-1')),40*3/(3+5));
  assert.equal(Number(answer('g6-2')),8000*(1-0.15));
  assert.equal(Number(answer('g5-4')),4*3);
  assert.equal(Number(answer('g9-2')),Math.hypot(6,8));
});
test('storage handles corrupted state and keeps valid preferences',()=>{
  const data=new Map();const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
  assert.deepEqual(readState(storage),defaults());
  const state=defaults();state.grade=8;state.name='민서';state.selected=['g8-1'];writeState(state,storage);
  assert.deepEqual(readState(storage),state);
  storage.setItem('think-math-v1','{bad json');assert.deepEqual(readState(storage),defaults());
  storage.setItem('think-math-v1',JSON.stringify({grade:200,attempts:'bad',name:'가'.repeat(30)}));const restored=readState(storage);assert.equal(restored.grade,4);assert.deepEqual(restored.attempts,[]);assert.equal(restored.name.length,20);
});
test('retrying an incorrect exercise resolves review and does not inflate unique solved count',()=>{
  const attempts=[{questionId:'a',correct:false,day:localDay()},{questionId:'a',correct:true,day:localDay()},{questionId:'b',correct:true,day:'2000-01-01'}];
  assert.equal(latestAttempts(attempts).get('a').correct,true);assert.deepEqual(stats(attempts),{solved:2,accuracy:67,days:2,today:1});
});
test('the school-day boundary uses Korea time',()=>{
  assert.equal(localDay(new Date('2026-10-19T15:00:00Z')),'2026-10-20');
});
test('PDF document has valid xref offsets and page resources',async()=>{
  const images=[{data:'data:image/jpeg;base64,/9j/2Q==',width:1240,height:1754},{data:'data:image/jpeg;base64,/9j/2Q==',width:1240,height:1754}];
  const blob=jpegPdf(images);assert.equal(blob.type,'application/pdf');const bytes=new Uint8Array(await blob.arrayBuffer());const text=new TextDecoder('latin1').decode(bytes);assert(text.startsWith('%PDF-1.4'));assert(text.includes('/Count 2'));assert(text.includes('/MediaBox [0 0 595.28 841.89]'));
  const section=text.slice(text.indexOf('xref\n')).split('\n');const entries=Number(section[1].split(' ')[1]);
  for(let i=1;i<entries;i++){const offset=Number(section[i+2].slice(0,10));const at=new TextDecoder().decode(bytes.slice(offset,offset+16));assert(at.startsWith(`${i} 0 obj`));}
});
test('canvas wrapping handles Korean characters and explicit lines',()=>{
  const ctx={measureText:s=>({width:s.length*10})};assert.deepEqual(wrapText(ctx,'가나다라\n마바',20),['가나','다라','마바']);assert.equal(safeFilename('수학:문제/집?'),'수학문제집');
});
