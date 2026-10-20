from pathlib import Path
import json,sys
from pypdf import PdfReader
sys.stdout.reconfigure(encoding='utf-8')
root=Path(__file__).resolve().parents[1]
for index,path in enumerate((root/'dist/hme/papers').glob('*.json')):
    data=json.loads(path.read_text(encoding='utf-8'))
    if not data.get('questions'):continue
    paper=PdfReader(root/'tmp/hme-source'/data['paper'])
    solution=PdfReader(root/'tmp/hme-source'/data['solution'])
    key=solution.pages[data['keyPage']-1].mediabox
    for q in data['questions']:
        box=paper.pages[q['paperPage']-1].mediabox
        q['paperDimensions']=[float(box.width),float(box.height)]
        q['solutionDimensions']=[float(key.width),float(key.height)]
    path.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Added original MediaBox coordinates for precise CropBox alignment.')
