import { NextApiRequest, NextApiResponse } from 'next'
import Stripe from 'stripe'
import { v4 as uuid } from 'uuid'
import call from '../../../lib/micro'
import TokenFromReq from '../../../lib/token'

const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY, null)

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  // get the token from cookies
  const token = TokenFromReq(req)
  if (!token) {
    res.status(401).json({ error: 'No token cookie set' })
    return
  }

  // authenticate the request
  let user: any
  try {
    const rsp = await call('/users/Validate', { token })
    user = rsp.user
  } catch ({ error, code }) {
    const statusCode = code === 400 ? 401 : code
    res.status(statusCode).json({ error })
    return
  }

  // validate the checkout session
  const queryString = req.url.split('?')[1]
  const urlParams = new URLSearchParams(queryString)
  const session = await stripe.checkout.sessions.retrieve(
    urlParams.get('sessionID')
  )
  if (session.payment_status !== 'paid') {
    res.status(500).json({ error: 'Payment failed' })
    return
  }

  // get the purchase info from session metadat
  const { groupID, threadID, imageURL } = session.metadata

  // load the group
  let group: any
  try {
    const rsp = await call('/groups/Read', { ids: [groupID] })
    group = rsp.groups[groupID]
  } catch ({ error, code }) {
    res.status(500).json({ error: 'Error finding group' })
    return
  }

  // create the message
  let msg: any
  try {
    const params = {
      id: uuid(),
      conversation_id: threadID,
      author_id: user.id,
      text: imageURL,
    }
    msg = (await call('/threads/CreateMessage', params)).message
  } catch ({ error, code }) {
    res.status(500).json({ error: 'Error creating message' })
    return
  }

  // publish the message to the other users in the group
  try {
    group.member_ids.forEach(async (id: string) => {
      await call('/streams/Publish', {
        topic: id,
        message: JSON.stringify({
          type: 'message.created',
          group_id: groupID,
          payload: {
            chat: {
              id: threadID,
              type: 'thread',
            },
            message: {
              id: msg.id,
              text: msg.text,
              sent_at: msg.sent_at,
              author: { ...user, current_user: id === user.id },
            },
          },
        }),
      })
    })
  } catch ({ error, code }) {
    console.error(`Error publishing to stream: ${error}, code: ${code}`)
    res.status(500).json({ error: 'Error publishing to stream' })
    return
  }

  res.redirect('/groups/' + groupID)
}
