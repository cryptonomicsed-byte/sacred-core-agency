import type { FastifyInstance } from 'fastify'
import crypto from 'node:crypto'
import { supabaseAdmin, getUserById, signJwt } from '../services/supabaseAdmin.js'

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}
function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = (stored || '').split(':')
  if (!salt || !hash) return false
  const test = crypto.scryptSync(password, salt, 64).toString('hex')
  try { return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(test, 'hex')) } catch { return false }
}

export async function authRoutes(server: FastifyInstance) {
  // Local signup (replaces Supabase auth) — issues our own JWT.
  server.post('/signup', async (request, reply) => {
    const { email, password, name } = (request.body || {}) as { email?: string; password?: string; name?: string }
    if (!email || !password) return reply.code(400).send({ error: 'Email and password required' })
    const { data: existing } = await supabaseAdmin.from('users').select('*').eq('email', email).limit(1)
    if (existing && existing.length) return reply.code(409).send({ error: 'Account already exists' })
    const id = crypto.randomUUID()
    const user = { id, email, name: name || email.split('@')[0], credits: 100, tier: 'pro' }
    const { error } = await supabaseAdmin.from('users').insert({ ...user, password_hash: hashPassword(password) })
    if (error) return reply.code(500).send({ error: error.message })
    return { data: { token: signJwt({ sub: id, email }), user } }
  })

  // Local login — issues our own JWT.
  server.post('/login', async (request, reply) => {
    const { email, password } = (request.body || {}) as { email?: string; password?: string }
    if (!email || !password) return reply.code(400).send({ error: 'Email and password required' })
    const { data: rows } = await supabaseAdmin.from('users').select('*').eq('email', email).limit(1)
    const user = rows && rows[0]
    if (!user || !verifyPassword(password, user.password_hash)) {
      return reply.code(401).send({ error: 'Invalid credentials' })
    }
    const { password_hash, ...publicUser } = user
    return { data: { token: signJwt({ sub: user.id, email }), user: publicUser } }
  })

  // Get current user profile from our token
  server.post('/me', async (request, reply) => {
    const authHeader = request.headers.authorization
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }
    const token = authHeader.slice(7)
    const { data: { user: authUser }, error } = await supabaseAdmin.auth.getUser(token)
    if (error || !authUser) {
      return reply.code(401).send({ error: 'Invalid token' })
    }
    const profile = await getUserById(authUser.id)
    if (!profile) {
      return reply.code(404).send({ error: 'User profile not found' })
    }
    const { password_hash, ...safe } = profile as any
    return { data: safe }
  })
}
