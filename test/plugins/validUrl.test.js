import t from 'tap'
import Fastify from 'fastify'
import validUrl from '../../plugins/validUrl.js'

// The folder structure we are using "forces" us to put
// inside the plugins folder all of our utilities that
// can be shared in our application. Given that these
// utilities are self contained, a nice side effect is that
// you can reuse them across different projects or even
// publish them as seprate modules.
//
// The best way to keep this difference between your business logic
// code and your plugins, is to test the plugins separately as well.
// In this way you can be sure if a plugin is working correclty,
// and if something does not work in your application you can
// quickly understand that the problem is not the plugin itself,
// but how you are using it.

t.test('Should check if a url is valid', async t => {
  // Create a clean Fastify instance, don't use
  // the one you get from the helper, as that
  // one is your application.
  const fastify = Fastify()
  // Register your plugin
  await fastify.register(validUrl)
  // Wait for Fastify to be ready
  await fastify.ready()

  // Test!
  t.true(await fastify.isValidUrl('https://fastify.io'))
  t.false(await fastify.isValidUrl('http://foo.bar'))
})
