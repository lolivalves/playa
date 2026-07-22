// api/checkout.js
// Vercel Serverless Function — runs securely on the server, never exposed to the browser.
// Called by the Playa+ app when the customer taps "Place order".

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Detect the origin domain dynamically so redirects always go back to
  // wherever the request came from (custom domain, Vercel preview URL, etc.)
  const origin = req.headers.origin || req.headers.referer || 'https://www.playaplus.app';
  const baseUrl = origin.endsWith('/') ? origin.slice(0, -1) : origin;

  // Allow requests from your domain (CORS)
  res.setHeader('Access-Control-Allow-Origin', baseUrl);
  res.setHeader('Access-Control-Allow-Methods', 'POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  try {
    const { items, spotNote, gpsLat, gpsLng, gpsAcc, passcode, service_fee, fee_label } = req.body;

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

    // Add service fee as a Stripe line item (only if > 0)
    const fee = parseFloat(service_fee) || 0;
    if (fee > 0) {
      lineItems.push({
        price_data: {
          currency: 'usd',
          product_data: {
            name: fee_label || 'Service fee',
            description: 'Beach delivery service fee',
          },
          unit_amount: Math.round(fee * 100),
        },
        quantity: 1,
      });
    }

    // Build metadata so you can see order info in your Stripe dashboard
    const metadata = {
      spot_note:    spotNote  || 'No note provided',
      passcode:     passcode  || '',
      gps_lat:      String(gpsLat || ''),
      gps_lng:      String(gpsLng || ''),
      gps_accuracy: String(gpsAcc || ''),
      maps_url:     gpsLat ? `https://www.google.com/maps?q=${gpsLat},${gpsLng}` : '',
      order_source: 'playaplus.app',
    };

    // Create the Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: 'payment',
      // Where to send the customer after payment
      success_url: `${baseUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url:  `${baseUrl}/?cancelled=true`,
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
