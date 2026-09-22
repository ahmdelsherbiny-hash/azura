/**
 * ============================================================================
 * AZURA STUDIO — SECURE BACKEND API WORKER (Cloudflare Worker ES Module)
 * ============================================================================
 * Hardened endpoints:
 * 1. POST /api/rfq             - Bounded, literal raw append to Google Sheets
 * 2. POST /api/analytics/batch - Bounded, schema-allowlisted event telemetry
 * 3. GET /api/dashboard/data  - Authenticated local dashboard data
 *
 * Security controls:
 * - Literal spreadsheet storage (valueInputOption=RAW) to prevent formula evaluation
 * - Hard 100 KiB byte stream limit before parsing; Content-Type: application/json enforcement
 * - Cloudflare Rate Limiting binding integration (RATE_LIMITER_RFQ, RATE_LIMITER_ANALYTICS)
 * - Strict analytics event & metadata allowlist; batch size capped at 50
 * - Geolocation minimization (country code only via request.cf; no city/region/tz)
 * - Generic error masking with request correlation IDs (no secret/stack leak)
 * ============================================================================
 */

let cachedAccessToken = null;
let tokenExpiresAt = 0;

// Permitted analytics event types
const ALLOWED_ANALYTICS_EVENTS = new Set([
  'session_start',
  'session_end',
  'section_view',
  'project_click',
  'social_link_click',
  'cta_click',
  'project_slide_view',
  'theme_changed',
  'language_changed',
  'rfq_start',
  'rfq_submit'
]);

// Permitted metadata keys across allowed events
const ALLOWED_METADATA_KEYS = new Set([
  'device',
  'os',
  'screen',
  'lang',
  'theme',
  'durationSec',
  'totalSeconds',
  'referrer',
  'platform',
  'label',
  'slideIndex',
  'customerType',
  'submissionId'
]);

const SESSION_ID_REGEX = /^[a-zA-Z0-9_-]{8,80}$/;

export default {
  async fetch(request, env, ctx) {
    const correlationId = typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : ('azr-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8));

    const origin = request.headers.get('Origin') || '';
    const corsHeaders = getCorsHeaders(origin, env.ALLOWED_ORIGINS);

    // 1. Handle CORS Preflight (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: corsHeaders
      });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/\/+$/, '');

    if (path === '/api/dashboard/data' && request.method === 'GET') {
      const privateHeaders = { 'Cache-Control': 'no-store' };
      if (!env.AZURA_DASHBOARD_SECRET) {
        console.error(`[${correlationId}] Dashboard secret unavailable`);
        return jsonResponse({ success: false, error: 'Service Unavailable' }, 503, privateHeaders);
      }
      if (request.headers.get('Authorization') !== `Bearer ${env.AZURA_DASHBOARD_SECRET}`) {
        return jsonResponse({ success: false, error: 'Unauthorized' }, 401, privateHeaders);
      }
      try {
        const [rfqRows, analyticsRows] = await Promise.all([
          fetchSheetRows(env, 'RFQ!A2:H'),
          fetchSheetRows(env, 'Analytics!A2:G')
        ]);
        return jsonResponse({
          success: true,
          fetchedAt: new Date().toISOString(),
          rfq: rfqRows.map(mapRfqRow),
          analytics: analyticsRows.map(mapAnalyticsRow)
        }, 200, privateHeaders);
      } catch {
        console.error(`[${correlationId}] Dashboard Sheet read failed`);
        return jsonResponse({ success: false, error: 'Dashboard data unavailable' }, 502, privateHeaders);
      }
    }

    // 2. Reject non-POST requests on API routes
    if (request.method !== 'POST') {
      return jsonResponse({ success: false, error: 'Method Not Allowed' }, 405, corsHeaders);
    }

    // 3. Extract Country-only Geolocation (Strictly request.cf.country; never client-supplied headers)
    const country = sanitizeString(request.cf?.country || 'Unknown', 10);

    try {
      // ----------------------------------------------------------------------
      // ROUTE 1: POST /api/rfq
      // ----------------------------------------------------------------------
      if (path === '/api/rfq') {
        // Rate Limiting check before consuming body
        if (!env.RATE_LIMITER_RFQ || typeof env.RATE_LIMITER_RFQ.limit !== 'function') {
          console.error(`[${correlationId}] RFQ rate limiter unavailable`);
          return jsonResponse({ success: false, error: 'Service Unavailable' }, 503, corsHeaders);
        }
        const rfqClientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
        const rfqRateResult = await env.RATE_LIMITER_RFQ.limit({ key: rfqClientIp });
        if (rfqRateResult?.success === false) {
          return jsonResponse(
            { success: false, error: 'Too Many Requests' },
            429,
            { ...corsHeaders, 'Retry-After': '60' }
          );
        }
        if (rfqRateResult?.success !== true) {
          console.error(`[${correlationId}] RFQ rate limiter returned an invalid result`);
          return jsonResponse({ success: false, error: 'Service Unavailable' }, 503, corsHeaders);
        }

        // Bounded body reader (100 KiB limit)
        const parsed = await readBoundedJson(request, 102400);
        if (parsed.error) {
          return jsonResponse({ success: false, error: parsed.error }, parsed.status, corsHeaders);
        }
        const body = parsed.data;

        // Honeypot spam check: silently succeed without writing to sheet
        if (body._hp && String(body._hp).trim().length > 0) {
          return jsonResponse({ success: true, message: 'Submission received.' }, 200, corsHeaders);
        }

        const name = sanitizeString(body.name, 100);
        const email = sanitizeString(body.email, 120);
        const phone = sanitizeString(body.phone, 50);
        const customerType = sanitizeString(body.customerType || body.clientType, 80);
        const brief = sanitizeString(body.brief || body.inquiry, 3000);

        if (!name || name.length < 2) {
          return jsonResponse({ success: false, error: 'Name is required (at least 2 characters).' }, 400, corsHeaders);
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email || !emailRegex.test(email)) {
          return jsonResponse({ success: false, error: 'A valid email address is required.' }, 400, corsHeaders);
        }

        if (!brief || brief.length < 5) {
          return jsonResponse({ success: false, error: 'Project brief or inquiry details are required.' }, 400, corsHeaders);
        }

        const validCustomerTypes = [
          'Property Owner',
          'Real Estate Developer',
          'Contracting Company',
          'Architect / Designer',
          'Other'
        ];
        const sanitizedCustomerType = validCustomerTypes.includes(customerType) ? customerType : 'Other / General';

        const submissionId = 'AZR-RFQ-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
        const timestamp = new Date().toISOString();

        // Stored row: country only (no city, region, or timezone)
        const rfqRow = [
          submissionId,
          timestamp,
          name,
          email,
          phone || 'N/A',
          sanitizedCustomerType,
          brief,
          country
        ];

        // Append before notifying: a mail failure must never lose the request.
        await appendSheetRow(env, 'RFQ!A:H', [rfqRow]);

        let notificationSent = false;
        try {
          await sendRfqNotification(env, {
            submissionId, timestamp, name, email, phone,
            customerType: sanitizedCustomerType, brief, country
          });
          notificationSent = true;
        } catch {
          console.error(`[${correlationId}] RFQ notification failed for ${submissionId}`);
        }

        return jsonResponse({
          success: true,
          submissionId: submissionId,
          notificationSent,
          message: 'Quotation request successfully submitted.'
        }, 200, corsHeaders);
      }

      // ----------------------------------------------------------------------
      // ROUTE 2: POST /api/analytics/batch
      // ----------------------------------------------------------------------
      if (path === '/api/analytics/batch') {
        // Rate Limiting check before consuming body
        if (!env.RATE_LIMITER_ANALYTICS || typeof env.RATE_LIMITER_ANALYTICS.limit !== 'function') {
          console.error(`[${correlationId}] Analytics rate limiter unavailable`);
          return jsonResponse({ success: false, error: 'Service Unavailable' }, 503, corsHeaders);
        }
        const analyticsClientIp = request.headers.get('CF-Connecting-IP') || 'unknown';
        const analyticsRateResult = await env.RATE_LIMITER_ANALYTICS.limit({ key: analyticsClientIp });
        if (analyticsRateResult?.success === false) {
          return jsonResponse(
            { success: false, error: 'Too Many Requests' },
            429,
            { ...corsHeaders, 'Retry-After': '60' }
          );
        }
        if (analyticsRateResult?.success !== true) {
          console.error(`[${correlationId}] Analytics rate limiter returned an invalid result`);
          return jsonResponse({ success: false, error: 'Service Unavailable' }, 503, corsHeaders);
        }

        // Bounded body reader (100 KiB limit)
        const parsed = await readBoundedJson(request, 102400);
        if (parsed.error) {
          return jsonResponse({ success: false, error: parsed.error }, parsed.status, corsHeaders);
        }
        const body = parsed.data;

        const sessionId = sanitizeString(body.sessionId, 80);
        if (!sessionId || !SESSION_ID_REGEX.test(sessionId)) {
          return jsonResponse({ success: false, error: 'Invalid sessionId format.' }, 400, corsHeaders);
        }

        if (!Array.isArray(body.events)) {
          return jsonResponse({ success: false, error: 'events must be an array.' }, 400, corsHeaders);
        }

        if (body.events.length === 0) {
          return jsonResponse({ success: true, processed: 0, message: 'Empty batch received.' }, 200, corsHeaders);
        }

        if (body.events.length > 50) {
          return jsonResponse({ success: false, error: 'Batch size exceeds maximum limit of 50 events.' }, 400, corsHeaders);
        }

        const rowsToInsert = [];

        for (const ev of body.events) {
          if (!ev || typeof ev !== 'object' || Array.isArray(ev)) {
            return jsonResponse({ success: false, error: 'Invalid event item in batch.' }, 400, corsHeaders);
          }

          const rawEventType = String(ev.type || ev.eventName || '').trim();
          if (!ALLOWED_ANALYTICS_EVENTS.has(rawEventType)) {
            return jsonResponse({ success: false, error: `Unauthorized event type: ${rawEventType.slice(0, 30)}` }, 400, corsHeaders);
          }

          // Validate timestamp (ISO string fallback to server time if invalid)
          let eventTimestamp = new Date().toISOString();
          if (ev.timestamp && typeof ev.timestamp === 'string') {
            const parsedTs = Date.parse(ev.timestamp);
            if (!isNaN(parsedTs)) {
              eventTimestamp = new Date(parsedTs).toISOString();
            }
          }

          const page = sanitizeString(ev.page || '/', 100);
          const section = sanitizeString(ev.section || 'none', 50);
          const project = sanitizeString(ev.project || 'none', 80);

          // Sanitize metadata against strict allowlist & primitive value bounds
          const sanitizedMeta = {};
          if (ev.metadata && typeof ev.metadata === 'object' && !Array.isArray(ev.metadata)) {
            for (const [k, v] of Object.entries(ev.metadata)) {
              if (ALLOWED_METADATA_KEYS.has(k)) {
                if (typeof v === 'string') {
                  sanitizedMeta[k] = sanitizeString(v, 100);
                } else if (typeof v === 'number' && Number.isFinite(v)) {
                  sanitizedMeta[k] = v;
                } else if (typeof v === 'boolean') {
                  sanitizedMeta[k] = v;
                }
              }
            }
          }

          // Country-only geo attached to metadata
          sanitizedMeta.country = country;

          let metadataStr = '{}';
          try {
            metadataStr = JSON.stringify(sanitizedMeta).slice(0, 800);
          } catch {
            metadataStr = '{}';
          }

          rowsToInsert.push([
            sessionId,
            eventTimestamp,
            rawEventType,
            page,
            section,
            project,
            metadataStr
          ]);
        }

        // A successful response means Sheets accepted the batch; clients retry failures.
        await appendSheetRow(env, 'Analytics!A:G', rowsToInsert);

        return jsonResponse({
          success: true,
          processed: rowsToInsert.length,
          geo: { country },
          message: 'Analytics batch accepted.'
        }, 200, corsHeaders);
      }

      // 404 Route Not Found
      return jsonResponse({ success: false, error: 'Endpoint Not Found' }, 404, corsHeaders);

    } catch (err) {
      // Internal error masking: never leak tokens, Google error payloads, or stack traces
      console.error(`[${correlationId}] Worker error on ${path}:`, err?.name || 'Error');
      return jsonResponse({
        success: false,
        error: 'Internal Server Error',
        correlationId
      }, 500, corsHeaders);
    }
  }
};

// ============================================================================
// BOUNDED STREAM READER & PARSER (100 KiB MAX, NO request.json() RE-CONSUME)
// ============================================================================

async function readBoundedJson(request, maxBytes = 102400) {
  const contentType = request.headers.get('Content-Type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return { error: 'Unsupported Media Type. Content-Type must be application/json.', status: 415 };
  }

  const contentLengthHeader = request.headers.get('Content-Length');
  if (contentLengthHeader) {
    const cl = parseInt(contentLengthHeader, 10);
    if (!isNaN(cl) && cl > maxBytes) {
      return { error: 'Payload Too Large. Max size is 100KB.', status: 413 };
    }
  }

  if (!request.body) {
    return { error: 'Request body is required.', status: 400 };
  }

  const reader = request.body.getReader();
  const chunks = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel('Payload ceiling exceeded');
        return { error: 'Payload Too Large. Max size is 100KB.', status: 413 };
      }
      chunks.push(value);
    }
  } catch {
    return { error: 'Failed to read request body stream.', status: 400 };
  }

  const combined = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    combined.set(chunk, offset);
    offset += chunk.byteLength;
  }

  const text = new TextDecoder('utf-8').decode(combined);
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: 'Invalid JSON payload.', status: 400 };
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { error: 'JSON payload root must be an object.', status: 400 };
  }

  return { data };
}

// ============================================================================
// HELPER FUNCTIONS & GOOGLE SHEETS API V4 INTEGRATION
// ============================================================================

function getCorsHeaders(origin, allowedOriginsConfig) {
  let responseOrigin = '*';

  if (!allowedOriginsConfig || allowedOriginsConfig === '*') {
    responseOrigin = origin || '*';
  } else {
    const list = allowedOriginsConfig.split(',').map(s => s.trim().toLowerCase());
    const reqOriginLower = (origin || '').toLowerCase();

    if (list.includes(reqOriginLower) || list.includes('*')) {
      responseOrigin = origin;
    } else if (reqOriginLower.startsWith('http://localhost') || reqOriginLower.startsWith('http://127.0.0.1')) {
      responseOrigin = origin;
    } else {
      responseOrigin = list[0] || 'null';
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

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...headers,
      'Content-Type': 'application/json; charset=utf-8'
    }
  });
}

function sanitizeString(val, maxLength = 255) {
  if (val === undefined || val === null) return '';
  return String(val)
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function mapRfqRow(row) {
  return {
    submissionId: row[0] || '',
    timestamp: row[1] || '',
    name: row[2] || '',
    email: row[3] || '',
    phone: row[4] || '',
    customerType: row[5] || '',
    brief: row[6] || '',
    location: row[7] || 'Unknown'
  };
}

function mapAnalyticsRow(row) {
  let metadata = {};
  try {
    metadata = row[6] ? JSON.parse(row[6]) : {};
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) metadata = {};
  } catch {
    metadata = {};
  }
  return {
    sessionId: row[0] || '',
    timestamp: row[1] || '',
    type: row[2] || '',
    page: row[3] || '/',
    section: row[4] || 'none',
    project: row[5] || 'none',
    metadata
  };
}

async function fetchSheetRows(env, range) {
  const accessToken = await getGoogleOAuthToken(env);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${env.GOOGLE_SPREADSHEET_ID}/values/${encodeURIComponent(range)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!response.ok) throw new Error(`Google Sheets read failed with HTTP ${response.status}`);
  const sheet = await response.json();
  return Array.isArray(sheet.values) ? sheet.values : [];
}

async function sendRfqNotification(env, rfq) {
  if (!env.RESEND_API_KEY) {
    throw new Error('Missing RESEND_API_KEY');
  }

  const lines = [
    `New quotation request: ${rfq.submissionId}`,
    `Submitted: ${rfq.timestamp}`,
    `Name: ${rfq.name}`,
    `Email: ${rfq.email}`,
    `Phone: ${rfq.phone || 'N/A'}`,
    `Client type: ${rfq.customerType}`,
    `Country: ${rfq.country}`,
    '',
    'Project brief:',
    rfq.brief
  ];

  const emailBody = JSON.stringify({
    from: 'Azura Studio <contact@azurastudio.site>',
    to: [env.RFQ_NOTIFICATION_TO || 'ahmd.elsherbiny@gmail.com'],
    subject: `New RFQ ${rfq.submissionId}`,
    text: lines.join('\n')
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
          'Idempotency-Key': `rfq/${rfq.submissionId}`
        },
        body: emailBody,
        signal: controller.signal
      });
      if (response.ok) return;
      if (response.status < 500 || attempt === 1) throw new Error(`Resend HTTP ${response.status}`);
    } catch (error) {
      if (attempt === 1) throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
}

async function appendSheetRow(env, range, values) {
  if (!env.GOOGLE_SPREADSHEET_ID) {
    throw new Error('Missing GOOGLE_SPREADSHEET_ID configuration.');
  }

  const accessToken = await getGoogleOAuthToken(env);
  const spreadsheetId = env.GOOGLE_SPREADSHEET_ID;
  const encodedRange = encodeURIComponent(range);

  // Literal raw string append to prevent formula injection
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ values })
  });

  if (!res.ok) {
    // Do not log or expose raw error text in public contexts
    throw new Error(`Google Sheets API responded with HTTP ${res.status}`);
  }

  return await res.json();
}

async function getGoogleOAuthToken(env) {
  const now = Math.floor(Date.now() / 1000);

  if (cachedAccessToken && tokenExpiresAt > now + 120) {
    return cachedAccessToken;
  }

  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Missing Google credentials in configuration.');
  }

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

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${signedJwt}`
  });

  if (!tokenRes.ok) {
    throw new Error(`Google OAuth exchange failed with HTTP ${tokenRes.status}`);
  }

  const tokenData = await tokenRes.json();
  cachedAccessToken = tokenData.access_token;
  tokenExpiresAt = now + (tokenData.expires_in || 3600);

  return cachedAccessToken;
}

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

function base64UrlEncode(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return base64UrlEncode(binary);
}
