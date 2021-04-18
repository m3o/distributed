import { NextApiRequest, NextApiResponse } from 'next'
import call from '../../../../lib/micro'
import TokenFromReq from '../../../../lib/token'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const {
    query: { thread_id },
  } = req

  if (req.method !== 'PATCH' && req.method !== 'DELETE') {
    res.status(405).json({})
    return
  }

  // get the token from cookies
  const token = TokenFromReq(req)
  if (!token) {
    res.status(401).json({ error: 'No token cookie set' })
    return
  }

  // authenticate the request
  var user: any
  try {
    const rsp = await call('/v1/users/validate', { token })
    user = rsp.user
  } catch ({ error, code }) {
    if (code === 400) code = 401
    res.status(code).json({ error })
    return
  }

  // load the thread
  var thread: any
  try {
    const rsp = await call('/v1/threads/ReadConversation', { id: thread_id })
    thread = rsp.conversation
  } catch ({ error, code }) {
    console.error(`Error loading conversation: ${error}, code: ${code}`)
    res.status(code).json({ error })
    return
  }

  // load the group
  var group: any
  try {
    const rsp = await call('/v1/groups/Read', { ids: [thread.group_id] })
    group = rsp.groups[thread.group_id]
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

  // delete the thread
  if (req.method === 'DELETE') {
    try {
      await call('/v1/threads/DeleteConversation', { id: thread.id })
    } catch ({ error, code }) {
      res.status(code).json({ error })
      return
    }

    group.member_ids.forEach(async (id: string) => {
      await call('/v1/streams/Publish', {
        topic: id,
        message: JSON.stringify({
          type: 'thread.deleted',
          group_id: group.id,
          payload: { id: thread.id },
        }),
      })
    })

    res.status(200).json({})
    return
  }
  if (req.method === 'PATCH') {
    var body: any
    try {
      body = JSON.parse(req.body)
    } catch (error) {
      res.status(400).json({ error: 'Error reading body' })
      return
    }

    try {
      await call('/v1/threads/UpdateConversation', {
        id: thread.id,
        topic: body.topic,
      })
    } catch ({ error, code }) {
      res.status(code).json({ error })
      return
    }

    group.member_ids.forEach(async (id: string) => {
      await call('/v1/streams/Publish', {
        topic: id,
        message: JSON.stringify({
          type: 'thread.updated',
          group_id: group.id,
          payload: { id: thread.id, topic: body.topic },
        }),
      })
    })

    res.status(200).json({})
    return
  }
}
