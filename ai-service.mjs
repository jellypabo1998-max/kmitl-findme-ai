export class VisionError extends Error {
  constructor(status,message){super(message);this.status=status;}
}
export const CLASSIFIER_MODEL='ai-lost-found/1';
const categories={Key:'Keys',Keys:'Keys',Bag:'Bag',Bottle:'Bottle',Glasses:'Glasses',Laptop:'Laptop',Phone:'Phone',Wallet:'Wallet'};
export function inferenceEndpoint(base=process.env.ROBOFLOW_INFERENCE_URL){
  if(!base)throw new VisionError(503,'โมเดลเพื่อนยังรอตัวรัน AI ของเรา');
  let url;try{url=new URL(base);}catch{throw new VisionError(503,'ตั้งค่าตัวรัน AI ไม่ถูกต้อง');}
  if(!['http:','https:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||url.pathname!=='/'||/(^|\.)roboflow\.(com|cloud)$/i.test(url.hostname))throw new VisionError(503,'ต้องใช้ URL ตัวรัน AI ของเรา ไม่ใช้ Roboflow Cloud');
  if(url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]','inference'].includes(url.hostname))throw new VisionError(503,'ตัวรัน AI ภายนอกต้องใช้ HTTPS');
  return new URL('/infer/classification',url).href;
}
export function classifierConfigured(){try{return !!process.env.ROBOFLOW_API_KEY&&!!inferenceEndpoint();}catch{return false;}}
export async function classifyImage(image,{key=process.env.ROBOFLOW_API_KEY,base=process.env.ROBOFLOW_INFERENCE_URL,fetcher=fetch}={}){
  const endpoint=inferenceEndpoint(base);
  if(!key)throw new VisionError(503,'โมเดลเพื่อนยังรอเชื่อม API key บนเซิร์ฟเวอร์');
  if(typeof image!=='string'||image.length>2800000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))throw new VisionError(400,'กรุณาใช้รูป JPEG ขนาดไม่เกิน 2 MB');
  const bytes=Buffer.from(image.split(',')[1],'base64');
  if(bytes.length>2000000||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw new VisionError(400,'ไฟล์ภาพไม่ถูกต้อง');
  let response;
  try {
    response=await fetcher(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({api_key:key,model_id:CLASSIFIER_MODEL,image:{type:'base64',value:image.split(',')[1]},disable_active_learning:true}),redirect:'error',signal:AbortSignal.timeout(120000)});
  } catch {throw new VisionError(503,'เชื่อมต่อโมเดลไม่ได้ กรุณาลองอีกครั้ง');}
  if(!response.ok)throw new VisionError(503,'ตัวรัน AI ของเรายังประมวลผลไม่ได้');
  let data;try{data=await response.json();if(Array.isArray(data))data=data[0];if(!data||typeof data!=='object')throw new Error();}catch{throw new VisionError(503,'ผลตอบกลับจากตัวรัน AI ไม่ถูกต้อง');}
  const list=Array.isArray(data.predictions)?data.predictions:Object.entries(data.predictions||{}).map(([name,value])=>({class:name,confidence:value.confidence}));
  const predictions=list.filter(p=>typeof p.class==='string'&&Number.isFinite(p.confidence)&&p.confidence>=0&&p.confidence<=1).sort((a,b)=>b.confidence-a.confidence).slice(0,7).map(p=>({label:p.class,category:categories[p.class]||'Other',confidence:p.confidence}));
  if(!predictions.length)throw new VisionError(503,'โมเดลยังไม่ส่งผลทำนายที่ใช้งานได้');
  return {model:CLASSIFIER_MODEL,predictions,top:predictions[0]};
}
