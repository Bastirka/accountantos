import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../api/checkout.js',import.meta.url),'utf8')
 .replace(/^import .*;\s*$/gm,'')
 .replace('export default async function handler','async function handler');

function setup(stripeStatus){
 let checkoutCount=0;
 const stripe=()=>({
  subscriptions:{list:async()=>({data:[{status:stripeStatus}],has_more:false})},
  checkout:{sessions:{create:async()=>{checkoutCount++;return{url:'https://checkout.stripe.com/test'}}}}
 });
 const ctx=vm.createContext({
  stripe,ready:()=>true,
  authorized:async()=>({id:'test-owner',email:'owner@example.test'}),
  account:async()=>({stripe_customer_id:'cus_test',status:'canceled'}),
  persist:async()=>{},
  origin:()=> 'https://accountantos-chi.vercel.app',
  handleError:(res,e)=>res.status(e.httpStatus||500).json({error:e.message}),
  process:{env:{STRIPE_PRICE_PROFESSIONAL:'price_test'}},
  Object,Date,Math,String,Error
 });
 vm.runInContext(source+';globalThis.handler=handler',ctx);
 const request=async()=>{const res={code:200,status(n){this.code=n;return this},json(x){this.body=x;return this}};await ctx.handler({method:'POST',body:{plan:'professional'}},res);return res};
 return {request,getCheckoutCount:()=>checkoutCount};
}
test('Stripe active subscription blocks double checkout even when local billing status is stale',async()=>{
 const {request,getCheckoutCount}=setup('active');
 assert.equal((await request()).code,409);
 assert.equal(getCheckoutCount(),0);
});
test('Stripe canceled subscription permits a new checkout',async()=>{
 const {request,getCheckoutCount}=setup('canceled');
 assert.equal((await request()).code,200);
 assert.equal(getCheckoutCount(),1);
});
