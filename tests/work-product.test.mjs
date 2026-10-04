import assert from 'node:assert/strict';
import { test } from 'node:test';
import { build } from 'esbuild';
let handler;
globalThis.Deno = { env: { get: n => ({ SUPABASE_URL:'https://example.invalid', SUPABASE_ANON_KEY:'public', SUPABASE_SERVICE_ROLE_KEY:'private' })[n] }, serve: fn => { handler=fn; } };
const bundle=await build({entryPoints:['supabase/functions/generate-work-product/index.ts'],bundle:true,write:false,platform:'node',format:'esm',plugins:[{name:'mock',setup(b){
 b.onResolve({filter:/^(npm:|jsr:)/},a=>({path:a.path,namespace:'mock'}));
 b.onLoad({filter:/.*/,namespace:'mock'},a=>({contents:a.path.endsWith('/cors')?'export const corsHeaders={"Access-Control-Allow-Headers":"authorization, apikey, x-client-info, content-type, x-retry-count"};':a.path.startsWith('jsr:')?'':'export const createClient=(...args)=>globalThis.workClient(...args);'}));
}}]});
await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
function fixture({role='clinical',valid=true,status=200,knowledgeStatus='Approved'}={}) {
 const saves=[];
 const rows={profiles:{id:'actor',role},pocs:{id:'poc-1',deficiency_id:'def-1',version:1,updated_date:'2026-10-01T00:00:00Z',element_1_specific_correction:'Documented correction'},deficiencies:{id:'def-1',regulatory_knowledge_id:'knowledge-1',updated_date:'2026-10-01T00:00:00Z',regulatory_mapping_verified:false},regulatory_knowledge:{id:'knowledge-1',approval_status:knowledgeStatus,title:'Reference only',updated_date:'2026-10-01T00:00:00Z'}};
 globalThis.workClient=(_url,key)=>key==='public'?{auth:{getUser:async()=>({data:{user:valid?{id:'actor'}:null},error:null})}}:{
  from(table){const q={};let id;q.select=()=>q;q.eq=(field,value)=>{if(field==='id')id=value;return q;};q.maybeSingle=async()=>({data:rows[table]&&(rows[table].id===id||table==='profiles')?rows[table]:null,error:null});return q;},
  async rpc(name,args){assert.equal(name,'clinical_save_generated_work_product');saves.push(args);return {data:status===200?{document_status:'DRAFT',content:args.p_payload.content}:{_http_status:status,error:'Source records changed during generation.'},error:null};}
 };return saves;
}
function request(body={document_type:'Plan of Correction Draft',poc_id:'poc-1'}){return new Request('https://example.invalid',{method:'POST',headers:{Authorization:'Bearer fixture','Content-Type':'application/json'},body:JSON.stringify(body)});}
for(const role of ['pending','client','finance','read_only','business_development'])test('generation denies '+role,async()=>{const saves=fixture({role});assert.equal((await handler(request())).status,403);assert.equal(saves.length,0);});
test('invalid JWT cannot generate',async()=>{const saves=fixture({valid:false});assert.equal((await handler(request())).status,401);assert.equal(saves.length,0);});
test('generation uses structured sources, preserves versions and labels guidance',async()=>{
 const saves=fixture();const response=await handler(request({document_type:'Plan of Correction Draft',poc_id:'poc-1',prompt:'Invent a completed intervention'}));assert.equal(response.status,200);
 const {p_payload:p,p_actor_id:actor}=saves[0];assert.equal(actor,'actor');assert.match(p.content,/Documented correction/);assert.match(p.content,/To be completed\./);assert.match(p.content,/REGULATORY MAPPING REQUIRES VERIFICATION/);assert.match(p.content,/not evidence that any corrective action has been completed/);assert.doesNotMatch(p.content,/Invent a completed intervention/);
 assert.deepEqual(p.source_record_ids,['poc-1','def-1','knowledge-1']);assert.equal(p.source_versions.poc.updated_date,'2026-10-01T00:00:00Z');assert.ok(p.source_fields_used.includes('poc.element_1_specific_correction'));
 assert.equal((await response.json()).document_status,'DRAFT');
});
test('unapproved regulatory knowledge is excluded',async()=>{const saves=fixture({knowledgeStatus:'Draft'});await handler(request());assert.doesNotMatch(saves[0].p_payload.content,/Reference only/);});
test('stale source rejection remains HTTP 409',async()=>{fixture({status:409});assert.equal((await handler(request())).status,409);});
test('missing source is rejected before save',async()=>{const saves=fixture();assert.equal((await handler(request({document_type:'Plan of Correction Draft',deficiency_id:'missing'}))).status,404);assert.equal(saves.length,0);});
test('missing source identifiers are rejected',async()=>{const saves=fixture();assert.equal((await handler(request({document_type:'Plan of Correction Draft'}))).status,400);assert.equal(saves.length,0);});
test('preflight includes SDK retry header',async()=>{fixture();const response=await handler(new Request('https://example.invalid',{method:'OPTIONS'}));assert.equal(response.status,200);assert.match(response.headers.get('Access-Control-Allow-Headers'),/x-retry-count/);});
