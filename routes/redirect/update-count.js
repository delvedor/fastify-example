import fp from 'fastify-plugin'
import { Readable } from 'readable-stream'

// In some cases you might need a custom plugin only in a specific
// part of yoru application. As we saw before, every plugin that needs
// or could be shared with the entire application should live inside
// the top level `/plugins` directory. In this case since we need this
// plugin to operate only in the `/redirect` scope, we will define it here.
// As you can see, the redirect plugin lives inside a folder instead of a file,
// what is the difference? `fastify-autoload` will automatically load every file
// inside the `/routes` folder, or every folder that contains an `index.js` file.
// In this way we have just created a specifc scope for our redirect logic that
// will not be shared with other plugins of your application.
// Thanks encapsulation! :rocket:

// This plugin defines a bulk updater instance that we will use
// for updating the visit count of our redirects. You could use
// a single update db call for each redirect as well, but the
// performances will suffer a bit more.
// By using a bulk indexer we accumulate update operations and
// we flush every now and then, in a fire and forget fashion.
async function updateCount (fastify, opts) {
  const { elastic, indices } = fastify

  // To create a "infinite update loop" with the Elasticsearch
  // bulk helper you need to create a readable stream instance.
  const updateCountStream = new Readable({
    objectMode: true,
    read (size) {}
  })

  // https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/client-helpers.html#_bulk_helper
  const updateCountUpdater = elastic.helpers.bulk({
    datasource: updateCountStream,
    flushBytes: 1000000,
    flushInterval: 5000,
    onDocument (doc) {
      return [{
        update: {
          _index: indices.SHORTURL,
          _id: doc.id
        }
      }, {
        doc: undefined,
        script: {
          lang: 'painless',
          source: 'ctx._source.count += 1'
        }
      }]
    },
    onDrop (doc) {
      fastify.log.warn(doc, 'dropped redirect analytics record')
    }
  })

  updateCountUpdater.catch(err => {
    fastify.log.error(err, 'updateCountUpdater throwed an error')
    process.exit(1)
  })

  // This onClose hook will be executed before the onClose's Elasticsearch
  // hook, because onClose hooks are executed in LIFO. This guranteees us
  // that we will not lose data or see unwanted exceptions while closing.
  fastify.addHook('onClose', (instance, done) => {
    updateCountStream.push(null)
    updateCountUpdater.then(() => done())
  })

  // Writing to a stream is a sync operation
  fastify.decorate('updateCount', id => {
    updateCountStream.push({ id })
  })
}

export default fp(updateCount, {
  name: 'update-count',
  dependencies: ['elasticsearch']
})
