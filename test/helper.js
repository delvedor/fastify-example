import Fastify from 'fastify'
import fp from 'fastify-plugin'
import App from '../app.js'

export function build (t) {
  const app = Fastify()
  app.register(fp(App))

  t.tearDown(app.close.bind(app))

  return app
}
