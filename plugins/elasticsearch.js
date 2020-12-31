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
 * A rule of thumb to follow is that every plugin should be self-contained,
 * and initialize all of its resources before telling to Fastify that is ready to go.
 * By design, Fastify won't start listeing to incoming requests if all the registered
 * plugins have finished their loading. Fastify guarantees the loading order
 * thansk to an internal graph structure, provided by https://github.com/fastify/avvio.
 */
async function elasticsearch (fastify, opts) {
  const {
    ELASTIC_CLOUD_ID,
    ELASTIC_ADDRESS,
    ELASTIC_API_KEY
  } = fastify.config

  assert(
    ELASTIC_CLOUD_ID || ELASTIC_ADDRESS,
    'You should confiigure either ELASTIC_CLOUD_ID or ELASTIC_ADDRESS'
  )

  const client = new Client({
    ...(ELASTIC_CLOUD_ID && { cloud: { id: ELASTIC_CLOUD_ID } }),
    ...(ELASTIC_ADDRESS && { node: ELASTIC_ADDRESS }),
    auth: { apiKey: ELASTIC_API_KEY }
  })

  const indices = {
    SHORTURL: 'scurte-shortened-url'
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

  // Small utilty that we use for generating
  // the ids of our documents in Elasticsearch.
  fastify.decorate('base64', base64)

  // Often, you need to disconnect from an external service
  // when you are shutting down the application, this
  // can be done via the `onClose` hook.
  // https://www.fastify.io/docs/latest/Hooks/#onclose
  fastify.addHook('onClose', (instance, done) => {
    instance.elastic.close(done)
  })

  function base64 (str) {
    return Buffer.from(str).toString('base64')
  }
}

/**
 * Currently we need a single index where we store our redirects.
 * The following functions checks if the index exists and
 * creates it if it doesn't.
 */
async function configureIndices (client, indices) {
  const { body: exists } = await client.indices.exists({ index: indices.SHORTURL })
  if (!exists) {
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
}

export default fp(elasticsearch, {
  name: 'elasticsearch'
})
