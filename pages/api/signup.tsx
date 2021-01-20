import { NextApiRequest, NextApiResponse } from 'next'
import call from '../../lib/micro';
import { serialize } from 'cookie';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const rsp = await call("/users/Create", JSON.parse(req.body))
    res.setHeader('Set-Cookie', serialize('token', rsp.token, { path: '/' }));
    res.status(200).json({});
  } catch ({ error, code }) {
    res.status(code).json({ error })
  }
}
