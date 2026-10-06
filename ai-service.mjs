export class VisionError extends Error {
  constructor(status,message){super(message);this.status=status;}
}
export const CLASSIFIER_MODEL='ai-lost-found/1';
const categories={Key:'Keys',Keys:'Keys',Bag:'Bag',Bottle:'Bottle',Glasses:'Glasses',Laptop:'Laptop',Phone:'Phone',Wallet:'Wallet'};
export async function classifyImage(image,{key=process.env.ROBOFLOW_API_KEY,fetcher=fetch}={}){
  if(!key)throw new VisionError(503,'โมเดลเพื่อนยังรอเชื่อม API key บนเซิร์ฟเวอร์');
  if(typeof image!=='string'||image.length>2800000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(image))throw new VisionError(400,'กรุณาใช้รูป JPEG ขนาดไม่เกิน 2 MB');
  const bytes=Buffer.from(image.split(',')[1],'base64');
  if(bytes.length>2000000||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)throw new VisionError(400,'ไฟล์ภาพไม่ถูกต้อง');
  let response;
  try {
    response=await fetcher(`https://serverless.roboflow.com/${CLASSIFIER_MODEL}?api_key=${encodeURIComponent(key)}`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:image.split(',')[1],signal:AbortSignal.timeout(45000)});
  } catch {throw new VisionError(503,'เชื่อมต่อโมเดลไม่ได้ กรุณาลองอีกครั้ง');}
  if(!response.ok)throw new VisionError(503,'Roboflow ยังประมวลผลไม่ได้ กรุณาตรวจการเชื่อมต่อหรือโควตา');
  const data=await response.json();
  const list=Array.isArray(data.predictions)?data.predictions:Object.entries(data.predictions||{}).map(([name,value])=>({class:name,confidence:value.confidence}));
  const predictions=list.filter(p=>typeof p.class==='string'&&Number.isFinite(p.confidence)&&p.confidence>=0&&p.confidence<=1).sort((a,b)=>b.confidence-a.confidence).slice(0,7).map(p=>({label:p.class,category:categories[p.class]||'Other',confidence:p.confidence}));
  if(!predictions.length)throw new VisionError(503,'โมเดลยังไม่ส่งผลทำนายที่ใช้งานได้');
  return {model:CLASSIFIER_MODEL,predictions,top:predictions[0]};
}
