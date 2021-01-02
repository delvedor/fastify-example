/**
 * Connects to a locally running Elasticsearch instance
 * and generates and ApiKey.
 */

import { Client } from '@elastic/elasticsearch'

const client = new Client({
  node: 'http://localhost:9200',
  auth: {
    username: 'elastic',
    password: 'changeme'
  }
})

async function generateApiKeys () {
  const { body } = await client.security.createApiKey({
    body: {
      name: 'app',
      role_descriptors: {
        'fastify-app-users': {
          cluster: ['monitor'],
          index: [{
            names: ['fastify-app-*'],
            privileges: ['all']
          }]
        }
      }
    }
  })

  return Buffer.from(`${body.id}:${body.api_key}`).toString('base64')
}

generateApiKeys()
  .then(apiKey => {
    console.log(JSON.stringify({ address: 'http://localhost:9200', apiKey }, null, 2))
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })
