/* eslint camelcase: 0 */

import fp from 'fastify-plugin'
import OAuth from 'fastify-oauth2'
import Cookie from 'fastify-cookie'
import Csrf from 'fastify-csrf'
import undici from 'undici'

/**
 * Authentication is a core component of virtually every application.
 * Fastify does not come with a prebuilt authentication solution, but it offers
 * many plugins instead, so you can choose the one that fits your needs.
 * In this application we want our users to login via GitHub and then share the
 * access token with the frontend via signed cookies.
 */
async function authorization (fastify, opts) {
  const { httpErrors, config } = fastify
  // We don't want every github user to access our application,
  // so we configure an allow list of emails that we accept.
  const allowedUsers = config.ALLOWED_USERS.split(',')

  // Undici is an http client for Node.js extremely optimized
  // to achieve the best performances possible. Is very well
  // suited if you need to send all the request to the same endpoint.
  const client = undici('https://api.github.com')

  // `fastify-oauth2` is a plugin that helps you handle oauth2 flows.
  // It comes with preconfigured settings for the major oauth providers.
  // Are you using Auth0? See https://npm.im/fastify-auth0-verify
  fastify.register(OAuth, {
    name: 'github',
    credentials: {
      client: {
        id: config.GITHUB_APP_ID,
        secret: config.GITHUB_APP_SECRET
      },
      auth: OAuth.GITHUB_CONFIGURATION
    },
    startRedirectPath: '/_app/login/github',
    // TODO: this url should change if we are in prod
    callbackUri: 'http://localhost:3000/_app/login/github/callback',
    scope: ['user:email']
  })

  // `fastify-cookie` adds everything you need to work with cookies
  fastify.register(Cookie, {
    secret: config.COOKIE_SECRET
  })

  // When using sessions with cookies, it's always recommended to use CSRF.
  // `fastify-csrf` will help you better protect your application.
  // Don't know what CSRF is? Take a look at https://github.com/pillarjs/understanding-csrf.
  fastify.register(Csrf, {
    sessionPlugin: 'fastify-cookie',
    cookieOpts: { signed: true }
  })

  // Decorators are the "Fastify way" of sharing code across your application.
  // When using the `decorate` API, the first parameter is the decorator name,
  // while the second the actual decorator (it can be any js value).
  // You can then access your decorator with `fastify.nameOfTheDecorator`.
  // See https://www.fastify.io/docs/latest/Decorators/
  // Testing authentication flow is hard, especially if you are using OAuth flow.
  // As workarond we are using mocks instead of the production authorization utilities.
  fastify.decorate('authorize', authorize)
  fastify.decorate('isUserAllowed', opts.testing ? isUserAllowedMock : isUserAllowed)
  // `decorateRequest` works in the same way of `decorate`, but it changes
  // the Fastify request object instead. It's very useful if you know you need
  // to add properties to the request object, as behind the scenes Fastify will
  // optimize the code for you.
  fastify.decorateRequest('user', null)

  // A good pattern to follow is to always expose utilities that interact with
  // the request/response lifecycle as functions with the hook signature.
  // See https://www.fastify.io/docs/latest/Hooks/
  // By exposing the authorization function with the hook signature, we can
  // use it everywhere in our application by adding a plugin or a route level
  // hook that uses it.
  // One of the unwritten core principles with Fastify is "keep things boring",
  // it will help you keep the complexity low, scale well in heterogeneous teams
  // and lower the barrier of entry.
  //
  // The authorization hook will look at the cookies and extract the session
  // cookie, in this case `user_session`. If it is not present, throws an error
  // with `httpErrors.unauthorized`, a utility added by `fastify-sensible`.
  // If the cookie is present it will try to unsign it and finally
  // verify with the OAuth provider if the provided token is valid
  // and is part of the allowed users list.
  // If the user is accepeted, it will update the `request.user` property
  // with the mail address of the user.
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
      mail = await fastify.isUserAllowed(cookie.value)
    } catch (err) {
      req.log.warn(`Invalid user tried to authenticate: ${JSON.stringify(err.user)}`)
      // Let's clear the cookie as well in case of errors,
      // in this way if a user retries the request we'll save
      // an additional http request to GitHub.
      reply.clearCookie('user_session', { path: '/_app' })
      throw err
    }

    // You can add any property to the request/reply objects,
    // but it's important you declare them in advance with decorators.
    // If you don't, your code will likely be deoptimized by V8.
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
      const err = httpErrors.forbidden('You are not allowed to access this')
      // let's store the user info so we can log them later
      err.user = payload
      throw err
    }

    for (const ele of payload) {
      if (ele.primary) return ele.email
    }
    throw httpErrors.badRequest('The user does not have a primary email')
  }

  // Mocks are double edges swords. The main issue with mocks
  // is that usually you only test for the success case.
  // You should test for the bad case as well, so if you are
  // writing a mock be sure to handle the failure cases as well.
  async function isUserAllowedMock (token) {
    if (token === 'invalid') {
      throw httpErrors.forbidden('You are not allowed to access this')
    }
    return allowedUsers[0]
  }
}

// When exporting a plugin that exposes a utility that will need to be used
// in other parts of your application, use `fastify-plugin` to tell Fastify that
// this plugin should not be encapsulated. See https://www.fastify.io/docs/latest/Encapsulation/.
export default fp(authorization, {
  // Protip: if you name your plugins, the stack trace in case of errors
  //         will be easier to read and other plugins can declare their dependency
  //         on this one. `fastify-autoload` will take care of loading the plugins
  //         in the correct order.
  name: 'authorization'
})
