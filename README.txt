KMITL FindMe AI — Static HTML Website

นี่เป็นเว็บไซต์ HTML/CSS/JavaScript ล้วน ไม่มี Floot, Lovable, React หรือ framework

ไฟล์:
- index.html
- report-lost.html
- report-found.html
- browse.html
- matches.html
- verify.html
- my-reports.html
- style.css
- app.js

วิธีเปิด:
1) แตก ZIP
2) เปิดโฟลเดอร์ใน VS Code
3) เปิด index.html หรือใช้ Live Server

หมายเหตุ:
- สมัครสมาชิกและล็อกอินผ่าน account API ที่กำหนดใน auth-config.js
- Report form บันทึกรายงานและรูปลง localStorage ของเบราว์เซอร์เครื่องนั้น
- AI matching ยังเป็น mock
- Map ใช้ Leaflet และ OpenStreetMap พร้อมหมุดพิกัดจากรายงาน
- หน้า Browse Items: แตะหมุด แล้วแตะชื่อสิ่งของเพื่อขยายรูปและรายละเอียดในกล่องตรงหมุดเดิม กด “ย่อรายละเอียด” เพื่อหุบกลับ
- การ์ดรายการใช้ View details เพื่อเปิดรายละเอียดบนหน้าเดิม
- ปุ่มตำแหน่งปัจจุบันต้องเปิดผ่าน HTTPS และอนุญาตตำแหน่งให้เว็บไซต์
- รูป campus ในหน้าเว็บอ้างอิงรูปจากเว็บไซต์ KMITL ผ่าน URL ภายนอก

- นำหน้าค้นหาด้วยรูปที่เพิ่มแยกออกแล้ว; ใช้ Report Found และ Matches เดิม
- ลิงก์หน้าค้นหารูปเก่ากลับไปหน้า Home และไม่โหลดโมเดล CLIP/Roboflow

- Report Found ใช้ Workflow Roboflow ที่เทรนแล้วเพื่อแนะนำหมวด; AI matching เดิมยังเป็น mock
- Home → ทดสอบ AI 10 รอบ: เลือกรูปใหม่และคำตอบจริงก่อนเริ่ม ล็อกคำตอบ แล้วเปรียบเทียบ top prediction; ถูก 8/10 ผ่าน ไม่ใช้ confidence เป็นเกณฑ์
- การทดสอบเรียก API จริง ใช้เครดิต Roboflow ข้อผิดพลาด API ไม่นับเป็นคำตอบผิด และส่งออกผล CSV ได้
