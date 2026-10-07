import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreTrials,exportTrialsCsv} from './ai-evaluation.js';
const trial=(correct=true)=>({status:'done',expected:'Keys',prediction:{category:correct?'Keys':'Bag',confidence:0.55}});
test('8 out of 10 passes regardless of model confidence; 7 out of 10 fails',()=>{
 const eight=Array.from({length:10},(_,i)=>trial(i<8));
 assert.deepEqual(scoreTrials(eight),{completed:10,correct:8,wrong:2,accuracy:80,passed:true});
 assert.equal(scoreTrials(eight.map((t,i)=>i===7?trial(false):t)).passed,false);
});
test('API failures and incomplete rounds cannot produce a passing grade',()=>{
 assert.equal(scoreTrials(Array.from({length:8},()=>trial())).passed,null);
 const partial=Array.from({length:10},(_,i)=>i<8?trial():{status:'error',expected:'Keys'});
 assert.equal(scoreTrials(partial).completed,8);assert.equal(scoreTrials(partial).wrong,0);assert.equal(scoreTrials(partial).passed,null);
 assert.equal(scoreTrials([]).accuracy,null);
});
test('CSV preserves individual results and protects spreadsheet formula filenames',()=>{
 const csv=exportTrialsCsv([{...trial(),filename:'=HYPERLINK("x")',model:'trained-v2',testedAt:'2026-10-07T12:00:00Z'},{status:'error',expected:'Bag',filename:'photo.jpg'}]);
 assert.ok(csv.includes("'=HYPERLINK"));assert.ok(csv.includes('55'));assert.ok(csv.includes('"Correct"'));assert.ok(csv.includes('"API error"'));assert.ok(csv.includes('"trained-v2"'));
});
