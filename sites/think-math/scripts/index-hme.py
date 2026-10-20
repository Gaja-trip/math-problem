"""Index original question locations; enable grading only on matching official keys.

Answers are extracted independently by pypdf and pdfplumber. This does not
invent missing answers, OCR diagrams, or replace official mathematical notation.
"""
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed
from collections import Counter
import hashlib,json,re,sys,unicodedata
import pdfplumber
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'tmp'/'hme-source'
DEST=ROOT/'dist'/'hme'
TOKEN=r'([①②③④⑤⑥⑦⑧⑨⑩]|[+−-]?\d+(?:\.\d+)?)'
KEY_PATTERN=re.compile(r'\s*'.join(rf'(?<!\d){n}\.\s*{TOKEN}' for n in range(1,26)))

def clean(text):
    return re.sub(r'[\x00-\x1f\x7f]',' ',text or '')

def extract_key(text):
    text=clean(text)
    match=KEY_PATTERN.search(text)
    return list(match.groups()) if match else None

def norm(value):return unicodedata.normalize('NFKC',value).replace('−','-')

def number_markers(page):
    result=[]
    for word in page.extract_words(x_tolerance=1.5,y_tolerance=3):
        match=re.fullmatch(r'(\d{1,2})\.',clean(word['text']).strip())
        if match and 1<=int(match[1])<=25:
            result.append({'n':int(match[1]),'x':word['x0'],'y':word['top'],'right':word['x1'],'bottom':word['bottom'],'height':word['bottom']-word['top']})
    return result

def answer_box(page):
    markers=number_markers(page)
    for first in [m for m in markers if m['n']==1]:
        second=next((m for m in markers if m['n']==2 and m['x']>first['right'] and abs(m['y']-first['y'])<5),None)
        if not second:continue
        third=next((m for m in markers if m['n']==3 and m['x']>second['right'] and abs(m['y']-first['y'])<5),None)
        if not third:continue
        spacing=second['x']-first['x']
        if not 25<spacing<page.width*.3:continue
        x0=max(0,first['x']-12);x1=min(page.width,third['x']+spacing-5)
        rows=[]
        for n in range(1,26):
            expected_x=first['x']+((n-1)%3)*spacing
            expected_y=first['y']+((n-1)//3)*(next((m['y']-first['y'] for m in markers if m['n']==4 and abs(m['x']-first['x'])<10 and m['y']>first['y']),26))
            candidates=[m for m in markers if m['n']==n and abs(m['x']-expected_x)<12 and abs(m['y']-expected_y)<9]
            if not candidates:break
            rows.append(min(candidates,key=lambda m:abs(m['y']-expected_y)))
        if len(rows)!=25:continue
        box=[x0,max(0,first['y']-10),x1,min(page.height,max(m['bottom'] for m in rows)+10)]
        key=[]
        for marker in rows:
            col=(marker['n']-1)%3
            right=first['x']+(col+1)*spacing-7
            cell=page.crop([marker['right']+1,max(0,marker['y']-4),min(page.width,right),min(page.height,marker['bottom']+5)])
            value=re.sub(r'\s+','',clean(cell.extract_text(x_tolerance=1,y_tolerance=5)))
            if not re.fullmatch(TOKEN,value):break
            key.append(value)
        if len(key)==25:return box,key
    return None,None

def primary_locations(document,exclude=None):
    all_markers=[]
    for p,page in enumerate(document.pages):
        for marker in number_markers(page):
            if exclude and p==exclude[0]:
                b=exclude[1]
                if b[0]<=marker['x']<=b[2] and b[1]<=marker['y']<=b[3]:continue
            if marker['height']<12 or marker['y']<page.height*.055 or marker['y']>page.height*.9:continue
            all_markers.append({**marker,'page':p})
    # Question numbers form repeated column margins. Body sublists are excluded.
    clusters=[]
    for marker in sorted(all_markers,key=lambda m:m['x']):
        cluster=next((c for c in clusters if abs(c['x']-marker['x'])<14),None)
        if cluster is None:clusters.append({'x':marker['x'],'items':[marker]})
        else:cluster['items'].append(marker)
    clusters.sort(key=lambda c:len(set(m['n'] for m in c['items'])),reverse=True)
    selected=clusters[:2]
    if not selected:return {},[]
    selected.sort(key=lambda c:c['x'])
    locations={};ambiguous=[]
    for ci,cluster in enumerate(selected):
        for marker in cluster['items']:
            n=marker['n']
            if n in locations:ambiguous.append(n)
            locations[n]={**marker,'column':ci,'margin':cluster['x']}
    for n in ambiguous:locations.pop(n,None)
    return locations,selected

def classify(text,grade):
    for words,lesson in [(['분수','소수','분모','분자'],'fractions'),(['각도','도형','삼각형','사각형','원주','부피','넓이','직선','선분'],'geometry'),(['비율','비례','백분율','할인'],'ratio'),(['경우','가지','확률'],'counting'),(['그래프','함수'],'functions'),(['방정식','다항식','계수','일차식'],'algebra'),(['규칙','반복'],'patterns')]:
        if any(w in text for w in words):return lesson
    return 'numbers' if grade<=6 else 'algebra'

def index_paper(paper):
    ppath=CACHE/paper['paper'];spath=CACHE/paper['solution']
    reader=PdfReader(spath)
    key_a=None
    for page in reader.pages[:2]:
        key_a=extract_key(page.extract_text())
        if key_a:break
    result={**paper,'count':25,'status':'needs-review','questions':[],'reason':'공식 정답표의 두 추출 결과가 아직 일치하지 않습니다.'}
    if not key_a:return result
    with pdfplumber.open(spath) as solution:
        key_b=box=None;key_page=0
        for i,page in enumerate(solution.pages[:2]):
            box,key_b=answer_box(page)
            if key_b:key_page=i;break
        if not key_b or list(map(norm,key_a))!=list(map(norm,key_b)):return result
        solution_locations,_=primary_locations(solution,(key_page,box))
        result.update({'status':'key-checked','keyPage':key_page+1,'keyClip':[round(x,2) for x in box],'key':key_a,'solutionPages':len(solution.pages),'verification':{'method':'pypdf-pdfplumber-exact-25','sourceSha256':paper['solutionSha256'],'date':'2026-10-20'}})
        with pdfplumber.open(ppath) as document:
            locations,columns=primary_locations(document)
            result['paperPages']=len(document.pages)
            if len(locations)!=25:
                result['reason']=f'공식 정답표 대조 완료. 문항 위치 {len(locations)}/25개 확인.'
            else:result['reason']='공식 정답표의 1~25번을 두 PDF 추출기로 대조했습니다.'
            for n in range(1,26):
                location=locations.get(n)
                if not location:continue
                page=document.pages[location['page']];ci=location['column'];margin=location['margin']
                nexts=[m for m in locations.values() if m['page']==location['page'] and m['column']==ci and m['y']>location['y']+2]
                y1=min((m['y']-9 for m in nexts),default=page.height*.883)
                x0=max(0,margin-8)
                x1=(columns[1]['x']-16) if ci==0 and len(columns)>1 else page.width-22
                if x1<=x0 or y1<=location['y']+15:continue
                clip=[x0,max(0,location['y']-7),x1,y1]
                raw=clean(page.crop(clip).extract_text(x_tolerance=2,y_tolerance=3))
                # Shared diagrams are rendered from the full source page when a
                # group introduction precedes these items; never discard them.
                solution_location=solution_locations.get(n)
                answer=key_a[n-1]
                question={'id':f"{paper['id']}-q{n}",'origin':'hme','examId':paper['id'],'number':n,'grade':paper['grade'],'year':paper['year'],'semester':paper['semester'],'title':f"{paper['year']} {paper['semester']} {n}번",'text':re.sub(r'\s+',' ',raw)[:1000],'answer':norm(answer),'answerDisplay':answer,'answerType':'choice' if answer in '①②③④⑤⑥⑦⑧⑨⑩' else 'number','difficulty':1 if n<=10 else 2 if n<=20 else 3,'lesson':classify(raw,paper['grade']),'paper':paper['paper'],'solution':paper['solution'],'paperPage':location['page']+1,'paperClip':[round(x,2) for x in clip],'solutionPage':(solution_location['page']+1) if solution_location else key_page+1,'keyPage':key_page+1,'keyClip':[round(x,2) for x in box],'verified':True,'steps':['공식 풀이지의 정답표와 대조한 답입니다. 앱에서 공식 풀이 원문을 함께 확인하세요.'],'hint':'원문에 있는 조건과 도형을 확인하고, 구해야 할 값을 먼저 정리해 보세요.','unit':''}
                question['paperDimensions']=[page.width,page.height]
                question['solutionDimensions']=[solution.pages[key_page].width,solution.pages[key_page].height]
                result['questions'].append(question)
            if len(result['questions'])==25:result['status']='ready'
    return result

def main():
    sys.stdout.reconfigure(encoding='utf-8')
    manifest=json.loads((CACHE/'source-manifest.json').read_text(encoding='utf-8'))
    DEST.mkdir(parents=True,exist_ok=True);(DEST/'papers').mkdir(exist_ok=True)
    summaries=[];failures=[];questions=0
    papers=manifest['papers']
    if '--retry' in sys.argv:
        remaining=[]
        for paper in papers:
            existing=DEST/'papers'/f"{paper['id']}.json"
            data=json.loads(existing.read_text(encoding='utf-8')) if existing.exists() else None
            if data and data.get('status')=='ready':
                summaries.append({k:v for k,v in data.items() if k not in ['questions','key']})
                summaries[-1]['onlineCount']=len(data['questions']);questions+=len(data['questions'])
            else:remaining.append(paper)
        papers=remaining
    with ProcessPoolExecutor(max_workers=4) as pool:
        tasks={pool.submit(index_paper,p):p for p in papers}
        for i,task in enumerate(as_completed(tasks)):
            paper=tasks[task]
            try:
                result=task.result()
                (DEST/'papers'/f"{paper['id']}.json").write_text(json.dumps(result,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
                summaries.append({k:v for k,v in result.items() if k not in ['questions','key']})
                summaries[-1]['onlineCount']=len(result['questions']);questions+=len(result['questions'])
            except Exception as error:failures.append({'id':paper['id'],'error':str(error)})
            if (i+1)%20==0:print(f"Indexed {i+1}/{len(tasks)} papers: {questions} questions",flush=True)
    summaries.sort(key=lambda p:(-p['year'],0 if p['semester']=='하반기' else 1,p['grade']))
    catalog={'sourceUrl':manifest['catalogUrl'],'retrievedAt':manifest['retrievedAt'],'editions':manifest['editions'],'papers':summaries,'questionCount':questions,'readyCount':sum(p['status']=='ready' for p in summaries),'checkedCount':sum(p['status']!='needs-review' for p in summaries),'failures':failures}
    (DEST/'catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    sources={}
    for p in manifest['papers']:
        sources[p['paper']]=p['paperSha256'];sources[p['solution']]=p['solutionSha256']
    (DEST/'sources.json').write_text(json.dumps(sources,separators=(',',':')),encoding='utf-8')
    print(json.dumps({'papers':len(summaries),'ready':catalog['readyCount'],'keysChecked':catalog['checkedCount'],'questions':questions,'errors':len(failures)},ensure_ascii=False),flush=True)

if __name__=='__main__':main()
