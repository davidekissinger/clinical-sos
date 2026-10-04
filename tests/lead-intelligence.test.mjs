import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
let handler;
globalThis.Deno={env:{get:n=>({SUPABASE_URL:'https://example.invalid',SUPABASE_ANON_KEY:'public',SUPABASE_SERVICE_ROLE_KEY:'private'})[n]},serve:fn=>{handler=fn;}};
const bundle=await build({entryPoints:['supabase/functions/lead-intelligence-action/index.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'mock',setup(b){b.onResolve({filter:/^(npm:|jsr:)/},a=>({path:a.path,namespace:'mock'}));b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path.endsWith('/cors')?'export const corsHeaders={"Access-Control-Allow-Headers":"authorization, apikey, x-retry-count"};':a.path.startsWith('jsr:')?'':'export const createClient=(...args)=>globalThis.leadClient(...args);'}));}}]});
await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
function fixture({role='clinical',source='https://www.cms.gov/record',stale=false,missing=false,valid=true}={}) {
 const writes=[];
 const signal={id:'signal-1',ccn:'123456',event_date:stale?'2020-01-01':new Date().toISOString().slice(0,10),source:'CMS',source_url:source,factual_evidence_summary:missing?'':'Stored factual summary',date_retrieved:new Date().toISOString(),deficiency_tag:'F880'};
 globalThis.fetch=async()=>assert.fail('verification must not fetch external records');
 globalThis.leadClient=(_url,key)=>key==='public'?{auth:{getUser:async()=>({data:{user:valid?{id:'actor'}:null},error:null})}}:{from(table){let single=false,write=false;const q={};for(const m of ['select','eq','order','limit'])q[m]=()=>q;q.update=values=>{writes.push({table,values});write=true;return q;};q.insert=q.update;
 const result=()=>({data:table==='profiles'?{id:'actor',role}:table==='facilities'?{id:'facility-1',facility_name:'Fixture'}:table==='regulatory_signals'?(single?signal:[]):[],error:null});
 q.maybeSingle=async()=>{single=true;return result();};q.then=(resolve,reject)=>Promise.resolve(write?{data:null,error:null}:result()).then(resolve,reject);return q;
 }};return writes;
}
const request=(action='verify_signal')=>new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify({action,signal_id:'signal-1',facility_id:'facility-1'})});
for(const role of ['pending','client','finance','read_only','business_development'])test('signal verification rejects '+role,async()=>{const writes=fixture({role});assert.equal((await handler(request())).status,403);assert.equal(writes.length,0);});
test('invalid JWT is rejected',async()=>{fixture({valid:false});assert.equal((await handler(request())).status,401);});
test('complete current government metadata passes deterministic gate without external fetch',async()=>{const writes=fixture();const r=await handler(request());assert.equal(r.status,200);const d=await r.json();assert.equal(d.verified,true);assert.equal(d.confidence_score,100);assert.match(d.evidence_assessment,/does not independently fetch/);assert.equal(writes[0].values.verified,true);});
for(const source of ['https://medicaid.example.com/record','https://agency.state.evil.com/record','https://cms.gov.evil.com/record'])test('misleading source hostname requires human review: '+source,async()=>{fixture({source});const d=await(await handler(request())).json();assert.equal(d.verified,false);assert.equal(d.human_review_required,true);});
for(const config of [{stale:true},{missing:true}])test('incomplete or stale evidence requires review '+JSON.stringify(config),async()=>{fixture(config);const d=await(await handler(request())).json();assert.equal(d.verified,false);assert.equal(d.human_review_required,true);});
for(const action of ['score_lead','score_lead_dual'])test(action+' returns explainable zero without signals',async()=>{fixture({role:'business_development'});const d=await(await handler(request(action))).json();assert.equal(d.signals_count,0);assert.equal(d.score??d.clinical_sos_priority_score,0);assert.match(d.explanation,/No regulatory signals/);});
