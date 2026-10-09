import {classifyPhoto} from './browser-ai.js?v=20261009-local1';
(() => {
 const input=document.querySelector('[data-upload]'), button=document.getElementById('analyzeFound'), output=document.getElementById('foundAiResult'), category=document.getElementById('found-category');
 if(!input||!button)return;let generation=0;
 input.addEventListener('change',()=>{generation++;output.replaceChildren();button.disabled=false;});
 button.addEventListener('click',async()=>{
  const file=input.files[0];if(!file){output.textContent='เลือกรูปของที่พบก่อนจ้า';return;}
  if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>10 * 1024 * 1024){output.textContent='ใช้รูป JPG / PNG / WebP ไม่เกิน 10 MB';return;}
  const current=generation;button.disabled=true;output.textContent='กำลังวิเคราะห์รูป…';
  try{
   const data=await classifyPhoto(file);if(current!==generation)return;
   output.replaceChildren();const title=document.createElement('p');title.textContent='หมวดที่ AI คาดว่าเป็น (ความมั่นใจ):';output.append(title);
   for(const prediction of data.predictions){const choose=document.createElement('button');choose.type='button';choose.className='btn btn-light';choose.textContent=prediction.category+' '+Math.round(prediction.confidence*100)+'% — ใช้หมวดนี้';choose.addEventListener('click',()=>{category.value=prediction.category;category.dispatchEvent(new Event('change',{bubbles:true}));title.textContent='เลือกหมวด '+prediction.category+' แล้ว — ตรวจสอบรายละเอียดก่อนบันทึก';});output.append(choose);}
  }catch(error){if(current===generation)output.textContent=error.name==='TimeoutError'?'AI ใช้เวลานาน กรุณาลองอีกครั้ง':error.message;}finally{if(current===generation)button.disabled=false;}
 });
})();
