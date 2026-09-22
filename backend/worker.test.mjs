import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import worker from './worker.js';

// Generate a valid RSA private key in PKCS8 PEM format for testing WebCrypto RS256 signing
const { privateKey: testPrivateKeyPem } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

// Helper to create mock environment
function createMockEnv(overrides = {}) {
  return {
    GOOGLE_SPREADSHEET_ID: 'mock-sheet-id-123',
    GOOGLE_SERVICE_ACCOUNT_EMAIL: 'azura-service@example.iam.gserviceaccount.com',
    GOOGLE_PRIVATE_KEY: testPrivateKeyPem,
    RESEND_API_KEY: 're_test_key',
    RFQ_NOTIFICATION_TO: 'contact@azurastudio.site',
    ALLOWED_ORIGINS: 'https://azurastudio.site,https://www.azurastudio.site',
    RATE_LIMITER_RFQ: { limit: async () => ({ success: true }) },
    RATE_LIMITER_ANALYTICS: { limit: async () => ({ success: true }) },
    ...overrides
  };
}

// Helper to mock global fetch for Google OAuth and Sheets
function setupFetchMock({ onSheetsAppend, onSheetsRead, onResend } = {}) {
  const originalFetch = globalThis.fetch;
  const calls = [];

  globalThis.fetch = async (url, options = {}) => {
    const urlStr = String(url);
    calls.push({ url: urlStr, options });

    // Mock OAuth token exchange
    if (urlStr.includes('oauth2.googleapis.com/token')) {
      return new Response(JSON.stringify({
        access_token: 'mock-google-access-token',
        expires_in: 3600,
        token_type: 'Bearer'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mock Sheets Append API
    if (urlStr.includes('sheets.googleapis.com/v4/spreadsheets')) {
      if (!urlStr.includes(':append') && onSheetsRead) {
        return onSheetsRead(urlStr, options);
      }
      if (onSheetsAppend) {
        return onSheetsAppend(urlStr, options);
      }
      return new Response(JSON.stringify({
        spreadsheetId: 'mock-sheet-id-123',
        tableRange: 'RFQ!A1:G1',
        updates: { updatedRows: 1 }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (urlStr === 'https://api.resend.com/emails') {
      if (onResend) return onResend(urlStr, options);
      return new Response(JSON.stringify({ id: 'mock-email-id' }), { status: 200 });
    }

    // Default fallback
    return new Response('Not Found', { status: 404 });
  };

  return {
    calls,
    restore() {
      globalThis.fetch = originalFetch;
    }
  };
}

// ----------------------------------------------------------------------------
// TEST SUITE: TASK 1 — RAW SPREADSHEET WRITES (FORMULA INJECTION DEFENSE)
// ----------------------------------------------------------------------------

test('Task 1: RFQ brief starting with formula "=" uses valueInputOption=RAW and preserves literal text', async () => {
  let capturedAppendUrl = null;
  let capturedAppendBody = null;

  const fetchMock = setupFetchMock({
    onSheetsAppend: (url, options) => {
      capturedAppendUrl = url;
      capturedAppendBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ updates: { updatedRows: 1 } }), { status: 200 });
    }
  });

  try {
    const env = createMockEnv();
    const formulaPayload = {
      name: 'Dr. John Doe',
      email: 'john@example.com',
      phone: '+201000000000',
      customerType: 'Property Owner',
      brief: '=cmd|\'/C calc\'!\'A0\''
    };

    const request = new Request('https://azura.test/api/rfq', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Origin': 'https://azurastudio.site'
      },
      body: JSON.stringify(formulaPayload)
    });

    const response = await worker.fetch(request, env, {});
    assert.equal(response.status, 200);

    const json = await response.json();
    assert.equal(json.success, true);

    // Verify Google Sheets append URL explicitly uses valueInputOption=RAW
    assert.ok(capturedAppendUrl, 'Sheets API append must be called');
    assert.ok(capturedAppendUrl.includes('valueInputOption=RAW'), `Expected URL to include valueInputOption=RAW, got: ${capturedAppendUrl}`);
    assert.ok(!capturedAppendUrl.includes('valueInputOption=USER_ENTERED'), 'Must not contain USER_ENTERED');

    // Verify raw brief text is preserved without formula execution
    const appendedRow = capturedAppendBody.values[0];
    assert.equal(appendedRow[6], '=cmd|\'/C calc\'!\'A0\'');
  } finally {
    fetchMock.restore();
  }
});

test('RFQ saved to Sheet sends the same request details by email', async () => {
  const fetchMock = setupFetchMock();
  try {
    const response = await worker.fetch(new Request('https://azura.test/api/rfq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Ahmed Example', email: 'ahmed@example.com', phone: '+201000000000',
        customerType: 'Property Owner', brief: 'Apartment renovation project'
      })
    }), createMockEnv(), {});

    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.notificationSent, true);
    const sheetCall = fetchMock.calls.find(call => call.url.includes('sheets.googleapis.com'));
    const emailCall = fetchMock.calls.find(call => call.url === 'https://api.resend.com/emails');
    assert.ok(sheetCall);
    assert.ok(emailCall);
    assert.ok(sheetCall.url.includes('RFQ!A%3AH'));
    assert.ok(fetchMock.calls.indexOf(sheetCall) < fetchMock.calls.indexOf(emailCall));
    assert.equal(emailCall.options.headers['Idempotency-Key'], `rfq/${result.submissionId}`);
    const email = JSON.parse(emailCall.options.body);
    assert.deepEqual(email.to, ['contact@azurastudio.site']);
    assert.match(email.text, /Ahmed Example/);
    assert.match(email.text, /Apartment renovation project/);
    assert.doesNotMatch(email.text, /Session ID|Sections:/);
  } finally {
    fetchMock.restore();
  }
});

test('RFQ stays successful after mail provider failure because Sheet append succeeded', async () => {
  const fetchMock = setupFetchMock({ onResend: () => new Response('provider failure', { status: 503 }) });
  const originalConsoleError = console.error;
  console.error = () => {};
  try {
    const response = await worker.fetch(new Request('https://azura.test/api/rfq', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Jane Doe', email: 'jane@example.com', brief: 'Interior design project' })
    }), createMockEnv(), {});
    const result = await response.json();
    assert.equal(response.status, 200);
    assert.equal(result.notificationSent, false);
    assert.ok(fetchMock.calls.some(call => call.url.includes('sheets.googleapis.com')));
  } finally {
    console.error = originalConsoleError;
    fetchMock.restore();
  }
});

// ----------------------------------------------------------------------------
// TEST SUITE: TASK 2 — BOUNDED REQUESTS (100 KiB STREAM LIMIT & VALIDATION)
// ----------------------------------------------------------------------------

test('Task 2: Request body exceeding 100 KiB stream ceiling returns 413 without Google API call', async () => {
  const fetchMock = setupFetchMock();

  try {
    const env = createMockEnv();
    // Generate chunked stream larger than 102400 bytes (e.g. 105 KiB)
    const chunkSize = 1024;
    const chunkCount = 105;
    const stream = new ReadableStream({
      start(controller) {
        const chunk = new Uint8Array(chunkSize).fill(65); // 'A'
        for (let i = 0; i < chunkCount; i++) {
          controller.enqueue(chunk);
        }
        controller.close();
      }
    });

    const request = new Request('https://azura.test/api/rfq', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: stream,
      duplex: 'half'
    });

    const response = await worker.fetch(request, env, {});
    assert.equal(response.status, 413);

    const json = await response.json();
    assert.equal(json.success, false);
    assert.equal(fetchMock.calls.length, 0, 'No Google API calls should occur on 413');
  } finally {
    fetchMock.restore();
  }
});

test('Task 2: Non-JSON Content-Type returns 415', async () => {
  const fetchMock = setupFetchMock();

  try {
    const env = createMockEnv();
    const request = new Request('https://azura.test/api/rfq', {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain'
      },
      body: 'plain text data'
    });

    const response = await worker.fetch(request, env, {});
    assert.equal(response.status, 415);
    assert.equal(fetchMock.calls.length, 0);
  } finally {
    fetchMock.restore();
  }
});

test('Task 2: Malformed JSON or non-object root returns 400', async () => {
  const fetchMock = setupFetchMock();

  try {
    const env = createMockEnv();
    // Malformed JSON
    const req1 = new Request('https://azura.test/api/rfq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"name": "broken'
    });
    const res1 = await worker.fetch(req1, env, {});
    assert.equal(res1.status, 400);

    // Array root
    const req2 = new Request('https://azura.test/api/rfq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(['malicious', 'array'])
    });
    const res2 = await worker.fetch(req2, env, {});
    assert.equal(res2.status, 400);

    assert.equal(fetchMock.calls.length, 0);
  } finally {
    fetchMock.restore();
  }
});

// ----------------------------------------------------------------------------
// TEST SUITE: TASK 3 — RESTRICT ANALYTICS DATA & EVENT ALLOWLIST
// ----------------------------------------------------------------------------

test('Task 3: Analytics event allowlist rejects unauthorized events with 400', async () => {
  const fetchMock = setupFetchMock();

  try {
    const env = createMockEnv();
    const request = new Request('https://azura.test/api/analytics/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'azr_abc12345_xyz98765',
        events: [
          {
            type: 'unauthorized_attacker_event',
            timestamp: new Date().toISOString()
          }
        ]
      })
    });

    const response = await worker.fetch(request, env, {});
    assert.equal(response.status, 400);

    const json = await response.json();
    assert.equal(json.success, false);
    assert.equal(fetchMock.calls.length, 0);
  } finally {
    fetchMock.restore();
  }
});

test('Task 3: Analytics rejects invalid sessionId or batches exceeding 50 events with 400', async () => {
  const fetchMock = setupFetchMock();

  try {
    const env = createMockEnv();
    // Invalid sessionId
    const req1 = new Request('https://azura.test/api/analytics/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'invalid!char$#@',
        events: []
      })
    });
    const res1 = await worker.fetch(req1, env, {});
    assert.equal(res1.status, 400);

    // Over 50 events
    const overLimitEvents = Array.from({ length: 51 }, () => ({
      type: 'section_view',
      timestamp: new Date().toISOString()
    }));
    const req2 = new Request('https://azura.test/api/analytics/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'azr_valid_session_123',
        events: overLimitEvents
      })
    });
    const res2 = await worker.fetch(req2, env, {});
    assert.equal(res2.status, 400);
    const json2 = await res2.json();
    assert.ok(json2.error.includes('exceeds maximum limit of 50'));

    assert.equal(fetchMock.calls.length, 0);
  } finally {
    fetchMock.restore();
  }
});

test('Task 3: Valid allowed analytics events pass with sanitized bounded metadata', async () => {
  let capturedAppendBody = null;

  const fetchMock = setupFetchMock({
    onSheetsAppend: (url, options) => {
      capturedAppendBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ updates: { updatedRows: 1 } }), { status: 200 });
    }
  });

  try {
    const env = createMockEnv();
    const request = new Request('https://azura.test/api/analytics/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'azr_abc12345_xyz98765',
        events: [
          {
            type: 'section_view',
            timestamp: new Date().toISOString(),
            page: '/',
            section: 'hero',
            metadata: {
              device: 'Desktop',
              os: 'Windows',
              unapproved_arbitrary_key: 'should_be_stripped'
            }
          }
        ]
      })
    });

    const response = await worker.fetch(request, env, {});
    assert.equal(response.status, 200);

    assert.ok(capturedAppendBody, 'Analytics batch should append to Sheets');
    const insertedRow = capturedAppendBody.values[0];
    const metadataParsed = JSON.parse(insertedRow[6]);

    // Allowed metadata exists
    assert.equal(metadataParsed.device, 'Desktop');
    assert.equal(metadataParsed.os, 'Windows');
    // Unapproved key was filtered out
    assert.equal(metadataParsed.unapproved_arbitrary_key, undefined);
  } finally {
    fetchMock.restore();
  }
});

test('Analytics does not report success when Sheets rejects the batch', async () => {
  const fetchMock = setupFetchMock({
    onSheetsAppend: () => new Response('upstream failure', { status: 503 })
  });
  try {
    const request = new Request('https://azura.test/api/analytics/batch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'azr_abc12345_xyz98765',
        events: [{ type: 'session_start', timestamp: new Date().toISOString() }]
      })
    });
    const response = await worker.fetch(request, createMockEnv(), {
      waitUntil: () => { throw new Error('Analytics must await the append'); }
    });
    assert.equal(response.status, 500);
    assert.equal((await response.json()).success, false);
  } finally {
    fetchMock.restore();
  }
});

// ----------------------------------------------------------------------------
// TEST SUITE: TASK 4 — RATE LIMITING BINDINGS
// ----------------------------------------------------------------------------

test('Task 4: Rate Limiter binding triggers 429 Too Many Requests with Retry-After', async () => {
  const fetchMock = setupFetchMock();

  try {
    const env = createMockEnv({
      RATE_LIMITER_RFQ: {
        limit: async ({ key }) => {
          assert.equal(key, '198.51.100.42');
          return { success: false }; // Denied
        }
      }
    });

    const request = new Request('https://azura.test/api/rfq', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CF-Connecting-IP': '198.51.100.42'
      },
      body: JSON.stringify({
        name: 'Jane Doe',
        email: 'jane@example.com',
        brief: 'Valid project brief for quotation'
      })
    });

    const response = await worker.fetch(request, env, {});
    assert.equal(response.status, 429);
    assert.equal(response.headers.get('Retry-After'), '60');
    assert.equal(fetchMock.calls.length, 0, 'No Google calls when rate limited');
  } finally {
    fetchMock.restore();
  }
});

test('Task 4: Missing rate limiter bindings fail closed with 503 before persistence', async () => {
  const fetchMock = setupFetchMock();
  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    const cases = [
      {
        route: '/api/rfq',
        missingBinding: 'RATE_LIMITER_RFQ',
        payload: { name: 'Jane Doe', email: 'jane@example.com', brief: 'Valid project brief' }
      },
      {
        route: '/api/analytics/batch',
        missingBinding: 'RATE_LIMITER_ANALYTICS',
        payload: { sessionId: 'azr_valid_session_123', events: [{ type: 'session_start' }] }
      }
    ];

    for (const { route, missingBinding, payload } of cases) {
      const env = createMockEnv({ [missingBinding]: undefined });
      const request = new Request(`https://azura.test${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const response = await worker.fetch(request, env, {});
      assert.equal(response.status, 503, `${route} must reject missing binding`);
      assert.equal((await response.json()).error, 'Service Unavailable');
    }

    assert.equal(fetchMock.calls.length, 0, 'No Google calls when a rate limiter is missing');
  } finally {
    console.error = originalConsoleError;
    fetchMock.restore();
  }
});

test('CORS preflight allows the www production site origin', async () => {
  const request = new Request('https://azura.test/api/rfq', {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://www.azurastudio.site',
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type'
    }
  });

  const response = await worker.fetch(request, createMockEnv(), {});
  assert.equal(response.status, 204);
  assert.equal(response.headers.get('Access-Control-Allow-Origin'), 'https://www.azurastudio.site');
});

test('dashboard data rejects unauthenticated requests before reading Google Sheets', async () => {
  const fetchMock = setupFetchMock();
  try {
    const response = await worker.fetch(new Request('https://azura.test/api/dashboard/data'),
      createMockEnv({ AZURA_DASHBOARD_SECRET: 'test-dashboard-secret' }), {});
    assert.equal(response.status, 401);
    assert.equal(fetchMock.calls.length, 0);
  } finally {
    fetchMock.restore();
  }
});

test('authorized local dashboard gets RFQ and analytics rows from Sheets', async () => {
  const fetchMock = setupFetchMock({
    onSheetsRead: (url) => new Response(JSON.stringify({
      values: url.includes('RFQ!')
        ? [['AZR-RFQ-1', '2026-09-21T10:00:00Z', 'Jane Doe', 'jane@example.com', '', 'Property Owner', 'Kitchen project', 'EG']]
        : [['azr_abc12345', '2026-09-21T10:00:00Z', 'session_start', '/', 'none', 'none', '{"device":"Mobile","country":"EG"}']]
    }), { status: 200 })
  });
  try {
    const request = new Request('https://azura.test/api/dashboard/data', {
      headers: { Authorization: 'Bearer test-dashboard-secret' }
    });
    const response = await worker.fetch(request, createMockEnv({ AZURA_DASHBOARD_SECRET: 'test-dashboard-secret' }), {});
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.rfq[0].submissionId, 'AZR-RFQ-1');
    assert.equal(payload.analytics[0].sessionId, 'azr_abc12345');
    assert.equal(payload.analytics[0].metadata.device, 'Mobile');
  } finally {
    fetchMock.restore();
  }
});

// ----------------------------------------------------------------------------
// TEST SUITE: TASK 5 — STOP INTERNAL ERROR DISCLOSURE
// ----------------------------------------------------------------------------

test('Task 5: Upstream Google API errors never leak secrets, stack traces, or internal error text', async () => {
  const SECRET_KEY_MARKER = 'SUPER_SECRET_LEAK_TEST_987654321';

  const fetchMock = setupFetchMock({
    onSheetsAppend: () => {
      // Simulate Google API failure leaking sensitive text
      return new Response(JSON.stringify({
        error: {
          code: 500,
          message: `Internal Google Sheets backend failure with secret token: ${SECRET_KEY_MARKER}`
        }
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  });

  try {
    const env = createMockEnv();
    const request = new Request('https://azura.test/api/rfq', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice',
        email: 'alice@example.com',
        brief: 'Testing error disclosure suppression'
      })
    });

    const response = await worker.fetch(request, env, {});
    assert.equal(response.status, 500);

    const bodyText = await response.text();
    assert.ok(!bodyText.includes(SECRET_KEY_MARKER), 'Public response must NEVER leak secret marker');
    assert.ok(!bodyText.includes('Google Sheets backend failure'), 'Public response must NOT leak Google error text');

    const json = JSON.parse(bodyText);
    assert.equal(json.success, false);
    assert.equal(json.error, 'Internal Server Error');
    assert.ok(json.correlationId, 'Must include safe correlationId');
  } finally {
    fetchMock.restore();
  }
});

// ----------------------------------------------------------------------------
// TEST SUITE: TASK 6 — GEOLOCATION MINIMIZATION (COUNTRY ONLY)
// ----------------------------------------------------------------------------

test('Task 6: Strictly uses request.cf.country and excludes city, region, and timezone', async () => {
  let capturedAppendBody = null;

  const fetchMock = setupFetchMock({
    onSheetsAppend: (url, options) => {
      capturedAppendBody = JSON.parse(options.body);
      return new Response(JSON.stringify({ updates: { updatedRows: 1 } }), { status: 200 });
    }
  });

  try {
    const env = createMockEnv();
    const request = new Request('https://azura.test/api/rfq', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Visitor attempts to spoof CF-IPCountry header
        'CF-IPCountry': 'SPOOFED'
      },
      body: JSON.stringify({
        name: 'Ahmed Elsherbiny',
        email: 'ahmed@example.com',
        brief: 'Valid inquiry with geo check'
      })
    });

    // Provide request.cf object from Cloudflare Edge
    request.cf = {
      country: 'EG',
      city: 'Cairo',
      region: 'Cairo Governorate',
      timezone: 'Africa/Cairo'
    };

    const response = await worker.fetch(request, env, {});
    assert.equal(response.status, 200);

    const row = capturedAppendBody.values[0];
    const locationField = row[7]; // index 7 is country in rfqRow [id, ts, name, email, phone, custType, brief, country]

    // Must be 'EG' only, not containing 'Cairo' or spoofed header
    assert.equal(locationField, 'EG');
    assert.ok(!locationField.includes('Cairo'), 'Must not store city');
    assert.ok(!locationField.includes('SPOOFED'), 'Must not trust CF-IPCountry header');
  } finally {
    fetchMock.restore();
  }
});
