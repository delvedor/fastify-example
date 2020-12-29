import { join } from 'desm'
import Static from 'fastify-static'
import Cors from 'fastify-cors'
import Helmet from 'fastify-helmet'

export const autoPrefix = '/_scurte'
export default async function frontend (fastify, opts) {
  fastify.register(Cors, {
    origin: false
  })

  fastify.register(Helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        frameSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-eval'",
          'https://unpkg.com'
        ],
        fontSrc: [
          "'self'",
          'https://www.gstatic.com',
          'https://fonts.gstatic.com',
          'https://fonts.googleapis.com'
        ],
        connectSrc: [
          "'self'",
          'https://unpkg.com'
        ],
        imgSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://www.gstatic.com',
          'https://fonts.googleapis.com',
          'https://unpkg.com'
        ]
      }
    }
  })

  fastify.register(Static, {
    root: join(import.meta.url, '..', 'public'),
    prefix: '/public'
  })

  fastify.route({
    method: 'GET',
    path: '/',
    handler: onBundle
  })

  function onBundle (req, reply) {
    reply.header('X-Robots-Tag', 'noindex, nofollow')
    reply.sendFile('index.html')
  }
}
