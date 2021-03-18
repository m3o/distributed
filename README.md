## Distributed

Distributed is a Next.js based jamstack app for live social chat

## Live Demo

Signup to the live demo at [distributed.app](https://distributed.app).


<img src="screenshot.png" />

## Usage

Distributed requires the following environment variables before getting started.

```
# The micro API endpoint/key
MICRO_API_ENDPOINT=https://api.m3o.com
MICRO_API_KEY=xxxxxxx

# Sendgrid api key for sending invites
SENDGRID_API_KEY=xxxxxxxx

# Twilio api key/secret/sid for audio/video calls
TWILIO_API_KEY=xxxxxxx
TWILIO_API_SECRET=xxxxx
TWILIO_ACCOUNT_SID=xxxxxx

# Stripe api key to pay for gifs
STRIPE_PUBLIC_KEY=xxxxxx
```

Then simply do npm run build and start

```
# Starts on port 3000
npm run build && npm start
```

## License

Distributed is licensed as Polyform Strict
