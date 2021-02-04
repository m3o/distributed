import { NextApiRequest, NextApiResponse } from 'next'
import { parse, serialize } from 'cookie';
import call from '../../lib/micro';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // get the cookie from the request
  const cookies = parse(req.headers.cookie || '');
  const token = cookies.token
  if(!token) {
    res.status(200).json({})
    return
  }

  // unset the cookie for the client
  res.setHeader('Set-Cookie', serialize('token', '', { maxAge: -1, path: '/', }))

  // determine which user is making the logout request
  var userID: string;
  try {
    const rsp = await call("/users/Validate", { token })
    userID = rsp.user.id
  } catch ({ error, code }) {
    res.status(200).json({})
    return
  }

  // logout the user, deactiving the token
  try {
    await call("/users/Logout", { id: userID })
    res.status(200).json({})
  } catch ({ error, code }) {
    res.status(code).json({ error })
    return
  }
}
