import { AuthError } from './auth-service.mjs';
const categoryMap={Key:'Keys',Keys:'Keys',Bag:'Bag',Bottle:'Bottle',Card:'ID Card',Earphones:'Earphones',Glasses:'Glasses',Laptop:'Laptop',Phone:'Phone',Umbrella:'Umbrella',Wallet:'Wallet',Other:'Other',placeholder:'Other'};
export async function classifyFoundPhoto(image,{key=process.env.ROBOFLOW_API_KEY,fetcher=fetch}={}){
  if(!key)throw new AuthError(503,'AI ยังรอตั้งค่าเชื่อมต่อบนเซิร์ฟเวอร์');
  if(typeof image!=='string'||image.length>2750000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))throw new AuthError(400,'กรุณาเลือกรูปที่ถูกต้อง');
  const bytes=Buffer.from(image.split(',')[1],'base64');
  if(bytes.length>2000000||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw new AuthError(400,'ไฟล์รูปไม่ถูกต้อง');
  let response;try{response=await fetcher('https://serverless.roboflow.com/pa-j/workflows/lost-found-pfak5',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({inputs:{image:{type:'base64',value:image.split(',')[1]}}}),redirect:'error',signal:AbortSignal.timeout(60000)});}catch{throw new AuthError(503,'เชื่อมต่อ AI ไม่สำเร็จ กรุณาลองอีกครั้ง');}
  if(!response.ok)throw new AuthError(503,'Roboflow ยังวิเคราะห์ไม่ได้ กรุณาตรวจสอบเครดิตและการเชื่อมต่อ');
  let data;try{data=await response.json();data=data?.outputs?.[0]?.predictions;}catch{throw new AuthError(503,'ผล AI ไม่ถูกต้อง');}
  const raw=Array.isArray(data?.predictions)?data.predictions:Object.entries(data?.predictions||{}).map(([label,v])=>({class:label,confidence:v.confidence}));
  const predictions=raw.filter(x=>typeof x.class==='string'&&Number.isFinite(x.confidence)&&x.confidence>=0&&x.confidence<=1).sort((a,b)=>b.confidence-a.confidence).slice(0,3).map(x=>({label:x.class,category:categoryMap[x.class]||'Other',confidence:x.confidence}));
  if(!predictions.length)throw new AuthError(503,'AI ไม่ส่งผลทำนายที่อ่านได้');
  return {model:data.resolved_model?.model_id||'lost-found-pfak5',predictions};
}
