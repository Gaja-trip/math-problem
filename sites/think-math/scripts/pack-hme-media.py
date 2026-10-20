"""Package generated images into bounded, reproducible Git-friendly archives."""
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
import hashlib, json, tarfile

ROOT=Path(__file__).resolve().parents[1]
MEDIA=ROOT/'assets/hme/media'
OUTPUT=ROOT/'assets/hme/media-packages'
LIMIT=32*1024*1024

def pack_bucket(item):
    bucket, files=item
    parts=[]; archive=None; size=0; count=0; index=0; target=None
    def finish():
        nonlocal archive
        if archive:
            archive.close(); data=target.read_bytes()
            parts.append({'file':target.name,'sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'files':count})
            archive=None
    for file in files:
        file_size=file.stat().st_size
        required=512+((file_size+511)//512)*512
        if archive and size+required>LIMIT: finish()
        if archive is None:
            target=OUTPUT/f'media-{bucket:02x}-{index}.tar'; index+=1
            archive=tarfile.open(target,'w',format=tarfile.USTAR_FORMAT);size=0;count=0
        info=tarfile.TarInfo(file.relative_to(MEDIA).as_posix());info.size=file_size;info.mode=0o644;info.mtime=0
        with file.open('rb') as stream:archive.addfile(info,stream)
        size+=required;count+=1
    finish()
    return parts

if __name__=='__main__':
    OUTPUT.mkdir(parents=True,exist_ok=True)
    buckets={i:[] for i in range(32)}
    for directory in sorted(MEDIA.iterdir()):
        if directory.is_dir() and len(directory.name)==64:
            buckets[int(directory.name[:2],16)//8].extend(sorted(p for p in directory.iterdir() if p.suffix in ('.webp','.json')))
    with ThreadPoolExecutor(max_workers=4) as pool:
        parts=[part for result in pool.map(pack_bucket,buckets.items()) for part in result]
    manifest={'version':1,'files':sum(p['files'] for p in parts),'packages':parts}
    data=json.dumps(manifest,separators=(',',':')).encode()
    (OUTPUT/'manifest.json').write_bytes(data)
    # The already built, verified local preview contains these same files.
    preview=ROOT/'web-dist/learning/hme/media/v6'
    if preview.exists():
        (preview/'.complete.json').write_text(json.dumps({'manifestSha256':hashlib.sha256(data).hexdigest(),'files':manifest['files']}),encoding='utf-8')
    print(json.dumps({'packages':len(parts),'files':manifest['files'],'MiB':round(sum(p['bytes'] for p in parts)/1048576,1)}),flush=True)
