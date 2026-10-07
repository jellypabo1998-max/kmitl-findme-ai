import {categories,scoreTrials,exportTrialsCsv} from './ai-evaluation.js?v=20261007-nine';
const $=id=>document.getElementById(id);
const rows=$('trialRows'), start=$('startTest'), reset=$('resetTest'), download=$('downloadResults'), status=$('testStatus');
let trials=[],running=false,locked=false;
function session(){try{return JSON.parse(localStorage.getItem('findme_session_v1')||sessionStorage.getItem('findme_session_v1')||'null');}catch{return null;}}
function renderSummary(){
 const score=scoreTrials(trials);$('doneCount').textContent=score.completed+' / 10';$('correctCount').textContent=score.correct;$('wrongCount').textContent=score.wrong;
 $('accuracy').textContent=score.completed===10?score.accuracy.toFixed(0)+'%':'—';
 const summary=$('testSummary');summary.className=score.passed===true?'test-pass':score.passed===false?'test-fail':'';
 summary.textContent=score.passed===true?'ผ่านเกณฑ์ — ทายถูก '+score.correct+' จาก 10 รอบ':score.passed===false?'ยังไม่ผ่านเกณฑ์ — ทายถูก '+score.correct+' จาก 10 รอบ':score.completed?'กำลังสะสมผล — รอสรุปเมื่อครบ 10 รอบ':'ยังไม่ได้เริ่มทดสอบ';
 download.disabled=running||!trials.some(t=>t.status==='done'||t.status==='error');
}
function makeRows(){
 trials.forEach(t=>{if(t.preview)URL.revokeObjectURL(t.preview);});trials=[];rows.replaceChildren();locked=false;
 for(let i=0;i<10;i++){
  const tr=document.createElement('tr'), number=document.createElement('td'), photo=document.createElement('td'), expectedCell=document.createElement('td'), prediction=document.createElement('td'), result=document.createElement('td');
  number.textContent=i+1;const box=document.createElement('div');box.className='test-photo';const img=document.createElement('img');img.alt='รูปทดสอบรอบ '+(i+1);img.hidden=true;
  const controls=document.createElement('div'), input=document.createElement('input'), filename=document.createElement('small');input.type='file';input.accept='image/jpeg,image/png,image/webp';input.setAttribute('aria-label','รูปทดสอบรอบ '+(i+1));
  controls.append(input,filename);box.append(img,controls);photo.append(box);
  const select=document.createElement('select');select.setAttribute('aria-label','คำตอบจริงรอบ '+(i+1));select.add(new Option('เลือกหมวดจริง',''));categories.forEach(c=>select.add(new Option(c,c)));expectedCell.append(select);
  prediction.textContent='—';result.textContent='รอทดสอบ';result.className='test-result';tr.append(number,photo,expectedCell,prediction,result);rows.append(tr);
  const trial={status:'pending',expected:'',input,select,predictionCell:prediction,resultCell:result};trials.push(trial);
  input.addEventListener('change',()=>{
   if(locked)return;if(trial.preview)URL.revokeObjectURL(trial.preview);trial.file=null;img.hidden=true;filename.textContent='';
   const file=input.files[0];if(!file)return;
   if(!/^image\/(jpeg|png|webp)$/.test(file.type)||file.size>2*1024*1024){input.value='';status.textContent='รอบ '+(i+1)+': ใช้รูป JPG / PNG / WebP ไม่เกิน 2 MB';return;}
   trial.file=file;trial.filename=file.name;trial.preview=URL.createObjectURL(file);img.src=trial.preview;img.hidden=false;filename.textContent=file.name;
  });
 }
 start.disabled=false;start.textContent='เริ่มทดสอบ 10 รอบ';status.textContent='เลือกรูปและหมวดจริงให้ครบ 10 รอบก่อนเริ่ม';renderSummary();
}
async function imageData(file){
 const bitmap=await createImageBitmap(file);try{const canvas=document.createElement('canvas'),ratio=Math.min(1,768/Math.max(bitmap.width,bitmap.height));canvas.width=Math.max(1,Math.round(bitmap.width*ratio));canvas.height=Math.max(1,Math.round(bitmap.height*ratio));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',0.85);}finally{bitmap.close();}
}
start.addEventListener('click',async()=>{
 if(running)return;const token=session()?.token;$('loginNotice').hidden=!!token;
 if(!token){status.textContent='เข้าสู่ระบบก่อนเริ่มทดสอบจ้า';return;}
 if(!locked&&trials.some(t=>!t.file||!categories.includes(t.select.value))){status.textContent='เลือกรูปและคำตอบจริงให้ครบทั้ง 10 รอบก่อนเริ่ม';return;}
 if(!locked){trials.forEach(t=>{t.expected=t.select.value;t.input.disabled=true;t.select.disabled=true;});locked=true;}
 running=true;start.disabled=true;reset.disabled=true;download.disabled=true;
 for(let i=0;i<trials.length;i++){
  const t=trials[i];if(t.status==='done')continue;t.status='running';t.resultCell.textContent='กำลังวิเคราะห์…';t.resultCell.className='test-result';status.textContent='กำลังทดสอบรอบ '+(i+1)+' / 10 — รอคำตอบจาก AI';
  try{
   const image=await imageData(t.file),response=await fetch(window.FINDME_AUTH_API+'/api/vision/classify',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({image}),signal:AbortSignal.timeout(90000)});
   const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error||'AI ยังไม่พร้อม'),{status:response.status});
   const top=data.predictions?.[0];if(!top||!categories.includes(top.category)||!Number.isFinite(top.confidence)||top.confidence<0||top.confidence>1)throw new Error('AI ส่งผลที่อ่านไม่ได้');
   t.prediction=top;t.model=data.model;t.testedAt=new Date().toISOString();t.status='done';t.predictionCell.textContent=top.category+' · '+(top.confidence*100).toFixed(1)+'%';
   const correct=t.expected===top.category;t.resultCell.textContent=correct?'✓ ถูก':'✕ ผิด';t.resultCell.className='test-result '+(correct?'test-pass':'test-fail');
  }catch(error){
   t.status='error';t.error=error.name==='TimeoutError'?'หมดเวลารอ AI':error.message;t.resultCell.textContent='เชื่อมต่อไม่สำเร็จ';t.predictionCell.textContent=t.error;
   // Stop on the first failure so an unavailable service does not consume ten requests.
   status.textContent='หยุดที่รอบ '+(i+1)+': '+t.error+' — กดทำต่อเพื่อทดสอบเฉพาะรอบที่ยังไม่สำเร็จ';break;
  }
  renderSummary();
 }
 running=false;reset.disabled=false;const score=scoreTrials(trials);start.disabled=score.completed===10;start.textContent=score.completed===10?'ทดสอบครบ 10 รอบแล้ว':'ทำต่อรอบที่ยังไม่สำเร็จ';
 if(score.completed===10)status.textContent='เสร็จแล้ว ดาวน์โหลดผล CSV เพื่อเก็บหลักฐานได้';renderSummary();
});
reset.addEventListener('click',()=>{if(!running)makeRows();});
download.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([exportTrialsCsv(trials)],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='findme-ai-test-'+new Date().toISOString().slice(0,10)+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);});
makeRows();$('loginNotice').hidden=!!session()?.token;

// Keep the site's intentional-navigation rule when leaving this public test page.
document.addEventListener('click',event=>{const link=event.target.closest?.('a[href]');if(!link||event.defaultPrevented||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey||event.button!==0||link.hasAttribute('download'))return;try{const target=new URL(link.href,location.href);if(target.origin===location.origin&&target.pathname!==location.pathname)sessionStorage.setItem('findme_next_page_v1',JSON.stringify({path:target.pathname,at:Date.now()}));}catch{}});
