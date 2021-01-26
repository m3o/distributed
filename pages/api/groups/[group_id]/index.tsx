import { NextApiRequest, NextApiResponse } from 'next'
import call from '../../../../lib/micro'
import { parse } from 'cookie'
import { isError } from 'util'

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

  // load the conversations and the recent messages within them
  var streams: any;
  try {
    const rsp = await call("/streams/ListConversations", { group_id })
    streams = rsp.conversations || [];
  } catch ({ error, code }) {
    console.error(`Error loading conversations: ${error}, code: ${code}`)
    res.status(500).json({ error: "Error loading conversations" })
    return
  }
  var messages: any = {}
  var user_ids: any = group.member_ids || [];
  if(streams.length > 0) {
    try {
      const rsp = await call("/streams/RecentMessages", { conversation_ids: streams.map(s => s.id) })
      if(rsp.messages) {
        user_ids.push(...rsp.messages.map(m => m.author_id))
        messages = rsp.messages.reduce((res, m) => {
          return { ...res, [m.conversation_id]: [...(res[m.conversation_id] || []), m] }
        })
      }
    } catch ({ error, code }) {
      console.error(`Error loading recent messages: ${error}, code: ${code}`)
      res.status(500).json({ error: "Error loading recent messages" })
      return
    } 
  }

  // load the details of the users
  var users: any
  try {
    const rsp = await call("/users/Read", { ids: user_ids })
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
    members: Object.keys(users).filter(id => id !== user.id).map(k => users[k]),
    streams: streams.map(s => ({
      id: s.id,
      topic: s.topic,
      messages: (messages[s.id] || []).map(m => ({
        id: m.id,
        text: m.text,
        sent_at: m.sent_at,
        author: { ...users[m.author_id], current_user: m.author_id === user.id },
      }))
    }))
  })
}
