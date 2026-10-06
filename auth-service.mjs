import { randomBytes, randomUUID, scrypt, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const derive = promisify(scrypt);
const options = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const digest = token => createHash('sha256').update(token).digest('hex');
export class AuthError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await derive(password, salt, 64, options);
  return `${salt}:${key.toString('hex')}`;
}
export async function verifyPassword(password, encoded) {
  const [salt, hash] = encoded.split(':');
  const key = await derive(password, salt, 64, options);
  const expected = Buffer.from(hash, 'hex');
  return expected.length === key.length && timingSafeEqual(expected, key);
}
const publicUser = u => ({ id: u.id, name: u.name, email: u.email });
export class Accounts {
  constructor(store) { this.store = store; }
  async init() { this.dummyHash = await hashPassword(randomBytes(32).toString('hex')); }
  async session(user, remember = true) {
    const token = randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + (remember ? 30 : 1) * 86400000);
    await this.store.addSession(digest(token), user.id, expires);
    return { user: publicUser(user), token, expiresAt: expires.toISOString() };
  }
  async register(data) {
    const name = typeof data.username === 'string' ? data.username.trim() : '';
    const email = typeof data.email === 'string' ? data.email.trim().toLowerCase() : '';
    if (!/^[a-zA-Z0-9_.-]{3,32}$/.test(name)) throw new AuthError(400, 'ชื่อผู้ใช้ต้องมี 3–32 ตัว ใช้ภาษาอังกฤษ ตัวเลข จุด ขีด หรือขีดล่าง');
    if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new AuthError(400, 'กรุณากรอกอีเมลให้ถูกต้อง');
    if (typeof data.password !== 'string' || data.password.length < 10 || data.password.length > 128) throw new AuthError(400, 'รหัสผ่านต้องมี 10–128 ตัวอักษร');
    const user = { id: randomUUID(), name, email, password_hash: await hashPassword(data.password) };
    try { await this.store.createUser(user); }
    catch (e) { if (e.code === '23505') throw new AuthError(409, 'ชื่อผู้ใช้หรืออีเมลนี้มีบัญชีแล้ว กรุณาเข้าสู่ระบบ'); throw e; }
    return this.session(user, data.remember !== false);
  }
  async login(data) {
    if (typeof data.identifier !== 'string' || data.identifier.length > 254 || typeof data.password !== 'string' || data.password.length > 128) throw new AuthError(400, 'กรุณากรอกอีเมลหรือชื่อผู้ใช้และรหัสผ่าน');
    const user = await this.store.findUser(data.identifier.trim().toLowerCase());
    if (user?.locked_until && new Date(user.locked_until) > new Date()) throw new AuthError(429, 'ลองรหัสผ่านผิดหลายครั้ง กรุณารอ 5 นาทีแล้วลองใหม่');
    const correct = await verifyPassword(data.password, user?.password_hash || this.dummyHash);
    if (!user || !correct) {
      if (user) await this.store.failLogin(user.id);
      throw new AuthError(401, 'ชื่อผู้ใช้ อีเมล หรือรหัสผ่านไม่ถูกต้อง');
    }
    await this.store.clearFailures(user.id);
    return this.session(user, data.remember !== false);
  }
  async me(token) {
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new AuthError(401, 'กรุณาเข้าสู่ระบบ');
    const user = await this.store.sessionUser(digest(token));
    if (!user) throw new AuthError(401, 'การเข้าสู่ระบบหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง');
    return publicUser(user);
  }
  async logout(token) {
    if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) await this.store.deleteSession(digest(token));
  }
}
