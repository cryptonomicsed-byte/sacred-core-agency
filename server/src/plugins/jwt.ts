import type { FastifyInstance } from 'fastify'
import jwt from '@fastify/jwt'

export async function registerJwt(server: FastifyInstance) {
  await server.register(jwt, {
    secret: process.env.JWT_SECRET!,
  })
}
