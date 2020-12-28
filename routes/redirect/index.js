import Piscina from 'fastify-piscina'
import { join } from 'desm'

export default async function short (fastify, opts) {
  const { elastic, indices } = fastify

  fastify.register(Piscina, {
    filename: join(import.meta.url, 'worker.cjs')
  })

  fastify.decorateReply('noMatches', noMatches)
  fastify.decorateReply('suggest', suggest)

  fastify.route({
    method: 'GET',
    path: '/*',
    handler: onGetUrl
  })

  async function onGetUrl (req, reply) {
    const source = req.params['*']
    const { body: result } = await elastic.search({
      index: indices.SHORTURL,
      body: {
        query: {
          match: {
            source: {
              query: source,
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
        .filter(url => !url._source.isPrivate)
        .map(url => url._source)
      return suggestions.length > 0
        ? reply.suggest(suggestions)
        : reply.noMatches()
    }

    return reply.redirect(firstMatch.destination)
  }

  async function noMatches () {
    const html = await fastify.runTask([])
    this.code(404).type('text/html')
    return html
  }

  async function suggest (suggestions) {
    const html = await fastify.runTask(suggestions)
    this.code(404).type('text/html')
    return html
  }
}
