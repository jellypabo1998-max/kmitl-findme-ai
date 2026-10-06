// Cosine similarity is a ranking signal, never a probability of ownership.
export function similarity(a,b){
  if(a.length!==b.length||!a.length)throw new Error('Embedding dimensions differ');
  let dot=0,aa=0,bb=0;
  for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}
  return aa&&bb?Math.max(-1,Math.min(1,dot/Math.sqrt(aa*bb))):0;
}
export function rankImages(query,rows){return rows.map(row=>({id:row.id,score:similarity(query,row.vector)})).sort((a,b)=>b.score-a.score);}
