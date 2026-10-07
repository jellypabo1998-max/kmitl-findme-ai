import {randomUUID} from 'node:crypto';
import {AuthError} from './auth-service.mjs';
const categories=new Set(['Keys','Wallet','Phone','Bag','Bottle','Glasses','Laptop','Other']);
export function validateContact(data) {
  const method=data?.contactMethod, value=String(data?.contactValue||'').trim();
  if(data?.contactConsent!==true)throw new AuthError(400,'กรุณายอมรับการแสดงช่องทางติดต่อเฉพาะผู้ที่คุณยืนยันแล้ว');
  const valid=method==='line'?/^[a-zA-Z0-9._-]{1,40}$/.test(value):method==='phone'?/^\+?[0-9]{8,15}$/.test(value.replace(/[ -]/g,'')):method==='email'?/^[^\s@<>]{1,64}@[^\s@<>]{1,189}\.[^\s@<>]{2,20}$/.test(value):false;
  if(!valid)throw new AuthError(400,'กรุณากรอก LINE ID เบอร์โทร หรืออีเมลให้ถูกต้อง');
  return {contactMethod:method,contactValue:value};
}
export function validateReport(data) {
  if(!data||typeof data!=='object'||Array.isArray(data))throw new AuthError(400,'ข้อมูลไม่ถูกต้อง');
  const contact=validateContact(data), text=(name,max)=>{const v=String(data[name]||'').trim();if(!v||v.length>max)throw new AuthError(400,'กรุณากรอกข้อมูลรายงานให้ครบและไม่ยาวเกินไป');return v;};
  const lat=Number(data.latitude),lng=Number(data.longitude);
  if(data.latitude===''||data.longitude===''||data.latitude==null||data.longitude==null||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)throw new AuthError(400,'กรุณาปักหมุดให้ถูกต้อง');
  if(!['lost','found'].includes(data.kind)||!categories.has(data.category))throw new AuthError(400,'หมวดหรือประเภทรายงานไม่ถูกต้อง');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(data.date||'')||!Number.isFinite(Date.parse(data.date+'T00:00:00Z'))||new Date(data.date+'T00:00:00Z').toISOString().slice(0,10)!==data.date)throw new AuthError(400,'วันที่ไม่ถูกต้อง');
  if(data.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time))throw new AuthError(400,'เวลาไม่ถูกต้อง');
  const photo=data.photo||'';
  if(photo){if(typeof photo!=='string'||photo.length>550000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(photo))throw new AuthError(400,'รูปไม่ถูกต้องหรือใหญ่เกินไป');const b=Buffer.from(photo.split(',')[1],'base64');if(b.length>400000||b[0]!==255||b[1]!==216||b[2]!==255)throw new AuthError(400,'รูปไม่ถูกต้อง');}
  return {itemName:text('itemName',120),description:text('description',2000),location:text('location',160),category:data.category,kind:data.kind,date:data.date,time:data.time||'',latitude:lat,longitude:lng,photo,...contact,status:data.kind==='lost'?'Searching':'Submitted'};
}
export class Reports {
  constructor(pool){this.pool=pool;}
  async init(){await this.pool.query(`CREATE TABLE IF NOT EXISTS findme_reports(id uuid PRIMARY KEY,owner_id uuid NOT NULL REFERENCES findme_users(id) ON DELETE CASCADE,client_key varchar(100) NOT NULL,payload jsonb NOT NULL,status varchar(20) NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),UNIQUE(owner_id,client_key)); CREATE TABLE IF NOT EXISTS findme_claims(id uuid PRIMARY KEY,report_id uuid NOT NULL REFERENCES findme_reports(id) ON DELETE CASCADE,requester_id uuid NOT NULL REFERENCES findme_users(id) ON DELETE CASCADE,evidence text NOT NULL,status varchar(20) NOT NULL DEFAULT 'Pending',created_at timestamptz NOT NULL DEFAULT now(),UNIQUE(report_id,requester_id)); CREATE INDEX IF NOT EXISTS findme_reports_owner ON findme_reports(owner_id);`);}
  row(row,userId){const payload={...row.payload};const allowed=row.owner_id===userId||row.contact_allowed===true;if(!allowed){delete payload.contactValue;delete payload.contactMethod;}return {...payload,contactUnlocked:allowed,id:row.id,status:row.status,createdAt:row.created_at,isCloud:true,isOwner:row.owner_id===userId,reporterName:row.reporter_name};}
  async list(user,mine=false){const r=await this.pool.query(`SELECT r.*,u.name AS reporter_name,EXISTS(SELECT 1 FROM findme_claims c WHERE c.report_id=r.id AND c.requester_id=$1 AND c.status='Approved') AS contact_allowed FROM findme_reports r JOIN findme_users u ON u.id=r.owner_id WHERE ${mine?'r.owner_id=$1':"r.status<>'Returned'"} ORDER BY r.created_at DESC LIMIT 100`,[user.id]);return r.rows.map(r=>this.row(r,user.id));}
  async claims(user){const r=await this.pool.query(`SELECT c.id,c.report_id,c.evidence,c.status,c.created_at,u.name AS requester_name,r.payload->>'itemName' AS item_name,(r.owner_id=$1) AS can_review FROM findme_claims c JOIN findme_reports r ON r.id=c.report_id JOIN findme_users u ON u.id=c.requester_id WHERE r.owner_id=$1 OR c.requester_id=$1 ORDER BY c.created_at DESC LIMIT 100`,[user.id]);return r.rows;}
  async claim(user,id,data){const evidence=String(data.evidence||'').trim();if(evidence.length<10||evidence.length>1500)throw new AuthError(400,'บอกจุดสังเกตหรือหลักฐาน 10–1500 ตัวอักษร');const r=await this.pool.query(`INSERT INTO findme_claims(id,report_id,requester_id,evidence) SELECT $1,id,$3,$4 FROM findme_reports WHERE id=$2 AND owner_id<>$3 AND status<>'Returned' ON CONFLICT(report_id,requester_id) DO NOTHING RETURNING id`,[randomUUID(),id,user.id,evidence]);if(!r.rows.length)throw new AuthError(409,'ส่งคำขอไว้แล้ว หรือรายงานนี้ไม่เปิดรับคำขอ');return {submitted:true};}
  async review(user,id,data){if(!['Approved','Rejected'].includes(data.status))throw new AuthError(400,'สถานะไม่ถูกต้อง');const r=await this.pool.query(`UPDATE findme_claims c SET status=$1 FROM findme_reports r WHERE c.id=$2 AND r.id=c.report_id AND r.owner_id=$3 RETURNING c.id`,[data.status,id,user.id]);if(!r.rows.length)throw new AuthError(404,'ไม่พบคำขอในรายงานของคุณ');return {updated:true};}
  async create(user,data){const report=validateReport(data),key=String(data.clientKey||randomUUID());if(!/^[a-zA-Z0-9_-]{1,100}$/.test(key))throw new AuthError(400,'รหัสรายงานไม่ถูกต้อง');
    // A retry with the same key returns the original report instead of publishing twice.
    const r=await this.pool.query(`INSERT INTO findme_reports(id,owner_id,client_key,payload,status) VALUES($1,$2,$3,$4,$5) ON CONFLICT(owner_id,client_key) DO UPDATE SET client_key=EXCLUDED.client_key RETURNING *`,[randomUUID(),user.id,key,JSON.stringify(report),report.status]);return this.row({...r.rows[0],reporter_name:user.name},user.id);}
  async contact(user,id,data){const contact=validateContact(data);const r=await this.pool.query('UPDATE findme_reports SET payload=payload || $1::jsonb,updated_at=now() WHERE id=$2 AND owner_id=$3 RETURNING *',[JSON.stringify(contact),id,user.id]);if(!r.rows.length)throw new AuthError(404,'ไม่พบรายงานของคุณ');return this.row({...r.rows[0],reporter_name:user.name},user.id);}
  async status(user,id,status){if(!['Returned','Searching','Submitted'].includes(status))throw new AuthError(400,'สถานะไม่ถูกต้อง');const r=await this.pool.query(`UPDATE findme_reports SET status=$1,updated_at=now() WHERE id=$2 AND owner_id=$3 AND ($1='Returned' OR ($1='Searching' AND payload->>'kind'='lost') OR ($1='Submitted' AND payload->>'kind'='found')) RETURNING *`,[status,id,user.id]);if(!r.rows.length)throw new AuthError(404,'ไม่พบรายงานของคุณ');return this.row({...r.rows[0],reporter_name:user.name},user.id);}
}
