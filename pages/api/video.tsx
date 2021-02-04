import { NextApiRequest, NextApiResponse } from 'next'
import call from '../../lib/micro'
import { parse } from 'cookie'
import twilio from 'twilio'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookies = parse(req.headers.cookie || '')
  
  const token = cookies.token
  if(!token) {
    res.status(401).json({ error: "No token cookie set" })
    return
  }

  var user: any
  try {
    const rsp = await call("/users/Validate", { token })
    user = rsp.user
  } catch ({ error, code }) {
    if(code === 400) code = 401
    res.status(code).json({ error })
    return
  }

  const accessToken = new twilio.jwt.AccessToken(
    process.env.TWILIO_ACCOUNT_SID!,
    process.env.TWILIO_API_KEY!,
    process.env.TWILIO_API_SECRET!,
    {
      ttl: 60 * 60 * 24,
      identity: user.id,
    }
  );

  const grant = new twilio.jwt.AccessToken.VideoGrant();
  accessToken.addGrant(grant);
  grant.toPayload();

  res.status(200).json({ identity: user.id, token: accessToken.toJwt() })
}
