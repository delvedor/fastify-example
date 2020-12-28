export const autoPrefix = '/_scurte'
export default async function frontend (fastify, opts) {
  fastify.route({
    method: 'GET',
    path: '/',
    handler: onBundle
  })

  function onBundle (req, reply) {
    reply.header('X-Robots-Tag', 'noindex, nofollow')
    reply.sendFile('index.html')
  }
}
