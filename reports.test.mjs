import test from 'node:test';
import assert from 'node:assert/strict';
import {validateContact,validateReport,validateMessage,caseRole,Reports} from './reports-service.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const example={itemName:'Keys',description:'Blue key tag',location:'Library',latitude:13.727478,longitude:100.775952,kind:'found',category:'Keys',date:'2026-10-07',contactMethod:'line',contactValue:'example.test',contactConsent:true};
test('contact requires explicit sharing consent and a usable contact value',()=>{
 for(const contactMethod of ['line','phone','email'])assert.throws(()=>validateContact({...example,contactMethod,contactConsent:false}),e=>e.status===400);
 for(const data of [{contactMethod:'phone',contactValue:'--------'},{contactMethod:'email',contactValue:'a@example.com\nBcc:x@example.com'},{contactMethod:'line',contactValue:'javascript:alert(1)'},{contactMethod:'unknown',contactValue:'hello'}])assert.throws(()=>validateContact({...example,...data}),e=>e.status===400);
 assert.equal(validateContact({...example,contactMethod:'phone',contactValue:'081-234-5678'}).contactValue,'081-234-5678');
});
test('case entry shows escaped username without exposing external contacts',()=>{
 const context=vm.createContext({window:{addEventListener(){}},setInterval(){},document:{addEventListener(){}},localStorage:{},sessionStorage:{},AbortSignal});
 vm.runInContext(readFileSync(new URL('./reports-client.js',import.meta.url),'utf8'),context);
 const html=context.window.FindMeReports.contactHTML;
 assert(html({isCloud:true,isOwner:true,contactMethod:'line',contactValue:'example.id',reporterName:'<script>'}).includes('&lt;script&gt;'));
 assert(!html({isCloud:true,isOwner:true,contactMethod:'phone',contactValue:'081-234-5678'}).includes('081-234-5678'));
 assert(!html({isCloud:true,isOwner:true,contactMethod:'email',contactValue:'me@example.com'}).includes('me@example.com'));
 assert(html({isCloud:true,id:'r',isOwner:false}).includes('data-start-case="r"'));
 assert(!html({contactValue:'old'}).includes('mailto:'));
});
test('report validates coordinates, actual date, photo and keeps only report fields',()=>{
 const valid=validateReport({...example,ownerId:'forged',status:'Returned'});assert.equal(valid.status,'Submitted');assert(!('ownerId' in valid));
 for(const patch of [{latitude:''},{latitude:100},{date:'2026-02-30'},{kind:'other'},{photo:'data:image/jpeg;base64,aGVsbG8='},{description:''}])assert.throws(()=>validateReport({...example,...patch}),e=>e.status===400);
});
test('report writes bind ownership to authenticated user and retries use an idempotency key',async()=>{
 let query,args;const store=new Reports({query:async(q,a)=>{query=q;args=a;return{rows:[{id:'report-id',owner_id:'real-user',payload:validateReport(example),status:'Submitted'}]};}});
 const result=await store.create({id:'real-user',name:'Reporter'},{...example,ownerId:'forged',clientKey:'retry-key'});
 assert.equal(args[1],'real-user');assert.equal(args[2],'retry-key');assert(query.includes('ON CONFLICT'));assert.equal(result.isOwner,true);
 const denied=new Reports({query:async()=>({rows:[]})});await assert.rejects(()=>denied.contact({id:'other'},'report-id',example),e=>e.status===404);
 await assert.rejects(()=>denied.status({id:'other'},'report-id','Searching'),e=>e.status===404);
});

test('contact is removed from API rows unless report owner or approved requester',()=>{const store=new Reports({});const row={id:'r',owner_id:'owner',payload:validateReport(example)};assert(!('contactValue' in store.row(row,'stranger')));assert.equal(store.row(row,'owner').contactValue,example.contactValue);assert.equal(store.row({...row,contact_allowed:true},'approved').contactValue,example.contactValue);assert(!('contactMethod' in store.row({...row,contact_allowed:false},'rejected')));});
test('claim review denies non owners and invalid approval states',async()=>{const store=new Reports({query:async()=>({rows:[]})});await assert.rejects(()=>store.review({id:'stranger'},'claim',{status:'Approved'}),e=>e.status===404);await assert.rejects(()=>store.review({id:'owner'},'claim',{status:'anything'}),e=>e.status===400);await assert.rejects(()=>store.claim({id:'claimant'},'report',{evidence:'short'}),e=>e.status===400);});

test('same-page report navigation records an internal entry instead of sending user Home',async()=>{const values=new Map(),events={};const storage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};const context=vm.createContext({window:{addEventListener(){}},document:{readyState:'complete',documentElement:{classList:{add(){},remove(){}}},addEventListener:(k,f)=>events[k]=f,getElementById:()=>null},location:{pathname:'/matches.html',href:'https://example.com/matches.html?report=one',origin:'https://example.com',replace(){},assign(){}},localStorage:{getItem:()=>null,removeItem(){}},sessionStorage:storage,URL,Date,console});vm.runInContext(readFileSync(new URL('./auth.js',import.meta.url),'utf8'),context);await context.window.FindMeAuthReady;events.click({target:{closest:()=>({href:'https://example.com/matches.html?report=two',hasAttribute:()=>false})},button:0});assert.equal(JSON.parse(values.get('findme_next_page_v1')).path,'/matches.html');});

test('in-app reports require no external contact and messages reject empty or invalid images',()=>{
 assert.deepEqual(validateContact({contactMethod:'inapp'}),{contactMethod:'inapp',contactValue:''});
 assert.equal(validateMessage({text:' hello '}).text,'hello');
 for(const data of [{},{text:'x'.repeat(2001)},{photo:'data:image/jpeg;base64,aGVsbG8='}])assert.throws(()=>validateMessage(data),e=>e.status===400);
});
test('three questions require real date, identifying detail, location and truth confirmation',async()=>{
 const store=new Reports({query:async()=>({rows:[{id:'claim'}]})});
 const answers={detail:'Blue key tag',date:'2026-10-07',location:'Library',confirm:true};
 for(const patch of [{date:'2026-02-30'},{detail:'a'},{location:''},{confirm:false}])await assert.rejects(()=>store.claim({id:'u'},'r',{answers:{...answers,...patch}}),e=>e.status===400);
 assert.equal((await store.claim({id:'u'},'r',{answers})).submitted,true);
});
test('only case participants can read messages and roles follow report kind',async()=>{
 const store=new Reports({query:async()=>({rows:[]})});await assert.rejects(()=>store.conversation({id:'outsider'},'c'),e=>e.status===404);
 assert.equal(caseRole({owner_id:'finder',kind:'found'},{id:'finder'}).finder,true);
 assert.equal(caseRole({owner_id:'recipient',kind:'lost'},{id:'recipient'}).recipient,true);
});
test('handover and closure are role checked and rolled back on premature or unauthorized actions',async()=>{
 const row={id:'c',report_id:'r',owner_id:'finder',kind:'found',status:'Approved',case_status:'Open',report_status:'Submitted'};
 let queries=[],released=0;const db={query:async(q,a)=>{queries.push([q,a]);return {rows:q.startsWith('SELECT c.')?[row]:[]}},release:()=>released++};const store=new Reports({connect:async()=>db});
 const photo='data:image/jpeg;base64,/9j/';
 await assert.rejects(()=>store.caseAction({id:'recipient'},'c',{action:'handover',photo}),e=>e.status===403);
 await assert.rejects(()=>store.caseAction({id:'recipient'},'c',{action:'confirm'}),e=>e.status===409);
 assert(queries.some(([q])=>q==='ROLLBACK'));
 await store.caseAction({id:'finder'},'c',{action:'handover',photo});
 assert(queries.some(([q])=>q.includes("case_status='Handover'")));
 row.case_status='Handover';row.handover_photo=photo;row.requester_id='recipient';row.linked_report_id='lost';queries=[];
 await assert.rejects(()=>store.caseAction({id:'finder'},'c',{action:'confirm'}),e=>e.status===403);
 await store.caseAction({id:'recipient'},'c',{action:'confirm'});
 assert(queries.some(([q,a])=>q.includes("UPDATE findme_reports SET status='Returned'")&&a[1]==='lost'&&a[2]==='recipient'));
 assert.equal(queries.at(-1)[0],'COMMIT');assert.equal(released,5);
 await assert.rejects(()=>store.status({id:'finder'},'r','Returned'),e=>e.status===409);
});

test('announcement deletion and undo bind authenticated ownership and hide removed listings',async()=>{let query,args;const store=new Reports({query:async(q,a)=>{query=q;args=a;return {rows:[{id:'r'}]};}});await store.remove({id:'owner'},'r');assert(query.includes('owner_id=$2'));assert(query.includes('deleted_at=now()'));assert.deepEqual(args,['r','owner']);await store.remove({id:'owner'},'r',true);assert(query.includes('deleted_at=NULL'));await store.list({id:'owner'},true);assert(query.includes('r.deleted_at IS NULL'));const denied=new Reports({query:async()=>({rows:[]})});await assert.rejects(()=>denied.remove({id:'outsider'},'r'),e=>e.status===404);await assert.rejects(()=>denied.remove({id:'outsider'},'r',true),e=>e.status===404);});
