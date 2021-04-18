module.exports = {
  env: {
    STRIPE_PUBLIC_KEY: process.env.STRIPE_PUBLIC_KEY,
  },

  async redirects() {
    return [
      {
        source: '/groups',
        destination: '/',
        permanent: false,
      },
    ]
  },
}
