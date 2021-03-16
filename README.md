Distributed is a Next.js based jamstack app for live social chat

## Usage

Distributed requires the following environment variables before getting started.

```
# The micro API endpoint
MICRO_API_ENDPOINT=https://api.m3o.com

# Sendgrid api key for sending invites
SENDGRID_API_KEY=xxxxxxxx

# Twilio api key/secret/sid for audio/video calls
TWILIO_API_KEY=xxxxxxx
TWILIO_API_SECRET=xxxxx
TWILIO_ACCOUNT_SID=xxxxxx
```

Then simply do npm run build and start

```
# Starts on port 3000
npm run build && npm start
```

## License

Distributed is licensed as Polyform Strict
