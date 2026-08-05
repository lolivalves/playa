// api/order.js
// Called by the customer app after Stripe redirects back with session_id.
// Saves the confirmed order to Supabase so all operators can see it.

const SUPA_URL = 'https://gjrmdmyxkisrjhuzrhmg.supabase.co';
const SUPA_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdqcm1kbXl4a2lzcmpodXpyaG1nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyNjg5MTYsImV4cCI6MjEwMDg0NDkxNn0.1zhSYonu0EKIdkT02Z8tCd2_J9IJcjb4dboTMbr0BXg';
const HEADERS  = { 'Content-Type': 'application/json', 'apikey': SUPA_KEY, 'Authorization': `Bearer ${SUPA_KEY}`, 'Prefer': 'return=representation' };

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || req.headers.referer || 'https://www.playaplus.app';
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { order } = req.body;
    if (!order) return res.status(400).json({ error: 'No order data' });

    // Save to Supabase
    const response = await fetch(`${SUPA_URL}/rest/v1/orders`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify({
        order_number:     order.id,
        status:           'pending', // store must approve before operators see it
        total:            order.total,
        subtotal:         order.subtotal,
        service_fee:      order.service_fee,
        delivery_fee:     order.delivery_fee,
        passcode:         order.passcode,
        gps_lat:          order.gpsLat,
        gps_lng:          order.gpsLng,
        gps_acc:          order.gpsAcc,
        spot_note:        order.note || '',
        selfie_url:       order.selfie || null,
        id_method:        order.idMethod || 'selfie',
        items:            order.items,
        stripe_session_id: order.stripeSessionId || null,
      })
    });

    const data = await response.json();
    if (response.ok) {
      return res.status(200).json({ success: true, order: data[0] });
    } else {
      console.error('Supabase error:', data);
      return res.status(500).json({ error: 'Failed to save order', detail: data });
    }
  } catch(err) {
    console.error('Order save error:', err);
    return res.status(500).json({ error: err.message });
  }
};
