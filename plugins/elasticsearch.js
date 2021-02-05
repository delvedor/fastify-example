import assert from 'assert'
import fp from 'fastify-plugin'
import { Client } from '@elastic/elasticsearch'

/**
 * A tipical usage of a plugin, is to expose an external service,
 * such as a database. In this case we are exposing the Elasticsearch client
 * since the application uses elasticsearch as main datastore.
 * As you will see, inside this plugin we are not only exposing the
 * Elasticsearch instance, but also initializing the necessary indices.
 *
 * Protip: A rule of thumb to follow is that every plugin should be self-contained,
 * and initialize all of its resources before telling to Fastify that is ready to go.
 * By design, Fastify won't start listeing to incoming requests if all the registered
 * plugins have finished their loading. Fastify guarantees the loading order
 * thanks to an internal graph structure, provided by https://github.com/fastify/avvio.
 */
async function elasticsearch (fastify, opts) {
  const {
    ELASTIC_CLOUD_ID,
    ELASTIC_ADDRESS,
    ELASTIC_API_KEY
  } = fastify.config

  assert(
    ELASTIC_CLOUD_ID || ELASTIC_ADDRESS,
    'You should configure either ELASTIC_CLOUD_ID or ELASTIC_ADDRESS'
  )

  const client = new Client({
    ...(ELASTIC_CLOUD_ID && { cloud: { id: ELASTIC_CLOUD_ID } }),
    ...(ELASTIC_ADDRESS && { node: ELASTIC_ADDRESS }),
    auth: { apiKey: ELASTIC_API_KEY },
    ...(opts.elasticMock && { Connection: opts.elasticMock.getConnection() })
  })

  const indices = {
    SHORTURL: 'fastify-app-shortened-url',
    // The rate limit index contains all the ip addresses the users that
    // sed a request to the application. Given that this index can grown
    // in size very quickly, a good approach would be to create a new index daily
    // and configure Elasticsearch to delete the old ones with an ILM policy.
    // See https://www.elastic.co/guide/en/elasticsearch/reference/current/index-lifecycle-management.html
    RATELIMIT: 'fastify-app-rate-limit'
  }

  // We ping the cluster before telling to Fastfy
  // that the plugin is ready. If the ping operation
  // fails, the plugin will throw an exception and the
  // application won't start.
  await client.ping()
  await configureIndices(client, indices)

  // We expose the Elasticsearch client instance
  // with a decorator, so it can be accessed later
  // with `fastify.elastic`.
  fastify.decorate('elastic', client)

  // We expose the indices names as well.
  // Those are exposed in an object, so if we
  // need to change an index name, there is no
  // need to update the entire application.
  fastify.decorate('indices', indices)

  // Often, you need to disconnect from an external service
  // when you are shutting down the application, this
  // can be done via the `onClose` hook.
  // https://www.fastify.io/docs/latest/Hooks/#onclose
  // A cool feature of the onClose hook is that as opposed to
  // every other hook, which are executed in a FIFO fashion,
  // onClose is executed in LIFO.
  // This guarantees that your onClose code depending
  // on other onClose will be executed first,
  // avoiding annoying ordering issues.
  fastify.addHook('onClose', (instance, done) => {
    instance.elastic.close(done)
  })
}

/**
 * Currently we need a single index where we store our redirects.
 * The following functions checks if the index exists and
 * creates it if it doesn't.
 */
async function configureIndices (client, indices) {
  let result = await client.indices.exists({ index: indices.SHORTURL })
  if (!result.body) {
    await client.indices.create({
      index: indices.SHORTURL,
      body: {
        mappings: {
          properties: {
            // the short url
            source: {
              type: 'text',
              // source is defined a text, which cannot be sorted by Elasticsearch.
              // To solve this we used the multi-fields feaure:
              // https://www.elastic.co/guide/en/elasticsearch/reference/current/multi-fields.html
              fields: {
                raw: { type: 'keyword' }
              }
            },
            // the destination of the short url
            destination: { type: 'text' },
            // should the source appear in the 404 suggestions?
            isPrivate: { type: 'boolean' },
            // how many times a shot url has been used
            count: { type: 'integer' },
            // who has created the short url
            user: { type: 'keyword' },
            // creation timestamp
            created: { type: 'date' }
          }
        }
      }
    })
  }

  result = await client.indices.exists({ index: indices.RATELIMIT })
  if (!result.body) {
    await client.indices.create({
      index: indices.RATELIMIT,
      body: {
        mappings: {
          properties: {
            // request count
            current: { type: 'integer' },
            // time to live of the request count
            ttl: { type: 'date' }
          }
        }
      }
    })
  }
}

export default fp(elasticsearch, {
  name: 'elasticsearch'
})
