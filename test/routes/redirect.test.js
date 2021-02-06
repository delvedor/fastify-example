import t from 'tap'
import { build, buildElasticMock } from '../helper.js'

t.test('Valid redirect', async t => {
  const mock = buildElasticMock()
  const fastify = await build(t, { elasticMock: mock })

  mock.add({
    method: 'POST',
    path: `/${fastify.indices.SHORTURL}/_search`
  }, params => {
    t.deepEqual(params.body, {
      query: {
        match: {
          source: {
            query: 'foo',
            fuzziness: 'AUTO'
          }
        }
      }
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

  mock.add({
    method: 'POST',
    path: '/_bulk'
  }, params => {
    t.match(params.body, [{
      update: {
        _index: fastify.indices.SHORTURL,
        _id: 'foo'
      }
    }, {
      script: {
        lang: 'painless',
        source: 'ctx._source.count += 1'
      }
    }])
    return { errors: false, items: [] }
  })

  const response = await fastify.inject({
    method: 'GET',
    path: '/foo'
  })

  t.strictEqual(response.statusCode, 302)
  t.strictEqual(response.headers.location, 'https://fastify.io')

  await fastify.close() // this will trigger a flush in the bulk updater
})

t.test('Suggest redirect', async t => {
  const mock = buildElasticMock()
  const fastify = await build(t, { elasticMock: mock })

  mock.add({
    method: 'POST',
    path: `/${fastify.indices.SHORTURL}/_search`
  }, params => {
    t.deepEqual(params.body, {
      query: {
        match: {
          source: {
            query: 'foo',
            fuzziness: 'AUTO'
          }
        }
      }
    })
    return {
      hits: {
        total: { value: 1 },
        hits: [{
          _source: {
            source: 'for',
            destination: 'https://fastify.io',
            isPrivate: false,
            count: 42
          }
        }]
      }
    }
  })

  const response = await fastify.inject({
    method: 'GET',
    path: '/foo'
  })

  t.strictEqual(response.statusCode, 404)
  t.strictEqual(response.headers['content-type'], 'text/html')
  t.true(response.payload.includes('<a class="is-size-5" href="https://fastify.io">for</a>'))
})

t.test('No matches', async t => {
  const mock = buildElasticMock()
  const fastify = await build(t, { elasticMock: mock })

  mock.add({
    method: 'POST',
    path: `/${fastify.indices.SHORTURL}/_search`
  }, params => {
    t.deepEqual(params.body, {
      query: {
        match: {
          source: {
            query: 'foo',
            fuzziness: 'AUTO'
          }
        }
      }
    })
    return {
      hits: {
        total: { value: 0 },
        hits: []
      }
    }
  })

  const response = await fastify.inject({
    method: 'GET',
    path: '/foo'
  })

  t.strictEqual(response.statusCode, 404)
  t.strictEqual(response.headers['content-type'], 'text/html')
  t.true(response.payload.includes('<h3 class="title is-3">Short url not found 😱</h3>'))
})
