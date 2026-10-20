"""Download only math-paper pairs explicitly listed by the selected HME catalogue.

Run after the user has authenticated and authorized their HME materials.
No credentials or cookies are collected or stored by this script.
"""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
import hashlib, html, json, re, sys, time
from urllib.parse import quote, urlencode
from urllib.request import Request, urlopen

sys.stdout.reconfigure(encoding='utf-8')
ROOT=Path(__file__).resolve().parents[1]
CACHE=ROOT/'tmp'/'hme-source'
CACHE.mkdir(parents=True,exist_ok=True)
CATALOG='https://hme.chunjae.co.kr/hme/hme_data/hme_preque.asp'
BASE='https://hme.chunjae.co.kr/webdata/HME/TestPaperData/'
def request(url,data=None):
    body=urlencode(data).encode('ascii') if data else None
    with urlopen(Request(url,data=body,headers={'User-Agent':'ThinkMath personal study archive/1.0'}),timeout=45) as response:
        return response.read()

def page_text(raw):
    for encoding in ['euc-kr','cp949','utf-8']:
        try:return raw.decode(encoding)
        except UnicodeDecodeError:pass
    return raw.decode('cp949',errors='replace')

first_text=page_text(request(CATALOG))
options=re.findall(r'<option\s+value="(\d+)"[^>]*>(.*?)</option>',first_text,re.S)
editions=[];papers=[];failures=[]
for index,(edition_id,label) in enumerate(options):
    label=html.unescape(re.sub('<[^>]+>','',label)).strip()
    year=int(re.search(r'20\d{2}',label)[0]);semester='하반기' if '하반기' in label else '상반기'
    cached=CACHE/f'catalog-{edition_id}.html'
    try:
        if not cached.exists():
            cached.write_bytes(request(CATALOG,{'hmeid':edition_id}));time.sleep(.08)
        content=page_text(cached.read_bytes())
        match=re.search(r'<tbody\s+class="html_contents"[^>]*>(.*?)</tbody>',content,re.S)
        if not match:raise ValueError('math table missing')
        rows=re.findall(r'<tr[^>]*>(.*?)</tr>',match[1],re.S)
        for row in rows:
            cells=re.findall(r'<td[^>]*>(.*?)</td>',row,re.S)
            if not cells:continue
            grade_text=html.unescape(re.sub('<[^>]+>','',cells[0])).strip()
            grade_match=re.search(r'(초|중)\s*([1-6])',grade_text)
            if not grade_match:continue
            grade=int(grade_match[2])+(6 if grade_match[1]=='중' else 0)
            files=list(dict.fromkeys(re.findall(r"openHmeFile\('([^']+\.pdf)'\)",row,re.I)))
            if len(files)!=2:
                failures.append({'edition':edition_id,'grade':grade,'reason':'No exact paper/solution pair'});continue
            paper,solution=files
            if any('/' in f or '\\' in f or '..' in f for f in files):raise ValueError('unsafe filename')
            papers.append({'id':f'hme-{edition_id}-{grade}','editionId':edition_id,'year':year,'semester':semester,'grade':grade,'label':label,'paper':paper,'solution':solution,'catalogUrl':CATALOG})
        editions.append({'id':edition_id,'year':year,'semester':semester,'label':label})
    except Exception as error:failures.append({'edition':edition_id,'reason':str(error)})
    if (index+1)%10==0:print(f'Catalogue {index+1}/{len(options)}: {len(papers)} paper pairs',flush=True)

def fetch(filename):
    target=CACHE/filename
    if target.exists() and target.read_bytes()[:5]==b'%PDF-':return filename,target.stat().st_size
    url=BASE+quote(filename)
    for attempt in range(2):
        try:
            content=request(url)
            if not content[:1024].lstrip().startswith(b'%PDF-'):raise ValueError('Not a PDF')
            target.write_bytes(content)
            return filename,len(content)
        except Exception:
            if attempt:raise
            time.sleep(.8)

filenames=list(dict.fromkeys(f for p in papers for f in [p['paper'],p['solution']]))
downloaded={};total=0
with ThreadPoolExecutor(max_workers=3) as pool:
    tasks={pool.submit(fetch,f):f for f in filenames}
    for index,task in enumerate(as_completed(tasks)):
        filename=tasks[task]
        try:
            _,size=task.result();downloaded[filename]=size;total+=size
        except Exception as error:failures.append({'filename':filename,'reason':str(error)})
        if (index+1)%40==0:print(f'PDF {index+1}/{len(filenames)}, {total/1048576:.1f} MiB',flush=True)

available=[]
for p in papers:
    if p['paper'] in downloaded and p['solution'] in downloaded:
        p['paperSha256']=hashlib.sha256((CACHE/p['paper']).read_bytes()).hexdigest()
        p['solutionSha256']=hashlib.sha256((CACHE/p['solution']).read_bytes()).hexdigest()
        available.append(p)
result={'catalogUrl':CATALOG,'retrievedAt':'2026-10-20','editions':editions,'papers':available,'failures':failures,'bytes':total}
(CACHE/'source-manifest.json').write_text(json.dumps(result,ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'editions':len(editions),'pairs':len(available),'files':len(downloaded),'megabytes':round(total/1048576,1),'failures':len(failures)},ensure_ascii=False),flush=True)
