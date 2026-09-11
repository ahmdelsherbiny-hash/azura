/**
 * ============================================================================
 * AZURA STUDIO — CLIENT-SIDE BATCHED ANALYTICS MODULE
 * ============================================================================
 * Batches telemetry events locally to drastically minimize Cloudflare Worker calls.
 * 
 * Features:
 * - Anonymous persistent Session ID (sessionStorage)
 * - In-memory event queue
 * - Configurable flush thresholds: queue size >= 8 or every 30 seconds
 * - Page unload flush via navigator.sendBeacon() / fetch(..., { keepalive: true })
 * - Privacy-respecting: NO keystrokes, NO form field recording, NO replay
 * ============================================================================
 */

const AzuraAnalytics = (function () {
  'use strict';

  // Configuration
  const CONFIG = {
    endpoint: window.AZURA_CONFIG?.ANALYTICS_ENDPOINT || 'https://azura-backend.ahmed-elsherbiny.workers.dev/api/analytics/batch',
    flushIntervalMs: 30000, // Flush every 30 seconds
    maxBatchSize: 8,        // Flush immediately when 8 events accumulate
    maxQueueCap: 50         // Safety ceiling
  };

  // State
  let eventQueue = [];
  let flushTimer = null;
  const sessionStartTime = Date.now();

  // Helper: Retrieve or create unique anonymous session ID
  function getSessionId() {
    try {
      let sid = sessionStorage.getItem('azura_session_id');
      if (!sid) {
        sid = 'azr_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
        sessionStorage.setItem('azura_session_id', sid);
      }
      return sid;
    } catch {
      return 'anon_' + Date.now();
    }
  }

  const sessionId = getSessionId();

  /**
   * Public function to queue an analytics event
   * @param {string} eventType - e.g. "section_view", "project_click", "rfq_start"
   * @param {object} [details={}] - Optional metadata (section, project, etc.)
   */
  function trackEvent(eventType, details = {}) {
    if (!eventType || typeof eventType !== 'string') return;

    const eventRecord = {
      type: eventType.slice(0, 50),
      timestamp: new Date().toISOString(),
      page: window.location.pathname || '/',
      section: details.section || details.sectionId || 'none',
      project: details.project || details.projectName || 'none',
      metadata: {
        lang: document.documentElement.getAttribute('lang') || 'en',
        theme: document.documentElement.getAttribute('data-theme') || 'dark',
        durationSec: Math.floor((Date.now() - sessionStartTime) / 1000),
        ...(typeof details.metadata === 'object' ? details.metadata : {})
      }
    };

    // If extra parameters were passed outside metadata, merge them
    for (const key of Object.keys(details)) {
      if (!['section', 'sectionId', 'project', 'projectName', 'metadata'].includes(key)) {
        eventRecord.metadata[key] = details[key];
      }
    }

    eventQueue.push(eventRecord);

    // Prevent unbounded memory growth
    if (eventQueue.length > CONFIG.maxQueueCap) {
      eventQueue = eventQueue.slice(-CONFIG.maxQueueCap);
    }

    // Flush immediately if batch threshold reached
    if (eventQueue.length >= CONFIG.maxBatchSize) {
      flushQueue();
    }
  }

  /**
   * Sends queued events to the Cloudflare Worker API
   * @param {boolean} [isUnloading=false] - True if triggered on page hide/exit
   */
  function flushQueue(isUnloading = false) {
    if (eventQueue.length === 0) return;

    const eventsToSend = [...eventQueue];
    eventQueue = []; // Clear queue immediately

    const payload = {
      sessionId: sessionId,
      events: eventsToSend
    };

    const payloadString = JSON.stringify(payload);

    // If page is closing/hiding, use sendBeacon or keepalive fetch
    if (isUnloading) {
      if (navigator.sendBeacon) {
        try {
          const blob = new Blob([payloadString], { type: 'application/json' });
          const sent = navigator.sendBeacon(CONFIG.endpoint, blob);
          if (sent) return;
        } catch {
          // Fallback to fetch keepalive below
        }
      }

      try {
        fetch(CONFIG.endpoint, {
          method: 'POST',
          body: payloadString,
          headers: { 'Content-Type': 'application/json' },
          keepalive: true
        }).catch(() => {});
      } catch {}
      return;
    }

    // Standard asynchronous flush
    fetch(CONFIG.endpoint, {
      method: 'POST',
      body: payloadString,
      headers: { 'Content-Type': 'application/json' }
    })
    .then((res) => {
      if (!res.ok) {
        // On server error, re-queue unsent events (up to max queue cap)
        eventQueue = [...eventsToSend.slice(-15), ...eventQueue].slice(-CONFIG.maxQueueCap);
      }
    })
    .catch(() => {
      // On network failure, preserve events in queue for next cycle
      eventQueue = [...eventsToSend.slice(-15), ...eventQueue].slice(-CONFIG.maxQueueCap);
    });
  }

  // Periodic timer for automatic flush
  function startInterval() {
    if (flushTimer) clearInterval(flushTimer);
    flushTimer = setInterval(() => {
      flushQueue(false);
    }, CONFIG.flushIntervalMs);
  }

  // Initialize event listeners & automated tracking
  function init() {
    startInterval();

    // 1. Initial Session Start
    trackEvent('session_start', {
      metadata: {
        referrer: document.referrer || 'direct',
        screen: `${window.innerWidth}x${window.innerHeight}`
      }
    });

    // 2. Automated Intersection Observer for Section Views
    if ('IntersectionObserver' in window) {
      const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.35) {
            const secId = entry.target.id || entry.target.getAttribute('data-section') || 'unnamed';
            trackEvent('section_view', { section: secId });
          }
        });
      }, { threshold: 0.35 });

      document.querySelectorAll('section[id], header[id]').forEach((sec) => {
        sectionObserver.observe(sec);
      });
    }

    // 3. Project Card Click Tracking
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.project-card, [data-project]');
      if (card) {
        const title = card.querySelector('.project-name, h3, h4')?.textContent?.trim() || card.getAttribute('data-project') || 'Project';
        trackEvent('project_click', { project: title });
        return;
      }

      // Social Links
      const socialLink = e.target.closest('.social-link, [data-social]');
      if (socialLink) {
        const platform = socialLink.getAttribute('data-social') || socialLink.getAttribute('aria-label') || 'Social';
        trackEvent('social_link_click', { metadata: { platform } });
        return;
      }

      // CTA buttons
      const ctaBtn = e.target.closest('.btn-primary, .cta-btn, a[href="#contact"], a[href="#rfq"]');
      if (ctaBtn) {
        const label = ctaBtn.textContent?.trim() || 'CTA';
        trackEvent('cta_click', { metadata: { label } });
      }
    });

    // 4. Page Visibility & Unload Flush (No polling)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushQueue(true);
      }
    });

    window.addEventListener('pagehide', () => {
      trackEvent('session_end', {
        metadata: { totalSeconds: Math.floor((Date.now() - sessionStartTime) / 1000) }
      });
      flushQueue(true);
    });
  }

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public Interface
  return {
    track: trackEvent,
    flush: () => flushQueue(false),
    getSessionId: () => sessionId
  };
})();

// Expose globally
window.AzuraAnalytics = AzuraAnalytics;
