import path from 'node:path';
import fs from 'node:fs';
import {spawn} from 'node:child_process';
const root=path.resolve('.');
if(!fs.existsSync('server-runtime/node_modules/vinext'))throw new Error('Install dependencies in server-runtime first: npm ci');
await import('./prepare-server.mjs');
const child=spawn(process.execPath,['scripts/run-framework.mjs','dev','--port','4173','--hostname','127.0.0.1',...process.argv.slice(2)],{cwd:path.join(root,'server-runtime'),stdio:'inherit',env:process.env});
child.on('exit',code=>{process.exitCode=code||0;});
