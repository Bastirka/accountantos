import {stripe,authorized,account,persist,handleError,origin,ready} from './_lib.js';
const plans={starter:'STRIPE_PRICE_STARTER',professional:'STRIPE_PRICE_PROFESSIONAL',agency:'STRIPE_PRICE_AGENCY'};
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  if(!ready())return res.status(503).json({error:'Billing is not configured yet'});
  const user=await authorized(req);
  const plan=String(req.body?.plan||'');
  if(!Object.hasOwn(plans,plan))return res.status(400).json({error:'Invalid plan'});
  const existing=await account(user.id);
  if(['active','trialing','past_due','unpaid','incomplete'].includes(existing?.status))return res.status(409).json({error:'Subscription already active. Use Billing Portal to manage it.'});
  const s=stripe();
  let customerId=existing?.stripe_customer_id;
  if(customerId){
   // Billing DB can lag behind Stripe webhooks. Check the payment provider before allowing another subscription.
   const subscriptions=await s.subscriptions.list({customer:customerId,status:'all',limit:100});
   if(subscriptions.data.some(sub=>['active','trialing','past_due','unpaid','incomplete','paused'].includes(sub.status)))
    return res.status(409).json({error:'A subscription already exists in Stripe. Use Billing Portal to manage it.'});
   if(subscriptions.has_more)
    return res.status(409).json({error:'Unable to verify all prior subscriptions. Contact support before checkout.'});
  }
  if(!customerId){const customer=await s.customers.create({email:user.email,metadata:{user_id:user.id}},{idempotencyKey:'accountantos-customer-'+user.id});customerId=customer.id;await persist(user.id,{stripe_customer_id:customerId})}
  const session=await s.checkout.sessions.create({mode:'subscription',customer:customerId,line_items:[{price:process.env[plans[plan]],quantity:1}],client_reference_id:user.id,metadata:{user_id:user.id},subscription_data:{metadata:{user_id:user.id}},success_url:origin()+'/?checkout=success',cancel_url:origin()+'/?checkout=cancel'}, {idempotencyKey:'accountantos-checkout-'+user.id+'-'+plan+'-'+Math.floor(Date.now()/600000)});
  res.status(200).json({url:session.url});
 }catch(e){handleError(res,e)}
}
