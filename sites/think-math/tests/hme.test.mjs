import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {exactAnswer} from '../dist/answer-checker.js';
import {serveHmeSource} from '../lib/hme-source.mjs';
import {validateHmePdf,decodeHmeSource} from '../dist/source-integrity.js';
const catalog=JSON.parse(fs.readFileSync(new URL('../dist/hme/catalog.json',import.meta.url),'utf8'));
const sources=JSON.parse(fs.readFileSync(new URL('../dist/hme/sources.json',import.meta.url),'utf8'));

test('strict official grading accepts equivalent fractions, Unicode choices and valid units',()=>{
  assert(exactAnswer('2/4','0.5'));assert(exactAnswer('２８ cm²','28'));assert(exactAnswer('④','4','choice'));assert(exactAnswer('4번','4','choice'));assert(exactAnswer('6,800원','6800'));
  assert(!exactAnswer('1,2','12'));assert(!exactAnswer('0.00000000001','0'));assert(!exactAnswer('1/0','1'));assert(!exactAnswer('4324','4','choice'));assert(!exactAnswer('1e2','100'));
});
test('all enabled HME questions have unique ids and matching official answer keys',()=>{
  const ids=new Set();let count=0;
  assert.equal(catalog.papers.length,407);
  for(const summary of catalog.papers){
    const paper=JSON.parse(fs.readFileSync(new URL(`../dist/hme/papers/${summary.id}.json`,import.meta.url),'utf8'));
    assert.equal(paper.paperSha256,sources[paper.paper]);assert.equal(paper.solutionSha256,sources[paper.solution]);
    if(paper.status==='needs-review'){assert.equal(paper.questions.length,0);continue;}
    assert.equal(paper.key.length,25);
    for(const q of paper.questions){
      assert(!ids.has(q.id));ids.add(q.id);assert(q.verified);assert.equal(q.examId,paper.id);assert.equal(q.grade,paper.grade);assert.equal(q.answerDisplay,paper.key[q.number-1]);assert(exactAnswer(q.answerDisplay,q.answer,q.answerType));
      assert(q.paperClip[2]>q.paperClip[0]);assert(q.paperClip[3]>q.paperClip[1]);assert(q.paperPage>=1&&q.paperPage<=paper.paperPages);assert(q.solutionPage>=1&&q.solutionPage<=paper.solutionPages);count++;
    }
    if(paper.status==='ready')assert.equal(paper.questions.length,25);
    const sourceOrder=[...paper.questions].sort((a,b)=>a.paperPage-b.paperPage||Number(a.paperClip[0]>250)-Number(b.paperClip[0]>250)||a.paperClip[1]-b.paperClip[1]);
    assert.deepEqual(sourceOrder.map(q=>q.number),paper.questions.map(q=>q.number));
  }
  assert.equal(count,catalog.questionCount);
});
test('2026 first-semester grade 4 official answers agree with independent calculations',()=>{
  const p=JSON.parse(fs.readFileSync(new URL('../dist/hme/papers/hme-49-4.json',import.meta.url),'utf8'));
  const answer=n=>Number(p.questions.find(q=>q.number===n).answer);
  assert.equal(answer(1),10000/1000);assert.equal(answer(4),350/50);assert.equal(answer(5),70+65);assert.equal(answer(12),432/24);
  assert.equal(answer(15),Array.from({length:10},(_,x)=>x).filter(x=>83540000<83000000+x*100000+20000).length);
  assert.equal(answer(18),Math.floor((10000*137+1000*384)/50000));
  assert.equal(answer(21),Math.floor((35000-27500)/(900-500))+1);
  const sum=(a,b,d)=>{let value=0;for(let x=a;x<=b;x++)value+=x%d;return value;};assert.equal(answer(24),sum(730,900,15)-sum(150,225,24));
  let cases=0;const digits=[3,4,5,6,7,8,9];
  for(const a of digits)for(const b of digits)for(const c of digits)for(const d of digits)for(const e of digits){if(new Set([a,b,c,d,e]).size===5&&(222+10*(a+c+d)+2*b+e)%23===0)cases++;}
  assert.equal(answer(25),cases);
});
test('the PDF service rejects unknown sources and the client rejects changed files',async()=>{
  let called=false;const fetcher=async()=>{called=true;return new Response('%PDF-1.7\nchanged',{headers:{'content-type':'application/pdf'}});};
  const unknown=await serveHmeSource(new Request('https://test/api/hme/no.pdf'),'no.pdf',sources,fetcher);assert.equal(unknown.status,404);assert.equal(called,false);
  const file=Object.keys(sources)[0];const source=await serveHmeSource(new Request('https://test/api/hme/'+file),file,sources);assert.equal(source.status,307);assert.equal(new URL(source.headers.get('location')).origin,'https://hme.chunjae.co.kr');
  await assert.rejects(()=>validateHmePdf(new TextEncoder().encode('%PDF-1.7 changed'),sources[file]),/일치하지/);
  const traversal=await serveHmeSource(new Request('https://test/api/hme/../../x.pdf'),'../../x.pdf',sources,fetcher);assert.equal(traversal.status,404);
});
test('every downloaded official source has its exact verified digest',async()=>{
  const hashes=new Set(Object.values(sources));
  for(const hash of hashes){const bytes=fs.readFileSync(new URL(`../assets/hme/files/${hash}.pdf`,import.meta.url));await validateHmePdf(bytes,hash);}
  const korean=Object.keys(sources).find(f=>/[가-힣]/.test(f));assert(korean);assert.equal((await serveHmeSource(new Request('https://test/api/hme/'+encodeURIComponent(korean)),korean,sources)).status,307);
});
test('all online questions have bundled problem and solution files',async()=>{
  const {default:bundled}=await import('../web-dist/learning/hme/bundled-sources.js');
  for(const paper of catalog.papers)if(paper.onlineCount>0){assert.equal(bundled[paper.paper],paper.paperSha256);assert.equal(bundled[paper.solution],paper.solutionSha256);}
  assert.equal(Object.keys(bundled).length,814);
  for(const [filename,hash] of Object.entries(sources))assert.equal(bundled[filename],hash);
});
test('every compressed online PDF restores the exact official original',async()=>{
  const {default:bundled}=await import('../web-dist/learning/hme/bundled-sources.js');
  for(const hash of new Set(Object.values(bundled))){const encoded=fs.readFileSync(new URL(`../web-dist/learning/hme/files/${hash}.pdf.gz`,import.meta.url));await decodeHmeSource(encoded,hash);}
});
