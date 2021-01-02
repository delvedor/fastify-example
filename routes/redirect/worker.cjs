'use strict'

/**
 * Here the magic happens!
 * This the worker thread code, it receives from the main
 * thread the array of suggestions and passes it to the svelte
 * rendering API. Once Svelte has rendered the content, we create
 * a valid html file and return it back to the main thread,
 * so it can be sent back to the user.
 */

const { join } = require('path')
// Needed so we can load `.svelte` source files.
require('svelte/register')

let App = null

function render (suggestions) {
  if (App === null) {
    App = require(join(__dirname, 'App.svelte')).default
  }

  const { head, html, css } = App.render({ suggestions })
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset='utf-8'>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="mobile-web-app-capable" content="yes"/>
  <title>App</title>
  <link rel="preconnect" href="https://fonts.gstatic.com">
  <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://unpkg.com/bulma@0.9.1/css/bulma.min.css">
  ${head}
  <style>
    ${css.code}
  </style>
</head>
<body>
  ${html}
</body>
</html>`
}

module.exports = render
