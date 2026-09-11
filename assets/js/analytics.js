/**
 * AZURA STUDIO — PRIVACY-FRIENDLY CLIENT-SIDE ANALYTICS
 * Lightweight session & interaction event tracking via Cloudflare Worker -> Google Sheets.
 */

const AzuraAnalytics = (function () {
  // Worker Endpoint URL (Can be overridden via window.AZURA_CONFIG.ANALYTICS_ENDPOINT)
  const ENDPOINT = window.AZURA_CONFIG?.ANALYTICS_ENDPOINT || '/api/analytics';

  // Generate or retrieve anonymous session ID
  function getSessionId() {
    let sid = sessionStorage.getItem('azura_session_id');
    if (!sid) {
      sid = 'azura_' + Math.random().toString(36).substring(2, 11) + '_' + Date.now().toString(36);
      sessionStorage.setItem('azura_session_id', sid);
    }
    return sid;
  }

  const sessionId = getSessionId();
  const sessionStartTime = Date.now();

  function trackEvent(eventName, eventData = {}) {
    const payload = {
      sessionId,
      eventName,
      eventData,
      timestamp: new Date().toISOString(),
      url: window.location.pathname + window.location.hash,
      referrer: document.referrer || 'direct',
      screenResolution: `${window.innerWidth}x${window.innerHeight}`,
      language: document.documentElement.getAttribute('lang') || 'en',
      theme: document.documentElement.getAttribute('data-theme') || 'dark',
      elapsedSeconds: Math.floor((Date.now() - sessionStartTime) / 1000)
    };

    // If local demo mode, log subtly to console for testing
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || !window.AZURA_CONFIG?.ANALYTICS_ENDPOINT) {
      // Keep quiet or debug if needed
      // console.debug('[Azura Analytics Local]', eventName, payload);
    }

    // Attempt delivery via sendBeacon or fetch
    if (window.AZURA_CONFIG?.ANALYTICS_ENDPOINT) {
      try {
        const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
        if (navigator.sendBeacon) {
          navigator.sendBeacon(ENDPOINT, blob);
        } else {
          fetch(ENDPOINT, {
            method: 'POST',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' },
            keepalive: true
          }).catch(() => {});
        }
      } catch (err) {
        // Silently fail to never break user experience
      }
    }
  }

  // Initialize standard listeners
  function init() {
    trackEvent('session_start');

    // Track section views
    const sections = document.querySelectorAll('section[id]');
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          trackEvent('section_view', { sectionId: entry.target.id });
        }
      });
    }, { threshold: 0.35 });

    sections.forEach((sec) => observer.observe(sec));

    // Track project card clicks
    document.querySelectorAll('.project-card').forEach((card) => {
      card.addEventListener('click', () => {
        const projectName = card.querySelector('.project-name')?.textContent?.trim() || 'Unknown';
        const projectCat = card.querySelector('.project-cat')?.textContent?.trim() || '';
        trackEvent('project_click', { project: projectName, category: projectCat });
      });
    });

    // Track session end / duration
    window.addEventListener('beforeunload', () => {
      trackEvent('session_end', {
        totalDurationSeconds: Math.floor((Date.now() - sessionStartTime) / 1000)
      });
    });
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return {
    track: trackEvent
  };
})();
