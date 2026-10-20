import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export const packagesDirectory=path.join(root,'assets/hme/media-packages');
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export function mediaPackageManifest(){const bytes=fs.readFileSync(path.join(packagesDirectory,'manifest.json'));return {...JSON.parse(bytes),sha256:sha256(bytes)};}
export function readMediaPackage(bytes,onFile){
  let offset=0,count=0;
  const field=(header,a,b)=>header.toString('ascii',a,b).replace(/\0.*$/s,'').trim();
  while(offset+512<=bytes.length){
    const header=bytes.subarray(offset,offset+512);offset+=512;
    if(header.every(v=>v===0)){if(!bytes.subarray(offset).every(v=>v===0))throw new Error('Unexpected archive trailer');return count;}
    let checksum=0;for(let i=0;i<512;i++)checksum+=i>=148&&i<156?32:header[i];
    if(checksum!==Number.parseInt(field(header,148,156),8))throw new Error('Invalid archive header');
    const prefix=field(header,345,500),filename=(prefix?prefix+'/':'')+field(header,0,100),sizeText=field(header,124,136);
    if(!/^[0-7]+$/.test(sizeText)||!/^([a-f0-9]{64})\/(index\.json|[a-z0-9-]+\.webp)$/.test(filename)||![0,48].includes(header[156]))throw new Error('Unsafe media archive entry');
    const size=Number.parseInt(sizeText,8);if(size<0||size>32*1024*1024||offset+size>bytes.length)throw new Error('Invalid archive file size');
    onFile(filename,bytes.subarray(offset,offset+size));count++;offset+=Math.ceil(size/512)*512;
  }
  throw new Error('Incomplete media archive');
}
export function ensureMedia(target){
  const manifest=mediaPackageManifest(),marker=path.join(target,'.complete.json');
  if(fs.existsSync(marker)){try{if(JSON.parse(fs.readFileSync(marker,'utf8')).manifestSha256===manifest.sha256)return manifest;}catch{}}
  fs.mkdirSync(target,{recursive:true});const directories=new Set();let count=0;
  for(const item of manifest.packages){
    if(!/^media-[a-f0-9]{2}-\d+\.tar$/.test(item.file))throw new Error('Invalid media package name');
    const bytes=fs.readFileSync(path.join(packagesDirectory,item.file));if(bytes.length!==item.bytes||sha256(bytes)!==item.sha256)throw new Error('Changed media package: '+item.file);
    const files=readMediaPackage(bytes,(name,data)=>{const folder=name.slice(0,64);if(!directories.has(folder)){fs.mkdirSync(path.join(target,folder),{recursive:true});directories.add(folder);}fs.writeFileSync(path.join(target,...name.split('/')),data);});
    if(files!==item.files)throw new Error('Missing archive entries');count+=files;
  }
  if(count!==manifest.files)throw new Error('Missing media files');
  fs.writeFileSync(marker,JSON.stringify({manifestSha256:manifest.sha256,files:count}));return manifest;
}
