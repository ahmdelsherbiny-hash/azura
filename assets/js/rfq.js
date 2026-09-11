/**
 * AZURA STUDIO — REQUEST FOR QUOTATION (RFQ) FORM HANDLER
 * Handles validation, client-side submission to Cloudflare Worker, and feedback states.
 */

(function () {
  const form = document.getElementById('rfq-form');
  const statusMsg = document.getElementById('rfq-status-msg');
  const submitBtn = document.getElementById('rfq-submit-btn');

  if (!form) return;

  let hasStartedTyping = false;

  // Track 'RFQ Started' on first field interaction
  form.querySelectorAll('input, select, textarea').forEach((input) => {
    input.addEventListener('focus', () => {
      if (!hasStartedTyping) {
        hasStartedTyping = true;
        if (window.AzuraAnalytics) {
          window.AzuraAnalytics.track('rfq_started');
        }
      }
    }, { once: true });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const isArabic = document.documentElement.getAttribute('lang') === 'ar';
    const originalBtnText = submitBtn.innerHTML;

    // Get field values
    const name = form.name.value.trim();
    const email = form.email.value.trim();
    const phone = form.phone.value.trim();
    const clientType = form.clientType.value;
    const brief = form.brief.value.trim();

    // Basic Validation
    if (!name || !email || !brief) {
      showMessage(
        isArabic ? 'يرجى ملء جميع الحقول المطلوبة بشكل صحيح.' : 'Please complete all required fields.',
        'error'
      );
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showMessage(
        isArabic ? 'يرجى إدخال بريد إلكتروني صالح.' : 'Please provide a valid email address.',
        'error'
      );
      return;
    }

    // Prepare Payload
    const payload = {
      name,
      email,
      phone: phone || 'N/A',
      clientType,
      brief,
      submittedAt: new Date().toISOString(),
      language: isArabic ? 'ar' : 'en',
      sessionId: sessionStorage.getItem('azura_session_id') || 'direct'
    };

    // Set UI to loading state
    submitBtn.disabled = true;
    submitBtn.innerHTML = `
      <span class="diamond-loader" style="width: 14px; height: 14px; margin-inline-end: 8px;"></span>
      <span>${isArabic ? 'جاري الإرسال...' : 'Submitting...'}</span>
    `;
    statusMsg.style.display = 'none';

    const rfqEndpoint = window.AZURA_CONFIG?.RFQ_ENDPOINT || '/api/rfq';

    try {
      if (window.AZURA_CONFIG?.RFQ_ENDPOINT) {
        const res = await fetch(rfqEndpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error('Submission failed');
      } else {
        // Mock server latency for prototype demo mode
        await new Promise((resolve) => setTimeout(resolve, 900));
      }

      // Track successful submission
      if (window.AzuraAnalytics) {
        window.AzuraAnalytics.track('rfq_submitted', { clientType });
      }

      // Show Success
      showMessage(
        isArabic
          ? 'تم استلام طلبك بنجاح. سيتواصل معك فريق استوديو أزورا في أقرب وقت.'
          : 'Thank you. Your quotation request has been received. Our team will contact you shortly.',
        'success'
      );

      form.reset();
      hasStartedTyping = false;
    } catch (err) {
      showMessage(
        isArabic
          ? 'حدث خطأ أثناء الإرسال. يرجى المحاولة مرة أخرى أو التواصل معنا مباشرة عبر واتساب.'
          : 'An error occurred. Please try again or reach out directly via WhatsApp.',
        'error'
      );
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalBtnText;
    }
  });

  function showMessage(text, type) {
    statusMsg.textContent = text;
    statusMsg.className = `form-status-msg ${type}`;
    statusMsg.style.display = 'block';
  }
})();
