import { readFileSync } from 'fs'
import { join } from 'desm'
// Any testing framework is fine, but we recommend to use the ones
// that interacts as less as possible with the Node.js environment.
// If your testing framework updates or chanegs Node.js globals
// your test will not be 100% reliable and the libraries you will
// use might have some issues with it.
import t from 'tap'
import { build } from '../helper.js'

const { version } = JSON.parse(readFileSync(join(import.meta.url, '../../package.json')))

// There are two main ways you can use to test your application,
// one is to test with a running server, which means that inside
// each test you will invoke `.listen()`, or with http injection.
// Http injection allows you to call routes of your server without
// the need to have a running http server underneath.
// Http injection is a first class citizen in Fastify, and you can
// use it both in production and testing.
//
// You can read more about testing and http injection at the following url:
// https://www.fastify.io/docs/latest/Testing/

t.test('Status route', async t => {
  const fastify = await build(t)

  // The http injection feature is powered by https://github.com/fastify/light-my-request
  // and you can access it with `fastify.inject`. This method can be used with
  // both callbacks and promises, a successful result is any http response,
  // which can be a 2xx, 3xx, 4xx or 5xx, while it will return an error
  // in case of a bad configuration or if something goes wrong.
  const response = await fastify.inject({
    method: 'GET',
    path: '/_app/status'
  })

  // Once we get back che response, we run our assertions
  // to verify that we got back the response that we were expecting.
  t.strictEqual(response.statusCode, 200)
  t.deepEqual(response.json(), { status: 'ok', version })
})
