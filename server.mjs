import http from 'node:http';
import {Reports} from './reports-service.mjs';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { Accounts, AuthError } from './auth-service.mjs';
import { PostgresStore } from './auth-store.mjs';
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 20000 });
pool.on('error', () => console.error('Database pool connection error'));
const store = new PostgresStore(pool);
console.log('Startup: account schema');
await store.init();
const accounts = new Accounts(store);
console.log('Startup: account crypto');
await accounts.init();
const reports=new Reports(pool);
console.log('Startup: case schema');
await reports.init();
console.log('Startup: schema ready');
// Disposable test account checks actual database writes, hashes, sessions and revocation.
if (process.env.RUN_AUTH_SMOKE_TEST === 'true') {
  const tag = randomBytes(8).toString('hex'), password = randomBytes(24).toString('hex');
  let userId,requesterId;
  try {
    console.log('Startup: disposable account smoke test');
    const registered = await accounts.register({username:`test_${tag}`,email:`${tag}@example.invalid`,password});
    userId = registered.user.id;
    if ((await accounts.me(registered.token)).id !== userId) throw new Error('Session test failed');
    const testReport=await reports.create(registered.user,{itemName:'Database smoke item',description:'Synthetic smoke test',location:'KMITL',category:'Keys',kind:'found',date:'2026-10-07',latitude:13.727478,longitude:100.775952,contactMethod:'email',contactValue:registered.user.email,contactConsent:true});
    if(!(await reports.list(registered.user,true)).some(r=>r.id===testReport.id))throw new Error('Report persistence test failed');
    if(!(await reports.list({id:'00000000-0000-0000-0000-000000000000'})).some(r=>r.id===testReport.id&&!r.contactValue&&r.isOwner===false))throw new Error('Shared report visibility test failed');
    try{await reports.contact({id:'00000000-0000-0000-0000-000000000000',name:'other'},testReport.id,{contactMethod:'email',contactValue:'test@example.invalid',contactConsent:true});throw new Error('Report ownership failed');}catch(e){if(e.status!==404)throw e;}
    console.log('Startup: disposable requester and linked report');
    const requester=await accounts.register({username:`claim_${tag}`,email:`claim_${tag}@example.invalid`,password});requesterId=requester.user.id;
    const lostReport=await reports.create(requester.user,{itemName:'Database smoke lost',description:'Synthetic blue tag',location:'KMITL',category:'Keys',kind:'lost',date:'2026-10-07',latitude:13.727478,longitude:100.775952,contactMethod:'inapp'});
    await reports.claim(requester.user,testReport.id,{answers:{detail:'Synthetic blue tag',date:'2026-10-07',location:'KMITL',confirm:true},linkedReportId:lostReport.id});
    const claim=(await reports.claims(registered.user)).find(c=>c.report_id===testReport.id);if(!claim)throw new Error('Claim persistence failed');
    try{await reports.review(requester.user,claim.id,{status:'Approved'});throw new Error('Self approval accepted');}catch(e){if(e.status!==404)throw e;}
    await reports.review(registered.user,claim.id,{status:'Approved'});
    if(!(await reports.list(requester.user)).some(r=>r.id===testReport.id&&r.contactValue===registered.user.email))throw new Error('Approved contact unavailable');
    await reports.review(registered.user,claim.id,{status:'Rejected'});
    if((await reports.list(requester.user)).some(r=>r.id===testReport.id&&r.contactValue))throw new Error('Revoked contact remained visible');
    console.log('Private claim smoke test passed: hidden contacts, owner approval, requester unlock, revocation');
    await reports.review(registered.user,claim.id,{status:'Approved'});
    const outsider={id:'00000000-0000-0000-0000-000000000000'};
    for(const operation of [()=>reports.conversation(outsider,claim.id),()=>reports.message(outsider,claim.id,{text:'Unauthorized'}),()=>reports.caseAction(outsider,claim.id,{action:'confirm'})]){try{await operation();throw new Error('Outsider accessed case');}catch(e){if(e.status!==404)throw e;}}
    await reports.message(requester.user,claim.id,{text:'Synthetic handover chat'});
    if(!(await reports.conversation(registered.user,claim.id)).messages.some(m=>m.body==='Synthetic handover chat'))throw new Error('Message persistence failed');
    try{await reports.caseAction(requester.user,claim.id,{action:'confirm'});throw new Error('Premature closure accepted');}catch(e){if(e.status!==409)throw e;}
    const proof='data:image/jpeg;base64,/9j/';
    try{await reports.caseAction(requester.user,claim.id,{action:'handover',photo:proof});throw new Error('Wrong handover role accepted');}catch(e){if(e.status!==403)throw e;}
    await reports.caseAction(registered.user,claim.id,{action:'handover',photo:proof});
    try{await reports.caseAction(registered.user,claim.id,{action:'confirm'});throw new Error('Finder confirmed own handover');}catch(e){if(e.status!==403)throw e;}
    await reports.caseAction(requester.user,claim.id,{action:'confirm'});
    if((await reports.conversation(requester.user,claim.id)).case.caseStatus!=='Closed')throw new Error('Case closure failed');
    if(!(await reports.list(requester.user,true)).some(r=>r.id===lostReport.id&&r.status==='Returned'))throw new Error('Linked lost report not closed');
    try{await reports.message(requester.user,claim.id,{text:'After closure'});throw new Error('Closed case accepted message');}catch(e){if(e.status!==409)throw e;}
    try{await reports.remove(outsider,testReport.id);throw new Error('Outsider deleted report');}catch(e){if(e.status!==404)throw e;}
    await reports.remove(registered.user,testReport.id);
    if((await reports.list(registered.user,true)).some(r=>r.id===testReport.id))throw new Error('Deleted report remained in My Reports');
    if((await reports.conversation(requester.user,claim.id)).case.caseStatus!=='Closed')throw new Error('Deleting announcement lost chat');
    await reports.remove(registered.user,testReport.id,true);
    if(!(await reports.list(registered.user,true)).some(r=>r.id===testReport.id))throw new Error('Restore failed');
    console.log('Announcement delete smoke test passed: owner-only removal, undo, chat retained');
    console.log('Case database smoke test passed: three questions, participant-only chat, handover photo, recipient confirmation, linked reports closed');
    if((await reports.list({id:'00000000-0000-0000-0000-000000000000'})).some(r=>r.id===testReport.id))throw new Error('Returned report remained public');
    console.log('Report database smoke test passed: persistent report, owner-only edits, return status');
    try { await accounts.login({identifier:registered.user.email,password:'intentionally incorrect'}); throw new Error('Incorrect password accepted'); }
    catch(e) { if (e.status !== 401) throw e; }
    const signedIn = await accounts.login({identifier:registered.user.name,password});
    await accounts.logout(signedIn.token);
    try { await accounts.me(signedIn.token); throw new Error('Revoked session accepted'); }
    catch(e) { if (e.status !== 401) throw e; }
    console.log('Auth database smoke test passed: signup, login, wrong password, persistent session, logout');
  } finally { if(requesterId)await pool.query('DELETE FROM findme_users WHERE id=$1',[requesterId]);if (userId) await pool.query('DELETE FROM findme_users WHERE id=$1',[userId]); }
}
const root = dirname(fileURLToPath(import.meta.url));
const files = new Set(['index.html','login.html','register.html','account.html','browse.html','my-reports.html','report-lost.html','report-found.html','matches.html','verify.html','style.css','app.js','map.js','auth.js','auth-config.js','found-ai.js','ai-test.html','ai-test.js','ai-evaluation.js','reports-client.js','cases-client.js']);
const origins = new Set((process.env.ALLOWED_ORIGINS || 'https://jellypabo1998-max.github.io').split(',').map(s=>s.trim()));
const limits = new Map();
let activeAuth = 0;
const reportLimits=new Map();
const server = http.createServer(async (req,res) => {
  const origin = req.headers.origin;
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
  res.setHeader('Cache-Control','no-store');
  if (origin) {
    if (!origins.has(origin) && origin !== `https://${req.headers.host}`) { res.writeHead(403); return res.end(); }
    res.setHeader('Access-Control-Allow-Origin',origin); res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods','GET, POST, OPTIONS');
  }
  if (req.method==='OPTIONS') { res.writeHead(204); return res.end(); }
  const reply = (status,value) => { res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'}); res.end(JSON.stringify(value)); };
  try {
    const path = new URL(req.url,'http://localhost').pathname;
    if(path==='/auth-config.js'&&req.method==='GET'&&process.env.SELF_HOSTED_AUTH==='true'){res.writeHead(200,{'Content-Type':'application/javascript; charset=utf-8'});return res.end('window.FINDME_AUTH_API = window.location.origin;');}
    if (path==='/health' && req.method==='GET') { await pool.query('SELECT 1'); return reply(200,{ok:true}); }
    if(path==='/api/reports'||path.startsWith('/api/reports/')) {
      const user=await accounts.me((req.headers.authorization||'').replace(/^Bearer /,''));
      if(path==='/api/reports'&&req.method==='GET')return reply(200,{reports:await reports.list(user,new URL(req.url,'http://localhost').searchParams.get('mine')==='1')});
      if(path==='/api/reports/claims'&&req.method==='GET')return reply(200,{claims:await reports.claims(user)});
      const conversation=path.match(/^\/api\/reports\/claims\/([0-9a-f-]{36})\/messages$/i);if(conversation&&req.method==='GET')return reply(200,await reports.conversation(user,conversation[1]));
      if(req.method!=='POST')return reply(404,{error:'Not found'});
      const now=Date.now();let rate=reportLimits.get(user.id);if(!rate||rate.until<now){rate={count:0,until:now+3600000};reportLimits.set(user.id,rate);}if(++rate.count>120)throw new AuthError(429,'มีคำขอแก้รายงานมากเกินไป กรุณาลองภายหลัง');
      if(!String(req.headers['content-type']||'').startsWith('application/json'))throw new AuthError(400,'ข้อมูลไม่ถูกต้อง');
      let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>600000)throw new AuthError(413,'ข้อมูลใหญ่เกินไป');chunks.push(chunk);}
      let data;try{data=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new AuthError(400,'ข้อมูลไม่ถูกต้อง');}
      if(!data||typeof data!=='object'||Array.isArray(data))throw new AuthError(400,'ข้อมูลไม่ถูกต้อง');
      if(path==='/api/reports')return reply(201,{report:await reports.create(user,data)});
      if(conversation)return reply(201,await reports.message(user,conversation[1],data));
      const action=path.match(/^\/api\/reports\/claims\/([0-9a-f-]{36})\/action$/i);if(action)return reply(200,await reports.caseAction(user,action[1],data));
      const review=path.match(/^\/api\/reports\/claims\/([0-9a-f-]{36})\/review$/i);if(review)return reply(200,await reports.review(user,review[1],data));
      const claim=path.match(/^\/api\/reports\/([0-9a-f-]{36})\/claim$/i);if(claim)return reply(201,await reports.claim(user,claim[1],data));
      const match=path.match(/^\/api\/reports\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/(contact|status|delete|restore)$/i);
      if(!match)return reply(404,{error:'Not found'});
      if(['delete','restore'].includes(match[2]))return reply(200,await reports.remove(user,match[1],match[2]==='restore'));
      return reply(200,{report:await(match[2]==='contact'?reports.contact(user,match[1],data):reports.status(user,match[1],data.status))});
    }
    if(path==='/api/vision/classify' && req.method==='POST') {
      return reply(410,{error:'AI now runs on your device. Refresh the website to use it without Roboflow credits.'});
    }
    if (path.startsWith('/api/auth/')) {
      const token = (req.headers.authorization || '').replace(/^Bearer /,'');
      if (path==='/api/auth/me' && req.method==='GET') return reply(200,{user:await accounts.me(token)});
      if (path==='/api/auth/logout' && req.method==='POST') { await accounts.logout(token); return reply(200,{ok:true}); }
      if (!['/api/auth/register','/api/auth/login'].includes(path) || req.method!=='POST') return reply(404,{error:'Not found'});
      // Limit total expensive requests and per-client request frequency.
      const ip = String(req.headers['x-forwarded-for'] || req.socket.remoteAddress).split(',')[0];
      const now=Date.now(); let rate=limits.get(ip);
      if (!rate || rate.until<now) { rate={count:0,until:now+15*60000}; limits.set(ip,rate); }
      if (++rate.count>30 || activeAuth>=2) throw new AuthError(429,'มีคำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่');
      if (limits.size>10000) for (const [key,v] of limits) if (v.until<now) limits.delete(key);
      if (!String(req.headers['content-type'] || '').startsWith('application/json')) throw new AuthError(400,'Invalid request');
      let size=0, chunks=[];
      for await (const chunk of req) { size+=chunk.length; if(size>16384) throw new AuthError(413,'ข้อมูลยาวเกินไป'); chunks.push(chunk); }
      let data; try { data=JSON.parse(Buffer.concat(chunks).toString()); } catch { throw new AuthError(400,'Invalid request'); }
      if (!data || typeof data!=='object' || Array.isArray(data)) throw new AuthError(400,'Invalid request');
      activeAuth++;
      try { return reply(path.endsWith('register')?201:200, await (path.endsWith('register')?accounts.register(data):accounts.login(data))); }
      finally { activeAuth--; }
    }
    const file=path==='/'?'index.html':path.slice(1);
    if (req.method!=='GET' || !files.has(file)) return reply(404,{error:'Not found'});
    const content=await readFile(join(root,file));
    const type=file.endsWith('.html')?'text/html':file.endsWith('.css')?'text/css':'text/javascript';
    res.writeHead(200,{'Content-Type':`${type}; charset=utf-8`}); res.end(content);
  } catch(e) {
    if (!e.status) console.error('Request failed:',e.code || e.name || 'Unknown error');
    reply(e.status || 503,{error:e.status?e.message:'บริการบัญชียังไม่พร้อม กรุณาลองใหม่อีกครั้ง'});
  }
});
server.requestTimeout=15000;
server.listen(Number(process.env.PORT || 10000),'0.0.0.0',()=>console.log('FindMe account service ready'));
