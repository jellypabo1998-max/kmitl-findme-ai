// Account identity comes from the server; a cached name never authenticates a user.
document.documentElement.classList.add('auth-checking');
window.FindMeUser = null;
window.FindMeAuthReady = (async () => {
  if (document.readyState === 'loading') await new Promise(resolve => document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  const key='findme_session_v1';
  const isEntry=/\/(login|register)\.html$/.test(location.pathname);
  const isHome=/\/(index\.html)?$/.test(location.pathname);
  const navigationKey='findme_next_page_v1';
  let internalEntry=false;
  try {
    const next=JSON.parse(sessionStorage.getItem(navigationKey)||'null');
    sessionStorage.removeItem(navigationKey);
    internalEntry=next?.path===location.pathname&&Date.now()-next.at>=0&&Date.now()-next.at<30000;
  } catch {}
  const rememberNavigation=href=>{
    try {
      const target=new URL(href,location.href);
      if(target.origin===location.origin&&!target.hash){
        sessionStorage.setItem(navigationKey,JSON.stringify({path:target.pathname,at:Date.now()}));
      }
    } catch {}
  };
  window.FindMeNavigate=href=>{rememberNavigation(href);location.assign(href);};
  document.addEventListener('click',event=>{
    const link=event.target.closest?.('a[href]');
    if(link&&!event.defaultPrevented&&!event.ctrlKey&&!event.metaKey&&!event.shiftKey&&!event.altKey&&event.button===0&&(!link.target||link.target==='_self')&&!link.hasAttribute('download'))rememberNavigation(link.href);
  });
  document.addEventListener('submit',event=>{
    const target=event.target;
    if(target.method?.toLowerCase()==='get')rememberNavigation(target.action);
  });
  // Only a fresh navigation selected within this tab may open a subpage.
  // Restored tabs, saved links, and reloads start at Home after session validation.
  const startAtHome=!isHome&&!internalEntry;
  const config=window.FINDME_AUTH_API || '';
  const api=config.replace(/\/$/,'');
  let session=null;
  try { session=JSON.parse(localStorage.getItem(key)||sessionStorage.getItem(key)||'null'); localStorage.removeItem('kmitl_user'); } catch {}
  const clear=()=>{try {localStorage.removeItem(key);sessionStorage.removeItem(key);}catch{};session=null;window.FindMeUser=null;};
  const errorBox=document.getElementById('authError');
  const showError=message=>{if(errorBox){errorBox.textContent=message;errorBox.hidden=false;}};
  async function request(path,data,token=session?.token) {
    if(!api && location.hostname.endsWith('github.io')) throw new Error('ระบบบัญชียังไม่พร้อม กรุณาลองใหม่');
    const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),90000);
    try {
      const headers={};if(data!==undefined)headers['Content-Type']='application/json';if(token)headers.Authorization=`Bearer ${token}`;
      const response=await fetch(`${api}/api/auth/${path}`,{method:data===undefined?'GET':'POST',headers,body:data===undefined?undefined:JSON.stringify(data),signal:controller.signal,cache:'no-store'});
      const result=await response.json().catch(()=>({error:'บริการบัญชียังไม่พร้อม กรุณาลองใหม่'}));
      if(!response.ok)throw Object.assign(new Error(result.error),{status:response.status});
      return result;
    } catch(e) {
      if(e.name==='AbortError'||e instanceof TypeError)throw new Error('เชื่อมต่อระบบบัญชีไม่ได้ กรุณารอสักครู่แล้วลองใหม่');
      throw e;
    } finally {clearTimeout(timeout);}
  }
  async function logout() {
    // Revoke on the server before clearing local state; failures remain visible and retryable.
    await request('logout',{});clear();location.replace('login.html');
  }
  window.FindMeLogout=logout;
  function save(result,remember) {
    clear();
    session={token:result.token,expiresAt:result.expiresAt};
    (remember?localStorage:sessionStorage).setItem(key,JSON.stringify(session));
    window.FindMeUser=result.user;
  }
  const form=document.getElementById('loginForm')||document.getElementById('registerForm');
  if(form)form.addEventListener('submit',async event=>{
    event.preventDefault();if(errorBox)errorBox.hidden=true;
    const isRegister=form.id==='registerForm';
    const password=form.elements.password.value;
    if(isRegister&&password!==form.elements.confirmPassword.value){showError('รหัสผ่านทั้งสองช่องไม่ตรงกัน');return;}
    const remember=form.elements.remember.checked;
    const payload=isRegister?{username:form.elements.username.value.trim(),email:form.elements.email.value.trim(),password,remember}:{identifier:form.elements.identifier.value.trim(),password,remember};
    const button=form.querySelector('button[type="submit"]');const label=button.textContent;button.disabled=true;button.textContent=isRegister?'กำลังสมัครสมาชิก…':'กำลังเข้าสู่ระบบ…';
    try {const result=await request(isRegister?'register':'login',payload,null);save(result,remember);form.reset();location.replace('index.html');}
    catch(e){showError(e.message);button.disabled=false;button.textContent=label;}
  });
  if(session?.token) {
    const waiting=document.createElement('div');waiting.className='auth-wait';waiting.setAttribute('role','status');waiting.textContent='กำลังตรวจสอบบัญชี…';document.body.append(waiting);
    try {
      const result=await request('me');window.FindMeUser=result.user;
      if(isEntry||startAtHome){location.replace('index.html');return null;}
      const name=document.getElementById('accountName'),email=document.getElementById('accountEmail');
      if(name)name.textContent=result.user.name;if(email)email.textContent=result.user.email;
      document.getElementById('accountLogout')?.addEventListener('click',async()=>{try{await logout();}catch(e){showError(e.message);}});
    } catch(e) {
      if(e.status===401){clear();if(!isEntry){location.replace('login.html');return null;}}
      else {
        waiting.textContent=e.message;
        const retry=document.createElement('button');retry.className='btn btn-dark';retry.textContent='ลองเชื่อมต่ออีกครั้ง';retry.addEventListener('click',()=>location.reload());waiting.append(document.createElement('br'),retry);
        return null;
      }
    }
    waiting.remove();
  }
  if(!window.FindMeUser&&!isEntry){location.replace('login.html');return null;}
  document.documentElement.classList.remove('auth-checking');
  window.addEventListener('storage',event=>{if(event.key===key)location.reload();});
  return window.FindMeUser;
})();
