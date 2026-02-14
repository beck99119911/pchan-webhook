Vercel Webhook Receiver for Coinbase Commerce (OpenClaw)

Overview

This project contains a simple Vercel serverless function that verifies Coinbase Commerce webhook signatures and forwards confirmed charges to an OpenClaw agent endpoint as a JSON job payload.

Files

- api/webhook.js  : Vercel serverless endpoint implementation.
- README_deploy_webhook.md : this file.

Environment variables (set these in Vercel Project Settings → Environment Variables)

- COMMERCE_WEBHOOK_SECRET  : Coinbase Commerce webhook shared secret (string)
- OPENCLAW_WEBHOOK_URL     : URL where OpenClaw accepts job POST (string)

How it works

1. Coinbase sends webhook POST to /api/webhook on your Vercel deployment.
2. webhook.js verifies the HMAC-SHA256 signature (x-cc-webhook-signature) using COMMERCE_WEBHOOK_SECRET.
3. If signature is valid and event.type === 'charge:confirmed', the code builds a job payload and POSTs it to OPENCLAW_WEBHOOK_URL.
4. OpenClaw should implement an endpoint that accepts this job JSON and handles generation/upload/notification.

Deploy steps (quick)

1. Push this folder to a GitHub repo (e.g. repo root has folder vercel_webhook/ with api/ inside).
   - Example: git add vercel_webhook && git commit && git push origin main
2. On Vercel dashboard, click "Import Project" → connect your GitHub repo → select the repository and the folder (if necessary).
3. Set Environment Variables in Vercel:
   - COMMERCE_WEBHOOK_SECRET
   - OPENCLAW_WEBHOOK_URL
4. Deploy. After deploy, your webhook URL will be:
   - https://<your-project>.vercel.app/api/webhook
5. In Coinbase Commerce dashboard → Settings → Webhooks → Add endpoint:
   - Endpoint URL: https://<your-project>.vercel.app/api/webhook
   - Events: select charge:confirmed (or others if desired)
   - Copy the generated webhook secret and paste it into COMMERCE_WEBHOOK_SECRET in Vercel.

Testing (low cost)

- Option A (preferred): Use a low-price Product/Checkout ($1) and perform a real purchase to trigger charge:confirmed.
- Option B: Use local curl with signature generation to test the endpoint (developer only).

Local quick test: (Generate a test signature locally)

```bash
PAYLOAD='{"event":{"type":"charge:confirmed","data":{"id":"test-123","metadata":{"purchaser_email":"you@example.com"}}}}'
SECRET='testsecret'
SIGNATURE=$(echo -n "$PAYLOAD" | openssl dgst -sha256 -hmac "$SECRET" | sed 's/^.* //')
curl -X POST -H "Content-Type: application/json" -H "x-cc-webhook-signature: $SIGNATURE" --data "$PAYLOAD" https://<your-vercel>/api/webhook
```

(When testing locally, set COMMERCE_WEBHOOK_SECRET to testsecret, and OPENCLAW_WEBHOOK_URL to a test endpoint that logs the body.)

Next steps

- Implement OpenClaw endpoint to accept job JSON and perform article generation, upload and notify purchaser.
- Optionally extend webhook.js to fetch Google Form responses (via Sheets API) to correlate metadata if metadata isn't passed through checkout UI.

Security

- Keep COMMERCE_WEBHOOK_SECRET and OPENCLAW_WEBHOOK_URL secret. Do NOT commit them to git.
- The code uses constant-time comparison for signature verification.

If you want, I can also create the OpenClaw AgentTask template and a small test OpenClaw receiver stub. Reply "create agent stub" to have me generate that file in workspace.
