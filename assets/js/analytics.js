/**
 * ============================================================================
 * AZURA STUDIO — CLIENT-SIDE BATCHED ANALYTICS MODULE
 * ============================================================================
 * Batches telemetry events locally to drastically minimize Cloudflare Worker calls.
 * 
 * Rules:
 * - Session ID is generated per browser session in sessionStorage.
 * - Referrer is strictly sanitized to hostname only (never full path or query).
 * - NO keystrokes, NO form field recording, NO replay.
 * ============================================================================
 */

const AzuraAnalytics = (function () {
  'use strict';

  const CONFIG = {
    endpoint: window.AZURA_CONFIG.ANALYTICS_ENDPOINT,
    flushIntervalMs: 30000,
    maxBatchSize: 8,
    maxQueueCap: 50
  };

  let eventQueue = [];
  let flushTimer = null;
  let sessionId = null;
  let sessionStartTime = null;
  let isInitialized = false;
  let deviceInfo = null;

  // Clean up any legacy consent state so it doesn't linger
  try {
    localStorage.removeItem('azura_analytics_consent');
  } catch {}

  function getCleanReferrer() {
    try {
      if (!document.referrer) return 'direct';
      const parsed = new URL(document.referrer);
      return parsed.hostname || 'direct';
    } catch {
      return 'direct';
    }
  }

  function getSessionId() {
    try {
      let sid = sessionStorage.getItem('azura_session_id');
      if (!sid) {
        sid = 'azr_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now().toString(36);
        sessionStorage.setItem('azura_session_id', sid);
      }
      return sid;
    } catch {
      return 'azr_' + Math.random().toString(36).substring(2, 10);
    }
  }

  function getDeviceInfo() {
    try {
      const ua = navigator.userAgent || '';
      let type = 'Desktop';

      if (/iPad|Tablet|PlayBook/i.test(ua) || (navigator.maxTouchPoints > 1 && window.innerWidth >= 768 && window.innerWidth <= 1024)) {
        type = 'Tablet';
      } else if (/Mobi|Android|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua) || window.innerWidth < 768) {
        type = 'Mobile';
      }

      let os = 'Unknown OS';
      if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';
      else if (/Android/i.test(ua)) os = 'Android';
      else if (/Windows/i.test(ua)) os = 'Windows';
      else if (/Macintosh|Mac OS X/i.test(ua)) os = 'macOS';
      else if (/Linux/i.test(ua)) os = 'Linux';

      return {
        type: type,
        os: os,
        screen: `${window.innerWidth}x${window.innerHeight}`
      };
    } catch {
      return { type: 'Desktop', os: 'Unknown', screen: 'Desktop' };
    }
  }

  /**
   * Queue an analytics event.
   */
  function trackEvent(eventType, details = {}) {
    if (!eventType || typeof eventType !== 'string') return;
    if (!sessionId) {
      sessionId = getSessionId();
    }

    const currentDevice = deviceInfo || getDeviceInfo();
    const eventRecord = {
      type: eventType.slice(0, 50),
      timestamp: new Date().toISOString(),
      page: (window.location.pathname || '/').slice(0, 100),
      section: (details.section || details.sectionId || 'none').slice(0, 50),
      project: (details.project || details.projectName || 'none').slice(0, 80),
      metadata: {
        device: currentDevice.type,
        os: currentDevice.os,
        screen: currentDevice.screen,
        lang: document.documentElement.getAttribute('lang') || 'en',
        theme: document.documentElement.getAttribute('data-theme') || 'dark',
        durationSec: sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0,
        ...(typeof details.metadata === 'object' && !Array.isArray(details.metadata) ? details.metadata : {})
      }
    };

    eventQueue.push(eventRecord);

    if (eventQueue.length > CONFIG.maxQueueCap) {
      eventQueue = eventQueue.slice(-CONFIG.maxQueueCap);
    }

    if (eventQueue.length >= CONFIG.maxBatchSize) {
      flushQueue(false);
    }
  }

  /**
   * Flush queued events to Worker API
   */
  function flushQueue(isUnloading = false) {
    if (eventQueue.length === 0 || !sessionId) {
      eventQueue = [];
      return;
    }

    const eventsToSend = [...eventQueue];
    eventQueue = [];

    const payloadString = JSON.stringify({
      sessionId: sessionId,
      events: eventsToSend
    });

    if (isUnloading) {
      if (navigator.sendBeacon) {
        try {
          const blob = new Blob([payloadString], { type: 'application/json' });
          if (navigator.sendBeacon(CONFIG.endpoint, blob)) return;
        } catch {}
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

    fetch(CONFIG.endpoint, {
      method: 'POST',
      body: payloadString,
      headers: { 'Content-Type': 'application/json' }
    })
    .then((res) => {
      if (!res.ok) {
        eventQueue = [...eventsToSend.slice(-15), ...eventQueue].slice(-CONFIG.maxQueueCap);
      }
    })
    .catch(() => {
      eventQueue = [...eventsToSend.slice(-15), ...eventQueue].slice(-CONFIG.maxQueueCap);
    });
  }

  function startInterval() {
    if (flushTimer) clearInterval(flushTimer);
    flushTimer = setInterval(() => {
      flushQueue(false);
    }, CONFIG.flushIntervalMs);
  }

  function stopTracking() {
    if (flushTimer) {
      clearInterval(flushTimer);
      flushTimer = null;
    }
    eventQueue = [];
    sessionId = null;
    sessionStartTime = null;
    try {
      sessionStorage.removeItem('azura_session_id');
    } catch {}
  }

  function setupListeners() {
    if (isInitialized) return;
    isInitialized = true;

    // Section view intersection observer
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

    // Interaction delegated clicks
    document.addEventListener('click', (e) => {
      const card = e.target.closest('.project-card, [data-project]');
      if (card) {
        const title = card.querySelector('.project-name, h3, h4')?.textContent?.trim() || card.getAttribute('data-project') || 'Project';
        trackEvent('project_click', { project: title });
        return;
      }

      const socialLink = e.target.closest('.social-link, [data-social]');
      if (socialLink) {
        const platform = socialLink.getAttribute('data-social') || socialLink.getAttribute('aria-label') || 'Social';
        trackEvent('social_link_click', { metadata: { platform } });
        return;
      }

      const ctaBtn = e.target.closest('.btn-primary, .cta-btn, a[href="#contact"], a[href="#rfq"]');
      if (ctaBtn) {
        const label = ctaBtn.textContent?.trim() || 'CTA';
        trackEvent('cta_click', { metadata: { label: label.slice(0, 50) } });
      }
    });

    // Unload flush
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        flushQueue(true);
      }
    });

    window.addEventListener('pagehide', () => {
      if (sessionId) {
        trackEvent('session_end', {
          metadata: { totalSeconds: sessionStartTime ? Math.floor((Date.now() - sessionStartTime) / 1000) : 0 }
        });
        flushQueue(true);
      }
    });
  }

  function startTracking() {
    sessionId = getSessionId();
    sessionStartTime = Date.now();
    deviceInfo = getDeviceInfo();

    setupListeners();
    startInterval();

    // Fire initial session start with hostname-only referrer
    trackEvent('session_start', {
      metadata: {
        referrer: getCleanReferrer(),
        device: deviceInfo.type,
        os: deviceInfo.os
      }
    });
  }

  // Auto-start on DOM ready
  function init() {
    startTracking();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    track: trackEvent,
    flush: () => flushQueue(false),
    setConsent: () => {},
    getConsentState: () => 'granted',
    getSessionId: () => sessionId,
    getDeviceInfo: () => deviceInfo || getDeviceInfo()
  };
})();

window.AzuraAnalytics = AzuraAnalytics;
