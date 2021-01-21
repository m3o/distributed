import { NextApiRequest, NextApiResponse } from 'next'
import call from '../../../../lib/micro'
import { parse } from 'cookie'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query: { group_id } } = req

  if(req.method !== 'GET') {
    res.status(405)
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

  // load the group
  var group: any
  try {
    const rsp = await call("/groups/Read", { ids: [group_id] })
    group = rsp.groups[group_id as string]
  } catch ({ error, code }) {
    console.error(`Error loading groups: ${error}, code: ${code}`)
    res.status(500).json({ error: "Error loading groups" })
    return
  }
  if(!group) {
    res.status(404).json({ error: "Group not found"})
    return
  }

  // ensure the user is a member of the group
  if(!group.member_ids?.includes(user.id)) {
    res.status(403).json({ error: "Not a member of this group" })
    return
  }

  // load the details of the users
  var users: any
  try {
    const rsp = await call("/users/Read", { ids: group.member_ids })
    users = rsp.users
  } catch ({ error, code }) {
    console.error(`Error loading users: ${error}, code: ${code}`)
    res.status(500).json({ error: "Error loading users" })
    return
  }

  // return the data
  res.status(200).json({
    id: group.id,
    name: group.name,
    members: Object.keys(users).map(k => users[k]),
  })
}
