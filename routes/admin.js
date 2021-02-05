import S from 'fluent-json-schema'

export const autoPrefix = '/_app'

/**
 * This plugin contains all the CRUD operations needed
 * to make the url shortener work.
 * It also exposes a `/refresh` route to get the csrf token
 * that should be sent to every other API.
 */
export default async function admin (fastify, opts) {
  const {
    httpErrors,
    elastic,
    indices,
    isValidUrl,
    authorize,
    csrfProtection
  } = fastify

  // Every route inside this plugin should be protected
  // by our authorization logic. The easiest way to do it,
  // is by adding an hook that runs our authorization code.
  // You should always run your authorization as soon as possible
  // in the request/response lifecycle!
  fastify.addHook('onRequest', authorize)

  // The frontend needs the CSRF token to be able to
  // communicate with the others API. This route returns
  // a token for every authenticated request.
  fastify.route({
    method: 'GET',
    path: '/refresh',
    schema: {
      description: 'Route used by the frontend app to validate the session' +
                   ' and retrieve the CSRF token.',
      response: {
        200: S.object().prop('csrfToken', S.string())
      }
    },
    handler: onRefresh
  })

  async function onRefresh (req, reply) {
    // `.generateCsrf` is a decorator added by `fastify-csrf`
    // It adds an additional cookie to the response with the csrf secret, it returns the csrf token.
    // Don't know what CSRF is? Take a look at https://github.com/pillarjs/understanding-csrf.
    const csrfToken = await reply.generateCsrf()
    return { csrfToken }
  }

  // Creates a new redirect.
  // It returns an error if it already exists.
  fastify.route({
    method: 'PUT',
    path: '/redirect',
    // We don't need to rate limit most of the admin APIs,
    // as those are already protected by authentication.
    // You can also choose to have a specific rate limit configuration
    // on a per-route basis, for example:
    // ```js
    // config: {
    //   rateLimit: {
    //     max: 100,
    //     timeWindow: '1 minute'
    //   }
    // }
    // ```
    config: { rateLimit: false },
    // This route should be protected also against CSRF attacks,
    // so we add an additional hook, `csrfProtection`, which is provided
    // by `fastify-csrf`, to check the CSRF secret and token.
    // The hooks are always executed in order of declaration, which means
    // that the authorization will be executed before the CSRF check.
    onRequest: csrfProtection,
    schema: {
      description: 'Adds a new redirect',
      // We do expect a body from the frontend which contains everything
      // we need to create a new redirect. Here we define how the body
      // should look like, so we can trust it once we start working
      // with it in our route handler. This is not the right place for
      // checking user permission tho, that should be done with an hook.
      // (`preValidation` should do the job)
      body: S.object()
        .prop('source', S.string().required())
        .prop('destination', S.string().required())
        .prop('isPrivate', S.boolean().default(false)), // you can also specify default values!
      response: {
        201: S.object().prop('created', S.boolean())
      }
    },
    handler: onAddRedirect
  })

  async function onAddRedirect (req, reply) {
    // We know that this properties are defied and
    // valid thank to the validation defined above!
    const { source, destination, isPrivate } = req.body

    // Logging is hard. Fastify comes with an integrated logger, already configured
    // to have the minimum overhead and logs by default incoming request and outgoing
    // responses. You can correlate different logs via their request id.
    // https://www.fastify.io/docs/latest/Logging/
    // A good question you can ask yourself is: "how much should I log?".
    // Is not an easy answer, it dependes on how many information you want
    // to know per each request, but remember that the more you log the more
    // you pay in terms of storage.
    // If you want to send your logs to Elasticsearch, consider using
    // https://www.elastic.co/guide/en/ecs-logging/nodejs/current/pino.html
    // For shipping your logs, you can either use https://github.com/pinojs/pino-elasticsearch
    // or https://www.elastic.co/beats/filebeat.
    req.log.info(`Adding new redirect from user ${req.user.mail}`)

    isValidSource(source)
    if (!(await isValidUrl(destination))) {
      throw httpErrors.badRequest('The destination is not a valid url')
    }

    const { statusCode } = await elastic.create({
      index: indices.SHORTURL,
      id: source,
      // refresh? https://www.elastic.co/guide/en/elasticsearch/reference/current/docs-refresh.html
      refresh: 'wait_for',
      body: {
        source,
        destination,
        isPrivate,
        created: new Date(),
        count: 0,
        // `req.user` is a decorator added by the authorization plugin
        // and populated by the authorize hook
        user: req.user.mail
      }
    }, {
      // ignore is a cool option of the Elasticsearch client,
      // it tell to the client not to throw in case of the specified
      // error, so you can handle it easily without the need of a try catch block.
      ignore: [409]
    })

    if (statusCode === 409) {
      throw httpErrors.conflict('The source already exists')
    }

    // Hey! we created a new resource, let's use
    // the appropriate status code. And rememeber
    // to configure the response schema as well.
    reply.code(201)
    return { created: true }
  }

  // Updates an existing redirect.
  // It returns an error if it does not exists.
  fastify.route({
    method: 'POST',
    path: '/redirect',
    config: { rateLimit: false },
    onRequest: csrfProtection,
    schema: {
      description: 'Updates an existing redirect',
      body: S.object()
        .prop('source', S.string().required())
        .prop('destination', S.string().required())
        .prop('isPrivate', S.boolean().default(false)),
      response: {
        200: S.object().prop('updated', S.boolean())
      }
    },
    handler: onEditRedirect
  })

  async function onEditRedirect (req, reply) {
    const { source, destination, isPrivate } = req.body

    isValidSource(source)
    if (!(await isValidUrl(destination))) {
      throw httpErrors.badRequest('The destination is not a valid url')
    }

    const { statusCode } = await elastic.update({
      index: indices.SHORTURL,
      id: source,
      refresh: 'wait_for',
      body: {
        doc: { source, destination, isPrivate }
      }
    }, { ignore: [404] })

    if (statusCode === 404) {
      throw httpErrors.notFound(`There is no destination with source ${source}`)
    }

    return { updated: true }
  }

  // Removes an existing redirect.
  // It returns an error if it does not exists.
  fastify.route({
    method: 'DELETE',
    path: '/redirect',
    config: { rateLimit: false },
    onRequest: csrfProtection,
    schema: {
      description: 'Removes an existing redirect',
      body: S.object().prop('source', S.string().required()),
      response: {
        200: S.object().prop('deleted', S.boolean())
      }
    },
    handler: onDeleteRedirect
  })

  async function onDeleteRedirect (req, reply) {
    const { source } = req.body
    isValidSource(source)

    const { statusCode } = await elastic.delete({
      index: indices.SHORTURL,
      id: source,
      refresh: 'wait_for'
    }, { ignore: [404] })

    if (statusCode === 404) {
      throw httpErrors.notFound(`The source ${source} does not exists`)
    }

    return { deleted: true }
  }

  // Get all the redirects defined by the current user.
  fastify.route({
    method: 'GET',
    path: '/redirects',
    config: { rateLimit: false },
    onRequest: csrfProtection,
    schema: {
      description: 'Get all the redirects defined by the current user.',
      // Note that the schema describes how the object will look
      // like in your code and not how the user sent it.
      // The query can be accessed via `request.query` and it's represented
      // by an object. The same can apply if a request body is encoded
      // in `application/x-www-form-urlencoded`.
      query: S.object()
        .prop('from', S.integer().minimum(0).default(0))
        .prop('size', S.integer().minimum(0).default(10)),
      response: {
        200: S.object()
          .prop('count', S.integer())
          .prop('redirects', S.array().items(
            S.object()
              .prop('source', S.string())
              .prop('destination', S.string())
              .prop('isPrivate', S.boolean())
              .prop('count', S.integer())
              .prop('created', S.string())
          ))
      }
    },
    handler: onGetRedirects
  })

  async function onGetRedirects (req, reply) {
    const { from, size } = req.query
    const { body: result } = await elastic.search({
      index: indices.SHORTURL,
      body: {
        from,
        size,
        query: {
          term: { user: req.user.mail }
        },
        // source is defined a text, which cannot be sorted by Elasticsearch.
        // To solve this we used the multi-fields feaure:
        // https://www.elastic.co/guide/en/elasticsearch/reference/current/multi-fields.html
        sort: 'source.raw'
      }
    })

    return {
      count: result.hits.total.value,
      redirects: result.hits.hits.map(entry => entry._source)
    }
  }

  function isValidSource (source) {
    // TODO: this check might not be needed
    const noSlashSource = source.replace(/\//g, '')
    if (encodeURIComponent(noSlashSource) !== noSlashSource) {
      throw httpErrors.badRequest('The source contains unsafe url characters')
    }
    if (source.split('/')[1] === '_app') {
      throw httpErrors.badRequest('The source cannot contain the private string "_app"')
    }
  }
}
