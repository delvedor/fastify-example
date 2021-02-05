import { readFileSync } from 'fs'
import { join } from 'desm'
import fp from 'fastify-plugin'
import Swagger from 'fastify-swagger'

const { version } = JSON.parse(readFileSync(join(import.meta.url, '../package.json')))

async function swaggerGenerator (fastify, opts) {
  // Swagger documentation generator for Fastify.
  // It uses the schemas you declare in your routes to generate a swagger compliant doc.
  // https://github.com/fastify/fastify-swagger
  fastify.register(Swagger, {
    routePrefix: '/documentation',
    swagger: {
      info: {
        title: 'Fastify URL Shortener',
        description: 'Fastify URL Shortener documentation',
        version
      },
      externalDocs: {
        url: 'https://github.com/delvedor/fastify-example',
        description: 'Find more info here'
      },
      host: 'localhost', // and your deployed url
      schemes: ['http', 'https'],
      consumes: ['application/json'],
      produces: ['application/json', 'text/html'],
      securityDefinitions: {
        Bearer: {
          type: 'apiKey',
          name: 'Bearer',
          in: 'header'
        },
        Csrf: {
          type: 'apiKey',
          name: 'x-csrf-token',
          in: 'header'
        }
      }
    },
    // let's expose the documentation only in development
    // it's up to you decide who should see this page,
    // but it's alwaysx better to start safe.
    exposeRoute: fastify.config.NODE_ENV !== 'production'
  })
}

export default fp(swaggerGenerator, {
  name: 'swaggerGenerator'
})
