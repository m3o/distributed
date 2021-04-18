import { NextApiRequest, NextApiResponse } from 'next'
import call from '../../../../lib/micro'
import sengrid from '@sendgrid/mail'
import TokenFromReq from '../../../../lib/token'

sengrid.setApiKey(process.env.SENDGRID_API_KEY)
const templateId = 'd-cad7d433f25341c9b69616e81c6df09d'
const from = 'support@m3o.com'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const {
    query: { group_id },
  } = req

  // ignore any OPTIONS requests
  if (!['GET', 'POST']?.includes(req.method)) {
    res.status(200)
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
    const rsp = await call('/v1/users/validate', { token })
    user = rsp.user
  } catch ({ error, code }) {
    const statusCode = code === 400 ? 401 : code
    res.status(statusCode).json({ error })
    return
  }

  // load the groups the user is a part of
  let group: any
  try {
    const rsp = await call('/v1/groups/List', { member_id: user.id })
    group = rsp.groups?.find((g) => g.id === group_id)
  } catch ({ error, code }) {
    console.error(`Error loading groups: ${error}, code: ${code}`)
    res.status(500).json({ error: 'Error loading groups' })
    return
  }
  if (!group) {
    res.status(403).json({ error: 'Not a member of this group' })
    return
  }

  // load the invites
  let invites = []
  try {
    const rsp = await call('/v1/invites/List', { group_id })
    invites = rsp.invites || []
  } catch ({ error, code }) {
    console.error(`Error loading invites: ${error}, code: ${code}`)
    res.status(500).json({ error: 'Error loading invites' })
    return
  }

  switch (req.method) {
    case 'GET':
      res.status(200).json(invites)
      return
    case 'POST': {
      // limit group sizes to 24
      if (group.member_ids.length + invites.length >= 24) {
        res.status(400).json({
          error:
            'Maximum group size of 24 already reached (including pending invites)',
        })
        return
      }

      // parse the request
      let body: any
      try {
        body = JSON.parse(req.body)
      } catch {
        body = {}
      }

      // create the invite
      let invite: any
      try {
        const rsp = await call('/v1/invites/Create', { ...body, group_id })
        invite = rsp.invite
      } catch ({ error, code }) {
        res.status(code).json({ error })
        return
      }

      // send the email
      try {
        const link = `https://distributed.app/login?code=${invite.code}&email=${body.email}`
        const dynamicTemplateData = {
          inviter: user.first_name,
          group: group.name,
          link,
        }
        await sengrid.send({
          to: body.email,
          from,
          dynamicTemplateData,
          templateId,
        })
        res.status(201).json(invite)
      } catch (error) {
        console.warn(`Error sending email: ${error}`)
        res.status(500).json({ error: 'Erorr sending code via email' })
        return
      }
    }
  }
}
