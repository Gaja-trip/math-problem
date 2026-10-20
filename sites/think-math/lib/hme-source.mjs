export async function serveHmeSource(request,filename,sources,bundled=sources){
  if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});
  if(!Object.hasOwn(sources,filename)||/[\\/]/.test(filename)||filename.includes('..'))return new Response('Not found',{status:404});
  const hash=sources[filename];
  if(!/^[a-f0-9]{64}$/.test(hash))return new Response('Invalid source record',{status:500});
  const location='https://hme.chunjae.co.kr/webdata/HME/TestPaperData/'+encodeURIComponent(filename);
  return new Response(null,{status:307,headers:{location,'cache-control':'private, max-age=3600'}});
}
