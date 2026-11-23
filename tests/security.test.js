import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../api/workspace.js',import.meta.url),'utf8')
 .replace(/^import .*;\s*$/gm,'')
 .replace('export default async function handler','async function handler');
const datasets=new Map();
let billingState={status:'active',plan:'professional'};
let stripeStatus='active';
let stripeCustomer='cus_test';
const getRecord=(userId)=>datasets.get(userId)||null;
const supabase=()=>({from:()=>({
 select:()=>({eq:(_k,userId)=>({maybeSingle:async()=>({data:getRecord(userId),error:null})})}),
 insert:record=>({select:()=>({maybeSingle:async()=>{if(datasets.has(record.user_id))return {data:null,error:{code:'23505'}};datasets.set(record.user_id,record);return{data:{updated_at:record.updated_at},error:null}}})}),
 update:record=>({eq:(_key,userId)=>({eq:(_key2,old)=>({select:()=>({maybeSingle:async()=>{const prev=datasets.get(userId);if(!prev||prev.updated_at!==old)return{data:null,error:null};datasets.set(userId,{...prev,...record});return{data:{updated_at:record.updated_at},error:null}}})})})})
})});
const ctx=vm.createContext({
 Buffer,Date,Promise,Set,JSON,Number,Object,Error,
 authorized:async req=>{const id=req.headers?.authorization?.match(/^Bearer (.+)$/)?.[1];if(!id)throw Object.assign(new Error('Sign in required'),{httpStatus:401});return{id}},
 admin:supabase,
 account:async id=>billingState,
 stripe:()=>({subscriptions:{retrieve:async()=>({status:stripeStatus,customer:stripeCustomer,items:{data:[{price:{id:'price_professional'}}]}})}}),
 tierFromPrice:price=>price==='price_professional'?'professional':null,
 handleError:(res,e)=>res.status(e.httpStatus||500).json({error:e.message})
});
vm.runInContext(source+'; globalThis.endpoint=handler',ctx);
function payload(n){return {companies:Array.from({length:n},(_,i)=>({id:'c'+i,name:'Firm '+i})),current:n?'c0':'',transactions:[],invoices:[],documents:[]}}
async function request(id,method='GET',body={}){
 const req={method,headers:id?{authorization:'Bearer '+id}:{},body};
 const res={code:200,setHeader(){},status(n){this.code=n;return this},json(x){this.body=x;return this}};
 await ctx.endpoint(req,res);return {code:res.code,body:res.body};
}
test('API requires authentication',async()=>{assert.equal((await request(null)).code,401)});
test('Professional permits exactly 15 companies',async()=>{assert.equal((await request('alice','PUT',{payload:payload(15),updatedAt:null})).code,200)});
test('Professional rejects a 16th company',async()=>{const old=datasets.get('alice');assert.equal((await request('alice','PUT',{payload:payload(16),updatedAt:old.updated_at})).code,403)});
test('Distinct authenticated users only load their own workspace',async()=>{
 const alice=await request('alice'),bob=await request('bob');
 assert.equal(alice.body.payload.companies.length,15);assert.equal(bob.body.payload.companies.length,0);
});
test('Server does not trust user-supplied ownership in payload',async()=>{
 const r=await request('bob','PUT',{payload:{...payload(1),transactions:[{company:'alice-secret',date:'2026-11-18',amount:1}]},updatedAt:null});
 assert.equal(r.code,400);
});
test('Outdated revision cannot overwrite newer records',async()=>{
 const stale='2020-01-01T00:00:00.000Z';
 assert.equal((await request('alice','PUT',{payload:payload(1),updatedAt:stale})).code,409);
});

test('Canceled Stripe subscription overrides stale Professional billing status',async()=>{
 billingState={status:'active',plan:'professional',stripe_customer_id:'cus_test',stripe_subscription_id:'sub_test'};
 stripeStatus='canceled';stripeCustomer='cus_test';
 const result=await request('charlie','PUT',{payload:payload(2),updatedAt:null});
 assert.equal(result.code,403);
});
test('Stripe active subscription permits paid company writes',async()=>{
 stripeStatus='active';
 const result=await request('charlie','PUT',{payload:payload(2),updatedAt:null});
 assert.equal(result.code,200);
});
test('Stripe customer mismatch rejects workspace writes',async()=>{
 stripeCustomer='cus_other';
 const row=datasets.get('charlie');
 const result=await request('charlie','PUT',{payload:payload(2),updatedAt:row.updated_at});
 assert.equal(result.code,403);
 billingState={status:'active',plan:'professional'};
});

test('Document metadata must belong to an existing company',async()=>{
 const base=payload(1);base.documents=[{id:'d1',company:'other-company',name:'receipt.jpg',type:'image/jpeg',storagePath:'user/c/d1.jpg'}];
 const result=await request('delta','PUT',{payload:base,updatedAt:null});
 assert.equal(result.code,400);
});
