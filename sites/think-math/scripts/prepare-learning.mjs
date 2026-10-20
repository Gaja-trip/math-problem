import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {ensureMedia} from './media-packages.mjs';
export const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
export function prepareLearning(target,{allOriginals=false,assetOrigin=null}={}){
  const source=path.join(root,'dist'),media=path.join(target,'hme/media/v6');
  const sources=JSON.parse(fs.readFileSync(path.join(source,'hme/sources.json'),'utf8'));
  const catalog=JSON.parse(fs.readFileSync(path.join(source,'hme/catalog.json'),'utf8'));
  const bundled=allOriginals||assetOrigin?{...sources}:{};
  if(!allOriginals)for(const paper of catalog.papers)if(paper.onlineCount>0){bundled[paper.paper]=paper.paperSha256;bundled[paper.solution]=paper.solutionSha256;}
  // Extract the committed packages at build time, never during a study request.
  if(!assetOrigin){ensureMedia(media);for(const hash of new Set(Object.values(sources))){const index=path.join(media,hash,'index.json');if(!fs.existsSync(index)||JSON.parse(fs.readFileSync(index,'utf8')).sourceSha256!==hash)throw new Error('Missing verified local media: '+hash);}}
  fs.mkdirSync(target,{recursive:true});
  for(const entry of fs.readdirSync(source,{withFileTypes:true}))if(!['server','client','.openai'].includes(entry.name))fs.cpSync(path.join(source,entry.name),path.join(target,entry.name),{recursive:true});
  fs.writeFileSync(path.join(target,'hme/bundled-sources.js'),'export default Object.freeze('+JSON.stringify(bundled)+');\n');
  fs.writeFileSync(path.join(target,'asset-origin.js'),'export default '+JSON.stringify(assetOrigin)+';\n');
  if(assetOrigin)return {bundled,documents:Object.keys(sources).length};
  fs.mkdirSync(path.join(target,'hme/files'),{recursive:true});
  for(const hash of new Set(Object.values(bundled))){
    const output=path.join(target,'hme/files',hash+'.pdf.gz');
    if(fs.existsSync(output))continue;
    const bytes=fs.readFileSync(path.join(root,'assets/hme/files',hash+'.pdf'));
    if(createHash('sha256').update(bytes).digest('hex')!==hash)throw new Error('Changed official source: '+hash);
    fs.writeFileSync(output,gzipSync(bytes,{level:9}));
  }
  return {bundled,documents:Object.keys(sources).length};
}
