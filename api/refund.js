// api/refund.js
// Called when the store rejects an order.
// Issues a full Stripe refund via the payment_intent stored on the order.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || req.headers.referer || 'https://www.playaplus.app';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { stripeSessionId, reason } = req.body;
    if (!stripeSessionId) return res.status(400).json({ error: 'No session ID' });

    // Retrieve the Stripe checkout session to get the payment intent
    const session = await stripe.checkout.sessions.retrieve(stripeSessionId);
    if (!session.payment_intent) {
      return res.status(400).json({ error: 'No payment intent found on session' });
    }

    // Issue full refund
    const refund = await stripe.refunds.create({
      payment_intent: session.payment_intent,
      reason: 'requested_by_customer', // closest Stripe reason for store rejection
      metadata: { rejection_reason: reason || 'Store unable to fulfill order' }
    });

    return res.status(200).json({ success: true, refundId: refund.id, status: refund.status });
  } catch (err) {
    console.error('Refund error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
