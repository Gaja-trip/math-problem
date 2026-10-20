import {GRADES,gradeLabel} from './data.js';
import {currentCatalog,getCachedHmePaper,getLocalDocument,drawHmePage,hmeQuestionRaster,hmeQuestionLayout} from './hme.js?v=local6';
import {gradePaper,restorePaperWork,paperRevision,isSameSubmission} from './paper-model.js?v=local6';

const e=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link=(href,label,cls='secondary')=>`<a class="btn ${cls}" href="#${href}">${label}</a>`;
const title=p=>`${p.year}년 ${p.semester} · ${gradeLabel(p.grade)}`;
export function createPaperStudy(config){
  let sequence=0,observer,saveTimer,activeId='',sourceReady=false,zoom=1;
  const rasters=new Map();
  const state=()=>config.state();
  function work(p){state().paperWork??={};return state().paperWork[p.id]??=restorePaperWork(p);}
  function persist(){clearTimeout(saveTimer);config.save();}
  function deferSave(){clearTimeout(saveTimer);saveTimer=setTimeout(()=>config.save(),300);}
  function filters(p){
    const papers=(currentCatalog()?.papers||[]).filter(x=>x.grade===p.grade&&x.onlineCount>0);
    const years=[...new Set(papers.map(x=>x.year))].sort((a,b)=>b-a);
    return `<div class="paper-filter-bar" aria-label="학년과 연도 선택"><label>학년<select data-paper-filter="grade" aria-label="풀이 학년">${GRADES.map((g,i)=>`<option value="${i+1}" ${p.grade===i+1?'selected':''}>${g}</option>`).join('')}</select></label><label>연도<select data-paper-filter="year" aria-label="풀이 연도">${years.map(y=>`<option value="${y}" ${y===p.year?'selected':''}>${y}년</option>`).join('')}</select></label><label>회차<select data-paper-filter="semester" aria-label="풀이 회차">${papers.filter(x=>x.year===p.year).map(x=>`<option value="${x.semester}" ${x.semester===p.semester?'selected':''}>${x.semester}</option>`).join('')}</select></label></div>`;
  }
  function navigation(p,answers){return `<nav class="paper-steps" aria-label="기출 학습 단계">${link('archive','1. 기출 자료실','ghost')}${link(`hme/${p.id}`,'2. 문제 풀기',answers?'secondary':'primary')}${link(`answers/${p.id}`,'3. 채점·해설집',answers?'primary':'secondary')}</nav>`;}
  function page(p,answers=false){
    const restored=restorePaperWork(p,state().paperWork?.[p.id]);state().paperWork??={};state().paperWork[p.id]=restored;
    const w=work(p);
    const head=`${navigation(p,answers)}<div class="page-intro"><div><div class="eyebrow">HME PAST PAPERS</div><h1>${e(title(p))}</h1><p>${answers?'제출한 답을 공식 답안과 비교하고, 아래 해설집을 차례로 확인해요.':'문제를 위에서 아래로 풀고, 마지막에 답안을 한 번에 제출하세요.'}</p></div>${link(`hme-document/${p.id}`,'원본 여러 쪽 보기')}</div>${filters(p)}`;
    if(answers)return head+resultPage(p,w);
    if(!p.questions.length)return head+`<div class="notice">자동 채점 문항이 없는 회차입니다. ${link(`hme-document/${p.id}`,'원문 확인하기')}</div>`;
    const answered=p.questions.filter(q=>w.answers[q.id]).length;
    return head+`<div class="paper-flow-note"><strong>${p.questions.length}문항을 순서대로 풀어요.</strong> 답은 자동 저장됩니다. 제출 전에는 정답과 해설이 표시되지 않아요.</div><div class="button-row paper-batch-tools"><button type="button" class="btn secondary small" data-action="hme-select-paper" data-id="${p.id}">이 회차 전체를 학습지에 담기</button>${link('worksheet','PDF 학습지 만들기','ghost small')}</div><form id="paper-answer-form" data-paper-id="${p.id}"><div class="paper-layout"><div class="paper-question-list">${p.questions.map(q=>`<article class="paper-question" id="paper-question-${q.number}" aria-labelledby="paper-label-${q.number}"><header><h2 id="paper-label-${q.number}">${q.number}번 문제</h2>${link(`solve/${q.id}`,'한 문제 집중 학습','ghost small')}</header><div class="paper-question-media" data-paper-raster="${q.id}" style="aspect-ratio:${(q.paperClip[2]-q.paperClip[0])/(q.paperClip[3]-q.paperClip[1])}"><div class="source-loading">공식 원문을 불러오는 중…</div></div><div class="paper-answer-input"><label for="paper-answer-${q.number}">${q.number}번 답</label><input id="paper-answer-${q.number}" data-paper-answer="${q.id}" value="${e(w.answers[q.id])}" maxlength="100" placeholder="숫자 또는 분수로 입력" autocomplete="off" inputmode="text"></div>${q.answerType==='choice'?`<div class="hme-choices" aria-label="${q.number}번 보기 선택">${[1,2,3,4,5].map(n=>`<button type="button" data-paper-choice="${q.id}" data-value="${n}" aria-label="${q.number}번 보기 ${n}" aria-pressed="${w.answers[q.id]===String(n)}" class="${w.answers[q.id]===String(n)?'active':''}">${'①②③④⑤'[n-1]}</button>`).join('')}</div>`:''}<details class="paper-notes"><summary>풀이 과정 메모</summary><textarea data-paper-note="${q.id}" aria-label="${q.number}번 풀이 메모" maxlength="1000" placeholder="계산 과정이나 떠오른 생각을 적어 보세요.">${e(w.notes[q.id])}</textarea></details></article>`).join('')}<div class="paper-submit-box"><h2>답안을 제출할까요?</h2><p>입력한 답을 한 번에 채점하고, 공식 해설집을 펼쳐요. 미응답 문항은 따로 표시합니다.</p><p data-paper-error role="alert"></p><button type="submit" class="btn primary" data-paper-submit disabled>답안 제출하고 해설 보기</button></div></div><aside class="paper-answer-nav"><h2>나의 답안</h2><p data-paper-progress aria-live="polite">${answered} / ${p.questions.length}문항 입력</p><div class="paper-jumps">${p.questions.map(q=>`<button type="button" data-paper-jump="${q.number}" data-question-id="${q.id}" class="${w.answers[q.id]?'filled':''}" aria-label="${q.number}번 문제로 이동">${q.number}</button>`).join('')}</div><button type="submit" class="btn primary" data-paper-submit disabled>입력한 답안 제출</button><p class="paper-source-status" data-paper-source-status role="status">원문 파일을 확인하고 있어요…</p><p class="paper-save-note" data-paper-save-note>이 기기에 자동 저장돼요.</p>${w.submission?link(`answers/${p.id}`,'지난 제출 결과 보기'):''}${link('archive','다른 기출 선택하기','ghost')}</aside></div></form>`;
  }
  function pdfPages(p,file,pages){return `<div class="multi-pdf-pages">${Array.from({length:pages},(_,i)=>`<section class="multi-pdf-page" id="official-page-${i+1}" aria-label="공식 원문 ${i+1}쪽"><div class="multi-page-label">공식 ${file===p.solution?'해설집':'문제지'} · ${i+1} / ${pages}쪽</div><div class="multi-page-scroll"><canvas width="600" height="850" style="width:100%" data-paper-pdf="${e(file)}" data-page="${i+1}" aria-label="공식 ${file===p.solution?'해설':'문제'} ${i+1}쪽"></canvas><div class="source-loading">공식 원문을 불러오는 중…</div></div></section>`).join('')}</div>`;}
  function pdfTools(p,file,pages){return `<div class="multi-pdf-tools"><span>해설·문제지의 모든 쪽을 아래로 이어서 볼 수 있어요.</span><div class="paper-page-jumps">${Array.from({length:pages},(_,i)=>`<button type="button" data-paper-page-jump="${i+1}" disabled>${i+1}쪽</button>`).join('')}</div><div class="paper-zoom"><button type="button" data-paper-zoom="out" aria-label="여러 쪽 원문 축소">−</button><span>${Math.round(zoom*100)}%</span><button type="button" data-paper-zoom="in" aria-label="여러 쪽 원문 확대">+</button><button type="button" class="btn secondary small" data-action="hme-download" data-file="${e(file)}">공식 PDF 내려받기</button></div></div>`;}
  function resultPage(p,w){
    if(!w.submission)return `<section class="panel paper-empty-result"><h2>아직 답안을 제출하지 않았어요.</h2><p>문제를 풀고 답안을 제출하면 채점 결과와 공식 해설집이 나타나요.</p>${link(`hme/${p.id}`,'문제 풀러 가기','primary')}</section>`;
    const result=gradePaper(p,w.submission.answers);
    return `<section class="paper-result-summary" aria-label="채점 결과"><div><small>환산 점수</small><strong>${result.score}<span>점</span></strong></div><div><small>정답</small><strong>${result.correct}<span>문항</span></strong></div><div><small>오답</small><strong>${result.wrong}<span>문항</span></strong></div><div><small>미응답</small><strong>${result.unanswered}<span>문항</span></strong></div></section><div class="paper-result-actions"><p>전체 ${result.total}문항 기준 · 입력한 답만 오답노트와 학습 기록에 반영됩니다.</p>${link(`hme/${p.id}`,'답안 수정하고 다시 풀기')}${link('review','오답노트 보기','ghost')}</div><div class="paper-result-table"><table><caption>문항별 채점 결과와 공식 정답</caption><thead><tr><th scope="col">번호</th><th scope="col">제출한 답</th><th scope="col">공식 정답</th><th scope="col">채점</th><th scope="col">해설집</th></tr></thead><tbody>${result.rows.map(row=>`<tr class="${row.correct===true?'is-correct':row.correct===false?'is-wrong':'is-blank'}"><th scope="row">${row.number}번</th><td>${e(row.answer||'미응답')}</td><td>${e(row.official)}</td><td>${row.correct===true?'정답':row.correct===false?'오답':'미응답'}</td><td><button type="button" class="text-button" data-paper-book>해설집 보기</button></td></tr>`).join('')}</tbody></table></div><section class="paper-solution-book" id="paper-solution-book"><div class="section-heading"><div><h2>공식 해설집</h2><p>문제 번호를 확인하며 나의 풀이와 비교해 보세요.</p></div></div>${pdfTools(p,p.solution,p.solutionPages)}${pdfPages(p,p.solution,p.solutionPages)}</section>`;
  }
  function documentPage(p,kind){
    const file=p[kind],pages=kind==='solution'?p.solutionPages:p.paperPages;
    return `${navigation(p,false)}<div class="page-intro"><div><h1>${e(title(p))}</h1><p>공식 원문의 모든 페이지를 위에서 아래로 이어서 확인해요.</p></div>${link(`hme/${p.id}`,'문제 풀기','primary')}</div><div class="filter-tabs"><button type="button" data-action="hme-doc-kind" data-kind="paper" class="${kind==='paper'?'active':''}">문제지 ${p.paperPages}쪽</button><button type="button" data-action="hme-doc-kind" data-kind="solution" class="${kind==='solution'?'active':''}">공식 풀이지 ${p.solutionPages}쪽</button></div>${pdfTools(p,file,pages)}${pdfPages(p,file,pages)}`;
  }
  function updateProgress(p){const w=work(p),answered=p.questions.filter(q=>w.answers[q.id].trim()).length;const label=document.querySelector('[data-paper-progress]');if(label)label.textContent=`${answered} / ${p.questions.length}문항 입력`;for(const b of document.querySelectorAll('[data-question-id]'))b.classList.toggle('filled',!!w.answers[b.dataset.questionId]?.trim());}
  function dispose(){sequence++;observer?.disconnect();observer=null;activeId='';sourceReady=false;clearTimeout(saveTimer);config.save();}
  async function mount(id){
    observer?.disconnect();const seq=++sequence;let assetFailed=false;activeId=id;sourceReady=false;
    const p=getCachedHmePaper(id)||currentCatalog()?.papers.find(x=>x.id===id);if(!p)return;
    const targets=[...document.querySelectorAll('[data-paper-raster],[data-paper-pdf]')];
    await Promise.all(targets.filter(t=>t.dataset.paperPdf).map(async target=>{try{const doc=await getLocalDocument(target.dataset.paperPdf),page=doc.pages[Number(target.dataset.page)-1];if(seq!==sequence||!target.isConnected)return;const css=getComputedStyle(target.parentElement),fit=Math.max(280,target.parentElement.clientWidth-(parseFloat(css.paddingLeft)||0)-(parseFloat(css.paddingRight)||0));target.width=page.width;target.height=page.height;target.style.width=fit*zoom+'px';}catch{}}));
    if(seq!==sequence)return;document.querySelectorAll('[data-paper-page-jump]').forEach(b=>b.disabled=false);
    const renderTarget=async target=>{
      if(seq!==sequence||!target.isConnected)return;
      try{if(target.dataset.paperRaster){const q=p.questions.find(x=>x.id===target.dataset.paperRaster);if(!rasters.has(q.id)){rasters.set(q.id,hmeQuestionRaster(q));if(rasters.size>40)rasters.delete(rasters.keys().next().value);}const raster=await rasters.get(q.id);if(seq!==sequence||!target.isConnected)return;target.innerHTML=`${raster.shared?`<p class="paper-shared-note">공통 지문·도형이 있는 원본 페이지입니다. ${q.number}번을 풀어 주세요.</p>`:''}<img src="${raster.data}" width="${raster.width}" height="${raster.height}" alt="공식 ${q.number}번 문제${raster.shared?'와 공통 지문·도형':''}">`;}
      else{await drawHmePage(target,target.dataset.paperPdf,Number(target.dataset.page),{zoom});if(seq===sequence&&target.isConnected)target.nextElementSibling?.remove();}}
      catch{if(seq!==sequence||!target.isConnected)return;const note=target.dataset.paperRaster?target:target.nextElementSibling;if(note){note.className='source-error';note.textContent='원문을 불러오지 못했어요. 다시 열어 확인해 주세요.';}rasters.delete(target.dataset.paperRaster);if(target.dataset.paperRaster){assetFailed=true;sourceReady=false;document.querySelectorAll('[data-paper-submit]').forEach(b=>b.disabled=true);const label=document.querySelector('[data-paper-source-status]');if(label)label.textContent='문제 이미지를 확인하지 못했어요. 다시 열어 주세요.';}}
    };
    observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){observer?.unobserve(entry.target);renderTarget(entry.target);}},{rootMargin:'500px 0px'});targets.forEach(t=>observer.observe(t));
    if(document.querySelector('#paper-answer-form')){
      try{await Promise.all([getLocalDocument(p.paper),getLocalDocument(p.solution)]);await Promise.all(p.questions.map(async q=>{const layout=await hmeQuestionLayout(q);if(seq!==sequence)return;const element=document.querySelector('[data-paper-raster="'+q.id+'"]');if(element)element.style.aspectRatio=String(layout.ratio);}));await hmeQuestionRaster(p.questions[0]);if(seq!==sequence)return;if(assetFailed)throw new Error('문제 이미지 확인 실패');sourceReady=true;document.querySelectorAll('[data-paper-submit]').forEach(b=>b.removeAttribute('disabled'));const label=document.querySelector('[data-paper-source-status]');if(label)label.textContent='저장된 공식 문제·정답 대조 완료';}
      catch{if(seq!==sequence)return;const label=document.querySelector('[data-paper-source-status]');if(label)label.textContent='공식 원본을 확인하지 못해 제출을 잠시 중단했어요. 다시 열어 주세요.';}
    }
  }
  document.addEventListener('input',event=>{
    const t=event.target,p=getCachedHmePaper(activeId);if(!p||(!t.dataset.paperAnswer&&!t.dataset.paperNote))return;
    const w=work(p);if(t.dataset.paperAnswer){w.answers[t.dataset.paperAnswer]=t.value.slice(0,100);updateProgress(p);document.querySelectorAll(`[data-paper-choice="${t.dataset.paperAnswer}"]`).forEach(b=>{const selected=b.dataset.value===t.value.trim();b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});}else w.notes[t.dataset.paperNote]=t.value.slice(0,1000);deferSave();
  });
  document.addEventListener('change',event=>{
    const t=event.target;if(!t.dataset.paperFilter)return;const p=getCachedHmePaper(activeId);if(!p)return;
    const wanted={grade:p.grade,year:p.year,semester:p.semester};wanted[t.dataset.paperFilter]=t.dataset.paperFilter==='semester'?t.value:Number(t.value);
    const candidates=(currentCatalog()?.papers||[]).filter(x=>x.grade===wanted.grade&&x.onlineCount>0);
    const next=candidates.find(x=>x.year===wanted.year&&x.semester===wanted.semester)||candidates.find(x=>x.year===wanted.year)||candidates[0];
    if(next){persist();config.grade(next.grade);config.go(`hme/${next.id}`);}
  });
  document.addEventListener('click',event=>{
    const b=event.target.closest('[data-paper-jump],[data-paper-page-jump],[data-paper-choice],[data-paper-zoom],[data-paper-book]');if(!b)return;
    if(b.hasAttribute('data-paper-book'))document.getElementById('paper-solution-book')?.scrollIntoView({behavior:'smooth',block:'start'});
    if(b.dataset.paperJump)document.getElementById(`paper-question-${b.dataset.paperJump}`)?.scrollIntoView({behavior:'smooth',block:'start'});
    if(b.dataset.paperPageJump)document.getElementById(`official-page-${b.dataset.paperPageJump}`)?.scrollIntoView({behavior:'smooth',block:'start'});
    if(b.dataset.paperZoom){zoom=Math.max(.5,Math.min(2,zoom+(b.dataset.paperZoom==='in'?.25:-.25)));persist();config.render();}
    if(b.dataset.paperChoice){const input=document.querySelector(`[data-paper-answer="${b.dataset.paperChoice}"]`);if(input){input.value=b.dataset.value;input.dispatchEvent(new Event('input',{bubbles:true}));}}
  });
  document.addEventListener('submit',event=>{
    if(event.target.id!=='paper-answer-form')return;event.preventDefault();const p=getCachedHmePaper(event.target.dataset.paperId);if(!p||!sourceReady)return;
    const w=work(p),result=gradePaper(p,w.answers);if(!result.answered){document.querySelector('[data-paper-error]').textContent='답을 한 문제 이상 입력한 뒤 제출해 주세요.';document.querySelector('[data-paper-answer]')?.focus();return;}
    if(!isSameSubmission(p,w)){w.submission={id:crypto.randomUUID(),at:new Date().toISOString(),revision:paperRevision(p),answers:{...w.answers}};config.graded(p,result,w.submission);}
    persist();config.go(`answers/${p.id}`);
  });
  window.addEventListener('pagehide',persist);
  return {page,documentPage,mount,dispose};
}
