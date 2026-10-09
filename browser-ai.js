// All image inference happens on this device. There is no cloud fallback.
const base=new URL('.',import.meta.url);
let enginePromise,queue=Promise.resolve();
function text(th,en){return localStorage.getItem('findme-language')==='en'?en:th;}
function loadRuntime(){
 if(window.ort)return Promise.resolve(window.ort);
 return new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=new URL('ort.wasm.min.js',base).href;
  script.onload=()=>window.ort?resolve(window.ort):reject(new Error('AI runtime unavailable'));
  script.onerror=()=>{script.remove();reject(new Error(text('โหลด AI ไม่สำเร็จ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่','Could not load AI. Check your connection and retry.')));};
  document.head.append(script);
 });
}
async function engine(){
 if(!enginePromise)enginePromise=(async()=>{
  const ort=await loadRuntime();ort.env.wasm.wasmPaths=new URL('.',base).href;
  // Single-thread WASM works on Safari and GitHub Pages without COOP/COEP.
  ort.env.wasm.numThreads=1;ort.env.wasm.proxy=false;
  const response=await fetch(new URL('labels.json',base));if(!response.ok)throw new Error('Model labels unavailable');
  const metadata=await response.json();
  const session=await ort.InferenceSession.create(new URL('findme-mobilenet.onnx',base).href,{executionProviders:['wasm'],graphOptimizationLevel:'all'});
  return {ort,metadata,session};
 })().catch(error=>{enginePromise=null;throw error;});
 return enginePromise;
}
async function infer(file){
 const {ort,metadata,session}=await engine();
 const url=URL.createObjectURL(file),img=new Image();
 try{
  img.src=url;await img.decode();const size=metadata.inputSize,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.fillStyle='#fff';ctx.fillRect(0,0,size,size);ctx.drawImage(img,0,0,size,size);
  const pixels=ctx.getImageData(0,0,size,size).data,plane=size*size,data=new Float32Array(3*plane);
  for(let i=0;i<plane;i++)for(let c=0;c<3;c++)data[c*plane+i]=(pixels[i*4+c]/255-metadata.mean[c])/metadata.std[c];
  const output=await session.run({image:new ort.Tensor('float32',data,[1,3,size,size])});
  const logits=Array.from(output.logits.data),max=Math.max(...logits),exp=logits.map(x=>Math.exp(x-max)),sum=exp.reduce((a,b)=>a+b,0);
  const predictions=metadata.labels.map((label,i)=>({label,category:metadata.categoryMap[label],confidence:exp[i]/sum})).sort((a,b)=>b.confidence-a.confidence).slice(0,3);
  return {model:metadata.model,predictions,execution:'browser'};
 }finally{URL.revokeObjectURL(url);}
}
export function classifyPhoto(file){
 const task=queue.then(()=>infer(file));queue=task.catch(()=>{});return task;
}
