'use strict'

const { join } = require('path')
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
  <title>Scurte</title>
  <link href="https://fonts.googleapis.com/css2?family=Oswald&family=Roboto&display=swap" rel="stylesheet">
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
