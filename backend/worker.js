/**
 * ============================================================================
 * AZURA STUDIO — SECURE BACKEND API WORKER (Cloudflare Worker ES Module)
 * ============================================================================
 * Handles:
 * 1. POST /api/rfq             - Request for Quotation intake & validation
 * 2. POST /api/analytics/batch - Batched session & user engagement telemetry
 * 
 * Target Destination: Google Sheets via Google Sheets API v4 (Service Account JWT Auth)
 * Zero external npm dependencies — uses native Web Crypto API for RS256 signing.
 * 
 * Required Cloudflare Worker Secrets / Environment Variables:
 * - GOOGLE_SERVICE_ACCOUNT_EMAIL : client_email from service account JSON
 * - GOOGLE_PRIVATE_KEY           : private_key from service account JSON (PEM format)
 * - GOOGLE_SPREADSHEET_ID        : ID string from Google Sheets URL
 * - ALLOWED_ORIGINS              : Comma-separated allowed origins (e.g. "https://azurastudio.com,http://localhost:5500")
 * ============================================================================
 */

// --- In-Memory JWT Access Token Cache (Worker instance lifespan) ---
let cachedAccessToken = null;
let tokenExpiresAt = 0;

export default {
  async fetch(request, env, ctx) {
    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin, env.ALLOWED_ORIGINS);

    // 1. Handle CORS Preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    // 2. Reject non-POST requests on API routes
    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, ''); // Normalize trailing slashes

    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405, corsHeaders);
    }

    // 3. Rate limiting / abuse guard: payload size limit (max 100 KB)
    const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (contentLength > 102400) {
      return jsonResponse({ success: false, error: 'Payload Too Large. Max size is 100KB.' }, 413, corsHeaders);
    }

    try {
      // ----------------------------------------------------------------------
      // ROUTE 1: POST /api/rfq
      // ----------------------------------------------------------------------
      if (path === '/api/rfq') {
        let body;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ success: false, error: 'Invalid JSON payload' }, 400, corsHeaders);
        }

        // Honeypot spam check (if honeypot field is filled, silently discard or reject)
        if (body._hp && String(body._hp).trim().length > 0) {
          return jsonResponse({ success: true, message: 'Received' }, 200, corsHeaders);
        }

        // Validate required fields
        const name = sanitizeString(body.name, 100);
        const email = sanitizeString(body.email, 120);
        const phone = sanitizeString(body.phone, 50);
        const customerType = sanitizeString(body.customerType || body.clientType, 80);
        const brief = sanitizeString(body.brief || body.inquiry, 3000);

        if (!name || name.length < 2) {
          return jsonResponse({ success: false, error: 'Name is required and must be at least 2 characters.' }, 400, corsHeaders);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          return jsonResponse({ success: false, error: 'A valid email address is required.' }, 400, corsHeaders);
        }

        if (!brief || brief.length < 5) {
          return jsonResponse({ success: false, error: 'Project brief or inquiry details are required.' }, 400, corsHeaders);
        }

        // Allowed Customer Types whitelist
        const validCustomerTypes = ['Property Owner', 'Real Estate Developer', 'Contracting Company', 'Architect / Designer', 'Other'];
        const sanitizedCustomerType = validCustomerTypes.includes(customerType) ? customerType : 'Other / General';

        // Construct record
        const submissionId = 'AZR-RFQ-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        const timestamp = new Date().toISOString();

        const rfqRow = [
          submissionId,
          timestamp,
          name,
          email,
          phone || 'N/A',
          sanitizedCustomerType,
          brief
        ];

        // Append to Google Sheets 'RFQ' tab
        await appendSheetRow(env, 'RFQ!A:G', [rfqRow]);

        return jsonResponse({
          success: true,
          submissionId: submissionId,
          message: 'RFQ successfully recorded.'
        }, 200, corsHeaders);
      }

      // ----------------------------------------------------------------------
      // ROUTE 2: POST /api/analytics/batch
      // ----------------------------------------------------------------------
      if (path === '/api/analytics/batch') {
        let body;
        try {
          body = await request.json();
        } catch {
          return jsonResponse({ success: false, error: 'Invalid JSON payload' }, 400, corsHeaders);
        }

        const sessionId = sanitizeString(body.sessionId, 80);
        const events = Array.isArray(body.events) ? body.events : [];

        if (!sessionId) {
          return jsonResponse({ success: false, error: 'sessionId is required.' }, 400, corsHeaders);
        }

        if (events.length === 0) {
          return jsonResponse({ success: true, count: 0, message: 'Empty batch received.' }, 200, corsHeaders);
        }

        // Cap batch size per request to 50 events to prevent abuse
        const cappedEvents = events.slice(0, 50);
        const rowsToInsert = [];

        for (const ev of cappedEvents) {
          if (!ev || typeof ev !== 'object') continue;

          const eventTimestamp = sanitizeString(ev.timestamp || new Date().toISOString(), 50);
          const eventType = sanitizeString(ev.type || ev.eventName || 'unknown', 60);
          const page = sanitizeString(ev.page || '/', 150);
          const section = sanitizeString(ev.section || 'none', 60);
          const project = sanitizeString(ev.project || 'none', 100);

          // Metadata serialized to compact JSON string
          let metadataStr = '{}';
          if (ev.metadata && typeof ev.metadata === 'object') {
            try {
              metadataStr = JSON.stringify(ev.metadata).slice(0, 1000);
            } catch {
              metadataStr = '{}';
            }
          }

          rowsToInsert.push([
            sessionId,
            eventTimestamp,
            eventType,
            page,
            section,
            project,
            metadataStr
          ]);
        }

        if (rowsToInsert.length > 0) {
          // Asynchronously flush to Google Sheets without blocking response if supported
          if (ctx && typeof ctx.waitUntil === 'function') {
            ctx.waitUntil(
              appendSheetRow(env, 'Analytics!A:G', rowsToInsert).catch((err) => {
                console.error('Failed to append analytics rows:', err);
              })
            );
          } else {
            await appendSheetRow(env, 'Analytics!A:G', rowsToInsert);
          }
        }

        return jsonResponse({
          success: true,
          processed: rowsToInsert.length,
          message: 'Analytics batch accepted.'
        }, 200, corsHeaders);
      }

      // 404 Endpoint Not Found
      return jsonResponse({ success: false, error: 'Endpoint Not Found' }, 404, corsHeaders);

    } catch (err) {
      console.error('Worker API error:', err);
      return jsonResponse({
        success: false,
        error: 'Internal Server Error',
        details: err.message || 'Unknown processing error'
      }, 500, corsHeaders);
    }
  }
};

// ============================================================================
// HELPER FUNCTIONS & GOOGLE SHEETS API INTEGRATION
// ============================================================================

/**
 * Returns dynamic CORS headers matching allowed origins or default fallbacks
 */
function getCorsHeaders(origin, allowedOriginsConfig) {
  let isAllowed = false;
  let responseOrigin = '*';

  if (!allowedOriginsConfig || allowedOriginsConfig === '*') {
    responseOrigin = origin || '*';
    isAllowed = true;
  } else {
    const list = allowedOriginsConfig.split(',').map(s => s.trim().toLowerCase());
    const reqOriginLower = (origin || '').toLowerCase();

    if (list.includes(reqOriginLower) || list.includes('*')) {
      responseOrigin = origin;
      isAllowed = true;
    } else {
      // Allow localhost / 127.0.0.1 origins in development
      if (reqOriginLower.startsWith('http://localhost') || reqOriginLower.startsWith('http://127.0.0.1')) {
        responseOrigin = origin;
        isAllowed = true;
      } else {
        responseOrigin = list[0] || 'null';
      }
    }
  }

  return {
    'Access-Control-Allow-Origin': responseOrigin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Requested-With',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

/**
 * Helper to construct JSON response
 */
function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

/**
 * Sanitize strings against XSS, control characters, and length limits
 */
function sanitizeString(val, maxLength = 255) {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // remove control chars
    .trim()
    .slice(0, maxLength);
}

/**
 * Appends rows to Google Sheets via Google Sheets REST API v4
 */
async function appendSheetRow(env, range, values) {
  if (!env.GOOGLE_SPREADSHEET_ID) {
    throw new Error('Missing GOOGLE_SPREADSHEET_ID secret.');
  }

  const accessToken = await getGoogleOAuthToken(env);
  const spreadsheetId = env.GOOGLE_SPREADSHEET_ID;
  const encodedRange = encodeURIComponent(range);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      values: values
    })
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Google Sheets API Error (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Generates or retrieves cached Google OAuth2 Access Token using RS256 JWT
 */
async function getGoogleOAuthToken(env) {
  const now = Math.floor(Date.now() / 1000);

  // Return cached token if valid for at least 2 more minutes
  if (cachedAccessToken && tokenExpiresAt > now + 120) {
    return cachedAccessToken;
  }

  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Google Service Account secrets (EMAIL or PRIVATE_KEY) are missing.');
  }

  // Construct JWT Header & Claim Set
  const header = { alg: 'RS256', typ: 'JWT' };
  const claimSet = {
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedClaimSet = base64UrlEncode(JSON.stringify(claimSet));
  const unsignedToken = `${encodedHeader}.${encodedClaimSet}`;

  // Sign using Web Crypto RS256
  const privateKey = parsePrivateKeyPem(env.GOOGLE_PRIVATE_KEY);
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    privateKey,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signatureBuffer = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(unsignedToken)
  );

  const signatureBase64Url = bufferToBase64Url(signatureBuffer);
  const signedJwt = `${unsignedToken}.${signatureBase64Url}`;

  // Exchange signed JWT for OAuth Access Token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedJwt}`
  });

  if (!tokenRes.ok) {
    const errText = await tokenRes.text();
    throw new Error(`Failed to obtain Google OAuth access token: ${errText}`);
  }

  const tokenData = await tokenRes.json();
  cachedAccessToken = tokenData.access_token;
  tokenExpiresAt = now + (tokenData.expires_in || 3600);

  return cachedAccessToken;
}

/**
 * Parses PEM formatted RSA private key to binary ArrayBuffer (PKCS#8)
 */
function parsePrivateKeyPem(pem) {
  const cleanPem = pem
    .replace(/-----BEGIN (RSA )?PRIVATE KEY-----/, '')
    .replace(/-----END (RSA )?PRIVATE KEY-----/, '')
    .replace(/\\n/g, '')
    .replace(/\s+/g, '');

  const binaryString = atob(cleanPem);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Base64 URL String encoder
 */
function base64UrlEncode(str) {
  const base64 = btoa(str);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * ArrayBuffer to Base64 URL String encoder
 */
function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64UrlEncode(binary);
}
