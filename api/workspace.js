import {authorized,admin,account,handleError,stripe,tierFromPrice} from './_lib.js';
const limits={starter:3,professional:15,agency:50};
const empty=()=>({companies:[],current:'',transactions:[],invoices:[],documents:[]});
function validate(payload){
 if(!payload||typeof payload!=='object'||Array.isArray(payload))throw Object.assign(new Error('Invalid workspace'),{httpStatus:400});
 for(const k of ['companies','transactions','invoices','documents'])if(!Array.isArray(payload[k]))throw Object.assign(new Error('Invalid '+k),{httpStatus:400});
 if(payload.companies.length>50||payload.transactions.length>20000||payload.invoices.length>20000||payload.documents.length>5000)throw Object.assign(new Error('Workspace limit exceeded'),{httpStatus:413});
 if(Buffer.byteLength(JSON.stringify(payload),'utf8')>4500000)throw Object.assign(new Error('Workspace too large'),{httpStatus:413});
 if(payload.companies.some(c=>!c||typeof c.id!=='string'||typeof c.name!=='string'||c.name.length>180)||payload.companies.some(c=>c.id.length>100))throw Object.assign(new Error('Invalid company data'),{httpStatus:400});
 const companyIds=new Set(payload.companies.map(c=>c.id));
 if(companyIds.size!==payload.companies.length)throw Object.assign(new Error('Duplicate company identifiers'),{httpStatus:400});
 if(payload.current&& !companyIds.has(payload.current))throw Object.assign(new Error('Invalid active company'),{httpStatus:400});
 if([...payload.transactions,...payload.invoices,...payload.documents].some(x=>!x||!companyIds.has(x.company)))throw Object.assign(new Error('Records must belong to an existing company'),{httpStatus:400});
 const validText=(value,max,optional=false)=>optional&&value==null||typeof value==='string'&&value.length<=max;
 if(payload.transactions.some(t=>!validText(t.id,100)||!validText(t.date,20)||!validText(t.description,500)||!Number.isFinite(t.amount)||!validText(t.reference,220,true)||!validText(t.reviewStatus,30,true)))throw Object.assign(new Error('Invalid transaction data'),{httpStatus:400});
 if(payload.invoices.some(i=>!validText(i.id,100)||!validText(i.number,120)||!validText(i.partner,220)||!Number.isFinite(i.total)||!validText(i.date,20)))throw Object.assign(new Error('Invalid invoice data'),{httpStatus:400});
 if(payload.documents.some(d=>typeof d.id!=='string'||d.id.length>100||typeof d.name!=='string'||typeof d.type!=='string'||typeof d.storagePath!=='string'||d.storagePath.length>500||d.name.length>220||!['image/jpeg','image/png','application/pdf'].includes(d.type)||!Number.isInteger(d.size)||d.size<1||d.size>10*1024*1024))throw Object.assign(new Error('Invalid document data'),{httpStatus:400});
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
  let tier=active(billingResult)?billingResult.plan:null;
  // For writes, Stripe is the authority. A delayed/missed webhook must not preserve paid entitlements.
  if(req.method==='PUT' && billingResult?.stripe_subscription_id){
    const sub=await stripe().subscriptions.retrieve(billingResult.stripe_subscription_id);
    const customerId=typeof sub.customer==='string'?sub.customer:sub.customer?.id;
    if(customerId!==billingResult.stripe_customer_id)
      return res.status(403).json({error:'Subscription customer mismatch'});
    const price=sub.items?.data?.[0]?.price?.id;
    tier=['active','trialing'].includes(sub.status)?tierFromPrice(price):null;
  }
  const companyLimit=tier?limits[tier]||0:1; // Free evaluation: 1 company
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
