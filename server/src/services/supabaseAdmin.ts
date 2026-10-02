// SQLite-backed drop-in replacement for the Supabase admin client.
// Implements the subset of the supabase-js query builder that this server uses:
//   from(t).select(cols).eq(c,v).order(c,{ascending}).limit(n).single()
//   from(t).insert(obj|obj[]).select()      from(t).update(obj).eq(c,v)
//   from(t).delete().eq(c,v)
//   auth.getUser(token)  (verifies our own JWT)     storage.from(b).getPublicUrl(p)
// Rows are stored as JSON in a single table so no per-table schema is needed.
import Database from 'better-sqlite3'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { User } from '../types/index.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.F5_DB_PATH || path.join(__dirname, '../../data/f5.db')
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true })
const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.exec(`CREATE TABLE IF NOT EXISTS rows (t TEXT NOT NULL, id TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY (t,id))`)

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret'

function b64url(buf: Buffer) { return buf.toString('base64').replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_') }
function verifyJwt(token: string): any | null {
  try {
    const [h, p, s] = token.split('.')
    if (!h || !p || !s) return null
    const expected = b64url(crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest())
    if (expected !== s) return null
    const payload = JSON.parse(Buffer.from(p.replace(/-/g,'+').replace(/_/g,'/'), 'base64').toString())
    if (payload.exp && Date.now() / 1000 > payload.exp) return null
    return payload
  } catch { return null }
}
export function signJwt(payload: Record<string, any>): string {
  const h = b64url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })))
  const body = { iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000) + 60*60*24*7, ...payload }
  const p = b64url(Buffer.from(JSON.stringify(body)))
  const s = b64url(crypto.createHmac('sha256', JWT_SECRET).update(`${h}.${p}`).digest())
  return `${h}.${p}.${s}`
}

type Filter = { col: string; val: any }
class Query {
  private filters: Filter[] = []
  private _order?: { col: string; asc: boolean }
  private _limit?: number
  private _single = false
  private returning = false
  constructor(private t: string, private op: 'select'|'insert'|'update'|'delete', private payload?: any) {}

  select(_cols?: string) { if (this.op === 'insert' || this.op === 'update') this.returning = true; return this }
  eq(col: string, val: any) { this.filters.push({ col, val }); return this }
  order(col: string, opts?: { ascending?: boolean }) { this._order = { col, asc: opts?.ascending !== false }; return this }
  limit(n: number) { this._limit = n; return this }
  single() { this._single = true; return this }

  private all(): any[] {
    const rows = db.prepare('SELECT id, data FROM rows WHERE t = ?').all(this.t) as any[]
    return rows.map(r => ({ ...JSON.parse(r.data), id: JSON.parse(r.data).id ?? r.id, __key: r.id }))
  }
  private matches(row: any) {
    return this.filters.every(f => String(row[f.col]) === String(f.val))
  }
  private run() {
    try {
      if (this.op === 'select') {
        let rows = this.all().filter(r => this.matches(r))
        if (this._order) rows.sort((a,b) => {
          const av=a[this._order!.col], bv=b[this._order!.col]
          return (av>bv?1:av<bv?-1:0) * (this._order!.asc?1:-1)
        })
        if (this._limit) rows = rows.slice(0, this._limit)
        rows = rows.map(({__key, ...rest}) => rest)
        return this._single ? { data: rows[0] ?? null, error: rows[0] ? null : { code: 'PGRST116', message: 'no rows' } }
                            : { data: rows, error: null }
      }
      if (this.op === 'insert') {
        const items = Array.isArray(this.payload) ? this.payload : [this.payload]
        const ins = db.prepare('INSERT OR REPLACE INTO rows (t,id,data) VALUES (?,?,?)')
        const out = items.map((o:any) => {
          const id = o.id || crypto.randomUUID()
          const row = { ...o, id, created_at: o.created_at || new Date().toISOString() }
          ins.run(this.t, id, JSON.stringify(row))
          return row
        })
        return this.returning ? { data: out, error: null } : { data: null, error: null }
      }
      if (this.op === 'update') {
        const upd = db.prepare('UPDATE rows SET data = ? WHERE t = ? AND id = ?')
        const changed: any[] = []
        for (const r of this.all().filter(r => this.matches(r))) {
          const merged = { ...r, ...this.payload }
          delete merged.__key
          upd.run(JSON.stringify(merged), this.t, r.__key)
          changed.push(merged)
        }
        return this.returning ? { data: changed, error: null } : { data: null, error: null }
      }
      // delete
      const del = db.prepare('DELETE FROM rows WHERE t = ? AND id = ?')
      for (const r of this.all().filter(r => this.matches(r))) del.run(this.t, r.__key)
      return { data: null, error: null }
    } catch (e: any) {
      return { data: null, error: { message: e?.message || String(e) } }
    }
  }
  // thenable so `await builder` works
  then(resolve: (v: any) => any, reject?: (e: any) => any) { return Promise.resolve(this.run()).then(resolve, reject) }
}

export const supabaseAdmin: any = {
  from: (t: string) => ({
    select: (c?: string) => new Query(t, 'select').select(c),
    insert: (p: any)  => new Query(t, 'insert', p),
    update: (p: any)  => new Query(t, 'update', p),
    delete: ()        => new Query(t, 'delete'),
  }),
  auth: {
    async getUser(token: string) {
      const payload = verifyJwt(token)
      if (!payload?.sub) return { data: { user: null }, error: { message: 'Invalid token' } }
      return { data: { user: { id: payload.sub, email: payload.email } }, error: null }
    },
  },
  storage: {
    from: (_bucket: string) => ({ getPublicUrl: (p: string) => ({ data: { publicUrl: `/media/${p}` } }) }),
  },
}

export async function getUserById(userId: string): Promise<User | null> {
  const { data, error } = await supabaseAdmin.from('users').select('*').eq('id', userId).single()
  if (error || !data) return null
  return data as User
}

export async function updateUserCredits(userId: string, newBalance: number): Promise<void> {
  const { error } = await supabaseAdmin.from('users').update({ credits: newBalance }).eq('id', userId)
  if (error) throw error
}

export async function logCreditTransaction(userId: string, action: string, creditsUsed: number, balanceAfter: number): Promise<void> {
  const { error } = await supabaseAdmin.from('credit_transactions').insert({
    user_id: userId, action, credits_used: creditsUsed, balance_after: balanceAfter,
  })
  if (error) throw error
}
