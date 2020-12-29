import { readFileSync } from 'fs'
import S from 'fluent-json-schema'
import { join } from 'desm'

const { version } = JSON.parse(readFileSync(join(import.meta.url, '../package.json')))

export const autoPrefix = '/_scurte'
export default async function status (fastify, opts) {
  fastify.route({
    method: 'GET',
    path: '/status',
    handler: onStatus,
    schema: {
      response: {
        200: S.object()
          .prop('status', S.string())
          .prop('version', S.string())
      }
    }
  })

  async function onStatus (req, reply) {
    return { status: 'ok', version }
  }
}
