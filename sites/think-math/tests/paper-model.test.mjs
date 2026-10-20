import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gradePaper,restorePaperWork,paperRevision,isSameSubmission,paginate} from '../dist/paper-model.js';
const paper=JSON.parse(fs.readFileSync(new URL('../dist/hme/papers/hme-49-4.json',import.meta.url)));
test('a submitted paper separates correct, wrong and unanswered questions',()=>{
  const result=gradePaper(paper,{'hme-49-4-q1':'10','hme-49-4-q2':'71','hme-49-4-q6':'④'});
  assert.deepEqual([result.total,result.answered,result.correct,result.wrong,result.unanswered,result.score],[25,3,2,1,22,8]);
  assert.equal(result.rows[1].correct,false);assert.equal(result.rows[2].correct,null);assert.equal(result.rows[5].official,'④');
});
test('a full official answer sheet scores 100 and an unverified paper cannot be submitted',()=>{
  const answers=Object.fromEntries(paper.questions.map(q=>[q.id,q.answerDisplay]));assert.equal(gradePaper(paper,answers).score,100);
  assert.throws(()=>gradePaper({...paper,questions:[{...paper.questions[0],verified:false}]},answers));
});
test('saved drafts keep a submitted snapshot separate and invalidate changed source revisions',()=>{
  const answers={'hme-49-4-q1':'10'},submission={id:'submission-1',at:'2026-10-20T00:00:00Z',revision:paperRevision(paper),answers};
  const work=restorePaperWork(paper,{answers,submission});assert(isSameSubmission(paper,work));work.answers['hme-49-4-q1']='11';assert(!isSameSubmission(paper,work));assert.equal(work.submission.answers['hme-49-4-q1'],'10');
  assert.equal(restorePaperWork({...paper,solutionSha256:'new'},work).submission,null);
  assert.equal(restorePaperWork(paper,{answers:{other:'99'}}).answers.other,undefined);
  assert.equal(restorePaperWork(paper,{answers:null}).answers['hme-49-4-q1'],'');
});
test('numbered catalogue pages neither repeat nor omit exams and clamp invalid pages',()=>{
  const items=Array.from({length:46},(_,i)=>i);assert.equal(paginate(items).pages,6);assert.deepEqual(paginate(items,6).items,[40,41,42,43,44,45]);
  assert.equal(paginate(items,-10).page,1);assert.equal(paginate(items,999).page,6);assert.deepEqual(paginate([],2).items,[]);
  assert.deepEqual(Array.from({length:6},(_,i)=>paginate(items,i+1).items).flat(),items);
});
