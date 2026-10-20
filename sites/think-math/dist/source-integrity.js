export async function validateHmePdf(bytes,expected){
  const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  if(data.byteLength>32*1024*1024||new TextDecoder().decode(data.slice(0,5))!=='%PDF-')throw new Error('올바른 공식 PDF가 아닙니다.');
  const digest=await crypto.subtle.digest('SHA-256',data);
  const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
  if(hash!==expected)throw new Error('공식 원본과 파일이 일치하지 않아 학습을 중단했습니다.');
  return data;
}
export async function decodeHmeSource(bytes,expected){
  let data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
  if(data[0]===0x1f&&data[1]===0x8b){
    const decoded=new Blob([data]).stream().pipeThrough(new DecompressionStream('gzip'));
    data=new Uint8Array(await new Response(decoded).arrayBuffer());
  }
  return validateHmePdf(data,expected);
}
