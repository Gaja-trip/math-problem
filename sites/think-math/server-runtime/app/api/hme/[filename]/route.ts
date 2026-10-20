import sources from '../../../../sources.json';
import bundled from '../../../../bundled-sources.json';
import {serveHmeSource} from '../../../../../lib/hme-source.mjs';
export async function GET(request:Request,context:{params:Promise<{filename:string}>}) {
  const {filename}=await context.params;
  try{return await serveHmeSource(request,filename,sources,bundled);}
  catch(error){console.warn('HME source fetch failed:',error instanceof Error?error.message:String(error));return new Response('공식 원본 서버에 연결하지 못했습니다.',{status:502});}
}
