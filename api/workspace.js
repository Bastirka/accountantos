import {authorized,admin,account,handleError} from './_lib.js';
const limits={starter:3,professional:15,agency:50};
const empty=()=>({companies:[],current:'',transactions:[],invoices:[]});
function validate(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Object.assign(new Error('Invalid workspace'),{httpStatus:400});
 for(const k of ['companies','transactions','invoices'])if(!Array.isArray(payload[k]))throw Object.assign(new Error('Invalid '+k),{httpStatus:400});
 if(payload.companies.length>50||payload.transactions.length>20000||payload.invoices.length>20000)throw Object.assign(new Error('Workspace limit exceeded'),{httpStatus:413});
 if(Buffer.byteLength(JSON.stringify(payload),'utf8')>4500000)throw Object.assign(new Error('Workspace too large'),{httpStatus:413});
 if(payload.companies.some(c=>!c||typeof c.id!=='string'||typeof c.name!=='string'||c.name.length>180)||payload.companies.some(c=>c.id.length>100))throw Object.assign(new Error('Invalid company data'),{httpStatus:400});
 const companyIds=new Set(payload.companies.map(c=>c.id));
 if(companyIds.size!==payload.companies.length)throw Object.assign(new Error('Duplicate company identifiers'),{httpStatus:400});
 if(payload.current&& !companyIds.has(payload.current))throw Object.assign(new Error('Invalid active company'),{httpStatus:400});
 if([...payload.transactions,...payload.invoices].some(x=>!x||!companyIds.has(x.company)))throw Object.assign(new Error('Records must belong to an existing company'),{httpStatus:400});
 return payload;
}
function active(a){return a&&['active','trialing'].includes(a.status)}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');
 if(!['GET','PUT'].includes(req.method))return res.status(405).json({error:'Method not allowed'});
 try{
  const u=await authorized(req);const db=admin();
  const [billingResult,workspaceResult]=await Promise.all([account(u.id),db.from('workspaces').select('payload,updated_at').eq('user_id',u.id).maybeSingle()]);
  if(workspaceResult.error)throw workspaceResult.error;
  const current=workspaceResult.data?.payload||empty();
  const tier=active(billingResult)?billingResult.plan:null;
  const companyLimit=tier?limits[tier]||0:1; // Free evaluation: 1 company; no real financial data permitted
  if(req.method==='GET')return res.status(200).json({payload:current,updatedAt:workspaceResult.data?.updated_at||null,tier:tier||'evaluation',companyLimit});
  if(companyLimit===0)return res.status(403).json({error:'Subscription plan not recognized'});
  const next=validate(req.body?.payload);
  if(next.companies.length>companyLimit)return res.status(403).json({error:'Your plan allows up to '+companyLimit+' companies'});
  if(!tier && (next.transactions.length>30||next.invoices.length>30))return res.status(403).json({error:'Evaluation limit: up to 30 transactions and invoices'});
  // Compare-and-swap prevents silent overwrites when two tabs edit the same workspace.
  const previousRevision=req.body?.updatedAt??null;
  const serverRevision=workspaceResult.data?.updated_at??null;
  if(previousRevision!==serverRevision)return res.status(409).json({error:'Data changed in another tab. Reload before saving.',code:'STALE_WORKSPACE'});
  const changedAt=new Date().toISOString();
  let result;
  if(serverRevision){
    result=await db.from('workspaces').update({payload:next,updated_at:changedAt})
      .eq('user_id',u.id).eq('updated_at',serverRevision).select('updated_at').maybeSingle();
  }else{
    result=await db.from('workspaces').insert({user_id:u.id,payload:next,updated_at:changedAt})
      .select('updated_at').maybeSingle();
  }
  if(result.error?.code==='23505')return res.status(409).json({error:'Workspace changed. Reload before saving.',code:'STALE_WORKSPACE'});
  if(result.error)throw result.error;
  if(!result.data)return res.status(409).json({error:'Workspace changed. Reload before saving.',code:'STALE_WORKSPACE'});
  res.status(200).json({saved:true,updatedAt:result.data.updated_at,companyLimit});
 }catch(e){handleError(res,e)}
}
