import fs from 'node:fs';
import path from 'node:path';
import {prepareLearning} from './prepare-learning.mjs';
const root=path.resolve('.');
const source=path.join(root,'dist');
const target=path.join(root,'server-runtime/public/learning');
const catalog=JSON.parse(fs.readFileSync(path.join(source,'hme/catalog.json'),'utf8'));
const bundled=JSON.parse(fs.readFileSync(path.join(source,'hme/sources.json'),'utf8'));
const keep=new Set();
fs.writeFileSync(path.join(source,'hme/bundled-sources.js'),'export default Object.freeze('+JSON.stringify(bundled)+');\n');
fs.writeFileSync(path.join(root,'server-runtime/bundled-sources.json'),JSON.stringify(bundled));
for(const relative of ['server-runtime/public/learning/hme/files','server-runtime/dist/client/learning/hme/files','dist/client/learning/hme/files']){
  const generated=path.join(root,relative);
  if(fs.existsSync(generated))for(const filename of fs.readdirSync(generated))if(/^[a-f0-9]{64}\.pdf(?:\.gz)?$/.test(filename)&&!keep.has(filename))fs.unlinkSync(path.join(generated,filename));
}
prepareLearning(target,{assetOrigin:'https://math-studying.vercel.app/learning/'});
fs.copyFileSync(path.join(source,'hme/sources.json'),path.join(root,'server-runtime/sources.json'));
console.log('Prepared existing learning app as isolated server assets.');
