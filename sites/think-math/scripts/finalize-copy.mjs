import fs from 'node:fs';
const file='dist/app.js';let text=fs.readFileSync(file,'utf8');
const edits=[
 ['기본 수록 문항은 창작 연습문제입니다.','HME 공식 기출과 창작 연습문제를 구분해 제공합니다.'],
 ['천재교육에 로그인해 받은 HME 기출 PDF를 등록하세요. 문항별 정답을 입력하면 자동 채점하고, 정답이 없으면 직접 결과를 기록할 수 있어요. 기출 원문의 자동 추출은 지원하지 않아요.','HME 공식 기출 탭에서 학년과 회차를 고르세요. 공식 정답표 대조가 완료된 문항은 원문을 보며 풀고 자동 채점할 수 있어요. 답을 제출한 뒤 공식 정답표와 풀이 원문을 함께 확인하세요. 정답 대조 대기 자료는 원문 학습으로 제공합니다. 직접 받은 PDF도 등록할 수 있어요.']
];
for(const [from,to] of edits){if(!text.includes(from))throw new Error('Copy target missing');text=text.replace(from,to);}
fs.writeFileSync(file,text);
