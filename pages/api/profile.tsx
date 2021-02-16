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

  var user: any;
  try {
    const rsp = await call("/users/Validate", { token })
    user = rsp.user
  } catch ({ error, code }) {
    if(code === 400) code = 401
    res.status(code).json({ error })
    return
  }

  if(req.method === 'GET') {
    res.status(200).json({ user })
    return
  }

  if(req.method === 'PATCH') {
    var body = {}
    try {
      body = JSON.parse(req.body)
    } catch {
      res.status(400).json({ error: "Error parsing request body" })
      return
    }

    try {
      await call ("/users/Update", { ...body, id: user.id })
      res.status(200).json({})
    } catch ({ error, code }) {
      console.error(`Error updating user: ${error}`)
      res.status(code).json({ error })
    }
    return
  }

  if(req.method !== 'DELETE') {
    res.status(405).json({})
    return
  }

  // load the groups
  var groups = [];
  try {
    const rsp = await call("/groups/List", { member_id: user.id })
    groups = rsp.groups
  } catch ({ error, code }) {
    console.error(`Error loading groups: ${error}. code: ${code}`)
    res.status(500).json({ error })
    return
  }
  
  // leave each group
  try {
    await groups.forEach(async (g) => await call("/groups/RemoveMember", { group_id: g.id, member_id: user.id }))
  } catch ({ error, code }) {
    res.status(500).json({ error })
    return
  }

  // delete the user
  await call("/users/Delete", { id: user.id })
  res.status(200).json({})
}
