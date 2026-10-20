import fs from 'node:fs';
import path from 'node:path';
import {prepareLearning,root} from './prepare-learning.mjs';
const output=path.join(root,'web-dist');
const result=prepareLearning(path.join(output,'learning'),{allOriginals:true});
fs.writeFileSync(path.join(output,'index.html'),'<!doctype html><html lang="ko"><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./learning/"><title>생각수학</title><a href="./learning/">생각수학 학습 시작</a></html>');
console.log(`Built standalone static app: ${result.documents} local PDFs and all pre-rendered pages. Output: ${output}`);
