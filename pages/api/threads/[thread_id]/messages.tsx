import { NextApiRequest, NextApiResponse } from 'next'
import call from '../../../../lib/micro'
import { parse } from 'cookie'
import { RSA_PKCS1_OAEP_PADDING } from 'constants';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { query: { thread_id } } = req;

  if(req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({})
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

  // load the thread
  var thread: any
  try {
    const rsp = await call("/threads/ReadConversation", { id: thread_id })
    thread = rsp.conversation
  } catch ({ error, code }) {
    console.error(`Error loading conversation: ${error}, code: ${code}`)
    res.status(code).json({ error })
    return
  }
  
  // load the group
  var group: any
  try {
    const rsp = await call("/groups/Read", { ids: [thread.group_id] })
    group = rsp.groups[thread.group_id]
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

  // if a get request, load the messages in the thread
  if(req.method === 'GET') {
    var messages = []
    try {
      const rsp = await call("/threads/ListMessages", { conversation_id: thread.id })
      messages = rsp.messages || []
    } catch ({ error, code }) {
      console.error(`Error loading messages: ${error}, code: ${code}`)
      res.status(500).json({ error: "Error loading messages" })
    }
    if(messages.length === 0) {
      res.status(200).json([])
      return
    }

    var users = {}
    try {
      const rsp = await call("/users/Read", { ids: messages.map(m => m.author_id)} )
      users = rsp.users || {}
    } catch ({ error, code }) {
      console.error(`Error loading users: ${error}, code: ${code}`)
      res.status(500).json({ error: "Error loading users" })
    }

    res.status(200).json(messages.map(m => ({
      id: m.id,
      text: m.text,
      sent_at: m.sent_at,
      author: { ...users[m.author_id], current_user: m.author_id === user.id },
    })))
    return
  }

  // parse the request
  var body: any;
  try {
    body = JSON.parse(req.body)
  } catch {
    body = {}
  }

  // create the thread
  try {
    const params = {
      conversation_id: thread.id,
      author_id: user.id,
      text: body.text,
    }
    const rsp = await call("/threads/CreateMessage", params)
    res.status(201).json({
      id: rsp.message.id,
      text: rsp.message.text,
      sent_at: rsp.message.sent_at,
      author: { ...user, current_user: true },
    })
  } catch ({ error, code }) {
    res.status(code).json({ error })
  }
}
