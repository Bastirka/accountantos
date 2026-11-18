import {stripe,authorized,account,handleError,origin,ready} from './_lib.js';
export default async function handler(req,res){
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'});
 try{
  if(!ready())return res.status(503).json({error:'Stripe not configured'});
  const user=await authorized(req),a=await account(user.id);
  if(!a?.stripe_customer_id)return res.status(400).json({error:'No billing account yet'});
  const session=await stripe().billingPortal.sessions.create({customer:a.stripe_customer_id,return_url:origin()});
  res.status(200).json({url:session.url})
 }catch(e){handleError(res,e)}
}
