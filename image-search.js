await window.FindMeAuthReady;
if(window.FindMeUser){
 const input=document.getElementById('queryPhoto'),button=document.getElementById('searchPhoto'),status=document.getElementById('visualStatus'),results=document.getElementById('visualResults'),choice=document.getElementById('useClassifier'),classification=document.getElementById('classificationResult');
 let photo=null,worker=null,busy=false,generation=0,rejectCompare=null;
 function token(){try{return JSON.parse(localStorage.getItem('findme_session_v1')||sessionStorage.getItem('findme_session_v1')||'null')?.token;}catch{return null;}}
 async function api(path,data){
   const response=await fetch(`${window.FINDME_AUTH_API}/api/vision/${path}`,{method:data?'POST':'GET',headers:{Authorization:`Bearer ${token()}`,...(data?{'Content-Type':'application/json'}:{})},...(data?{body:JSON.stringify(data)}:{}),signal:AbortSignal.timeout(90000)});
   const payload=await response.json();if(!response.ok)throw new Error(payload.error||'เชื่อมต่อโมเดลไม่ได้');return payload;
 }
 try{const info=await api('status');choice.disabled=!info.ready;document.getElementById('classifierStatus').textContent=info.ready?'โมเดลเพื่อนพร้อมใช้งาน: AI Lost & Found เวอร์ชัน 1':'โมเดลเพื่อนยังรอการตั้งค่า API key — ยังใช้ AI ค้นหารูปคล้ายในเครื่องได้';}catch{choice.disabled=true;document.getElementById('classifierStatus').textContent='ยังตรวจการเชื่อมต่อโมเดลเพื่อนไม่ได้ — ใช้ AI ค้นหารูปคล้ายในเครื่องได้';}
 async function prepare(file){
   if(file.size>20*1024*1024)throw new Error('กรุณาเลือกรูปไม่เกิน 20 MB');
   const url=URL.createObjectURL(file);
   try{
     const image=new Image();image.src=url;await image.decode();
     const scale=Math.min(1,1024/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
     canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',0.85);
   }finally{URL.revokeObjectURL(url);}
 }
 input.addEventListener('change',async()=>{
   const selected=++generation;photo=null;button.disabled=true;results.replaceChildren();classification.textContent='';document.getElementById('visualResultsTitle').hidden=true;
   if(!input.files[0])return;
   try{const prepared=await prepare(input.files[0]);if(selected!==generation)return;photo=prepared;document.getElementById('queryPreview').src=photo;document.getElementById('visualPreview').hidden=false;status.textContent='เลือกรูปแล้ว กดค้นหาเพื่อเริ่ม';button.disabled=false;}catch(e){status.textContent=e.message==='กรุณาเลือกรูปไม่เกิน 20 MB'?e.message:'เปิดรูปไม่ได้ ลองใช้ JPEG, PNG หรือ WebP';}
 });
 function stop(){generation++;rejectCompare?.(new Error('ยกเลิกการค้นหาแล้ว'));rejectCompare=null;worker?.terminate();worker=null;busy=false;button.disabled=!photo;input.disabled=false;document.getElementById('visualType').disabled=false;button.textContent='ค้นหาด้วยรูป';}
 document.getElementById('clearPhoto').addEventListener('click',()=>{stop();photo=null;input.value='';button.disabled=true;document.getElementById('visualPreview').hidden=true;document.getElementById('queryPreview').removeAttribute('src');results.replaceChildren();status.textContent='';classification.textContent='';document.getElementById('visualResultsTitle').hidden=true;});
 async function compare(items){
   return new Promise((resolve,reject)=>{
     rejectCompare=reject;
     worker??=new Worker(new URL('./image-search-worker.js',import.meta.url),{type:'module'});
     worker.onmessage=({data})=>{
       if(data.status==='loading')status.textContent=`กำลังดาวน์โหลด AI เปรียบเทียบรูป ${data.progress}% — ครั้งแรกอาจใช้เวลาสักครู่`;
       if(data.status==='matching')status.textContent=`กำลังเทียบรูป ${data.done+1}/${data.total}`;
       if(data.status==='error')reject(new Error(data.error));
       if(data.status==='done'){rejectCompare=null;resolve(data);}
     };
     worker.onerror=()=>reject(new Error('AI เปรียบเทียบรูปเปิดไม่ได้ ลองใหม่หรือใช้เบราว์เซอร์เวอร์ชันล่าสุด'));
     worker.postMessage({photo,items:items.map(i=>({id:i.id,photo:i.photo}))});
   });
 }
 button.addEventListener('click',async()=>{
   if(!photo||busy)return;const current=++generation;busy=true;button.disabled=true;input.disabled=true;document.getElementById('visualType').disabled=true;button.textContent='กำลังค้นหา…';results.replaceChildren();classification.textContent='';document.getElementById('visualResultsTitle').hidden=true;
   const kind=document.getElementById('visualType').value;
   let items=allBrowseItems().filter(i=>!i.isDemo&&i.id&&safePhoto(i.photo)&&(!kind||i.type===kind));
   if(!items.length){status.textContent='ยังไม่มีรายงานที่มีรูปในเครื่องนี้ แจ้งของพร้อมแนบรูปก่อน แล้วกลับมาค้นหาได้';busy=false;button.disabled=false;input.disabled=false;document.getElementById('visualType').disabled=false;button.textContent='ค้นหาด้วยรูป';return;}
   try{
     if(choice.checked&&!choice.disabled){
       status.textContent='กำลังให้โมเดลเพื่อนทายหมวด…';
       try{const prediction=await api('classify',{image:photo});if(current!==generation)return;const top=prediction.top;classification.textContent=`โมเดลเพื่อนทายหมวด: ${top.label} · ความมั่นใจ ${(top.confidence*100).toFixed(1)}% (ไม่ใช่คะแนนความคล้าย)`;
         if(top.confidence>=0.6&&top.category!=='Other'){const same=items.filter(i=>i.category===top.category);if(same.length)items=same;else classification.textContent+=' · ยังไม่มีรูปในหมวดนี้ จึงเทียบกับทุกรายการ';}
       }catch(e){if(current!==generation)return;classification.textContent=e.message+' · ค้นหารูปคล้ายในเครื่องต่อได้';}
     }
     if(current!==generation)return;status.textContent='กำลังเตรียม AI เปรียบเทียบรูป…';const found=await compare(items);if(current!==generation)return;
     document.getElementById('visualResultsTitle').hidden=false;
     const rows=found.results.slice(0,12);
     results.innerHTML=rows.map(r=>{const item=items.find(i=>i.id===r.id);return `<div><div class="similarity-label">ความคล้ายของภาพ ${(Math.max(0,r.score)*100).toFixed(1)} / 100</div>${card(item)}</div>`;}).join('');
     status.textContent=rows.length?`แสดง ${rows.length} รายการที่ใกล้เคียงที่สุด${found.skipped?` · มี ${found.skipped} รูปที่เปิดไม่ได้`:''} — ตรวจรายละเอียด วันที่ และสถานที่ก่อนยืนยัน`:'ไม่สามารถเปิดรูปรายงานเพื่อเปรียบเทียบได้';
   }catch(e){if(current!==generation)return;status.textContent=e.message;worker?.terminate();worker=null;}
   finally{if(current===generation){busy=false;button.disabled=!photo;input.disabled=false;document.getElementById('visualType').disabled=false;button.textContent='ค้นหาด้วยรูป';}}
 });
}
