import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const root=path.resolve('.');
await import('./prepare-server.mjs');
const plugin=process.env.SITES_PLUGIN_ROOT;
if(!plugin)throw new Error('Set SITES_PLUGIN_ROOT to the installed Sites plugin path.');
const npmCli=process.env.npm_execpath||path.join(path.dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
const buildArgs=process.platform==='win32'?[npmCli,'run','build']:[path.join(plugin,'scripts/build-site.mjs')];
const code=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,buildArgs,{cwd:path.join(root,'server-runtime'),stdio:'inherit',env:process.env});child.on('error',reject);child.on('close',resolve);});
if(code!==0)throw new Error('Isolated server build failed. Existing learning source is preserved.');
const built=path.join(root,'server-runtime/dist');
for(const name of ['server','client'])if(fs.existsSync(path.join(built,name)))fs.cpSync(path.join(built,name),path.join(root,'dist',name),{recursive:true});
if(fs.existsSync(path.join(built,'.openai'))){fs.mkdirSync(path.join(root,'dist/.openai'),{recursive:true});fs.copyFileSync(path.join(built,'.openai/hosting.json'),path.join(root,'dist/.openai/hosting.json'));}
console.log('Built isolated server with preserved learning source.');
