/**
 * AZURA STUDIO — MAIN APPLICATION CONTROLLER
 * Manages i18n (EN/AR), Dark/Light Theming, Smooth Navigation, and Scroll Reveal Observers.
 */

// Global Public Config Object
window.AZURA_CONFIG = {
  // Replace these with your live Cloudflare Worker URL upon deployment
  ANALYTICS_ENDPOINT: '',
  RFQ_ENDPOINT: '',
  SOCIAL_LINKS: {
    instagram: 'https://instagram.com/azura.studio',
    facebook: 'https://facebook.com/azura.studio',
    whatsapp: 'https://wa.me/201000000000'
  }
};

const I18N_DICTIONARY = {
  en: {
    // Navigation
    navProjects: 'Projects',
    navAbout: 'About',
    navServices: 'Services',
    navContact: 'Contact Us',
    ctaQuote: 'Request Quote',

    // Hero
    heroTag: 'Architectural Vision',
    heroTitle: 'Spaces Inspired By Tomorrow',
    heroSubtitle: 'Bridging conceptual architectural artistry with immaculate photorealistic visualization and master execution.',
    heroBadge: 'Open for Select Commissions',

    // Signature
    sigEyebrow: 'Design Philosophy',
    sigHeading: 'Architecture Crafted with Diamond Precision',
    sigDesc: 'Azura Studio creates refined residential, commercial, and hospitality sanctuaries. We curate atmospheres that transcend ordinary design through clean geometries, natural stone materiality, and luminous spatial poetry.',
    pillar1Title: 'Architectural Design',
    pillar1Desc: 'Bespoke residential villas, high-rise towers, and master-planned spaces.',
    pillar2Title: 'Interior Sanctuaries',
    pillar2Desc: 'Curated travertine, oak, and marble interiors tailored for timeless living.',
    pillar3Title: 'CGI Visualization',
    pillar3Desc: 'Uncompromising photorealistic architectural imagery and animations.',

    // Selected Projects
    projEyebrow: 'Portfolio Highlights',
    projHeading: 'Selected Architectural Works',
    projSub: 'A curated preview of our latest design explorations and built environments.',
    btnExplore: 'Explore Project',

    // Project Titles & Categories
    p1Name: 'Azure Horizon Penthouse',
    p1Cat: 'Luxury Interior / Monaco',
    p2Name: 'Solis Desert Pavilion',
    p2Cat: 'Architecture / Dubai',
    p3Name: 'Lapis Marble Residence',
    p3Cat: 'Residential Interior / London',
    p4Name: 'Aurora Parametric Tower',
    p4Cat: 'Commercial Architecture / Riyadh',
    p5Name: 'Serene Courtyard Atrium',
    p5Cat: 'Zen Sanctuary / Kyoto',
    p6Name: 'Aethel Executive Lounge',
    p6Cat: 'Hospitality Design / Zurich',
    p7Name: 'Monolith Cliff Villa',
    p7Cat: 'Coastal Architecture / Mallorca',
    p8Name: 'Celeste Master Suite',
    p8Cat: 'Minimalist Interior / Milan',

    // RFQ Section
    rfqEyebrow: 'Inquire',
    rfqHeading: 'Request for Quotation',
    rfqDesc: 'We invite property owners, visionary developers, and leading contracting companies to discuss bespoke architectural and visualization commissions.',
    rfqNameLabel: 'Full Name *',
    rfqNamePlaceholder: 'e.g. Alexander Vance',
    rfqEmailLabel: 'Email Address *',
    rfqEmailPlaceholder: 'alexander@example.com',
    rfqPhoneLabel: 'Phone / WhatsApp',
    rfqPhonePlaceholder: '+1 (555) 000-0000',
    rfqTypeLabel: 'I am a *',
    rfqTypeOpt1: 'Property Owner / Private Client',
    rfqTypeOpt2: 'Real Estate Developer',
    rfqTypeOpt3: 'Contracting Company / Studio Partner',
    rfqBriefLabel: 'Project Brief / Inquiry *',
    rfqBriefPlaceholder: 'Tell us about your project location, scope, and timeline...',
    rfqSubmitBtn: 'Submit Quotation Request',

    // Channels
    channelsHeading: 'Direct Connect',
    chanInstagram: 'Instagram Portfolio',
    chanFacebook: 'Facebook Community',
    chanWhatsapp: 'Direct WhatsApp Chat',

    // Footer
    footerTagline: 'Spaces Inspired by a Brighter Tomorrow.',
    footerRights: 'All rights reserved.'
  },

  ar: {
    // Navigation
    navProjects: 'المشاريع',
    navAbout: 'عن الاستوديو',
    navServices: 'الخدمات',
    navContact: 'تواصل معنا',
    ctaQuote: 'طلب عرض سعر',

    // Hero
    heroTag: 'الرؤية المعمارية',
    heroTitle: 'مساحات تلهم الغد',
    heroSubtitle: 'نجمع بين الفن المعماري المفاهيمي والمحاكاة البصرية الواقعية فائقة الدقة والتنفيذ المتقن.',
    heroBadge: 'متاحون لاستقبال مشاريع جديدة',

    // Signature
    sigEyebrow: 'فلسفة التصميم',
    sigHeading: 'عمارة مصممة بدقة الألماس',
    sigDesc: 'يبتكر استوديو أزورا ملاذات سكنية وتجارية وضيافة راقية. نصنع بيئات تتجاوز المألوف عبر التناغم الهندسي، دفء الحجر والرخام الطبيعي، وشاعرية الفضاءات المضيئة.',
    pillar1Title: 'التصميم المعماري',
    pillar1Desc: 'فلل سكنية فاخرة، أبراج شاهقة، ومخططات معمارية مدروسة.',
    pillar2Title: 'التصميم الداخلي',
    pillar2Desc: 'فراغات من الحجر والخشب والرخام مصممة لأسلوب حياة خالد.',
    pillar3Title: 'المحاكاة البصرية CGI',
    pillar3Desc: 'إخراج بصري ورندرات ثلاثية الأبعاد فائقة الواقعية والجمال.',

    // Selected Projects
    projEyebrow: 'أبرز الأعمال',
    projHeading: 'مشاريع معمارية مختارة',
    projSub: 'مقتطفات مختارة تعكس أحدث رؤانا وتصاميمنا المنفذة.',
    btnExplore: 'استكشاف المشروع',

    // Project Titles & Categories
    p1Name: 'بنتهاوس أفق أزورا',
    p1Cat: 'تصميم داخلي فاخر / موناكو',
    p2Name: 'فيلا واحة سوليس',
    p2Cat: 'عمارة معاصرة / دبي',
    p3Name: 'إقامة رخام اللابيس',
    p3Cat: 'تصميم سكني راقٍ / لندن',
    p4Name: 'برج أورورا المعماري',
    p4Cat: 'عمارة تجارية / الرياض',
    p5Name: 'أتريوم السكينة الياباني',
    p5Cat: 'ملاذ زين هادئ / كيوتو',
    p6Name: 'صالة إيثل التنفيذية',
    p6Cat: 'تصميم ضيافة فاخر / زيورخ',
    p7Name: 'فيلا المنحدر الصخري',
    p7Cat: 'عمارة ساحلية / مايوركا',
    p8Name: 'جناح سيليست الملكي',
    p8Cat: 'تصميم داخلي مينيمال / ميلانو',

    // RFQ Section
    rfqEyebrow: 'طلب استشارة وتكلفة',
    rfqHeading: 'طلب عرض سعر للمشروع',
    rfqDesc: 'ندعو ملاك العقارات والمطورين العقاريين وشركات المقاولات الرائدة لمناقشة مشاريعهم المعمارية وتطلعاتهم البصرية.',
    rfqNameLabel: 'الاسم الكامل *',
    rfqNamePlaceholder: 'مثال: محمد الشريف',
    rfqEmailLabel: 'البريد الإلكتروني *',
    rfqEmailPlaceholder: 'name@example.com',
    rfqPhoneLabel: 'رقم الهاتف / الواتساب',
    rfqPhonePlaceholder: '+20 100 000 0000',
    rfqTypeLabel: 'أنا *',
    rfqTypeOpt1: 'مالك عقار / عميل خاص',
    rfqTypeOpt2: 'مطور عقاري',
    rfqTypeOpt3: 'شركة مقاولات / شريك استشاري',
    rfqBriefLabel: 'تفاصيل واستفسار المشروع *',
    rfqBriefPlaceholder: 'شاركنا نبذة عن موقع المشروع، مساحته، والجدول الزمني المقترح...',
    rfqSubmitBtn: 'إرسال طلب عرض السعر',

    // Channels
    channelsHeading: 'قنوات التواصل المباشر',
    chanInstagram: 'معرض إنستغرام',
    chanFacebook: 'مجتمع فيسبوك',
    chanWhatsapp: 'محادثة واتساب مباشرة',

    // Footer
    footerTagline: 'مساحات مستوحاة من غدٍ أكثر إشراقاً.',
    footerRights: 'جميع الحقوق محفوظة.'
  }
};

(function () {
  // State
  let currentLang = localStorage.getItem('azura_lang') || 'en';
  let currentTheme = localStorage.getItem('azura_theme') || 'dark';

  // Elements
  const header = document.querySelector('.site-header');
  const langToggleBtn = document.getElementById('lang-toggle-btn');
  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const mobileToggle = document.getElementById('mobile-toggle');
  const navMenu = document.getElementById('nav-menu');

  // --- Theme Management ---
  function applyTheme(theme) {
    currentTheme = theme;
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('azura_theme', theme);

    if (themeToggleBtn) {
      themeToggleBtn.setAttribute('aria-label', theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode');
      themeToggleBtn.innerHTML = theme === 'dark'
        ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>'
        : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
    }

    if (window.AzuraAnalytics) {
      window.AzuraAnalytics.track('theme_changed', { theme });
    }
  }

  // --- Language Management ---
  function applyLanguage(lang) {
    currentLang = lang;
    const isArabic = lang === 'ar';
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', isArabic ? 'rtl' : 'ltr');
    localStorage.setItem('azura_lang', lang);

    if (langToggleBtn) {
      langToggleBtn.textContent = isArabic ? 'EN' : 'عربي';
      langToggleBtn.setAttribute('aria-label', isArabic ? 'Switch to English' : 'التبديل إلى العربية');
    }

    // Update all data-i18n elements
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (I18N_DICTIONARY[lang]?.[key]) {
        el.textContent = I18N_DICTIONARY[lang][key];
      }
    });

    // Update placeholders
    document.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (I18N_DICTIONARY[lang]?.[key]) {
        el.setAttribute('placeholder', I18N_DICTIONARY[lang][key]);
      }
    });

    // Refresh Hero Slider layout if needed
    if (window.refreshHeroSlider) {
      window.refreshHeroSlider();
    }

    // Refresh Voyage 3D Slider layout
    if (window.refreshVoyageSlider) {
      window.refreshVoyageSlider();
    }

    if (window.AzuraAnalytics) {
      window.AzuraAnalytics.track('language_changed', { lang });
    }
  }

  // --- Event Listeners ---
  if (langToggleBtn) {
    langToggleBtn.addEventListener('click', () => {
      applyLanguage(currentLang === 'en' ? 'ar' : 'en');
    });
  }

  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
    });
  }

  // Mobile Menu
  if (mobileToggle && navMenu) {
    const closeMobileMenu = () => {
      navMenu.classList.remove('open');
      mobileToggle.setAttribute('aria-expanded', 'false');
      mobileToggle.setAttribute('aria-label', 'Open Navigation Menu');
      document.body.classList.remove('mobile-menu-open');
    };

    const openMobileMenu = () => {
      navMenu.classList.add('open');
      mobileToggle.setAttribute('aria-expanded', 'true');
      mobileToggle.setAttribute('aria-label', 'Close Navigation Menu');
      document.body.classList.add('mobile-menu-open');
      navMenu.querySelector('.nav-link')?.focus();
    };

    mobileToggle.addEventListener('click', () => {
      const isOpen = navMenu.classList.contains('open');
      if (isOpen) {
        closeMobileMenu();
      } else {
        openMobileMenu();
      }
    });

    // Close menu when clicking nav links
    navMenu.querySelectorAll('.nav-link').forEach((link) => {
      link.addEventListener('click', () => {
        closeMobileMenu();
      });
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && navMenu.classList.contains('open')) {
        closeMobileMenu();
        mobileToggle.focus();
      }
    });

    document.addEventListener('pointerdown', (event) => {
      if (
        navMenu.classList.contains('open') &&
        !navMenu.contains(event.target) &&
        !mobileToggle.contains(event.target)
      ) {
        closeMobileMenu();
      }
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 768 && navMenu.classList.contains('open')) {
        closeMobileMenu();
      }
    }, { passive: true });
  }

  // Header Scroll Effect
  window.addEventListener('scroll', () => {
    if (window.scrollY > 40) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });

  // Scroll Reveal Observer
  const revealElements = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-fade');
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('revealed');
      }
    });
  }, {
    threshold: 0.12,
    rootMargin: '0px 0px -40px 0px'
  });

  revealElements.forEach((el) => revealObserver.observe(el));

  // Initialize
  applyTheme(currentTheme);
  applyLanguage(currentLang);
})();
