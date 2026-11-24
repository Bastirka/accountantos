import {authorized,admin,handleError} from './_lib.js';
const BUCKET='documents';
const MAX_BYTES=10*1024*1024;
const ALLOWED=new Set(['image/jpeg','image/png','application/pdf']);

function bad(message,status=400){throw Object.assign(new Error(message),{httpStatus:status})}
function safeName(name){return String(name||'document').normalize('NFKC').replace(/[^a-zA-Z0-9._-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,120)||'document'}
async function ensureBucket(db){
 const {data,error}=await db.storage.listBuckets();
 if(error)throw error;
 if(data?.some(b=>b.name===BUCKET))return;
 const created=await db.storage.createBucket(BUCKET,{public:false,fileSizeLimit:MAX_BYTES,allowedMimeTypes:[...ALLOWED]});
 if(created.error&&!/already exists/i.test(created.error.message))throw created.error;
}
async function workspaceHasPath(db,userId,path){
 const {data,error}=await db.from('workspaces').select('payload').eq('user_id',userId).maybeSingle();
 if(error)throw error;
 return !!data?.payload?.documents?.some(d=>d?.storagePath===path);
}

export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  const user=await authorized(req),db=admin(),action=String(req.query?.action||req.body?.action||'');
  await ensureBucket(db);
  if(action==='upload'){
   const {name,type,size,company}=req.body||{};
   if(!ALLOWED.has(type))bad('Atbalstīti tikai JPG, PNG un PDF faili.');
   if(!Number.isInteger(size)||size<1||size>MAX_BYTES)bad('Fails pārsniedz 10 MB limitu.');
   if(typeof company!=='string'||!company||company.length>100)bad('Invalid company');
   const {data:workspace,error:workspaceError}=await db.from('workspaces').select('payload').eq('user_id',user.id).maybeSingle();
   if(workspaceError)throw workspaceError;
   if(!workspace?.payload?.companies?.some(item=>item?.id===company))bad('Company not found',404);
   if((workspace.payload.documents?.length||0)>=5000)bad('Document limit reached',413);
   const id=crypto.randomUUID(),path=user.id+'/'+company+'/'+id+'-'+safeName(name);
   const {data,error}=await db.storage.from(BUCKET).createSignedUploadUrl(path);
   if(error)throw error;
   return res.status(200).json({id,path,token:data.token});
  }
  if(action==='download'){
   const path=String(req.body?.path||'');
   if(!path.startsWith(user.id+'/'))bad('Forbidden',403);
   if(!await workspaceHasPath(db,user.id,path))bad('Document not found',404);
   const {data,error}=await db.storage.from(BUCKET).createSignedUrl(path,600);
   if(error)throw error;
   return res.status(200).json({url:data.signedUrl,expiresIn:600});
  }
  bad('Unknown document action');
 }catch(error){handleError(res,error)}
}
