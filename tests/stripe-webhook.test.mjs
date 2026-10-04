import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHmac } from 'node:crypto';
import { build } from 'esbuild';

let handler;
let stripeKey='sk_test_fixture';
const webhookSecret='whsec_fixture';
globalThis.Deno={env:{get:n=>({STRIPE_SECRET_KEY:stripeKey,STRIPE_WEBHOOK_SECRET:webhookSecret,SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_ROLE_KEY:'private'})[n]},serve:fn=>{handler=fn;}};
const bundle=await build({entryPoints:['supabase/functions/stripe-webhook/index.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'mock',setup(b){
 b.onResolve({filter:/^(npm:|jsr:)/},a=>({path:a.path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path.startsWith('jsr:')?'':'export const createClient=(...args)=>globalThis.webhookClient(...args);'}));
}}]});
await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));

function fixture({claim='claimed',failedTable=null,failedCompletion=false,completion=false,claimError=false}={}) {
 stripeKey='sk_test_fixture';
 const writes=[];const completions=[];let claims=0;
 globalThis.fetch=async()=>assert.fail('must not contact Stripe in these fixtures');
 globalThis.webhookClient=()=>({
  from(table){const q={};let values;
   q.select=()=>q;q.eq=()=>q;q.update=q.insert=v=>{values=v;writes.push({table,values:v});return q;};
   const result=()=>({data:table==='subscription_tiers'?{included_capabilities:['can_view_poc','attacker_capability']}:{id:'account-1'},error:table===failedTable?{message:'fixture write failure'}:null});
   q.single=async()=>result();q.then=(resolve,reject)=>Promise.resolve(result()).then(resolve,reject);return q;
  },
  async rpc(name,args){
   if(name==='claim_stripe_webhook_event'){claims++;return {data:claim,error:claimError?{message:'fixture claim failure'}:null};}
   assert.equal(name,'complete_stripe_webhook_event');completions.push(args);
   return {data:args.p_status==='Success'?!completion:true,error:args.p_status==='Success'&&failedCompletion?{message:'fixture completion failure'}:null};
  },
 });
 return {writes,completions,get claims(){return claims;}};
}
function event(type='invoice.paid',object={metadata:{client_account_id:'account-1'},id:'invoice-1'}){return {id:'evt_fixture',type,livemode:false,data:{object}};}
function request(e=event(),{timestamp=Math.floor(Date.now()/1000),signature=true,secret=webhookSecret}={}) {
 const payload=JSON.stringify(e);const digest=createHmac('sha256',secret).update(`${timestamp}.${payload}`).digest('hex');
 return new Request('https://example.invalid',{method:'POST',headers:{...(signature?{'stripe-signature':`t=${timestamp},v1=${digest}`} : {}),'Content-Type':'application/json'},body:payload});
}
for(const options of [{signature:false},{secret:'wrong-secret'},{timestamp:1}])test('rejects missing, invalid or stale signature '+JSON.stringify(options),async()=>{const f=fixture();assert.equal((await handler(request(event(),options))).status,400);assert.equal(f.claims,0);});
for(const key of ['sk_live_fixture','rk_live_fixture'])test('rejects live key '+key,async()=>{const f=fixture();stripeKey=key;assert.equal((await handler(request())).status,503);assert.equal(f.claims,0);});
test('rejects live event even with test key',async()=>{const f=fixture();assert.equal((await handler(request({...event(),livemode:true}))).status,400);assert.equal(f.claims,0);});
test('successful duplicate is acknowledged without record writes',async()=>{const f=fixture({claim:'duplicate'});const r=await handler(request());assert.equal(r.status,200);assert.equal((await r.json()).duplicate,true);assert.equal(f.writes.length,0);});
test('in-progress event remains retryable rather than acknowledged',async()=>{const f=fixture({claim:'in_progress'});assert.equal((await handler(request())).status,503);assert.equal(f.writes.length,0);});
test('claim failure returns retryable error',async()=>{fixture({claimError:true});assert.equal((await handler(request())).status,500);});
for(const [type,object,expected] of [
 ['checkout.session.completed',{client_reference_id:'account-1',metadata:{tier_id:'tier-1',tier_name:'Fixture'}},{subscription_status:'Active',billing_status:'Paid'}],
 ['invoice.paid',{id:'invoice-1',metadata:{client_account_id:'account-1'}},{subscription_status:'Active',billing_status:'Paid'}],
 ['invoice.payment_failed',{id:'invoice-1',metadata:{client_account_id:'account-1'}},{subscription_status:'Past Due',billing_status:'Past Due'}],
 ['customer.subscription.updated',{id:'sub-1',metadata:{client_account_id:'account-1'},status:'past_due'},{subscription_status:'Past Due'}],
 ['customer.subscription.deleted',{id:'sub-1',metadata:{client_account_id:'account-1'}},{subscription_status:'Cancelled',access_status:'Suspended'}],
])test('persists '+type+' before successful completion',async()=>{
 const f=fixture();assert.equal((await handler(request(event(type,object)))).status,200);
 const account=f.writes.find(w=>w.table==='client_accounts').values;
 for(const [key,value] of Object.entries(expected))assert.equal(account[key],value);
 assert.ok(f.writes.some(w=>w.table==='automation_logs'));
 assert.equal(f.completions.at(-1).p_status,'Success');
 if(type==='checkout.session.completed')assert.deepEqual(f.writes.find(w=>w.table==='client_memberships').values,{can_view_poc:true});
});
for(const failedTable of ['client_accounts','automation_logs'])test('database '+failedTable+' failure is recorded for retry',async()=>{const f=fixture({failedTable});assert.equal((await handler(request())).status,500);assert.equal(f.completions.at(-1).p_status,'Failed');assert.equal(f.completions.some(c=>c.p_status==='Success'),false);});
for(const failedTable of ['subscription_tiers','client_memberships'])test('checkout '+failedTable+' failure is recorded for retry',async()=>{const f=fixture({failedTable});assert.equal((await handler(request(event('checkout.session.completed',{client_reference_id:'account-1',metadata:{tier_id:'tier-1'}})))).status,500);assert.equal(f.completions.at(-1).p_status,'Failed');});
for(const config of [{failedCompletion:true},{completion:true}])test('completion failure is never acknowledged '+JSON.stringify(config),async()=>{const f=fixture(config);assert.equal((await handler(request())).status,500);assert.equal(f.completions.at(-1).p_status,'Failed');});
test('missing account association is not silently accepted',async()=>{const f=fixture();assert.equal((await handler(request(event('invoice.paid',{id:'invoice-1'})))).status,500);assert.equal(f.writes.length,0);assert.equal(f.completions.at(-1).p_status,'Failed');});
