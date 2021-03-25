import { NextApiRequest, NextApiResponse } from 'next'
import { serialize } from 'cookie';
import call from '../../lib/micro';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  var body: any
  try {
    body = JSON.parse(req.body)
  } catch (error) {
    res.status(400).json({ error: "Erorr parsing request body" })
    return
  }

  var user: any;
  try {
    const rsp = await call("/v1/users/ReadByEmail", { emails: [body.email] })
    user = rsp.users ? rsp.users[body.email?.toLowerCase()] : null
  } catch ({ error, code }) {
    console.error(`Error reading users: ${error}`)
    res.status(500).json({ error: "Internal server error" })
    return
  }
  if(!user) {
    res.status(400).json({ error: "User not found" })
    return
  }

  try {
    await call("/v1/codes/Verify", { identity: user.email, code: body.code })
  } catch ({ error, code }) {
    console.error(`Error reading code: ${error}`)
    res.status(code).json({ error })
    return
  }

  try {
    await call("/v1/users/update", { id: user.id, password: body.password })
  } catch ({ error, code }) {
    res.status(code).json({ error })
    return
  }

  try {
    const rsp = await call("/v1/users/login", { email: user.email, password: body.password })
    res.setHeader('Set-Cookie', serialize('token', rsp.token, { path: '/' }));
    res.status(200).json(rsp);
  } catch ({ error, code }) {
    res.status(code).json({ error })
  }
}
