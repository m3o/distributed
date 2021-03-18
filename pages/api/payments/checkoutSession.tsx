import Stripe from 'stripe';
import { NextApiRequest, NextApiResponse } from 'next'

const stripe = new Stripe(process.env.STRIPE_PRIVATE_KEY, null);

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  let groupID: string;
  let threadID: string;
  let imageURL: string;
  try {
    const body = JSON.parse(req.body)
    threadID = body.threadID
    groupID = body.groupID
    imageURL = body.imageURL
  } catch {
    res.status(400).json({ error: "Missing request body" })
    return
  }

  const params: Stripe.Checkout.SessionCreateParams = {
    submit_type: 'pay',
    payment_method_types: ['card'],
    line_items: [
      {
        name: 'Distributed - Send Gif',
        amount: 100,
        currency: 'USD',
        quantity: 1
      }
    ],
    metadata: { imageURL, groupID, threadID },
    success_url: `${process.env.STRIPE_REDIRECT_URL}/api/payments/success?sessionID={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.STRIPE_REDIRECT_URL}/groups/${groupID}`
  }
  const checkoutSession: Stripe.Checkout.Session = await stripe.checkout.sessions.create(params)

  res.status(200).json({ id: checkoutSession.id })
}