import AutoLoad from 'fastify-autoload'
import Sensible from 'fastify-sensible'
import Static from 'fastify-static'
import Env from 'fastify-env'
import S from 'fluent-json-schema'
import { join } from 'desm'

export default async function (fastify, opts) {
  fastify.register(Env, {
    schema: S.object()
      .prop('ELASTIC_CLOUD_ID', S.string().required())
      .prop('ELASTIC_API_KEY', S.string().required())
      .prop('GITHUB_APP_ID', S.string().required())
      .prop('GITHUB_APP_SECRET', S.string().required())
      .prop('ALLOWED_USERS', S.string().required())
      .valueOf()
  })

  fastify.register(Sensible)

  fastify.register(Static, {
    root: join(import.meta.url, 'public'),
    prefix: '/_scurte/public'
  })

  fastify.register(AutoLoad, {
    dir: join(import.meta.url, 'plugins'),
    options: Object.assign({}, opts)
  })

  fastify.register(AutoLoad, {
    dir: join(import.meta.url, 'routes'),
    dirNameRoutePrefix: false,
    options: Object.assign({}, opts)
  })
}
