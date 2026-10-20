import {exactAnswer} from './answer-checker.js';

export function paperRevision(paper){return `${paper.paperSha256}:${paper.solutionSha256}:${paper.questions.map(q=>`${q.id}=${q.answer}`).join('|')}`;}
export function answerSheet(paper,answers={}){const values=answers&&typeof answers==='object'?answers:{};return Object.fromEntries(paper.questions.map(q=>[q.id,String(values[q.id]??'').trim().slice(0,100)]));}
export function gradePaper(paper,answers={}){
  if(!paper.questions.length||paper.questions.some(q=>!q.verified))throw new Error('공식 정답 대조가 완료되지 않은 회차입니다.');
  const values=answerSheet(paper,answers);
  const rows=paper.questions.map(q=>({id:q.id,number:q.number,answer:values[q.id],official:q.answerDisplay||q.answer,correct:values[q.id]?exactAnswer(values[q.id],q.answer,q.answerType):null,solutionPage:q.solutionPage}));
  const correct=rows.filter(q=>q.correct===true).length,wrong=rows.filter(q=>q.correct===false).length;
  return {rows,total:rows.length,answered:correct+wrong,correct,wrong,unanswered:rows.length-correct-wrong,score:Math.round(correct/rows.length*100)};
}
export function restorePaperWork(paper,input={}){
  const answers=answerSheet(paper,input.answers),notes=Object.fromEntries(paper.questions.map(q=>[q.id,String(input.notes?.[q.id]??'').slice(0,1000)]));
  const submission=input.submission?.revision===paperRevision(paper)&&typeof input.submission.id==='string'?{id:input.submission.id,at:String(input.submission.at||''),revision:input.submission.revision,answers:answerSheet(paper,input.submission.answers)}:null;
  return {answers,notes,submission};
}
export function isSameSubmission(paper,work){return !!work.submission&&work.submission.revision===paperRevision(paper)&&JSON.stringify(answerSheet(paper,work.answers))===JSON.stringify(answerSheet(paper,work.submission.answers));}
export function paginate(items,page=1,size=8){const pages=Math.max(1,Math.ceil(items.length/size));const current=Math.max(1,Math.min(pages,Math.floor(Number(page)||1)));return {items:items.slice((current-1)*size,current*size),page:current,pages,total:items.length};}
