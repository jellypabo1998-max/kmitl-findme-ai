import test from 'node:test';import assert from 'node:assert/strict';
import {classifyImage} from './ai-service.mjs';import {rankImages,similarity} from './image-match-utils.js';
const image='data:image/jpeg;base64,/9j/AA==';
test('trained classifier forwards image, maps Key to Keys and returns confidence separately',async()=>{
 let called=false;
 const result=await classifyImage(image,{key:'test-only-secret',fetcher:async(url,options)=>{called=true;assert.equal(new URL(url).pathname,'/ai-lost-found/1');assert.equal(options.body,'/9j/AA==');return{ok:true,json:async()=>({predictions:[{class:'Wallet',confidence:.1},{class:'Key',confidence:.9}]})};}});
 assert.ok(called);assert.equal(result.top.category,'Keys');assert.equal(result.top.confidence,.9);assert.ok(!JSON.stringify(result).includes('test-only-secret'));
});
test('missing key, invalid image, upstream failure are explicit and do not leak secrets',async()=>{
 await assert.rejects(classifyImage(image,{key:''}),e=>e.status===503);
 await assert.rejects(classifyImage('https://example.test/image',{key:'test'}),e=>e.status===400);
 await assert.rejects(classifyImage(image,{key:'test-only-secret',fetcher:async()=>{throw new Error('test-only-secret');}}),e=>e.status===503&&!e.message.includes('test-only-secret'));
});
test('actual vectors rank identical images first, with zero vectors handled',()=>{
 const result=rankImages([1,0],[{id:'other',vector:[0,1]},{id:'same',vector:[1,0]}]);assert.equal(result[0].id,'same');assert.equal(result[0].score,1);assert.equal(similarity([0,0],[0,0]),0);assert.throws(()=>similarity([1],[1,2]));
});
