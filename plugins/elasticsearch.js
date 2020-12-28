import fp from 'fastify-plugin'
import { Client } from '@elastic/elasticsearch'

async function elasticsearch (fastify, opts) {
  const client = new Client({
    cloud: { id: fastify.config.ELASTIC_CLOUD_ID },
    auth: { apiKey: fastify.config.ELASTIC_API_KEY }
  })

  const indices = {
    SHORTURL: 'scurte-shortened-url'
  }

  await client.ping()
  await configureIndices(client, indices)

  fastify
    .decorate('elastic', client)
    .decorate('indices', indices)
    .addHook('onClose', (instance, done) => {
      instance.elastic.close(done)
    })
}

async function configureIndices (client, indices) {
  const { body: exists } = await client.indices.exists({ index: indices.SHORTURL })
  if (!exists) {
    await client.indices.create({
      index: indices.SHORTURL,
      body: {
        mappings: {
          properties: {
            source: { type: 'text' },
            destination: { type: 'text' },
            isPrivate: { type: 'boolean' },
            count: { type: 'integer' },
            user: { type: 'keyword' }
          }
        }
      }
    })
  }
}

export default fp(elasticsearch, {
  name: 'elasticsearch'
})
