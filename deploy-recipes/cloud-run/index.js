import 'make-promises-safe'
import Fastify from 'fastify'
import App from './app.js'

// Google Cloud Run will set this environment variable for you, so
// you can also use it to detect if you are running in Cloud Run
const IS_GOOGLE_CLOUD_RUN = process.env.K_SERVICE !== undefined

// Format logs int Stackdriver format (https://cloud.google.com/logging)
const prodLoggerOptions = {
  level: 'info',
  messageKey: 'message',
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,
  formatters: {
    level (label, number) {
      switch (label) {
        case 'debug':
        case 'info':
        case 'error':
          return { severity: label.toUpperCase() }
        case 'warn':
          return { severity: 'WARNING' }
        case 'fatal':
          return { severity: 'CRITICAL' }
        default:
          return { severity: 'DEFAULT' }
      }
    },
    bindings (bindings) {
      return {}
    },
    log (obj) {
      const { req, res, responseTime, ...driver } = obj
      if (req != null) {
        driver.httpRequest = driver.httpRequest || {}
        driver.httpRequest.requestMethod = req.method
        driver.httpRequest.requestUrl = (req.raw.socket.encrypted ? 'https://' : 'http://') + req.hostname + req.url
        driver.httpRequest.remoteIp = req.ip
        driver.httpRequest.userAgent = req.headers['user-agent']
      }

      if (res != null) {
        driver.httpRequest = driver.httpRequest || {}
        driver.httpRequest.status = res.statusCode
        driver.httpRequest.latency = responseTime / 1000
      }

      return driver
    }
  }
}

const devLoggerOptions = {
  level: 'info'
}

async function start () {
  const fastify = Fastify({
    trustProxy: true,
    logger: IS_GOOGLE_CLOUD_RUN
      ? prodLoggerOptions
      : devLoggerOptions
  })
  fastify.register(App)
  // You must listen on the port Cloud Run provides
  const port = process.env.PORT || 3000
  // You must listen on all IPV4 addresses in Cloud Run
  const address = IS_GOOGLE_CLOUD_RUN ? '0.0.0.0' : undefined
  await fastify.listen(port, address)
}

start().catch(err => {
  console.error(err)
  process.exit(1)
})
