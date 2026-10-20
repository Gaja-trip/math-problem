import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateLocalDocument,verifyMediaBytes} from '../dist/local-media.js';
import {mediaPackageManifest,packagesDirectory,readMediaPackage} from '../scripts/media-packages.mjs';
import path from 'node:path';
const sources=JSON.parse(fs.readFileSync(new URL('../dist/hme/sources.json',import.meta.url),'utf8'));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');

test('every archived document and every enabled question has a verified local image',async()=>{
  const documents=new Map();let pages=0,questions=0;
  for(const hash of new Set(Object.values(sources))){
    const base=new URL(`../web-dist/learning/hme/media/v6/${hash}/`,import.meta.url);
    const doc=validateLocalDocument(JSON.parse(fs.readFileSync(new URL('index.json',base),'utf8')),hash);documents.set(hash,doc);
    for(const image of [...doc.pages,...Object.values(doc.questions)]){
      const bytes=fs.readFileSync(new URL(image.file,base));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');assert.equal(digest(bytes),image.sha256);
    }
    pages+=doc.pages.length;
  }
  for(const name of fs.readdirSync(new URL('../dist/hme/papers/',import.meta.url))){
    const p=JSON.parse(fs.readFileSync(new URL('../dist/hme/papers/'+name,import.meta.url),'utf8'));
    const doc=documents.get(p.paperSha256);assert(doc);assert(documents.get(p.solutionSha256));
    for(const q of p.questions){const image=doc.questions[q.id];assert(image,q.id);assert.equal(image.sourcePage,q.paperPage);assert.deepEqual(image.clip,q.paperClip);assert(image.width>0&&image.height>0);questions++;}
  }
  assert.equal(documents.size,814);assert.equal(questions,4748);assert(pages>3000);
});

test('changed image bytes and source-manifest mismatches stop loading',async()=>{
  await assert.rejects(()=>verifyMediaBytes(new Uint8Array([1,2,3]),'0'.repeat(64)),/변경/);
  const hash=Object.values(sources)[0],doc=JSON.parse(fs.readFileSync(new URL(`../web-dist/learning/hme/media/v6/${hash}/index.json`,import.meta.url),'utf8'));
  assert.throws(()=>validateLocalDocument({...doc,sourceSha256:'0'.repeat(64)},hash));
  const bad={...doc,pages:[{...doc.pages[0],file:'../../external.webp'}]};assert.throws(()=>validateLocalDocument(bad,hash));
});

test('Vercel output contains all PDFs and source metadata without Sites build tools',()=>{
  const rootConfig=JSON.parse(fs.readFileSync(new URL('../../../vercel.json',import.meta.url),'utf8'));
  const appConfig=JSON.parse(fs.readFileSync(new URL('../vercel.json',import.meta.url),'utf8'));
  assert.equal(rootConfig.framework,null);assert.equal(appConfig.framework,null);assert.match(rootConfig.buildCommand,/build-static\.mjs/);
  const origin=fs.readFileSync(new URL('../web-dist/learning/asset-origin.js',import.meta.url),'utf8');assert.match(origin,/export default null/);
  assert(fs.existsSync(new URL('../web-dist/index.html',import.meta.url)));
  assert(fs.existsSync(new URL('../web-dist/learning/index.html',import.meta.url)));
});

test('opening an exam and its first question only requests local metadata and a small image',async()=>{
  const originalFetch=globalThis.fetch,originalReader=globalThis.FileReader,requested=[];
  globalThis.FileReader=class {readAsDataURL(blob){blob.arrayBuffer().then(bytes=>{this.result='data:image/webp;base64,'+Buffer.from(bytes).toString('base64');this.onload();});}};
  globalThis.fetch=async input=>{
    const url=new URL(input);requested.push(url.href);assert.equal(url.protocol,'file:');assert(!/\.pdf(?:\.gz)?$|pdfjs/.test(url.pathname));
    const marker='/hme/media/v6/',index=url.pathname.indexOf(marker);
    const file=index>=0?new URL('../web-dist/learning/hme/media/v6/'+url.pathname.slice(index+marker.length),import.meta.url):url;
    return new Response(fs.readFileSync(file));
  };
  try{
    const hme=await import('../dist/hme.js?test=local-media');
    const p=await hme.loadHmePaper('hme-49-3'),raster=await hme.hmeQuestionRaster(p.questions[0]);
    assert.equal(p.paperPages,8);assert.equal(p.solutionPages,4);assert(raster.data.startsWith('data:image/webp;'));assert.equal(requested.length,4);
    assert(Buffer.from(raster.data.split(',')[1],'base64').length<20000);
  }finally{globalThis.fetch=originalFetch;globalThis.FileReader=originalReader;}
});

test('bounded Git archives reproduce every deployed media file exactly',()=>{
  const manifest=mediaPackageManifest();let count=0;
  for(const item of manifest.packages){
    const bytes=fs.readFileSync(path.join(packagesDirectory,item.file));assert.equal(digest(bytes),item.sha256);assert(item.bytes<40*1024*1024);
    const files=readMediaPackage(bytes,(name,data)=>{assert.equal(digest(data),digest(fs.readFileSync(new URL('../web-dist/learning/hme/media/v6/'+name,import.meta.url))));});assert.equal(files,item.files);count+=files;
  }
  assert.equal(count,manifest.files);assert.equal(count,9673);
  assert.throws(()=>readMediaPackage(Buffer.alloc(512,1),()=>{}),/header/);
  const unsafe=Buffer.alloc(1024);fs.readFileSync(path.join(packagesDirectory,manifest.packages[0].file)).copy(unsafe,0,0,512);unsafe.fill(0,0,100);unsafe.write('../outside.webp',0);unsafe.fill(0,124,136);unsafe.write('00000000000',124);unsafe.fill(32,148,156);let sum=0;for(let i=0;i<512;i++)sum+=unsafe[i];unsafe.write(sum.toString(8).padStart(6,'0')+'\0 ',148);assert.throws(()=>readMediaPackage(unsafe,()=>{}),/Unsafe/);
});
