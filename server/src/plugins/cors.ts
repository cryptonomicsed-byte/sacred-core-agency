import type { FastifyInstance } from 'fastify'
import cors from '@fastify/cors'

export async function registerCors(server: FastifyInstance) {
  await server.register(cors, {
    origin: ['http://localhost:3001'],
    credentials: true,
  })
}
