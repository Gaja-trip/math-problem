import fs from 'node:fs';
import path from 'node:path';
import {validateHmePdf} from '../dist/source-integrity.js';
const root=path.resolve('.');
const sources=JSON.parse(fs.readFileSync(path.join(root,'dist/hme/sources.json'),'utf8'));
const directory=path.join(root,'assets/hme/files');
fs.mkdirSync(directory,{recursive:true});
let total=0;const unique=new Set();
for(const [filename,hash] of Object.entries(sources)){
  const source=path.join(root,'tmp/hme-source',filename);
  const target=path.join(directory,hash+'.pdf');
  const bytes=await validateHmePdf(fs.readFileSync(source),hash);
  if(!unique.has(hash)){fs.copyFileSync(source,target);unique.add(hash);total+=bytes.length;}
}
fs.writeFileSync(path.join(root,'dist/hme/source-map.js'),'// Official files collected and checked against sources.json.\nexport default Object.freeze('+JSON.stringify(sources)+');\n');
console.log(JSON.stringify({verifiedFiles:Object.keys(sources).length,uniqueFiles:unique.size,megabytes:Math.round(total/1048576)}));
