// Exact arithmetic for answer checking: no eval and no floating-point tolerance.
export function canonical(value) {
  let text=String(value??'').normalize('NFKC').trim().replace(/[−–]/g,'-').replace(/⁄/g,'/');
  text=text.replace(/\s*(?:km|cm|mm|m|kg|mg|g|mL|ml|L|리터|도|°|개|명|장|칸|배|분|초|원|권|상자|자루|가지|조각|일째|일|번)(?:[23])?\s*$/i,'');
  text=text.replace(/\s+/g,'');
  if(/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(text))text=text.replace(/,/g,'');
  return text.toLowerCase();
}
function rational(text) {
  if(text.length>150)return null;
  if(/^[+-]?\d+\/[+-]?\d+$/.test(text)){
    const [a,b]=text.split('/').map(BigInt);return b===0n?null:[a,b];
  }
  if(!/^[+-]?\d+(?:\.\d+)?$/.test(text))return null;
  const sign=text.startsWith('-')?-1n:1n;
  const [whole,fraction='']=text.replace(/^[+-]/,'').split('.');
  const denominator=10n**BigInt(fraction.length);
  return [sign*(BigInt(whole)*denominator+BigInt(fraction||'0')),denominator];
}
export function exactAnswer(input,expected,type='number') {
  const a=canonical(input),b=canonical(expected);
  if(!a||!b)return false;
  if(type==='choice')return /^[1-9]$/.test(a)&&a===b;
  if(a===b)return true;
  const x=rational(a),y=rational(b);
  return !!(x&&y&&x[0]*y[1]===y[0]*x[1]);
}
