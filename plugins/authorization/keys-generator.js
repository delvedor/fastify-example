/**
 * Small utilty for generating a cryptographically strong random string,
 * that can be used as key for signing cookies.
 */

import cryptoRandomString from 'crypto-random-string'

console.log(cryptoRandomString({ length: 42, type: 'base64' }))
