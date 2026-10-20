// Optional offline visual QA. Pass a package.json next to @napi-rs/canvas.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { QUESTIONS } from '../dist/data.js';
import { makeWorksheet } from '../dist/pdf.js';
const require=createRequire(path.resolve(process.argv[2]||'package.json'));
const {createCanvas,GlobalFonts}=require('@napi-rs/canvas');
if(fs.existsSync('C:/Windows/Fonts/malgun.ttf'))GlobalFonts.registerFromPath('C:/Windows/Fonts/malgun.ttf','Malgun Gothic');
globalThis.document={fonts:{ready:Promise.resolve()},createElement:()=>createCanvas(1,1)};
const result=await makeWorksheet(QUESTIONS.filter(q=>q.grade===4),{title:'초등 4학년 · 생각을 키우는 수학',includeAnswers:true,space:'normal'});
fs.mkdirSync('output/pdf',{recursive:true});
fs.writeFileSync('output/pdf/생각수학-초등4-학습지.pdf',Buffer.from(await result.blob.arrayBuffer()));
for(let i=0;i<result.pages.length;i++)fs.writeFileSync(`output/pdf/page-${i+1}.jpg`,Buffer.from(result.pages[i].split(',')[1],'base64'));
console.log(JSON.stringify({pages:result.pages.length,bytes:result.blob.size,output:'output/pdf/생각수학-초등4-학습지.pdf'}));
