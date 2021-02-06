import Piscina from 'fastify-piscina'
import { join } from 'desm'
import UpdateCount from './update-count.js'

/**
 * Finally, the core feature of this application, the redirect!
 * Normally if a url shortener doesn't find a matching source,
 * it will return a 404. To make it more interesting, we'll use
 * the full text search capabilities of Elasticsearch and try to
 * suggest a url to he user in case of a typo (à la Google).
 * Wait! Let's do something more, the UI that will suggest alternative
 * urls or show the 404 page will be server rendered wth Svelte (https://svelte.dev/).
 * As you saw in the Elasticsearch plugin, a good rule of thumb is that
 * every plugin should be self-contained, reason why we are registering
 * the an additonal plugin here and not in the global plugins folder.
 */
export default async function short (fastify, opts) {
  const {
    elastic,
    indices
  } = fastify

  // Server side rendering has a rather big issue in Node.js.
  // Most of the times is synchronous, which means that while
  // we generate the html page, the server won't be able to handle new requests.
  // To solve this annoying issue, we can use a super cool feature
  // of Node.js, worker threads! (https://nodejs.org/api/worker_threads.html)
  // Handling worker threads is not trivial, so we will use an amazing
  // library, Piscina! (https://github.com/piscinajs/piscina)
  // Piscina can be integrated with Fastify via the `fastify-piscina` plugin.
  fastify.register(Piscina, {
    filename: join(import.meta.url, 'worker.cjs')
  })

  fastify.register(UpdateCount)

  // Let's add two decorators that we'll need only here
  // to handle the html response generation.
  fastify.decorateReply('noMatches', noMatches)
  fastify.decorateReply('suggest', suggest)

  // catch all route to handle the redirects
  // the only reserved route is `/_app`
  fastify.route({
    method: 'GET',
    path: '/*',
    handler: onGetUrl
  })

  async function onGetUrl (req, reply) {
    const source = req.params['*']
    if (source === '') {
      return reply.redirect('https://github.com/delvedor/fastify-example')
    }

    const { body: result } = await elastic.search({
      index: indices.SHORTURL,
      body: {
        query: {
          // match runs a full-text query
          match: {
            source: {
              query: source,
              // fuzziness will help us detect typos
              fuzziness: 'AUTO'
            }
          }
        }
      }
    })

    if (result.hits.total.value === 0) {
      return reply.noMatches()
    }

    const { _source: firstMatch } = result.hits.hits[0]
    if (firstMatch.source !== source) {
      const suggestions = result.hits.hits
        // a url can also be excluded from suggestions
        .filter(url => !url._source.isPrivate)
        .map(url => url._source)
      return suggestions.length > 0
        ? reply.suggest(suggestions)
        : reply.noMatches()
    }

    // let's update the click count!
    this.updateCount(firstMatch.source)

    return reply.redirect(firstMatch.destination)
  }

  async function noMatches () {
    // `.runTask` is a decorator added by `fastify-piscina`
    const html = await fastify.runTask([])
    // `this` is the reply object
    this.code(404)
    // Don't forget to set the content type,
    // otherwise the browser won't be able to
    // render the page.
    this.type('text/html')
    return html
  }

  async function suggest (suggestions) {
    const html = await fastify.runTask(suggestions)
    this.code(404).type('text/html')
    return html
  }
}
