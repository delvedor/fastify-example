import S from 'fluent-json-schema'

export const autoPrefix = '/_scurte'
export default async function admin (fastify, opts) {
  const {
    httpErrors,
    elastic,
    indices,
    isValidUrl,
    isUserAllowed,
    authorize,
    csrfProtection
  } = fastify

  fastify.route({
    method: 'GET',
    path: '/login/github/callback',
    handler: onLoginCallback
  })

  async function onLoginCallback (req, reply) {
    const token = await this.github.getAccessTokenFromAuthorizationCodeFlow(req)
    await isUserAllowed(token.access_token)

    reply.setCookie('user_session', token.access_token, {
      secure: this.config.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: true,
      path: '/_scurte',
      signed: true,
      maxAge: 604800, // one week in seconds
      expires: new Date(Date.now() + 604800 * 1000)
    })

    return reply.redirect(autoPrefix)
  }

  fastify.route({
    method: 'GET',
    path: '/refresh',
    onRequest: authorize,
    schema: {
      response: {
        200: S.object().prop('csrfToken', S.string())
      }
    },
    handler: onRefresh
  })

  async function onRefresh (req, reply) {
    const csrfToken = await reply.generateCsrf()
    return { csrfToken }
  }

  fastify.route({
    method: 'PUT',
    path: '/redirect',
    onRequest: [authorize, csrfProtection],
    schema: {
      body: S.object()
        .prop('source', S.string().required())
        .prop('destination', S.string().required())
        .prop('isPrivate', S.boolean().default(false)),
      response: {
        201: S.object().prop('created', S.boolean())
      }
    },
    handler: onAddRedirect
  })

  async function onAddRedirect (req, reply) {
    const { source, destination, isPrivate } = req.body

    isValidSource(source)
    if (!(await isValidUrl(destination))) {
      throw httpErrors.badRequest('The destination is not a valid url')
    }

    const { statusCode } = await elastic.create({
      index: indices.SHORTURL,
      id: base64(source),
      refresh: 'wait_for',
      body: { source, destination, isPrivate, count: 0, user: req.user.mail }
    }, { ignore: [409] })

    if (statusCode === 409) {
      throw httpErrors.conflict('The source already exists')
    }

    reply.code(201)
    return { created: true }
  }

  fastify.route({
    method: 'POST',
    path: '/redirect',
    onRequest: [authorize, csrfProtection],
    schema: {
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
      id: base64(source),
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

  fastify.route({
    method: 'DELETE',
    path: '/redirect',
    onRequest: [authorize, csrfProtection],
    schema: {
      body: S.object()
        .prop('source', S.string().required()),
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
      id: base64(source),
      refresh: 'wait_for'
    }, { ignore: [404] })

    if (statusCode === 404) {
      throw httpErrors.notFound(`The source ${source} does not exists`)
    }

    return { deleted: true }
  }

  fastify.route({
    method: 'GET',
    path: '/redirects',
    onRequest: [authorize, csrfProtection],
    schema: {
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
        }
      }
    })

    return {
      count: result.hits.total.value,
      redirects: result.hits.hits.map(entry => entry._source)
    }
  }

  function isValidSource (source) {
    const noSlashSource = source.replace(/\//g, '')
    if (encodeURIComponent(noSlashSource) !== noSlashSource) {
      throw httpErrors.badRequest('The source contains unsafe url characters')
    }
    if (source.split('/')[0] === '_scurte') {
      throw httpErrors.badRequest('The source cannot contain the private string "_scurte"')
    }
  }

  function base64 (str) {
    return Buffer.from(str).toString('base64')
  }
}
