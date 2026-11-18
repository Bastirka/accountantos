import {authorized,account,handleError,ready} from './_lib.js';
export default async function handler(req,res){
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'});
 try{const user=await authorized(req),a=await account(user.id);
 res.setHeader('Cache-Control','no-store');
 res.status(200).json({configured:ready(),plan:a?.plan||null,status:a?.status||'inactive',periodEnd:a?.current_period_end||null,hasCustomer:!!a?.stripe_customer_id})
 }catch(e){handleError(res,e)}
}
