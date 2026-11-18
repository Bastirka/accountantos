import {stripe,admin,persist,tierFromPrice,handleError} from './_lib.js';
export const config={api:{bodyParser:false}};
async function raw(req){const chunks=[];for await(const chunk of req)chunks.push(Buffer.from(chunk));return Buffer.concat(chunks)}
async function saveSubscription(s,subscription){
 const userId=subscription.metadata?.user_id;
 if(!userId)return;
 const p=subscription.items.data[0]?.price?.id||null;
 const end=subscription.items.data[0]?.current_period_end??subscription.current_period_end;
 await persist(userId,{stripe_customer_id:typeof subscription.customer==='string'?subscription.customer:subscription.customer.id,stripe_subscription_id:subscription.id,stripe_price_id:p,plan:tierFromPrice(p),status:subscription.status,current_period_end:end?new Date(end*1000).toISOString():null})
}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).end();
 try{
  if(!process.env.STRIPE_WEBHOOK_SECRET)return res.status(503).end('Webhook not configured');
  const event=stripe().webhooks.constructEvent(await raw(req),req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);
  if(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted'].includes(event.type)){
   await saveSubscription(null,event.data.object)
  }else if(event.type==='checkout.session.completed'){
   const sess=event.data.object;
   if(sess.mode==='subscription'&&sess.subscription){
    const subscription=await stripe().subscriptions.retrieve(sess.subscription);
    await saveSubscription(null,subscription)
   }
  }
  res.status(200).json({received:true})
 }catch(e){console.error('Stripe webhook error:',e.message);res.status(400).json({error:'Invalid event or processing failure'})}
}
