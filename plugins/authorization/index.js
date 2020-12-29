/* eslint camelcase: 0 */

import fp from 'fastify-plugin'
import OAuth from 'fastify-oauth2'
import Cookie from 'fastify-cookie'
import Csrf from 'fastify-csrf'
import undici from 'undici'

async function authorization (fastify, opts) {
  const { httpErrors, config } = fastify
  const allowedUsers = config.ALLOWED_USERS.split(',')

  const client = undici('https://api.github.com')

  fastify
    .register(OAuth, {
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
    .register(Cookie, {
      secret: config.COOKIE_SECRET
    })
    .register(Csrf, {
      sessionPlugin: 'fastify-cookie',
      cookieOpts: { signed: true }
    })
    .decorate('authorize', authorize)
    .decorate('isUserAllowed', isUserAllowed)
    .decorateRequest('user', null)

  async function authorize (req, reply) {
    const { user_session } = req.cookies
    if (!user_session) {
      throw httpErrors.unauthorized('Missing session cookie')
    }

    const cookie = req.unsignCookie(user_session)
    if (!cookie.valid) {
      throw httpErrors.unauthorized('Invalid cookie signature')
    }

    let mail
    try {
      mail = await isUserAllowed(cookie.value)
    } catch (err) {
      reply.clearCookie('user_session', { path: '/_scurte' })
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
