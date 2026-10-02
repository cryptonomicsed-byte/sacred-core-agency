import type { FastifyInstance } from 'fastify'
import rateLimit from '@fastify/rate-limit'

export async function registerRateLimit(server: FastifyInstance) {
  await server.register(rateLimit, {
    max: 100,
    timeWindow: '15 minutes',
  })
}
