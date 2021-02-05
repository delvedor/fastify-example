import { join } from 'desm'
import Static from 'fastify-static'
import Helmet from 'fastify-helmet'

export const autoPrefix = '/_app'

/**
 * This plugin contains all the code needed to serve the frontend of
 * the application, it registers additional plugins to handle
 * static file serving and helmet security headers.
 * As you saw in the Elasticsearch plugin, a good rule of thumb is that
 * every plugin should be self-contained, reason why we are registering
 * the two additonal plugins here and not in the global plugins folder.
 */
export default async function frontend (fastify, opts) {
  // `fastify-helmet` helps you secure your application
  // with important security headers. It's not a silver bullet™,
  // but security is an orchestraton of multiple tools that work
  // together to reduce the attack surface of your application.
  fastify.register(Helmet, {
    // Here we are telling to the browser to only
    // accept content from the following sources.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        frameSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-eval'",
          'https://unpkg.com'
        ],
        fontSrc: [
          "'self'",
          'https://www.gstatic.com',
          'https://fonts.gstatic.com',
          'https://fonts.googleapis.com'
        ],
        connectSrc: [
          "'self'",
          'https://unpkg.com'
        ],
        imgSrc: ["'self'"],
        styleSrc: [
          "'self'",
          "'unsafe-inline'",
          'https://www.gstatic.com',
          'https://fonts.googleapis.com',
          'https://unpkg.com'
        ]
      }
    }
  })

  // You are welcome to serve static files from Fastify
  // with the `fastify-static` plugin, but in the real-world™
  // you should definitely use a CDN!
  fastify.register(Static, {
    root: join(import.meta.url, '..', 'public'),
    prefix: '/public' // since we are using `autoPrefix`, the final path will be `/_app/public`
  })

  // The OAuth callback route that we use to extract
  // the access token and generate the session cookie.
  fastify.route({
    method: 'GET',
    path: '/login/github/callback',
    handler: onLoginCallback
  })

  async function onLoginCallback (req, reply) {
    // In every route and hook, the `this` is the
    // current Fastify instance!
    const token = await this.github.getAccessTokenFromAuthorizationCodeFlow(req)
    await this.isUserAllowed(token.access_token)

    // Keep always security in mind!
    reply.setCookie('user_session', token.access_token, {
      // The cookie should be sent only over https
      secure: this.config.NODE_ENV === 'production',
      // The cookie should not be accessible via js in the browser
      httpOnly: true,
      // The cookie should be sent only to this domain
      sameSite: true,
      // The cookie should be sent only for the path starting with `/_app`
      path: '/_app',
      // The cookie should be signed (handled by `fastify-cookie`)
      signed: true,
      maxAge: 604800, // one week in seconds
      expires: new Date(Date.now() + 604800 * 1000)
    })

    // redirect the user to the frontend
    return reply.redirect(autoPrefix)
  }

  // A single route that serves the index.html file,
  // `fastify-static` will take care of the rest.
  fastify.route({
    method: 'GET',
    path: '/',
    handler: onBundle
  })

  function onBundle (req, reply) {
    // Robots go away! https://developers.google.com/search/reference/robots_meta_tag
    reply.header('X-Robots-Tag', 'noindex, nofollow')
    // `.sendFile` is a decorator added by `fastify-static`
    reply.sendFile('index.html')
  }
}
