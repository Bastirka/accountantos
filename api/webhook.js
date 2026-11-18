import {stripe,admin,persist,tierFromPrice} from './_lib.js';
export const config={api:{bodyParser:false}};
async function raw(req){const parts=[];for await(const chunk of req)parts.push(Buffer.from(chunk));return Buffer.concat(parts)}
async function saveSubscription(subscription){
 const customerId=typeof subscription.customer==='string'?subscription.customer:subscription.customer?.id;
 if(!customerId)throw Error('Subscription missing customer');
 const db=admin();
 const {data:found,error}=await db.from('billing_accounts').select('user_id').eq('stripe_customer_id',customerId).maybeSingle();
 if(error)throw error;
 const userId=found?.user_id||subscription.metadata?.user_id;
 if(!userId)throw Error('Unrecognized subscription customer '+customerId);
 if(found?.user_id&&subscription.metadata?.user_id&&found.user_id!==subscription.metadata.user_id)throw Error('Customer ownership mismatch');
 const price=subscription.items?.data?.[0]?.price?.id||null;
 const end=subscription.items?.data?.[0]?.current_period_end??subscription.current_period_end;
 await persist(userId,{stripe_customer_id:customerId,stripe_subscription_id:subscription.id,stripe_price_id:price,plan:tierFromPrice(price),status:subscription.status,current_period_end:end?new Date(end*1000).toISOString():null});
}
async function syncInvoice(invoice){
 const subscriptionId=typeof invoice.subscription==='string'?invoice.subscription:invoice.subscription?.id;
 if(subscriptionId)await saveSubscription(await stripe().subscriptions.retrieve(subscriptionId));
}
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).end();
 if(!process.env.STRIPE_WEBHOOK_SECRET)return res.status(503).end('Webhook not configured');
 let event;
 try{event=stripe().webhooks.constructEvent(await raw(req),req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET)}
 catch(e){console.error('Invalid Stripe signature');return res.status(400).json({error:'Invalid signature'})}
 try{
  switch(event.type){
   case 'customer.subscription.created':
   case 'customer.subscription.updated':
   case 'customer.subscription.deleted':
    await saveSubscription(event.data.object);break;
   case 'checkout.session.completed':
   case 'checkout.session.async_payment_succeeded':{
    const session=event.data.object;
    if(session.mode==='subscription'&&session.subscription)await saveSubscription(await stripe().subscriptions.retrieve(session.subscription));
    break;
   }
   case 'invoice.paid':
   case 'invoice.payment_failed':
    await syncInvoice(event.data.object);break;
  }
  return res.status(200).json({received:true})
 }catch(e){console.error('Stripe webhook processing failed:',event.id,event.type,e.message);return res.status(500).json({error:'Processing failed; Stripe will retry'})}
}
