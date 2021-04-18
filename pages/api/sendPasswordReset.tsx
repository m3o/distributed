import { NextApiRequest, NextApiResponse } from 'next'
import call from '../../lib/micro'
import sengrid from '@sendgrid/mail'

sengrid.setApiKey(process.env.SENDGRID_API_KEY)
const templateId = 'd-02aefa32b6de484aa850d794cb8cf471'
const from = 'support@m3o.com'

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  var body: any
  try {
    body = JSON.parse(req.body)
  } catch (error) {
    res.status(400).json({ error: 'Erorr parsing request body' })
    return
  }

  var user: any
  try {
    const rsp = await call('/v1/users/ReadByEmail', { emails: [body.email] })
    user = rsp.users ? rsp.users[body.email?.toLowerCase()] : null
  } catch ({ error, code }) {
    console.error(`Error reading users: ${error}`)
    res.status(500).json({ error: 'Internal server error' })
    return
  }
  if (!user) {
    res.status(400).json({ error: 'User not found' })
    return
  }

  var code: string
  try {
    const rsp = await call('/v1/codes/Create', { identity: user.email })
    code = rsp.code
  } catch ({ error, code }) {
    console.error(`Error creating code: ${error}`)
    res.status(500).json({ error: 'Internal server error' })
    return
  }

  try {
    const dynamicTemplateData = { name: user.first_name, code }
    await sengrid.send({
      to: user.email,
      from,
      dynamicTemplateData,
      templateId,
    })
    res.status(200).json({})
  } catch (error) {
    console.warn(`Error sending email: ${error}`)
    res.status(500).json({ error: 'Erorr sending code via email' })
  }
}
