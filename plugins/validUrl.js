import fp from 'fastify-plugin'
import http from 'http'
import https from 'https'

/**
 * This application is an url shortener, and we want to be sure that
 * a destination url exists before to store it in Elasticsearch.
 * This plugins adds a single `isValidUrl` decorator that performs
 * an http request the the destination url to figure out if the url is valid.
 * We are not using `undici` as client (like in the authorization plugin)
 * because undici is best suiited for calling the same endpoint multiple
 * times, while the Node.js core http client can talk with multiple
 * addresses more easily.
 */
async function validUrl (fastify, opts) {
  fastify.decorate('isValidUrl', isValidUrl)

  function isValidUrl (url) {
    return new Promise((resolve, reject) => {
      const protocol = url.slice(0, 5) === 'https' ? https : http
      const request = protocol.get(url)

      const onResponse = response => {
        cleanListeners()
        response.destroy() // We don't care about the response.
        resolve(response.statusCode < 400)
      }

      const onTimeout = () => {
        cleanListeners()
        request.once('error', () => {}) // we need to catch the request aborted error
        request.abort()
        resolve(false)
      }

      const onError = _err => {
        cleanListeners()
        resolve(false)
      }

      const onAbort = () => {
        cleanListeners()
        request.once('error', () => {}) // we need to catch the request aborted error
        resolve(false)
      }

      request.on('response', onResponse)
      request.on('timeout', onTimeout)
      request.on('error', onError)
      request.on('abort', onAbort)

      request.end()

      // Let's be good citizens and clean the listeners,
      // so we free memory and avoid memory leaks.
      function cleanListeners () {
        request.removeListener('response', onResponse)
        request.removeListener('timeout', onTimeout)
        request.removeListener('error', onError)
        request.removeListener('abort', onAbort)
      }
    })
  }
}

export default fp(validUrl, {
  name: 'validUrl'
})
