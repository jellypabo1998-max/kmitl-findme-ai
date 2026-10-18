import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const ctx=vm.createContext({window:{addEventListener(){}},document:{addEventListener(){},querySelectorAll(){return []}},URLSearchParams,location:{search:''}});
vm.runInContext(readFileSync(new URL('./app.js',import.meta.url),'utf8'),ctx);
const lost={id:'lost',kind:'lost',category:'Wallet',itemName:'กระเป๋าสตางค์ Miu Miu',description:'สีชมพู มีโบว์',location:'Library',date:'2026-10-10',latitude:13.727,longitude:100.775};
const found={...lost,id:'found',kind:'found',date:'2026-10-11'};
test('wallet never matches phones, same-side, returned, deleted or itself',()=>{
 const rows=[lost,found,{...found,id:'phone',category:'Phone'},{...found,id:'lost2',kind:'lost'},{...found,id:'returned',status:'Returned'},{...found,id:'deleted',deletedAt:'2026-10-11'}];
 assert.equal(JSON.stringify(ctx.getMatchCandidates(lost,rows).map(x=>x.item.id)),JSON.stringify(['found']));
 assert.equal(ctx.getMatchCandidates({...lost,category:''},rows).length,0);
});
test('Key aliases work but removed earphones and ID Card are not matched',()=>{
 assert.equal(ctx.getMatchCandidates({...lost,category:'Keys'},[{...found,category:'Key'}]).length,1);
 for(const category of ['Earphone','Umbrella','ID Card'])assert.equal(ctx.getMatchCandidates({...lost,category},[{...found,category}]).length,0);
});
test('nearby matching description and date outrank far dissimilar old reports',()=>{
 const a=ctx.matchBreakdown(lost,found),b=ctx.matchBreakdown(lost,{...found,location:'Dorm',latitude:14,longitude:101,itemName:'Wallet',description:'Black leather',date:'2026-12-10'});
 assert(a.total>b.total);assert(a.total<=100);assert(a.total>=0);
 assert(ctx.textSimilarity('กระเป๋าสีชมพู','กระเป๋าสีชมพูมีโบว์')>ctx.textSimilarity('กระเป๋าสีชมพู','โทรศัพท์สีดำ'));
});
test('missing evidence stays unknown and cannot turn into a perfect match',()=>{
 const a={id:'a',kind:'lost',category:'Wallet'},b={id:'b',kind:'found',category:'Wallet'};
 const score=ctx.matchBreakdown(a,b);assert.equal(score.location,null);assert.equal(score.description,null);assert.equal(score.date,null);assert.equal(score.total,25);
});
test('found before lost gets no date points; invalid dates stay unknown',()=>{
 assert.equal(ctx.matchBreakdown(lost,{...found,date:'2026-10-09'}).date,0);
 assert.equal(ctx.matchBreakdown(lost,{...found,date:'2026-02-30'}).date,null);
});
