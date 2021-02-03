const withPWA = require('next-pwa')
const runtimeCaching = require('next-pwa/cache')

module.exports = withPWA({
  target: 'serverless',
  pwa: {
    dest: 'public',
    runtimeCaching,
  },
})
