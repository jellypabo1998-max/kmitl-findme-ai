"""Train a local image classifier; select regularization using validation only.

Run with the exported Roboflow folder dataset as the first argument.
Test images are used only after classifier selection. No hosted inference calls.
"""
import sys, json, hashlib, time
from pathlib import Path
from collections import Counter
import numpy as np
import torch
from PIL import Image
from torch import nn
from torchvision import models, transforms
from torch.utils.data import Dataset, DataLoader
from sklearn.linear_model import LogisticRegression
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

torch.set_num_threads(4)
torch.manual_seed(42)
np.random.seed(42)
root=Path(sys.argv[1])
project=Path(__file__).resolve().parent
out=project/'models'
(project/'training').mkdir(exist_ok=True)
out.mkdir(exist_ok=True)
labels=['Bag','Bottle','Calculator','Glasses','Key','Laptop','Phone','Wallet','Watch']
category={'Key':'Keys','Calculator':'Other','Watch':'Other'}
transform=transforms.Compose([transforms.Resize((224,224)),transforms.ToTensor(),transforms.Normalize([.485,.456,.406],[.229,.224,.225])])
rows={}
seen={}
removed=[]
# Prefer test, then validation when an identical decoded photo crosses splits.
for split in ['test','valid','train']:
    rows[split]=[]
    for label in labels:
        for p in sorted((root/split/label).glob('*')):
            if p.suffix.lower() not in ['.jpg','.jpeg','.png','.webp']:continue
            with Image.open(p) as im:
                rgb=im.convert('RGB')
                digest=hashlib.sha256(str(rgb.size).encode()+rgb.tobytes()).hexdigest()
            if digest in seen:
                removed.append({'removed':str(p.relative_to(root)),'retained':seen[digest]});continue
            seen[digest]=str(p.relative_to(root))
            rows[split].append((p,labels.index(label)))
class Photos(Dataset):
    def __init__(self,split):self.rows=rows[split]
    def __len__(self):return len(self.rows)
    def __getitem__(self,i):
        p,y=self.rows[i]
        with Image.open(p) as im:return transform(im.convert('RGB')),y
backbone=models.mobilenet_v3_large(weights=models.MobileNet_V3_Large_Weights.DEFAULT)
backbone.classifier=nn.Identity()
backbone.eval()
def features(split):
    cache=out.parent/'training'/f'{split}_features.npz'
    # Cache applies to this one fixed dataset and preprocessing only.
    if cache.exists():
        a=np.load(cache);return a['x'],a['y']
    xs=[];ys=[];start=time.time()
    with torch.inference_mode():
        for i,(x,y) in enumerate(DataLoader(Photos(split),batch_size=32,num_workers=0)):
            xs.append(backbone(x).numpy());ys.append(y.numpy())
            if i%5==0:print(f'{split}: {min((i+1)*32,len(rows[split]))}/{len(rows[split])}, {time.time()-start:.1f}s',flush=True)
    x=np.concatenate(xs);y=np.concatenate(ys);np.savez(cache,x=x,y=y)
    return x,y
x,y=features('train');v,vy=features('valid')
scaler=StandardScaler().fit(x)
sx=scaler.transform(x);sv=scaler.transform(v)
best=None;trials=[]
for c in [.01,.1,1,10]:
    clf=LogisticRegression(C=c,max_iter=2000,random_state=42).fit(sx,y)
    score=accuracy_score(vy,clf.predict(sv));trials.append({'C':c,'validationAccuracy':float(score)})
    print('Validation',c,score,flush=True)
    if best is None or score>best[0]:best=(score,clf,c)
_,clf,c=best
head=nn.Linear(960,len(labels))
weight=clf.coef_/scaler.scale_[None,:]
bias=clf.intercept_-weight@scaler.mean_
with torch.no_grad():head.weight.copy_(torch.tensor(weight,dtype=torch.float32));head.bias.copy_(torch.tensor(bias,dtype=torch.float32))
network=nn.Sequential(backbone,head).eval()
torch.save(network.state_dict(),out.parent/'training'/'browser_checkpoint.pt')
torch.onnx.export(network,torch.zeros(1,3,224,224),str(out/'findme-mobilenet.onnx'),input_names=['image'],output_names=['logits'],opset_version=17,dynamo=False)
# Final evaluation after choosing C and exporting the deployment model.
tx,ty=features('test');pred=clf.predict(scaler.transform(tx))
test=accuracy_score(ty,pred)
print('FINAL TEST',test,len(ty),flush=True)
import onnxruntime as ort
session=ort.InferenceSession(str(out/'findme-mobilenet.onnx'),providers=['CPUExecutionProvider'])
sample,_=Photos('test')[0]
with torch.inference_mode():native=network(sample.unsqueeze(0)).numpy()
exported=session.run(None,{'image':sample.unsqueeze(0).numpy()})[0]
assert np.allclose(native,exported,atol=1e-4,rtol=1e-4),'Export parity failure'
report={'architecture':'MobileNetV3-Large ImageNet feature extractor + trained multinomial logistic classifier','source':'Roboflow pa-j/lost-found-pfak5 version 2','inputSize':224,'normalization':{'mean':[.485,.456,.406],'std':[.229,.224,.225]},'labels':labels,'categoryMap':{l:category.get(l,l) for l in labels},'excludedClasses':['Earphone','ID Card','Umbrella'],'splitCounts':{s:dict(Counter(labels[y] for _,y in r)) for s,r in rows.items()},'duplicateRemovals':removed,'validationTrials':trials,'selectedC':c,'testAccuracy':float(test),'testCorrect':int((pred==ty).sum()),'testCount':len(ty),'perClass':classification_report(ty,pred,target_names=labels,output_dict=True,zero_division=0),'confusionMatrix':confusion_matrix(ty,pred).tolist(),'exportMaxLogitDifference':float(np.max(np.abs(native-exported))),'limitations':['Exported images were already stretched to 224x224.','Exact decoded duplicates removed; near-duplicates may remain.','Dataset accuracy does not guarantee accuracy on new real-world photos.','Excluded classes and unfamiliar objects can still be classified as a supported class.']}
(out/'training-report.json').write_text(json.dumps(report,indent=2))
(out/'labels.json').write_text(json.dumps({'model':'findme-browser-mobilenet-v1','labels':labels,'categoryMap':report['categoryMap'],'inputSize':224,'mean':[.485,.456,.406],'std':[.229,.224,.225]},indent=2))
print('Export complete', (out/'findme-mobilenet.onnx').stat().st_size,flush=True)
