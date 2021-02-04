import t from 'tap'
import cookieSignature from 'cookie-signature'
import { errors } from '@elastic/elasticsearch'
import { build, buildElasticMock } from '../helper.js'

// When opening the application the first thing that happens
// is a call to `/refresh`, to figure out if the user is logged
// or not and also to retrieve the CSRF token/secret.
t.test('Refresh csrf token', async t => {
  const fastify = await build(t)

  const response = await fastify.inject({
    method: 'GET',
    path: '/_app/refresh',
    cookies: {
      user_session: cookieSignature.sign('token', fastify.config.COOKIE_SECRET)
    }
  })

  // Once we get back che response, we run our assertions
  // to verify that we got back the response that we were expecting.
  t.strictEqual(response.statusCode, 200)
  // We can't know the value of the csrf token,
  // so we only verify its presence and type.
  t.type(response.json().csrfToken, 'string')
  t.match(response.cookies, [{ name: '_csrf' }])
})

t.test('User not allowed', async t => {
  const fastify = await build(t)

  const response = await fastify.inject({
    method: 'GET',
    path: '/_app/refresh',
    cookies: {
      user_session: cookieSignature.sign('invalid', fastify.config.COOKIE_SECRET)
    }
  })

  t.strictEqual(response.statusCode, 403)
})

// Now let's test what happens when a new redirect is added.
// We are going to use the Elasticsearch mocking utility so we
// can verify the payload sent to Elasticsearch as well.
t.test('Add a new redirect (201)', async t => {
  const mock = buildElasticMock()
  const fastify = await build(t, { elasticMock: mock })

  // define the elasticsearch endpoint that
  // handles a new document creation
  mock.add({
    method: 'PUT',
    path: `/${fastify.indices.SHORTURL}/_create/foo`
  }, params => {
    t.match(params.body, {
      source: 'foo',
      destination: 'https://fastify.io',
      isPrivate: false,
      count: 0,
      user: fastify.config.ALLOWED_USERS.split(',')[0]
    })
    return { result: 'created' }
  })

  const { token, secret } = await getCsrfToken(fastify)
  // We define every time the entire http call, with
  // all the necessary headers a configuration, no shortcuts.
  // In this way we make sure that our security works
  // and we don't leave unwanted "backdoors" around.
  const response = await fastify.inject({
    method: 'PUT',
    path: '/_app/redirect',
    headers: {
      // pass the csrf token
      'x-csrf-token': token
    },
    cookies: {
      // the user session cookie
      user_session: cookieSignature.sign('token', process.env.COOKIE_SECRET),
      // the csrf secret
      _csrf: secret
    },
    payload: {
      source: 'foo',
      destination: 'https://fastify.io',
      isPrivate: false
    }
  })

  t.strictEqual(response.statusCode, 201)
  t.deepEqual(response.json(), { created: true })
})

// Now let's test what happens when a new redirect is added,
// but it already exists. With the Elasticsearch mocking library
// we can also trigger response errors.
t.test('Add a new redirect (409)', async t => {
  const mock = buildElasticMock()
  const fastify = await build(t, { elasticMock: mock })

  // define the elasticsearch endpoint that
  // handles a new document creation
  mock.add({
    method: 'PUT',
    path: `/${fastify.indices.SHORTURL}/_create/foo`
  }, params => {
    // instead of returning a successful response,
    // let's return a response error
    return new errors.ResponseError({
      body: { errors: {}, status: 409 },
      statusCode: 409
    })
  })

  const { token, secret } = await getCsrfToken(fastify)
  const response = await fastify.inject({
    method: 'PUT',
    path: '/_app/redirect',
    headers: {
      // pass the csrf token
      'x-csrf-token': token
    },
    cookies: {
      // the user session cookie
      user_session: cookieSignature.sign('token', process.env.COOKIE_SECRET),
      // the csrf secret
      _csrf: secret
    },
    payload: {
      source: 'foo',
      destination: 'https://fastify.io',
      isPrivate: false
    }
  })

  t.strictEqual(response.statusCode, 409)
  t.deepEqual(response.json(), {
    error: 'Conflict',
    message: 'The source already exists',
    statusCode: 409
  })
})

// Writing test is important!! While writing this test I've noticed
// that the source validity check was broken, even if it looked ok!
// No type definition would have saved you from this.
t.test('Add a new redirect (400 - bad source)', async t => {
  const mock = buildElasticMock()
  const fastify = await build(t, { elasticMock: mock })

  const { token, secret } = await getCsrfToken(fastify)
  const response = await fastify.inject({
    method: 'PUT',
    path: '/_app/redirect',
    headers: {
      // pass the csrf token
      'x-csrf-token': token
    },
    cookies: {
      // the user session cookie
      user_session: cookieSignature.sign('token', process.env.COOKIE_SECRET),
      // the csrf secret
      _csrf: secret
    },
    payload: {
      source: '/_app/foo',
      destination: 'https://fastify.io',
      isPrivate: false
    }
  })

  t.strictEqual(response.statusCode, 400)
  t.deepEqual(response.json(), {
    error: 'Bad Request',
    message: 'The source cannot contain the private string "_app"',
    statusCode: 400
  })
})

t.test('Add a new redirect (400 - bad destination)', async t => {
  const mock = buildElasticMock()
  const fastify = await build(t, { elasticMock: mock })

  const { token, secret } = await getCsrfToken(fastify)
  const response = await fastify.inject({
    method: 'PUT',
    path: '/_app/redirect',
    headers: {
      // pass the csrf token
      'x-csrf-token': token
    },
    cookies: {
      // the user session cookie
      user_session: cookieSignature.sign('token', process.env.COOKIE_SECRET),
      // the csrf secret
      _csrf: secret
    },
    payload: {
      source: 'foo',
      destination: 'http://foobar.bar/',
      isPrivate: false
    }
  })

  t.strictEqual(response.statusCode, 400)
  t.deepEqual(response.json(), {
    error: 'Bad Request',
    message: 'The destination is not a valid url',
    statusCode: 400
  })
})

t.test('Update a redirect (200)', async t => {
  const mock = buildElasticMock()
  const fastify = await build(t, { elasticMock: mock })

  // define the elasticsearch endpoint that
  // handles a new document creation
  mock.add({
    method: 'POST',
    path: `/${fastify.indices.SHORTURL}/_update/foo`
  }, params => {
    t.match(params.body, {
      doc: {
        source: 'foo',
        destination: 'https://fastify.io',
        isPrivate: false
      }
    })
    return { result: 'updated' }
  })

  const { token, secret } = await getCsrfToken(fastify)
  const response = await fastify.inject({
    method: 'POST',
    path: '/_app/redirect',
    headers: {
      // pass the csrf token
      'x-csrf-token': token
    },
    cookies: {
      // the user session cookie
      user_session: cookieSignature.sign('token', process.env.COOKIE_SECRET),
      // the csrf secret
      _csrf: secret
    },
    payload: {
      source: 'foo',
      destination: 'https://fastify.io',
      isPrivate: false
    }
  })

  t.strictEqual(response.statusCode, 200)
  t.deepEqual(response.json(), { updated: true })
})

t.test('Update a redirect (404)', async t => {
  const mock = buildElasticMock()
  const fastify = await build(t, { elasticMock: mock })

  // define the elasticsearch endpoint that
  // handles a new document creation
  mock.add({
    method: 'POST',
    path: `/${fastify.indices.SHORTURL}/_update/foo`
  }, params => {
    return new errors.ResponseError({
      body: { errors: {}, status: 404 },
      statusCode: 404
    })
  })

  const { token, secret } = await getCsrfToken(fastify)
  const response = await fastify.inject({
    method: 'POST',
    path: '/_app/redirect',
    headers: {
      // pass the csrf token
      'x-csrf-token': token
    },
    cookies: {
      // the user session cookie
      user_session: cookieSignature.sign('token', process.env.COOKIE_SECRET),
      // the csrf secret
      _csrf: secret
    },
    payload: {
      source: 'foo',
      destination: 'https://fastify.io',
      isPrivate: false
    }
  })

  t.strictEqual(response.statusCode, 404)
  t.deepEqual(response.json(), {
    error: 'Not Found',
    message: 'There is no destination with source foo',
    statusCode: 404
  })
})

t.test('Delete a redirect (200)', async t => {
  const mock = buildElasticMock()
  const fastify = await build(t, { elasticMock: mock })

  // define the elasticsearch endpoint that
  // handles a new document creation
  mock.add({
    method: 'DELETE',
    path: `/${fastify.indices.SHORTURL}/_doc/foo`
  }, () => {
    return { result: 'deleted' }
  })

  const { token, secret } = await getCsrfToken(fastify)
  const response = await fastify.inject({
    method: 'DELETE',
    path: '/_app/redirect',
    headers: {
      // pass the csrf token
      'x-csrf-token': token
    },
    cookies: {
      // the user session cookie
      user_session: cookieSignature.sign('token', process.env.COOKIE_SECRET),
      // the csrf secret
      _csrf: secret
    },
    payload: {
      source: 'foo'
    }
  })

  t.strictEqual(response.statusCode, 200)
  t.deepEqual(response.json(), { deleted: true })
})

t.test('Delete a redirect (404)', async t => {
  const mock = buildElasticMock()
  const fastify = await build(t, { elasticMock: mock })

  // define the elasticsearch endpoint that
  // handles a new document creation
  mock.add({
    method: 'DELETE',
    path: `/${fastify.indices.SHORTURL}/_doc/foo`
  }, () => {
    return new errors.ResponseError({
      body: { errors: {}, status: 404 },
      statusCode: 404
    })
  })

  const { token, secret } = await getCsrfToken(fastify)
  const response = await fastify.inject({
    method: 'DELETE',
    path: '/_app/redirect',
    headers: {
      // pass the csrf token
      'x-csrf-token': token
    },
    cookies: {
      // the user session cookie
      user_session: cookieSignature.sign('token', process.env.COOKIE_SECRET),
      // the csrf secret
      _csrf: secret
    },
    payload: {
      source: 'foo'
    }
  })

  t.strictEqual(response.statusCode, 404)
  t.deepEqual(response.json(), {
    error: 'Not Found',
    message: 'The source foo does not exists',
    statusCode: 404
  })
})

t.test('Get all user defined redirects', async t => {
  const mock = buildElasticMock()
  const fastify = await build(t, { elasticMock: mock })

  // define the elasticsearch endpoint that
  // handles a new document creation
  mock.add({
    method: 'POST',
    path: `/${fastify.indices.SHORTURL}/_search`
  }, params => {
    t.deepEqual(params.body, {
      from: 0,
      size: 10,
      query: {
        term: { user: fastify.config.ALLOWED_USERS.split(',')[0] }
      },
      sort: 'source.raw'
    })
    return {
      hits: {
        total: { value: 1 },
        hits: [{
          _source: {
            source: 'foo',
            destination: 'https://fastify.io',
            isPrivate: false,
            count: 42
          }
        }]
      }
    }
  })

  const { token, secret } = await getCsrfToken(fastify)
  const response = await fastify.inject({
    method: 'GET',
    path: '/_app/redirects',
    headers: {
      // pass the csrf token
      'x-csrf-token': token
    },
    cookies: {
      // the user session cookie
      user_session: cookieSignature.sign('token', process.env.COOKIE_SECRET),
      // the csrf secret
      _csrf: secret
    }
  })

  t.strictEqual(response.statusCode, 200)
  t.deepEqual(response.json(), {
    count: 1,
    redirects: [{
      source: 'foo',
      destination: 'https://fastify.io',
      isPrivate: false,
      count: 42
    }]
  })
})

async function getCsrfToken (fastify) {
  const response = await fastify.inject({
    method: 'GET',
    path: '/_app/refresh',
    cookies: {
      user_session: cookieSignature.sign('token', fastify.config.COOKIE_SECRET)
    }
  })
  return { token: response.json().csrfToken, secret: response.cookies[0].value }
}
