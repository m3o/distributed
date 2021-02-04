import { NextApiRequest, NextApiResponse } from 'next'
import call from '../../lib/micro';
import { parse } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const cookies = parse(req.headers.cookie || '');
  
  const token = cookies.token
  if(!token) {
    res.status(401).json({ error: "No token cookie set" })
    return
  }

  try {
    const rsp = await call("/users/Validate", { token })
    res.status(200).json(rsp)
  } catch ({ error, code }) {
    if(code === 400) code = 401
    res.status(code).json({ error })
  }
}
