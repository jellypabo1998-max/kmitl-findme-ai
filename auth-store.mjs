export class PostgresStore {
  constructor(pool) { this.pool = pool; }
  async init() {
    await this.pool.query(`CREATE TABLE IF NOT EXISTS findme_users (
      id uuid PRIMARY KEY, name varchar(32) NOT NULL, email varchar(254) NOT NULL UNIQUE,
      password_hash text NOT NULL, failed_attempts integer NOT NULL DEFAULT 0,
      locked_until timestamptz, created_at timestamptz NOT NULL DEFAULT now());
      CREATE UNIQUE INDEX IF NOT EXISTS findme_username_unique ON findme_users (lower(name));
      CREATE TABLE IF NOT EXISTS findme_sessions (
      token_hash char(64) PRIMARY KEY, user_id uuid NOT NULL REFERENCES findme_users(id) ON DELETE CASCADE,
      expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
      CREATE INDEX IF NOT EXISTS findme_sessions_user ON findme_sessions(user_id);`);
  }
  async createUser(u) { await this.pool.query('INSERT INTO findme_users(id,name,email,password_hash) VALUES ($1,$2,$3,$4)', [u.id,u.name,u.email,u.password_hash]); }
  async findUser(id) { return (await this.pool.query('SELECT * FROM findme_users WHERE lower(name)=$1 OR email=$1 LIMIT 1', [id])).rows[0]; }
  async failLogin(id) { await this.pool.query(`UPDATE findme_users SET failed_attempts=CASE WHEN locked_until<now() THEN 1 ELSE failed_attempts+1 END,
    locked_until=CASE WHEN failed_attempts>=4 AND (locked_until IS NULL OR locked_until>=now()) THEN now()+interval '5 minutes' ELSE NULL END WHERE id=$1`, [id]); }
  async clearFailures(id) { await this.pool.query('UPDATE findme_users SET failed_attempts=0,locked_until=NULL WHERE id=$1', [id]); }
  async addSession(hash,id,expiry) {
    await this.pool.query('DELETE FROM findme_sessions WHERE expires_at<now()');
    await this.pool.query('INSERT INTO findme_sessions(token_hash,user_id,expires_at) VALUES ($1,$2,$3)', [hash,id,expiry]);
    await this.pool.query('DELETE FROM findme_sessions WHERE user_id=$1 AND token_hash NOT IN (SELECT token_hash FROM findme_sessions WHERE user_id=$1 ORDER BY created_at DESC LIMIT 5)', [id]);
  }
  async sessionUser(hash) { return (await this.pool.query('SELECT u.* FROM findme_users u JOIN findme_sessions s ON s.user_id=u.id WHERE s.token_hash=$1 AND s.expires_at>now()', [hash])).rows[0]; }
  async deleteSession(hash) { await this.pool.query('DELETE FROM findme_sessions WHERE token_hash=$1', [hash]); }
}
