import fp from 'fastify-plugin'
import RateLimit from 'fastify-rate-limit'

/**
 * When exposing an application to the public internet, it's a good
 * approach to add a rate limiter to disallow excessive usage.
 * A rate limiter will save resources and based on the configuration
 * help you identify malicious users.
 *
 * Usually one of the best suited databases for storing rate limit data
 * is Redis, due to its speed and the simple nature of the store data.
 * In this case we will reuse Elasticsearch, to avoid increase the complexity
 * of the codebase and the cost of the infrastructure.
 * Fastify offers a simple yet powerful plugin for handling rate limiting,
 * named `fastify-rate-limit`. Unfortunately Elasticsearch is not part
 * of the officially supported stores, so we'll write a custom one.
 */
async function rateLimit (fastify, opts) {
  const { elastic, indices } = fastify

  class ElasticsearchStore {
    constructor (options) {
      this.options = options
    }

    // This method will be called each time a new request comes in.
    // To avoid sending too many request to Elasticsearch, we'll
    // use the update API, which allow us to update the document
    // if present, create it if it doesn't exists and read the
    // updated document. In this way we'll send up to 2 requests
    // to Elasticsearch for each `incr` call, but only one in case
    // of frequent requests.
    incr (ip, callback) {
      const { timeWindow } = this.options
      elastic.update({
        index: indices.RATELIMIT,
        id: ip,
        _source: true,
        body: {
          // increase the `current` field
          script: {
            lang: 'painless',
            source: 'ctx._source.current += 1'
          },
          // create the document if it does not exists
          upsert: {
            current: 1,
            ttl: Date.now() + timeWindow
          }
        }
      }, onIncrement)

      function onIncrement (err, result) {
        if (err) return callback(err)
        const { current, ttl } = result.body.get._source
        if (ttl < Date.now()) {
          elastic.update({
            index: indices.RATELIMIT,
            id: ip,
            _source: true,
            body: {
              // update the entire document
              doc: {
                current: 1,
                ttl: Date.now() + timeWindow
              }
            }
          }, onIncrement)
        } else {
          callback(null, { current, ttl })
        }
      }
    }

    child (routeOptions) {
      return new ElasticsearchStore({ ...this.options, ...routeOptions })
    }
  }

  // `fastify-rate-limit` does not allow to configure a custom response
  // that is not a JSON, which means that if we want to send something
  // different, say an html page, we need to intercept the error and
  // change the response. This can be achieved by using the `.setErrorHandler`
  // method. It will intercept all errored responses and allow you to update
  // the response to what you need. In this case, since we are serving a
  // frontend application, we want to send back an html page.
  fastify.setErrorHandler(errorHandler)
  function errorHandler (error, request, reply) {
    if (error.statusCode === 429) {
      return reply
        .code(429)
        .type('text/html')
        .send(get429Page(error.message))
    }
    reply.send(error)
  }

  // Finally register the rate limit plugin
  // and add the needd configuration.
  fastify.register(RateLimit, {
    allowList: ['127.0.0.1'], // no rate limit in our machine
    store: ElasticsearchStore,
    timeWindow: '1 minute',
    max: 10
  })
}

function get429Page (message) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset='utf-8'>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>Too Many Requests</title>
  <link rel="preconnect" href="https://fonts.gstatic.com">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;900&display=swap" rel="stylesheet">
  <style>
    html, body {
      width: 100%;
      height: 100%;
      margin: 0;
      padding: 0;
      font-family: 'Montserrat', sans-serif;
      font-size: 25px;
    }

    main {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
    }

   h1 {
      background: linear-gradient(90deg, #d53369 0%, #daae51 100%);
     -webkit-background-clip: text;
       -moz-background-clip: text;
      background-clip: text;
     -webkit-text-fill-color: transparent;
      -moz-text-fill-color: transparent;
      text-fill-color: transparent;
      color: #d53369;
    }
  </style>
</head>
<body>
  <main>
    <h1>Hey, slow down!</h1>
    <p>${message}</p>
  </main>
</body>
</html>`
}

export default fp(rateLimit, {
  name: 'rateLimit',
  // This plugin needs a working Elasticsearch connection
  // to be able to work, so we declare its dependency on the
  // `elasticsearch` plugin we have previously created.
  dependencies: ['elasticsearch']
})
