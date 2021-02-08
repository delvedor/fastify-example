import Fastify from 'fastify'
import fp from 'fastify-plugin'
import Mock from '@elastic/elasticsearch-mock'
import App from '../app.js'

// We need to load the env configuration
process.env.NODE_ENV = 'development'
process.env.ELASTIC_ADDRESS = 'http://localhost:9200'
process.env.ELASTIC_API_KEY = '<api-key>'
process.env.GITHUB_APP_ID = '<app-id>'
process.env.GITHUB_APP_SECRET = '<app-secret>'
process.env.COOKIE_SECRET = '<cookie-secret>'
process.env.ALLOWED_USERS = 'foo@bar.com'

export async function build (t, opts = {}) {
  const app = Fastify()
  // Currently we are always relying on the Mock being present
  // in our tests, an improvement would be to test against a local
  // living instance of Elasticsearch, but for the sake of simplicity
  // of the demo we will always use a mock.
  if (!opts.elasticMock) {
    opts.elasticMock = buildElasticMock()
  }
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
