import { NextApiRequest, NextApiResponse } from 'next'
import call from '../../../lib/micro'
import TokenFromReq from '../../../lib/token';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query: { group_id } } = req;

  if(req.method !== 'GET') {
    res.status(405)
    return
  }
  
  // get the token from cookies
  const token = TokenFromReq(req)
  if(!token) {
    res.status(401).json({ error: "No token cookie set" })
    return
  }

  // authenticate the request
  var user: any
  try {
    const rsp = await call("/v1/users/validate", { token })
    user = rsp.user
  } catch ({ error, code }) {
    if(code === 400) code = 401
    res.status(code).json({ error })
    return
  }

  // load the invites
  var invites: any
  try {
    const rsp = await call("/invites/List", { email: user.email })
    invites = rsp.invites || []
  } catch ({ error, code }) {
    console.error(`Error loading invites: ${error}, code: ${code}`)
    res.status(500).json({ error: "Error loading invites" })
    return
  }
  if(invites.length === 0) {
    res.json([])
    return
  }
  
  // load the details for the groups
  var groups: any
  try {
    const rsp = await call("/groups/Read", { ids: invites.map(i => i.group_id) })
    groups = rsp.groups
  } catch ({ error, code }) {
    console.error(`Error loading groups: ${error}, code: ${code}`)
    res.status(500).json({ error: "Error loading groups" })
    return
  }

  // return the response
  res.json(invites.map(i => { 
    const group = groups[i.group_id]

    return {
      id: i.id, 
      code: i.code,
      group: {
        id: group.id,
        name: group.name
      },
    }
  }))
}
