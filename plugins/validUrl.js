import fp from 'fastify-plugin'
import http from 'http'
import https from 'https'

async function validUrl (fastify, opts) {
  fastify.decorate('isValidUrl', isValidUrl)

  function isValidUrl (url) {
    return new Promise((resolve, reject) => {
      const protocol = url.slice(0, 5) === 'https' ? https : http
      const request = protocol.get(url)

      const onResponse = response => {
        cleanListeners()
        response.destroy()
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
