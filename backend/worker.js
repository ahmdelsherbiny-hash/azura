/**
 * AZURA STUDIO — CLOUDFLARE WORKER API LAYER
 * Secure backend handler for RFQ Submissions and Privacy Analytics forwarding to Google Sheets.
 * 
 * Environment Variables / Secrets to set in Cloudflare Dashboard:
 * - GOOGLE_SHEET_WEBHOOK_URL: URL of your Google Apps Script Web App (or Google Sheets REST endpoint)
 * - ALLOWED_ORIGIN: "https://azurastudio.com" or "*" during development
 */

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '*';
    const allowedOrigin = env.ALLOWED_ORIGIN || '*';

    // CORS Preflight headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigin === '*' ? origin : allowedOrigin,
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-Session-ID',
      'Access-Control-Max-Age': '86400'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    try {
      // 1. RFQ Submission Endpoint
      if (path === '/api/rfq' && request.method === 'POST') {
        const body = await request.json();

        // Validate required fields
        if (!body.name || !body.email || !body.brief) {
          return new Response(
            JSON.stringify({ success: false, error: 'Missing required fields' }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Sanitized RFQ Record
        const rfqRecord = {
          type: 'RFQ_SUBMISSION',
          timestamp: body.submittedAt || new Date().toISOString(),
          name: String(body.name).slice(0, 100),
          email: String(body.email).slice(0, 100),
          phone: String(body.phone || '').slice(0, 40),
          clientType: String(body.clientType || 'General').slice(0, 60),
          brief: String(body.brief).slice(0, 2000),
          language: String(body.language || 'en').slice(0, 5),
          sessionId: String(body.sessionId || 'anonymous').slice(0, 60),
          ip: request.headers.get('CF-Connecting-IP') || 'masked'
        };

        // Forward to Google Sheets Webhook
        if (env.GOOGLE_SHEET_WEBHOOK_URL) {
          await fetch(env.GOOGLE_SHEET_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rfqRecord)
          });
        }

        return new Response(
          JSON.stringify({ success: true, message: 'Quotation request received successfully' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 2. Privacy-Friendly Analytics Endpoint
      if (path === '/api/analytics' && request.method === 'POST') {
        const body = await request.json();

        const analyticsRecord = {
          type: 'ANALYTICS_EVENT',
          sessionId: String(body.sessionId || 'anonymous').slice(0, 60),
          eventName: String(body.eventName || 'unknown').slice(0, 60),
          eventData: body.eventData || {},
          timestamp: body.timestamp || new Date().toISOString(),
          url: String(body.url || '/').slice(0, 200),
          referrer: String(body.referrer || '').slice(0, 200),
          language: String(body.language || 'en').slice(0, 5),
          theme: String(body.theme || 'dark').slice(0, 10),
          elapsedSeconds: Number(body.elapsedSeconds || 0),
          country: request.headers.get('CF-IPCountry') || 'unknown'
        };

        // Forward to Google Sheets asynchronously without blocking client
        if (env.GOOGLE_SHEET_WEBHOOK_URL) {
          ctx.waitUntil(
            fetch(env.GOOGLE_SHEET_WEBHOOK_URL, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(analyticsRecord)
            }).catch(() => {})
          );
        }

        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // 404 For other routes
      return new Response(
        JSON.stringify({ error: 'Endpoint not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (err) {
      return new Response(
        JSON.stringify({ success: false, error: 'Internal Server Error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
  }
};
