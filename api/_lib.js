import Stripe from 'stripe';
import {createClient} from '@supabase/supabase-js';
const required=(key)=>{const v=process.env[key];if(!v)throw new Error('Missing server setting: '+key);return v};
export function stripe(){return new Stripe(required('STRIPE_SECRET_KEY'))}
export function admin(){return createClient(required('SUPABASE_URL'),required('SUPABASE_SECRET_KEY'),{auth:{persistSession:false,autoRefreshToken:false}})}
export async function authorized(req){const header=req.headers.authorization||'';const match=/^Bearer (.+)$/i.exec(header);if(!match)throw Object.assign(new Error('Sign in required'),{httpStatus:401});const client=createClient(required('SUPABASE_URL'),required('SUPABASE_PUBLISHABLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await client.auth.getUser(match[1]);if(error||!data.user)throw Object.assign(new Error('Invalid session'),{httpStatus:401});return data.user}
export function handleError(res,e){const status=e.httpStatus||500;res.status(status).json({error:status===500?'Server configuration or billing error':e.message});if(status===500)console.error('Billing API error:',e.message)}
export function origin(){return required('APP_URL').replace(/\/$/,'')}
export async function account(userId){const {data,error}=await admin().from('billing_accounts').select('*').eq('user_id',userId).maybeSingle();if(error)throw error;return data}
export async function persist(userId,values){const {error}=await admin().from('billing_accounts').upsert({user_id:userId,...values,updated_at:new Date().toISOString()},{onConflict:'user_id'});if(error)throw error}
export function tierFromPrice(price){for(const tier of ['STARTER','PROFESSIONAL','AGENCY']){if(process.env['STRIPE_PRICE_'+tier]===price)return tier.toLowerCase()}return null}
export function ready(){return ['SUPABASE_URL','SUPABASE_SECRET_KEY','SUPABASE_PUBLISHABLE_KEY','STRIPE_SECRET_KEY','APP_URL','STRIPE_PRICE_STARTER','STRIPE_PRICE_PROFESSIONAL','STRIPE_PRICE_AGENCY'].every(k=>!!process.env[k])}
