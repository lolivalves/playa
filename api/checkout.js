// api/checkout.js
// Vercel Serverless Function — runs securely on the server, never exposed to the browser.
// Called by the Playa+ app when the customer taps "Place order".

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Allow requests from your domain (CORS)
  res.setHeader('Access-Control-Allow-Origin', 'https://playaplusapp.com');
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { items, spotNote, pinX, pinY } = req.body;

    if (!items || !items.length) {
      return res.status(400).json({ error: 'No items in cart' });
    }

    // Build Stripe line items from the cart
    const lineItems = items.map(item => ({
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${item.emoji} ${item.name}`,
          description: item.desc || '',
        },
        unit_amount: Math.round(item.price * 100), // Stripe uses cents
      },
      quantity: item.qty,
    }));

    // Add a delivery fee line item (free for now, but Stripe needs at least 50 cents)
    // If you ever want to charge delivery, change unit_amount here
    // lineItems.push({ price_data: { currency:'usd', product_data:{ name:'🏖️ Beach Delivery' }, unit_amount: 99 }, quantity:1 });

    // Build metadata so you can see spot info in your Stripe dashboard
    const metadata = {
      spot_note: spotNote || 'No note provided',
      pin_x: String(Math.round(pinX || 0)),
      pin_y: String(Math.round(pinY || 0)),
      order_source: 'playaplusapp.com',
    };

    // Create the Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      // Where to send the customer after payment
      success_url: `https://playaplusapp.com/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `https://playaplusapp.com/?cancelled=true`,
      metadata,
      // Pre-fill customer details if you have them
      // customer_email: req.body.email,
      billing_address_collection: 'auto',
      // Enable Apple Pay, Google Pay automatically
      payment_method_options: {
        card: { request_three_d_secure: 'automatic' },
      },
      custom_text: {
        submit: { message: '🏖️ Your order will be delivered to your beach spot!' },
      },
    });

    // Return the session URL to the browser
    return res.status(200).json({ url: session.url, sessionId: session.id });

  } catch (err) {
    console.error('Stripe error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
