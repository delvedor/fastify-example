import { readFileSync } from 'fs'
import fp from 'fastify-plugin'
import { join } from 'desm'
import OAuth from 'fastify-oauth2'
import SecureSession from 'fastify-secure-session'
import Csrf from 'fastify-csrf'
import undici from 'undici'

async function authorization (fastify, opts) {
  const { httpErrors, config } = fastify
  const allowedUsers = config.ALLOWED_USERS.split(',')

  const client = undici('https://api.github.com')

  fastify.register(OAuth, {
    name: 'github',
    credentials: {
      client: {
        id: config.GITHUB_APP_ID,
        secret: config.GITHUB_APP_SECRET
      },
      auth: OAuth.GITHUB_CONFIGURATION
    },
    startRedirectPath: '/_scurte/login/github',
    callbackUri: 'http://localhost:3000/_scurte/login/github/callback',
    scope: ['user:email']
  })

  fastify.register(SecureSession, {
    cookieName: 'scurte-session',
    key: readFileSync(join(import.meta.url, 'secret.key')),
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: true,
      path: '/_scurte'
    }
  })

  fastify.register(Csrf, {
    sessionPlugin: 'fastify-secure-session'
  })

  fastify.decorate('authorize', authorize)
  fastify.decorate('isUserAllowed', isUserAllowed)
  fastify.decorateRequest('user', null)

  async function authorize (req, reply) {
    const session = req.session.get('session')
    if (session === undefined) {
      req.log.debug('The session cookie is not present')
      throw httpErrors.unauthorized('The session cookie is not present')
    }

    let mail
    try {
      mail = await isUserAllowed(session.token)
    } catch (err) {
      req.session.delete()
      throw err
    }
    req.user = { mail }
  }

  async function isUserAllowed (token) {
    const response = await client.request({
      method: 'GET',
      path: '/user/emails',
      headers: {
        'User-Agent': 'scurte',
        Authorization: `Bearer ${token}`
      }
    })

    if (response.statusCode >= 400) {
      throw httpErrors.unauthorized('Authenticate again')
    }

    let payload = ''
    response.body.setEncoding('utf8')
    for await (const chunk of response.body) {
      payload += chunk
    }
    payload = JSON.parse(payload)

    const isAllowed = payload.some(ele => allowedUsers.includes(ele.email))
    if (!isAllowed) {
      throw httpErrors.forbidden('You are not allowed to access this')
    }

    for (const ele of payload) {
      if (ele.primary) return ele.email
    }
    throw httpErrors.badRequest('The user does not have a primary email')
  }
}

export default fp(authorization, {
  name: 'authorization'
})
