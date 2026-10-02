import type { FastifyInstance } from 'fastify'
import helmet from '@fastify/helmet'

export async function registerHelmet(server: FastifyInstance) {
  await server.register(helmet)
}
