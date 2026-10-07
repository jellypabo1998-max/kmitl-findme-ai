export const categories=['Keys','Wallet','Phone','Bag','Bottle','Glasses','ID Card','Laptop','Other'];
export function scoreTrials(trials){
  const completed=trials.filter(t=>t.status==='done'&&categories.includes(t.expected)&&categories.includes(t.prediction?.category));
  const correct=completed.filter(t=>t.expected===t.prediction.category).length;
  return {completed:completed.length,correct,wrong:completed.length-correct,accuracy:completed.length?correct/completed.length*100:null,passed:trials.length===10&&completed.length===10?correct>=8:null};
}
function csvCell(value){let text=String(value??'');if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export function exportTrialsCsv(trials){
  const rows=[['Round','Image','Expected category','AI category','AI confidence (%)','Result','Model','Tested at']];
  trials.forEach((t,i)=>rows.push([i+1,t.filename,t.expected,t.prediction?.category,t.prediction?Number((t.prediction.confidence*100).toFixed(2)):'',t.status==='done'?(t.expected===t.prediction.category?'Correct':'Incorrect'):t.status==='error'?'API error':'Not tested',t.model,t.testedAt]));
  return '\uFEFF'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');
}
