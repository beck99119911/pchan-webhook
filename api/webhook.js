import crypto from 'crypto';
import fetch from 'node-fetch';

// Helper to read raw body
function bufferFromReq(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function verifySignature(rawBody, signature, secret) {
  if (!signature || !secret) return false;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(rawBody);
  const expected = hmac.digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch (e) {
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const signature = req.headers['x-cc-webhook-signature'];
  const rawBody = await bufferFromReq(req);

  if (!verifySignature(rawBody, signature, process.env.COMMERCE_WEBHOOK_SECRET)) {
    console.error('Invalid webhook signature');
    return res.status(401).send('Invalid signature');
  }

  let body;
  try {
    body = JSON.parse(rawBody.toString());
  } catch (e) {
    console.error('Invalid JSON', e);
    return res.status(400).send('Invalid JSON');
  }

  const eventType = body.event?.type || body.type;
  console.log('Received event:', eventType);

  if (eventType === 'charge:confirmed') {
    const charge = body.event.data || body.data;
    const metadata = charge.metadata || {};

    // Build job payload for OpenClaw
    const job = {
      orderId: charge.id || charge.code || Date.now().toString(),
      email: metadata.purchaser_email || charge?.customer?.email || null,
      title_hint: metadata.title_hint || null,
      tone: metadata.tone || null,
      keywords: metadata.must_include || null,
      length: metadata.length || 'medium',
      rawCharge: charge
    };

    console.log('Enqueue job to OpenClaw:', job.orderId, 'email=', job.email);

    try {
      const r = await fetch(process.env.OPENCLAW_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(job)
      });

      if (!r.ok) {
        console.error('Failed to forward to OpenClaw', await r.text());
        return res.status(502).send('Failed to forward');
      }

      console.log('Forwarded to OpenClaw');
      return res.status(200).send('ok');
    } catch (e) {
      console.error('Error forwarding to OpenClaw', e);
      return res.status(500).send('internal error');
    }
  }

  // For other events, just acknowledge
  res.status(200).send('ignored');
}
