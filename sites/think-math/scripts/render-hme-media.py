"""Render the verified local HME archive once; never fetch from HME at runtime.

Requires pypdfium2, pypdf and Pillow. Generated, content-addressed assets are
checked in so Vercel builds require only Node, without a PDF renderer.
"""
from pathlib import Path
from concurrent.futures import ProcessPoolExecutor, as_completed
import argparse, hashlib, json, re, sys
import pypdfium2 as pdfium
from pypdf import PdfReader
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
VERSION = 'local6-webp-1100-85-v1'
RANGES = re.compile(r'\[\s*(\d{1,2})\s*[~∼～]\s*(\d{1,2})\s*\]')

def write_json(path, data):
    path.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

def render_document(job):
    filename, digest, questions = job
    directory = ROOT / 'assets/hme/media' / digest
    manifest = directory / 'index.json'
    if manifest.exists():
        saved = json.loads(manifest.read_text(encoding='utf-8'))
        if saved.get('version') == VERSION and set(saved.get('questions', {})) == {q['id'] for q in questions}:
            records = saved['pages'] + list(saved['questions'].values())
            if all((directory / item['file']).exists() for item in records):
                return len(saved['pages']), len(questions), sum((directory / r['file']).stat().st_size for r in records)
    raw = (ROOT / 'assets/hme/files' / (digest + '.pdf')).read_bytes()
    if hashlib.sha256(raw).hexdigest() != digest:
        raise ValueError('Changed official PDF: ' + filename)
    directory.mkdir(parents=True, exist_ok=True)
    document = pdfium.PdfDocument(raw)
    reader = PdfReader(ROOT / 'assets/hme/files' / (digest + '.pdf')) if questions else None
    result = {'version': VERSION, 'sourceSha256': digest, 'pages': [], 'questions': {}}
    total = 0
    def save_image(image, name, extra=None):
        nonlocal total
        target = directory / name
        image.convert('RGB').save(target, 'WEBP', quality=85, method=4)
        data = target.read_bytes(); total += len(data)
        return {'file': name, 'width': image.width, 'height': image.height, 'sha256': hashlib.sha256(data).hexdigest(), **(extra or {})}
    for number in range(1, len(document) + 1):
        page = document[number - 1]
        related = [q for q in questions if q['paperPage'] == number]
        scale = (2200 if related else 1100) / page.get_width()
        bitmap = page.render(scale=scale)
        image = bitmap.to_pil().convert('RGB')
        full = image.copy()
        full.thumbnail((1100, 3000), Image.Resampling.LANCZOS)
        bounds = list(page.get_bbox())
        media = list(page.get_mediabox())
        result['pages'].append(save_image(full, f'p{number}.webp', {'bounds': bounds, 'mediaBox': media}))
        text = reader.pages[number - 1].extract_text() or '' if related else ''
        ranges = [(int(a), int(b)) for a, b in RANGES.findall(text)]
        for q in related:
            shared = any(a <= q['number'] <= b for a, b in ranges)
            if shared:
                clipped = image.copy()
            else:
                x0, y0, x1, y1 = q['paperClip']
                offset_x, offset_y = bounds[0], q['paperDimensions'][1] - bounds[3]
                box = (max(0, round((x0-offset_x)*scale)), max(0, round((y0-offset_y)*scale)), min(image.width, round((x1-offset_x)*scale)), min(image.height, round((y1-offset_y)*scale)))
                if box[2] <= box[0] or box[3] <= box[1]:
                    raise ValueError('Invalid question bounds: ' + q['id'])
                clipped = image.crop(box)
            clipped.thumbnail((1100, 3000), Image.Resampling.LANCZOS)
            result['questions'][q['id']] = save_image(clipped, q['id'] + '.webp', {'shared': shared, 'sourcePage': number, 'clip': q['paperClip']})
        bitmap.close(); page.close()
    document.close()
    write_json(manifest, result)
    return len(result['pages']), len(questions), total

if __name__ == '__main__':
    sys.stdout.reconfigure(encoding='utf-8')
    parser = argparse.ArgumentParser(); parser.add_argument('--limit', type=int); parser.add_argument('--workers', type=int, default=3)
    args = parser.parse_args()
    sources = json.loads((ROOT / 'dist/hme/sources.json').read_text(encoding='utf-8'))
    papers = [json.loads(p.read_text(encoding='utf-8')) for p in (ROOT / 'dist/hme/papers').glob('*.json')]
    questions = {p['paper']: p.get('questions', []) for p in papers}
    jobs = [(name, digest, questions.get(name, [])) for name, digest in sources.items()]
    # Generate the current exam first for early visual inspection.
    jobs.sort(key=lambda j: (not j[0].startswith('20261'), j[0]))
    if args.limit: jobs = jobs[:args.limit]
    pages = count = size = 0
    with ProcessPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(render_document, job) for job in jobs]
        for i, future in enumerate(as_completed(futures), 1):
            p, q, b = future.result(); pages += p; count += q; size += b
            if i % 20 == 0 or i == len(jobs): print(json.dumps({'documents': i, 'total': len(jobs), 'pages': pages, 'questions': count, 'MiB': round(size/1048576, 1)}), flush=True)
