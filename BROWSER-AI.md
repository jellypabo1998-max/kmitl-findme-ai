# FindMe browser AI

New MobileNetV3-Large ImageNet feature extractor with a multinomial classifier trained on the supplied Roboflow folder export. This is a newly trained model, not the original hosted Roboflow weights.

Run inference using Report Found or ai-test.html. Photos stay in the browser for classification; submitting a report separately uploads its photo. No Roboflow inference requests or credits. First use downloads approximately 24 MB (model plus WASM runtime); later reuse depends on browser caching. Hosting/network availability and device memory still matter.

Held-out dataset result: 134/138 correct, 97.1%. Selection used validation only. Exact decoded duplicates were removed across splits; near duplicates may remain. This result does not guarantee new-photo accuracy. Ten fixed samples on model-check.html verify browser execution, not a fresh accuracy benchmark. Teacher testing should use new photos and ai-test.html. Confidence is not measured accuracy.

Classes: Bag, Bottle, Calculator, Glasses, Key, Laptop, Phone, Wallet, Watch. Key maps to Keys; Calculator and Watch map to Other. Earphone excluded. No ID Card or Umbrella. Unknown/excluded objects can still receive a supported label; check category before submitting.

Reproduce with Python, torch, torchvision, numpy, Pillow, scikit-learn, onnx and onnxruntime: `python train_browser.py /path/to/dataset`. Training downloads official ImageNet weights initially; no Roboflow credits. Remove training/*_features.npz before changing the dataset. Outputs are models/*. First deploy copies those outputs to the website root. See training-report.json for counts, confusion matrix and export parity. Runtime: onnxruntime-web 1.23.2, single-thread WASM; license: onnxruntime-LICENSE.txt.
