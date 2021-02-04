import Fastify from 'fastify'
import fp from 'fastify-plugin'
import { join } from 'desm'
import dotenv from 'dotenv'
import Mock from '@elastic/elasticsearch-mock'
import App from '../app.js'

// We need to load the env configuration
dotenv.config({ path: join(import.meta.url, '..', '.env') })

export async function build (t, opts = {}) {
  const app = Fastify()
  await app.register(fp(App), { testing: true, ...opts })

  t.tearDown(app.close.bind(app))

  return app
}

// Mocking is a double edged sword, it makes very easy
// writing test, but it could also lead to false positives
// as often you only test for the successful case.
// This does not mean that mocks should be avoided altogether,
// but it might make sense to mix it with real database tests.
// https://github.com/elastic/elasticsearch-js-mock
export function buildElasticMock () {
  const mock = new Mock()

  // Mock the 'ping' method
  mock.add({
    method: 'HEAD',
    path: '/'
  }, () => {
    return ''
  })

  // Mock the 'indices.create' method
  mock.add({
    method: 'PUT',
    path: '/:name'
  }, () => {
    return { acknowledged: true }
  })

  // Mock the 'indices.exists' method
  mock.add({
    method: 'HEAD',
    path: '/:name'
  }, () => {
    return ''
  })

  return mock
}
