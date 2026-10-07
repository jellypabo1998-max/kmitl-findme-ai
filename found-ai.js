(() => {
 const input=document.querySelector('[data-upload]'), button=document.getElementById('analyzeFound'), output=document.getElementById('foundAiResult'), category=document.getElementById('found-category');
 if(!input||!button)return;let generation=0;
 input.addEventListener('change',()=>{generation++;output.replaceChildren();button.disabled=false;});
 button.addEventListener('click',async()=>{
  const file=input.files[0];if(!file){output.textContent='เลือกรูปของที่พบก่อนจ้า';return;}
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>2*1024*1024){output.textContent='ใช้รูป JPG / PNG / WebP ไม่เกิน 2 MB';return;}
  const current=generation;button.disabled=true;output.textContent='กำลังวิเคราะห์รูป…';
  try{
   const bitmap=await createImageBitmap(file), canvas=document.createElement('canvas'), ratio=Math.min(1,768/Math.max(bitmap.width,bitmap.height));canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);canvas.getContext('2d').drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
   const session=JSON.parse(localStorage.getItem('findme_session_v1')||sessionStorage.getItem('findme_session_v1')||'null');
   const response=await fetch(window.FINDME_AUTH_API+'/api/vision/classify',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+(session?.token||'')},body:JSON.stringify({image:canvas.toDataURL('image/jpeg',0.85)}),signal:AbortSignal.timeout(90000)});
   const data=await response.json();if(!response.ok)throw new Error(data.error||'AI ยังไม่พร้อม');if(current!==generation)return;
   output.replaceChildren();const title=document.createElement('p');title.textContent='หมวดที่ AI คาดว่าเป็น (ความมั่นใจ):';output.append(title);
   for(const prediction of data.predictions){const choose=document.createElement('button');choose.type='button';choose.className='btn btn-light';choose.textContent=prediction.category+' '+Math.round(prediction.confidence*100)+'% — ใช้หมวดนี้';choose.addEventListener('click',()=>{category.value=prediction.category;category.dispatchEvent(new Event('change',{bubbles:true}));title.textContent='เลือกหมวด '+prediction.category+' แล้ว — ตรวจสอบรายละเอียดก่อนบันทึก';});output.append(choose);}
  }catch(error){if(current===generation)output.textContent=error.name==='TimeoutError'?'AI ใช้เวลานาน กรุณาลองอีกครั้ง':error.message;}finally{if(current===generation)button.disabled=false;}
 });
})();
