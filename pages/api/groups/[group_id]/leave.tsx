import { NextApiRequest, NextApiResponse } from 'next'
import call from '../../../../lib/micro'
import TokenFromReq from '../../../../lib/token'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const {
    query: { group_id },
  } = req

  if (req.method !== 'POST') {
    res.status(405)
    return
  }

  // get the token from cookies
  const token = TokenFromReq(req)
  if (!token) {
    res.status(401).json({ error: 'No token cookie set' })
    return
  }

  // authenticate the request
  let user: any
  try {
    const rsp = await call('/users/validate', { token })
    user = rsp.user
  } catch ({ error, code }) {
    const statusCode = code === 400 ? 401 : code
    res.status(statusCode).json({ error })
    return
  }

  // load the group
  let group: any
  try {
    const rsp = await call('/groups/Read', { ids: [group_id] })
    group = rsp.groups[group_id as string]
  } catch ({ error, code }) {
    console.error(`Error loading groups: ${error}, code: ${code}`)
    res.status(500).json({ error: 'Error loading groups' })
    return
  }
  if (!group) {
    res.status(404).json({ error: 'Group not found' })
    return
  }

  // ensure the user is a member of the group
  if (!group.member_ids?.includes(user.id)) {
    res.status(403).json({ error: 'Not a member of this group' })
    return
  }

  // leave the group
  try {
    await call('/groups/RemoveMember', {
      group_id: group.id,
      member_id: user.id,
    })
  } catch ({ error, code }) {
    console.error(`Error leaving group: ${error}, code: ${code}`)
    res.status(500).json({ error: 'Error leaving group' })
    return
  }

  // publish the message to the users in the group
  try {
    group.member_ids.forEach(async (id: string) => {
      await call('/streams/Publish', {
        topic: id,
        message: JSON.stringify({
          type: 'group.user.left',
          group_id: group.id,
          payload: { id: user.id },
        }),
      })
    })
    res.status(200).json({})
  } catch ({ error, code }) {
    console.error(`Error publishing to stream: ${error}, code: ${code}`)
    res.status(500).json({ error: 'Error publishing to stream' })
  }
}
