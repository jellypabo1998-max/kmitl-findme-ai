# ใช้โมเดลเพื่อนโดยไม่เรียก Roboflow Cloud

ชุดนี้ใช้โมเดล AI Lost & Found เวอร์ชัน 1 ที่เพื่อนเทรนแล้ว ไม่เทรนใหม่
เว็บเรียก `/infer/classification` บน Roboflow Inference ที่รันในเครื่องเรา
ไม่มีการย้อนกลับไปใช้ Serverless Cloud API หากเครื่องเราล่ม
Roboflow ระบุว่า inference บนฮาร์ดแวร์ของเราไม่ใช้เครดิต แต่ยังต้องมี API key
เพื่อดาวน์โหลด/เข้าถึงโมเดลที่เทรนไว้ และต้องเชื่อมอินเทอร์เน็ตตอนเริ่มต้น
https://github.com/roboflow/inference

## เปิดบนคอม Windows / Mac / Linux

1. ติดตั้ง Docker Desktop จากเว็บทางการ (Linux ใช้ Docker Engine + Compose)
2. แตก ZIP แล้วเปิด Terminal ในโฟลเดอร์ที่มี `selfhost.compose.yaml`
3. คัดลอก `selfhost.env.example` เป็น `.env`
4. ใส่ ROBOFLOW_API_KEY ของ workspace Jupiter AI Project ในไฟล์ `.env` บนคอมเอง
   ไม่ส่ง key ในแชต ไม่อัปโหลด `.env` ไป GitHub
5. ใส่ POSTGRES_PASSWORD เป็นรหัสยาวใช้ตัวอักษรอังกฤษและตัวเลข
6. รัน `docker compose -f selfhost.compose.yaml up -d --build`
7. เปิด http://localhost:10000 สมัครบัญชีทดสอบ แล้วแจ้งของพร้อมรูป
8. เปิด Home → ค้นหาด้วยรูป เลือกรูป และเลือกให้โมเดลเพื่อนทายหมวด
   ครั้งแรกต้องโหลดโมเดล อาจใช้เวลาสักครู่ หากยังไม่พร้อมให้ลองอีกครั้ง
9. หยุดด้วย `docker compose -f selfhost.compose.yaml stop`
   เปิดอีกครั้งด้วย `docker compose -f selfhost.compose.yaml up -d`

นี่คือฐานบัญชีทดสอบแยกจากเว็บจริง ไม่มีการย้าย/ลบบัญชีเดิม
รายงานยังเก็บในเบราว์เซอร์ของเครื่องนั้น ไม่มีการย้ายข้อมูลเดิมอัตโนมัติ
ไม่ใช้คำสั่ง `down -v` เพราะจะลบฐานข้อมูลและโมเดลที่แคชไว้

## ให้เว็บ GitHub Pages เดิมเรียกโมเดลนี้

ต้องมีเครื่องรันเปิดอยู่ และช่องทาง HTTPS จาก Render ไปยังตัวรัน AI
ชุดทดสอบนี้เปิดเฉพาะ localhost เพื่อไม่เปิด API/ฐานข้อมูลให้บุคคลภายนอก
ยังไม่มี URL HTTPS สาธารณะให้เว็บเดิมเรียกใช้งาน
การเปิดให้ใช้บนมือถือ/iPad ผ่านเว็บจริงต้องตั้งช่องทางนี้ให้เสร็จก่อน
อย่าเปิดพอร์ต 9001 หรือฐานข้อมูลออกอินเทอร์เน็ตโดยตรง
ไม่ต้องย้ายระบบล็อกอินเดิม และไม่ต้องใส่ API key ใน HTML/JS ฝั่งผู้ใช้

## สถานะการตรวจสอบ

ทดสอบ Node: validation, authentication เดิม, รูปแบบคำขอ self-hosted,
การบล็อก Cloud URL, ไม่ redirect และไม่มี Cloud fallback
ยังไม่ได้รันโมเดลเพื่อนจริง เพราะต้องตั้ง API key และมีเครื่อง Docker ก่อน
สภาพแวดล้อมผู้ช่วยไม่มี Docker จึงยังไม่ทดสอบ build/container จริง
ยังไม่รับประกันว่า Render Free จะรันโมเดล ViT และ dependency ทั้งชุดไหว
ไม่มีการสมัครบริการเสียเงินหรือใช้เครดิต Roboflow ในการเตรียมชุดนี้
