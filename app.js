
const ITEMS = [
  {name:'House Keys',type:'Found',category:'Keys',location:'Science Building',time:'Today 14:20',icon:'🔑'},
  {name:'Black Wallet',type:'Found',category:'Wallet',location:'Library',time:'Today 11:05',icon:'👛'},
  {name:'Reading Glasses',type:'Lost',category:'Glasses',location:'Cafeteria',time:'Yesterday',icon:'👓'},
  {name:'Dorm Keys',type:'Lost',category:'Keys',location:'Dormitory',time:'Yesterday',icon:'🔑'},
  {name:'Water Bottle',type:'Found',category:'Bottle',location:'Sports Complex',time:'2 days ago',icon:'🧴'},
  {name:'Smartphone',type:'Lost',category:'Phone',location:'Engineering Building',time:'2 days ago',icon:'📱'}
];

function card(item){
  return `<article class="item-card">
    <div class="item-photo">${item.icon}</div>
    <div class="item-top"><h3>${item.name}</h3><span class="badge ${item.type==='Found'?'found':'lost'}">${item.type}</span></div>
    <div class="meta">${item.category} • ${item.location}</div>
    <div class="meta">${item.time}</div>
    <a class="text-link" href="${item.type==='Found'?'verify.html':'matches.html'}">View details →</a>
  </article>`;
}

function renderItems(target='itemsGrid', list=ITEMS){
  const el=document.getElementById(target);
  if(!el)return;
  el.innerHTML=list.map(card).join('');
}

function setupBrowse(){
  const search=document.getElementById('search');
  const type=document.getElementById('type');
  const category=document.getElementById('categoryFilter');
  const run=()=>{
    const q=(search?.value||'').toLowerCase();
    const t=type?.value||'';
    const c=category?.value||'';
    const out=ITEMS.filter(i=>(!q||(`${i.name} ${i.category} ${i.location}`).toLowerCase().includes(q))&&(!t||i.type===t)&&(!c||i.category===c));
    renderItems('itemsGrid',out);
  };
  [search,type,category].forEach(x=>x&&x.addEventListener('input',run));
  run();
}

function setupUpload(){
  document.querySelectorAll('[data-upload]').forEach(input=>{
    input.addEventListener('change',()=>{
      const file=input.files?.[0];
      const preview=input.closest('.upload-box')?.querySelector('.upload-preview');
      if(!file||!preview)return;
      const reader=new FileReader();
      reader.onload=()=>preview.innerHTML=`<img src="${reader.result}" alt="preview">`;
      reader.readAsDataURL(file);
    });
  });
}

function setupReportForm(){
  const form=document.querySelector('[data-report-form]');
  if(!form)return;
  form.addEventListener('submit',e=>{
    e.preventDefault();
    const data=Object.fromEntries(new FormData(form).entries());
    const list=JSON.parse(localStorage.getItem('kmitl_reports')||'[]');
    list.unshift({...data,id:Date.now(),status:form.dataset.kind==='lost'?'Searching':'Submitted'});
    localStorage.setItem('kmitl_reports',JSON.stringify(list));
    location.href=form.dataset.kind==='lost'?'matches.html':'my-reports.html';
  });
}

function renderReports(){
  const grid=document.getElementById('reportsGrid');
  if(!grid)return;
  const saved=JSON.parse(localStorage.getItem('kmitl_reports')||'[]');
  const demo=[
    {itemName:'House Keys',location:'Science Building',status:'Searching'},
    {itemName:'Black Wallet',location:'Library',status:'Potential Match'},
    {itemName:'Umbrella',location:'Engineering Building',status:'Returned'}
  ];
  const rows=[...saved,...demo];
  grid.innerHTML=rows.map(r=>`<article class="report-card">
    <span class="badge ${r.status==='Returned'?'resolved':r.status==='Potential Match'?'found':'lost'}">${r.status}</span>
    <h3>${r.itemName||'Untitled item'}</h3>
    <p class="meta">${r.location||'KMITL Campus'}</p>
    <a class="btn btn-light" href="${r.status==='Searching'?'matches.html':'browse.html'}">Open report</a>
  </article>`).join('');
}

function setupVerify(){
  const form=document.getElementById('verifyForm');
  if(!form)return;
  form.addEventListener('submit',e=>{
    e.preventDefault();
    document.getElementById('verifySuccess').hidden=false;
  });
}

document.addEventListener('DOMContentLoaded',()=>{
  renderItems('recentGrid',ITEMS.slice(0,6));
  setupBrowse();
  setupUpload();
  setupReportForm();
  renderReports();
  setupVerify();
});
