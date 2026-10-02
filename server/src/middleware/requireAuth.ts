import type { FastifyRequest, FastifyReply } from 'fastify'
import { supabaseAdmin } from '../services/supabaseAdmin.js'

export interface AuthUser {
  id: string
  email: string
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const authHeader = request.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Unauthorized' })
  }

  const token = authHeader.slice(7)

  try {
    // Verify with fastify-jwt
    await request.jwtVerify()

    // Also verify with Supabase to confirm token validity
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token)

    if (error || !user) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    ;(request as FastifyRequest & { authUser: AuthUser }).authUser = {
      id: user.id,
      email: user.email!,
    }
  } catch {
    return reply.code(401).send({ error: 'Unauthorized' })
  }
}

export function getAuthUser(request: FastifyRequest): AuthUser {
  return (request as FastifyRequest & { authUser: AuthUser }).authUser
}
