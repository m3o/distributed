import { NextApiRequest, NextApiResponse } from 'next'
import call from '../../../../lib/micro'
import { parse } from 'cookie'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query: { group_id } } = req;

  // ignore any OPTIONS requests
  if(!['GET', 'POST']?.includes(req.method)) {
    res.status(200)
    return
  }

  // get the token from cookies
  const token = parse(req.headers.cookie).token
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

  // load the groups the user is a part of
  try {
    const rsp = await call("/groups/List", { member_id: user.id })
    if(!rsp.groups?.find(g => g.id === group_id)) {
      res.status(403).json({ error: "Not a member of this group" })
      return
    }
  } catch ({ error, code }) {
    console.error(`Error loading groups: ${error}, code: ${code}`)
    res.status(500).json({ error: "Error loading groups" })
    return
  }

  switch(req.method) {
  case 'GET':
    // load the invites
    try {
      const rsp = await call("/invites/List", { group_id })
      res.status(200).json(rsp.invites || [])
    } catch ({ error, code }) {
      console.error(`Error loading invites: ${error}, code: ${code}`)
      res.status(500).json({ error: "Error loading invites" })
    }
    return
  case 'POST':
    // parse the request
    var body: any;
    try {
      body = JSON.parse(req.body)
    } catch {
      body = {}
    }
    
    // create the invite
    try {
      const rsp = await call("/invites/Create", { ...body, group_id })
      res.status(201).json(rsp.invite)
    } catch ({ error, code }) {
      res.status(code).json({ error })
    }
    return
  }
}
