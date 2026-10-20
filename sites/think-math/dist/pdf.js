// A dependency-free A4 PDF writer. Korean text is drawn by the browser's fonts.
// Each page is embedded at 2x resolution, so exports also work offline.
const WIDTH=1240, HEIGHT=1754, MARGIN=100;
const FONT='"Malgun Gothic", "Apple SD Gothic Neo", "Noto Sans KR", sans-serif';
export function safeFilename(value) { return String(value).replace(/[<>:"/\\|?*\x00-\x1f]/g,'').trim().slice(0,80) || '생각수학-학습지'; }
export function wrapText(ctx,text,maxWidth) {
  const output=[];
  for(const paragraph of String(text).split('\n')){
    let line='';
    for(const character of paragraph){if(line && ctx.measureText(line+character).width>maxWidth){output.push(line);line=character;}else line+=character;}
    output.push(line);
  }
  return output;
}
export function jpegPdf(images) {
  const enc=new TextEncoder();const chunks=[];const offsets=[0];let length=0;
  const push=data=>{const bytes=typeof data==='string'?enc.encode(data):data;chunks.push(bytes);length+=bytes.length;};
  const object=(id,content)=>{offsets[id]=length;push(`${id} 0 obj\n${content}\nendobj\n`);};
  push('%PDF-1.4\n%ThinkMath\n');
  object(1,'<< /Type /Catalog /Pages 2 0 R >>');
  object(2,`<< /Type /Pages /Count ${images.length} /Kids [${images.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
  images.forEach((image,i)=>{
    const id=3+i*3;const bytes=Uint8Array.from(atob(image.data.split(',')[1]),c=>c.charCodeAt(0));
    object(id,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im${i} ${id+1} 0 R >> >> /Contents ${id+2} 0 R >>`);
    offsets[id+1]=length;push(`${id+1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${image.width} /Height ${image.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);push(bytes);push('\nendstream\nendobj\n');
    const command=`q 595.28 0 0 841.89 0 0 cm /Im${i} Do Q`;
    object(id+2,`<< /Length ${enc.encode(command).length} >>\nstream\n${command}\nendstream`);
  });
  const start=length;push(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for(let i=1;i<offsets.length;i++)push(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);
  push(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`);
  return new Blob(chunks,{type:'application/pdf'});
}
export async function makeWorksheet(questions,{title='나만의 수학 학습지',includeAnswers=true,space='normal'}={}) {
  await document.fonts.ready;
  const canvases=[];let canvas,ctx,y,page=0,answerMode=false;
  const text=(str,x,top,size=24,color='#263c36',weight=400)=>{ctx.font=`${weight} ${size}px ${FONT}`;ctx.fillStyle=color;ctx.fillText(str,x,top);};
  const newPage=(answerPage=answerMode)=>{
    answerMode=answerPage;
    canvas=document.createElement('canvas');canvas.width=WIDTH;canvas.height=HEIGHT;ctx=canvas.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,WIDTH,HEIGHT);ctx.textBaseline='top';canvases.push(canvas);page++;
    text('생각수학',MARGIN,68,24,'#215e4f',700);text(answerPage?'정답과 풀이':'개념부터 탄탄하게',WIDTH-340,72,18,'#6b7971');
    ctx.strokeStyle='#215e4f';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(MARGIN,116);ctx.lineTo(WIDTH-MARGIN,116);ctx.stroke();
    ctx.font=`700 36px ${FONT}`;
    const titleLines=wrapText(ctx,title||'나만의 수학 학습지',WIDTH-2*MARGIN);
    titleLines.forEach((line,i)=>text(line,MARGIN,151+i*50,36,'#173e33',700));
    const metadataY=171+titleLines.length*50;
    text(answerPage?'답을 확인하기 전에 한 번 더 생각해 보세요.':`이름: __________________    날짜: __________________    ${questions.length}문제`,MARGIN,metadataY,20,'#6b7971');
    text(`${page}`,WIDTH/2-8,HEIGHT-65,18,'#849089');y=metadataY+70;
  };
  const lines=(str,x,maxWidth,size=25,color='#263c36',weight=400)=>{
    ctx.font=`${weight} ${size}px ${FONT}`;const result=wrapText(ctx,str,maxWidth);
    for(const line of result){if(y+size*1.65>HEIGHT-125)newPage();text(line,x,y,size,color,weight);y+=size*1.65;}return result.length;
  };
  newPage();
  for(let i=0;i<questions.length;i++){
    const question=questions[i];ctx.font=`400 25px ${FONT}`;
    const linesCount=wrapText(ctx,question.text,WIDTH-2*MARGIN-65).length;
    const imageHeight=question.image?Math.min((WIDTH-2*MARGIN-65)/question.image.width*question.image.height,1000):0;
    const needed=70+(question.image?imageHeight:linesCount*42)+(space==='wide'?260:155);
    if(y+needed>HEIGHT-125 && y>320)newPage();
    text(String(i+1).padStart(2,'0'),MARGIN,y,25,'#215e4f',700);
    lines(question.title,MARGIN+64,WIDTH-2*MARGIN-65,25,'#173e33',700);y+=8;
    if(question.image){
      const picture=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=question.image.data;});
      const availableWidth=WIDTH-2*MARGIN-65;
      const maxHeight=1000;
      const factor=Math.min(availableWidth/question.image.width,maxHeight/question.image.height);
      const iw=question.image.width*factor,ih=question.image.height*factor;
      if(y+ih+150>HEIGHT-125)newPage();
      ctx.drawImage(picture,MARGIN+64,y,iw,ih);y+=ih+20;
      if(question.image.shared){text('공통 지문과 도형을 보존하기 위해 원문 페이지를 포함했습니다.',MARGIN+64,y,18,'#8d977f');y+=33;}
    }else lines(question.text,MARGIN+64,WIDTH-2*MARGIN-65);
    y+=space==='wide'?195:90;
    if(y+70>HEIGHT-125)newPage();
    text('답: __________________________',WIDTH-490,y,21,'#58675f');y+=57;
    ctx.strokeStyle='#e1e7e1';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(MARGIN,y);ctx.lineTo(WIDTH-MARGIN,y);ctx.stroke();y+=38;
  }
  if(includeAnswers){
    newPage(true);
    for(let i=0;i<questions.length;i++){
      const question=questions[i];const solution=(question.steps||[]).map((v,j)=>`${j+1}. ${v}`).join('\n') || '직접 등록한 문제입니다. 등록한 해설이 없습니다.';
      ctx.font=`400 22px ${FONT}`;const needed=95+wrapText(ctx,solution,WIDTH-2*MARGIN-65).length*37;
      if(y+needed>HEIGHT-130 && y>320)newPage(true);
      lines(`${i+1}. ${question.answerDisplay||question.answer}${question.unit?' '+question.unit:''}`,MARGIN,WIDTH-2*MARGIN,26,'#215e4f',700);y+=5;
      lines(solution,MARGIN+30,WIDTH-2*MARGIN-35,22,'#58675f');y+=35;
    }
  }
  const images=canvases.map(c=>({data:c.toDataURL('image/jpeg',0.94),width:WIDTH,height:HEIGHT}));
  return {blob:jpegPdf(images),pages:images.map(i=>i.data)};
}
export function downloadBlob(blob,name) {
  const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
export function printPages(pages,title) {
  const frame=document.createElement('iframe');frame.className='print-frame';frame.title=title;document.body.append(frame);
  const doc=frame.contentDocument;doc.open();doc.write('<!doctype html><html lang="ko"><head><meta charset="UTF-8"><title>생각수학 학습지</title><style>@page{size:A4;margin:0}html,body{margin:0}img{width:210mm;height:297mm;display:block;break-after:page}img:last-child{break-after:auto}</style></head><body></body></html>');doc.close();doc.title=title;
  Promise.all(pages.map(src=>new Promise(resolve=>{const img=doc.createElement('img');img.onload=resolve;img.onerror=resolve;img.src=src;doc.body.append(img);}))).then(()=>{frame.contentWindow.focus();frame.contentWindow.print();});
  setTimeout(()=>frame.remove(),120000);
}
