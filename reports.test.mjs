import test from 'node:test';
import assert from 'node:assert/strict';
import {validateContact,validateReport,Reports} from './reports-service.mjs';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const example={itemName:'Keys',description:'Blue key tag',location:'Library',latitude:13.727478,longitude:100.775952,kind:'found',category:'Keys',date:'2026-10-07',contactMethod:'line',contactValue:'example.test',contactConsent:true};
test('contact requires explicit sharing consent and a usable contact value',()=>{
 for(const contactMethod of ['line','phone','email'])assert.throws(()=>validateContact({...example,contactMethod,contactConsent:false}),e=>e.status===400);
 for(const data of [{contactMethod:'phone',contactValue:'--------'},{contactMethod:'email',contactValue:'a@example.com\nBcc:x@example.com'},{contactMethod:'line',contactValue:'javascript:alert(1)'},{contactMethod:'unknown',contactValue:'hello'}])assert.throws(()=>validateContact({...example,...data}),e=>e.status===400);
 assert.equal(validateContact({...example,contactMethod:'phone',contactValue:'081-234-5678'}).contactValue,'081-234-5678');
});
test('contact buttons use the selected channel and escape untrusted report text',()=>{
 const context=vm.createContext({window:{addEventListener(){}},setInterval(){},document:{addEventListener(){}},localStorage:{},sessionStorage:{},AbortSignal});
 vm.runInContext(readFileSync(new URL('./reports-client.js',import.meta.url),'utf8'),context);
 const html=context.window.FindMeReports.contactHTML;
 assert(html({isCloud:true,isOwner:true,contactMethod:'line',contactValue:'example.id',reporterName:'<script>'}).includes('&lt;script&gt;'));
 assert(html({isCloud:true,isOwner:true,contactMethod:'phone',contactValue:'081-234-5678'}).includes('href="tel:0812345678"'));
 assert(html({isCloud:true,isOwner:true,contactMethod:'email',contactValue:'me@example.com'}).includes('mailto:me%40example.com'));
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
 await assert.rejects(()=>denied.status({id:'other'},'report-id','Returned'),e=>e.status===404);
});

test('contact is removed from API rows unless report owner or approved requester',()=>{const store=new Reports({});const row={id:'r',owner_id:'owner',payload:validateReport(example)};assert(!('contactValue' in store.row(row,'stranger')));assert.equal(store.row(row,'owner').contactValue,example.contactValue);assert.equal(store.row({...row,contact_allowed:true},'approved').contactValue,example.contactValue);assert(!('contactMethod' in store.row({...row,contact_allowed:false},'rejected')));});
test('claim review denies non owners and invalid approval states',async()=>{const store=new Reports({query:async()=>({rows:[]})});await assert.rejects(()=>store.review({id:'stranger'},'claim',{status:'Approved'}),e=>e.status===404);await assert.rejects(()=>store.review({id:'owner'},'claim',{status:'anything'}),e=>e.status===400);await assert.rejects(()=>store.claim({id:'claimant'},'report',{evidence:'short'}),e=>e.status===400);});
