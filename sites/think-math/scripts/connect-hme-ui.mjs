// One-time, guarded edits to the existing UI. Fail before writing on any mismatch.
import fs from 'node:fs';
const filename='dist/app.js';let source=fs.readFileSync(filename,'utf8');
const edits=[
 ['function questionsPage(){const questions=filteredQuestions();','function practiceQuestionsPage(){const questions=filteredQuestions();'],
 ['function archivePage(){return','function uploadedArchivePage(){return'],
 ['function solvePage(id){const q=getQuestion(id);','function practiceSolvePage(id){const q=getQuestion(id);'],
 ["r.page==='exam'?'archive':r.page;","['exam','hme','hme-document'].includes(r.page)?'archive':r.page;"],
 ["case 'worksheet':content=worksheetPage();break;","case 'worksheet':content=worksheetPage();break;case 'hme':content=hmePaperPage(r.id);break;case 'hme-document':content=hmeDocumentPage(r.id);break;"],
 ["if(r.page==='exam')loadExam(r.id,renderSequence);","scheduleHmeViews(renderSequence);if(r.page==='exam')loadExam(r.id,renderSequence);"],
 ["q.origin==='created'?'창작 연습':'직접 등록'","q.origin==='hme'?'HME 공식 기출':q.origin==='created'?'창작 연습':'직접 등록'"],
 ['<p>${esc(q.text)}</p></div><div class="question-row-actions">','<p>${q.origin===\'hme\'?\'공식 원문 도형·수식 보존 · 정답표 대조 완료\':esc(q.text)}</p></div><div class="question-row-actions">'],
 ["function record(questionId,answer,correct,extra={}){state.attempts.push", "function record(questionId,answer,correct,extra={}){rememberOfficial(getQuestion(questionId));state.attempts.push"],
 ["case 'bookmark':state.bookmarks=","case 'bookmark':rememberOfficial(getQuestion(id));state.bookmarks="],
 ["case 'add-question':if(!state.selected.includes(id))", "case 'add-question':rememberOfficial(getQuestion(id));if(!state.selected.includes(id))"],
 ["case 'start':{const latest=", "case 'start':{if(currentCatalog()){startOfficial();break;}const latest="],
 ['if(!answer)return;const correct=isCorrect(answer,q.answer);',"if(!answer)return;if(q.origin==='hme'&&renderedHmeQuestion!==q.id)return;const correct=exactAnswer(answer,q.answer,q.answerType||'number');"],
 ['const result=await makeWorksheet(list,worksheet);',"const prepared=await Promise.all(list.map(async q=>q.origin==='hme'?{...q,image:await hmeQuestionRaster(q)}:q));const result=await makeWorksheet(prepared,worksheet);"],
 ['<p>${esc(q.text)}</p><div class="paper-space"','<p>${q.origin===\'hme\'?\'공식 원문의 도형과 수식을 PDF에 포함합니다.\':esc(q.text)}</p><div class="paper-space"']
];
for(const [from,to] of edits){if(!source.includes(from))throw new Error('Edit target missing: '+from.slice(0,100));source=source.replace(from,to);}
fs.writeFileSync(filename,source);
console.log('Connected official HME questions, source validation, grading, and worksheets.');
