// api/order.js
// Saves a confirmed Stripe order to Supabase.
// Works in two modes:
// 1. Full mode — order data from localStorage passed in body (normal case)
// 2. Fallback mode — only sessionId available (iOS Safari cleared localStorage)

const stripe  = require('stripe')(process.env.STRIPE_SECRET_KEY);
const SUPA_URL = 'https://gjrmdmyxkisrjhuzrhmg.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdqcm1kbXl4a2lzcmpodXpyaG1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjg5MTYsImV4cCI6MjEwMDg0NDkxNn0.1zhSYonu0EKIdkT02Z8tCd2_J9IJcjb4dboTMbr0BXg';
const HEADERS  = {
  'Content-Type': 'application/json',
  'apikey': SUPA_KEY,
  'Authorization': `Bearer ${SUPA_KEY}`,
  'Prefer': 'return=representation'
};

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || req.headers.referer || 'https://www.playaplus.app';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { order, sessionId } = req.body;
    const stripeSessionId = sessionId || order?.stripeSessionId;

    if (!stripeSessionId) {
      return res.status(400).json({ error: 'No session ID provided' });
    }

    // Check if this order already exists in Supabase (prevent duplicates on retry)
    const existing = await fetch(
      `${SUPA_URL}/rest/v1/orders?stripe_session_id=eq.${stripeSessionId}&select=id,order_number`,
      { headers: HEADERS }
    );
    const existingData = await existing.json();
    if (existingData && existingData.length > 0) {
      console.log('Order already exists in Supabase:', existingData[0].id);
      return res.status(200).json({ success: true, order: existingData[0] });
    }

    // Fetch session from Stripe to get payment details
    // This is the fallback for when localStorage data was lost
    let stripeSession;
    try {
      stripeSession = await stripe.checkout.sessions.retrieve(stripeSessionId, {
        expand: ['line_items']
      });
    } catch(e) {
      console.error('Stripe session fetch failed:', e.message);
    }

    // Build order data — prefer data from localStorage (order object),
    // fall back to Stripe session data
    const orderNumber = order?.id || Date.now();
    const total       = order?.total || (stripeSession?.amount_total / 100) || 0;
    const items       = order?.items || [];

    // Extract metadata from Stripe session
    const meta = stripeSession?.metadata || {};

    const payload = {
      order_number:      orderNumber,
      status:            'pending',
      total:             total,
      subtotal:          order?.subtotal || total,
      service_fee:       order?.service_fee || 0,
      delivery_fee:      order?.delivery_fee || 0,
      passcode:          order?.passcode || meta.passcode || '',
      gps_lat:           order?.gpsLat  || meta.gps_lat  || null,
      gps_lng:           order?.gpsLng  || meta.gps_lng  || null,
      gps_acc:           order?.gpsAcc  || meta.gps_accuracy || null,
      spot_note:         order?.note    || meta.spot_note || '',
      selfie_url:        order?.selfie  || null,
      id_method:         order?.idMethod || 'selfie',
      items:             items,
      stripe_session_id: stripeSessionId,
      customer_id:       order?.customerId    || null,
      customer_email:    order?.customerEmail || stripeSession?.customer_details?.email || null,
      customer_name:     order?.customerName  || stripeSession?.customer_details?.name  || null,
    };

    // Save to Supabase
    const response = await fetch(`${SUPA_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (response.ok && !data.error) {
      console.log('✅ Order saved to Supabase:', data[0]?.id);
      return res.status(200).json({ success: true, order: data[0] });
    } else {
      console.error('❌ Supabase save failed:', JSON.stringify(data));
      return res.status(500).json({ error: 'Failed to save order', detail: data });
    }

  } catch(err) {
    console.error('❌ Order handler error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};
