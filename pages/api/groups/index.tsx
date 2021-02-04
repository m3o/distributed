import { NextApiRequest, NextApiResponse } from 'next'
import call from '../../../lib/micro'
import { parse } from 'cookie'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // ignore any OPTIONS requests
  if(!['GET', 'POST']?.includes(req.method)) {
    res.status(200)
    return
  }

  // get the token from cookies
  const token = parse(req.headers.cookie || '').token
  if(!token) {
    res.status(401).json({ error: "No token cookie set" })
    return
  }

  // authenticate the request
  var user: any
  try {
    const rsp = await call("/users/Validate", { token })
    user = rsp.user
  } catch ({ error, code }) {
    if(code === 400) code = 401
    res.status(code).json({ error })
    return
  }

  switch(req.method) {
  case "GET":
    // load the groups
    try {
      const rsp = await call("/groups/List", { member_id: user.id })
      const groups = rsp.groups?.map(g => ({ id: g.id, name: g.name })) || []
      res.status(200).json(groups)
    } catch ({ error, code }) {
      console.error(`Error loading groups: ${error}. code: ${code}`)
      res.status(500).json({ error })
    }
    return
  case "POST":
    // create a group
    var group: any
    try {
      const rsp = await call("/groups/Create", JSON.parse(req.body))
      group = rsp.group
    } catch ({ error, code }) {
      res.status(code).json({ error })
      return
    }

    // join the group
    try {
      await call("/groups/AddMember", { group_id: group.id, member_id: user.id })
      res.status(201).json({ group })
    } catch ({ error, code }) {
      res.status(code).json({ error })
    }
  }
}
