import {rankImages} from './image-match-utils.js';
let loading;const cache=new Map();
async function load(){
  if(!loading)loading=(async()=>{
    const {env,AutoProcessor,CLIPVisionModelWithProjection,RawImage}=await import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.8.1');
    env.allowLocalModels=false;env.backends.onnx.wasm.numThreads=1;
    const id='Xenova/clip-vit-base-patch16';
    const processor=await AutoProcessor.from_pretrained(id);
    const model=await CLIPVisionModelWithProjection.from_pretrained(id,{device:'wasm',dtype:'q8',progress_callback:p=>{if(p.status==='progress')postMessage({status:'loading',progress:Math.round(p.progress||0)});}});
    return {processor,model,RawImage};
  })().catch(e=>{loading=null;throw e;});
  return loading;
}
async function embed(photo){
  const key=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(photo)))).map(x=>x.toString(16).padStart(2,'0')).join('');
  if(cache.has(key))return cache.get(key);
  const {processor,model,RawImage}=await load();
  const image=await RawImage.read(photo);const inputs=await processor(image);
  const {image_embeds}=await model(inputs);const vector=Array.from(image_embeds.data);
  if(cache.size>=100)cache.delete(cache.keys().next().value);cache.set(key,vector);return vector;
}
self.onmessage=async({data})=>{
  try {
    const query=await embed(data.photo);const rows=[];let skipped=0;
    for(let i=0;i<data.items.length;i++){
      postMessage({status:'matching',done:i,total:data.items.length});
      try{rows.push({id:data.items[i].id,vector:await embed(data.items[i].photo)});}catch{skipped++;}
    }
    postMessage({status:'done',results:rankImages(query,rows),skipped});
  } catch {postMessage({status:'error',error:'โหลด AI เปรียบเทียบรูปไม่สำเร็จ ตรวจอินเทอร์เน็ตแล้วลองใหม่'});}
};
