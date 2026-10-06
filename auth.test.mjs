import test from 'node:test';
import assert from 'node:assert/strict';
import { Accounts } from './auth-service.mjs';
class MemoryStore {
  users=new Map(); sessions=new Map();
  async createUser(u) { if([...this.users.values()].some(x=>x.email===u.email||x.name.toLowerCase()===u.name.toLowerCase())) throw Object.assign(new Error(),{code:'23505'}); this.users.set(u.id,{...u}); }
  async findUser(s) { return [...this.users.values()].find(x=>x.email===s||x.name.toLowerCase()===s); }
  async failLogin(id) { const u=this.users.get(id); u.failed_attempts=(u.failed_attempts||0)+1; if(u.failed_attempts>=5)u.locked_until=new Date(Date.now()+300000); }
  async clearFailures(id) { Object.assign(this.users.get(id),{failed_attempts:0,locked_until:null}); }
  async addSession(h,id,e) { this.sessions.set(h,{id,expiry:e}); }
  async sessionUser(h) { const s=this.sessions.get(h); return s&&s.expiry>new Date()?this.users.get(s.id):null; }
  async deleteSession(h) { this.sessions.delete(h); }
}
test('real signup, duplicate checks, wrong password and revocation',async()=>{
  const store=new MemoryStore(),a=new Accounts(store); await a.init();
  const input={username:'Student_one',email:'student@example.invalid',password:'test-only-fixture-password'};
  const result=await a.register(input);
  assert.equal((await a.me(result.token)).name,'Student_one');
  assert(!JSON.stringify(result).includes('password'));
  assert(![...store.users.values()][0].password_hash.includes(input.password));
  assert(!store.sessions.has(result.token));
  await assert.rejects(a.register({...input,username:'STUDENT_ONE',email:'different@example.invalid'}),{status:409});
  await assert.rejects(a.login({identifier:input.email,password:'incorrect'}),{status:401});
  const second=await a.login({identifier:'student_one',password:input.password,remember:false});
  assert(new Date(second.expiresAt)<new Date(Date.now()+2*86400000));
  // A fresh Accounts instance shares persistent store, rather than trusting client user data.
  const restarted=new Accounts(store); await restarted.init();
  assert.equal((await restarted.me(second.token)).id,result.user.id);
  await restarted.logout(second.token);
  await assert.rejects(restarted.me(second.token),{status:401});
  for(const s of store.sessions.values())s.expiry=new Date(0);
  await assert.rejects(a.me(result.token),{status:401});
});
test('input validation and lockout',async()=>{
  const store=new MemoryStore(),a=new Accounts(store);await a.init();
  await assert.rejects(a.register({username:'x',email:'bad',password:'tiny'}),{status:400});
  const input={username:'Lock_test',email:'lock@example.invalid',password:'test-only-fixture-password'};
  await a.register(input);
  for(let i=0;i<5;i++)await assert.rejects(a.login({identifier:input.email,password:'wrong'}),{status:401});
  await assert.rejects(a.login({identifier:input.email,password:input.password}),{status:429});
  await assert.rejects(a.me('fake-session'),{status:401});
});
