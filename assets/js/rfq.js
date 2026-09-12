/**
 * ============================================================================
 * AZURA STUDIO — REQUEST FOR QUOTATION (RFQ) FORM SUBMISSION MODULE
 * ============================================================================
 * Handles client-side validation, UI feedback states, honeypot spam protection,
 * and POST submission to the Cloudflare Worker (/api/rfq).
 * ============================================================================
 */

(function () {
  'use strict';

  const form = document.getElementById('rfq-form');
  const statusMsg = document.getElementById('rfq-status-msg');
  const submitBtn = document.getElementById('rfq-submit-btn');

  if (!form) return;

  const RFQ_ENDPOINT = window.AZURA_CONFIG?.RFQ_ENDPOINT || 'https://azurabackend.ahmd-elsherbiny.workers.dev/api/rfq';
  let hasStartedRfq = false;

  // Track RFQ Start on first interaction without capturing sensitive input
  form.querySelectorAll('input, select, textarea').forEach((input) => {
    input.addEventListener('focus', () => {
      if (!hasStartedRfq) {
        hasStartedRfq = true;
        if (window.AzuraAnalytics) {
          window.AzuraAnalytics.track('rfq_start');
        }
      }
    }, { once: true });
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const isArabic = document.documentElement.getAttribute('lang') === 'ar';
    const originalBtnText = submitBtn ? submitBtn.innerHTML : 'Submit';

    // 1. Extract values
    const name = form.name ? form.name.value.trim() : '';
    const email = form.email ? form.email.value.trim() : '';
    const phone = form.phone ? form.phone.value.trim() : '';
    const customerType = form.customerType ? form.customerType.value : (form.clientType ? form.clientType.value : 'Property Owner');
    const brief = form.brief ? form.brief.value.trim() : (form.inquiry ? form.inquiry.value.trim() : '');
    const honeypot = form._hp ? form._hp.value : '';

    // 2. Client-side Validation
    if (!name || name.length < 2) {
      showStatus(
        isArabic ? 'يرجى إدخال الاسم الكريم بشكل صحيح.' : 'Please enter a valid full name.',
        'error'
      );
      if (form.name) form.name.focus();
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email)) {
      showStatus(
        isArabic ? 'يرجى إدخال بريد إلكتروني صالح للتواصل.' : 'Please provide a valid email address.',
        'error'
      );
      if (form.email) form.email.focus();
      return;
    }

    if (!brief || brief.length < 5) {
      showStatus(
        isArabic ? 'يرجى تزويدنا بنبذة موجزة عن مشروعك أو استفسارك.' : 'Please write a brief summary about your project or inquiry.',
        'error'
      );
      if (form.brief) form.brief.focus();
      return;
    }

    // 3. Prepare Payload
    const payload = {
      name: name,
      email: email,
      phone: phone || 'N/A',
      customerType: customerType,
      brief: brief,
      _hp: honeypot // Spam honeypot trap
    };

    // 4. Update UI to Loading State
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="diamond-loader" style="display:inline-block; width:14px; height:14px; border:2px solid currentColor; border-top-color:transparent; border-radius:50%; animation:spin 0.8s linear infinite; margin-inline-end:8px;"></span>
        <span>${isArabic ? 'جاري إرسال الطلب...' : 'Transmitting Request...'}</span>
      `;
    }
    hideStatus();

    try {
      const response = await fetch(RFQ_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Server error occurred');
      }

      // 5. Track Successful RFQ Submit in Analytics
      if (window.AzuraAnalytics) {
        window.AzuraAnalytics.track('rfq_submit', {
          metadata: {
            customerType: customerType,
            submissionId: result.submissionId || 'N/A'
          }
        });
      }

      // 6. Display Success State
      showStatus(
        isArabic
          ? `تم استلام طلبك بنجاح. رقم الطلب: ${result.submissionId || ''}. سيتواصل معك فريق استوديو أزورا في أقرب وقت.`
          : `Thank you. Your quotation request was received (ID: ${result.submissionId || 'Confirmed'}). Our team will contact you shortly.`,
        'success'
      );

      form.reset();
      hasStartedRfq = false;

    } catch (error) {
      console.error('RFQ Error:', error);
      showStatus(
        isArabic
          ? 'حدث خطأ أثناء إرسال الطلب. يرجى المحاولة لاحقاً أو التواصل معنا مباشرة عبر واتساب.'
          : 'Unable to submit your request at this moment. Please reach out to us directly via WhatsApp or email.',
        'error'
      );
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnText;
      }
    }
  });

  function showStatus(message, type) {
    if (!statusMsg) return;
    statusMsg.textContent = message;
    statusMsg.className = `form-status-msg ${type}`;
    statusMsg.style.display = 'block';
  }

  function hideStatus() {
    if (!statusMsg) return;
    statusMsg.style.display = 'none';
  }
})();
