import fs from 'node:fs';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
const root=path.resolve('.');
const source=path.join(root,'dist');
const target=path.join(root,'server-runtime/public/learning');
const catalog=JSON.parse(fs.readFileSync(path.join(source,'hme/catalog.json'),'utf8'));
const bundled={};
for(const paper of catalog.papers)if(paper.onlineCount>0){bundled[paper.paper]=paper.paperSha256;bundled[paper.solution]=paper.solutionSha256;}
const keep=new Set(Object.values(bundled).map(hash=>hash+'.pdf.gz'));
fs.writeFileSync(path.join(source,'hme/bundled-sources.js'),'export default Object.freeze('+JSON.stringify(bundled)+');\n');
fs.writeFileSync(path.join(root,'server-runtime/bundled-sources.json'),JSON.stringify(bundled));
for(const relative of ['server-runtime/public/learning/hme/files','server-runtime/dist/client/learning/hme/files','dist/client/learning/hme/files']){
  const generated=path.join(root,relative);
  if(fs.existsSync(generated))for(const filename of fs.readdirSync(generated))if(/^[a-f0-9]{64}\.pdf(?:\.gz)?$/.test(filename)&&!keep.has(filename))fs.unlinkSync(path.join(generated,filename));
}
fs.mkdirSync(target,{recursive:true});
for(const entry of fs.readdirSync(source,{withFileTypes:true})) {
  if(['server','client','.openai'].includes(entry.name))continue;
  fs.cpSync(path.join(source,entry.name),path.join(target,entry.name),{recursive:true});
}
fs.copyFileSync(path.join(source,'hme/sources.json'),path.join(root,'server-runtime/sources.json'));
fs.mkdirSync(path.join(target,'hme/files'),{recursive:true});
for(const filename of keep){const encoded=path.join(target,'hme/files',filename);if(!fs.existsSync(encoded)){const original=path.join(root,'assets/hme/files',filename.slice(0,-3));fs.writeFileSync(encoded,gzipSync(fs.readFileSync(original),{level:9}));}}
console.log('Prepared existing learning app as isolated server assets.');
