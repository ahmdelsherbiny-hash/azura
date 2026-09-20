/**
 * AZURA STUDIO — VOYAGE 3D SLIDER ENGINE
 * High-performance 3D perspective slider with multi-card circular staging,
 * mouse drag & touch swipe gestures, interactive social action circles,
 * working dots tracking, and RTL support.
 */

(function () {
  const wrap = (n, max) => (n % max + max) % max;

  class VoyageSlider {
    constructor(container) {
      this.container = container;
      this.section = container.closest('section') || document;
      this.slides = Array.from(container.querySelectorAll('.voyage-slide'));
      this.slideInfos = Array.from(container.querySelectorAll('.voyage-slide-info'));
      this.ambientBgs = Array.from(this.section.querySelectorAll('.voyage-slide-bg'));
      // Find dots in the whole section (inside or outside container)
      this.dots = Array.from(this.section.querySelectorAll('.voyage-dot'));
      this.btnPrev = container.querySelector('.voyage-btn-prev') || this.section.querySelector('.voyage-btn-prev');
      this.btnNext = container.querySelector('.voyage-btn-next') || this.section.querySelector('.voyage-btn-next');

      this.total = this.slides.length;
      if (this.total === 0) return;

      this.currentIndex = 0;
      this.isAnimating = false;
      this.motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      this.animationDuration = this.motionQuery.matches ? 0 : 750;

      // Mouse drag state
      this.isDragging = false;
      this.dragStartX = 0;
      this.dragStartY = 0;
      this.dragThreshold = 35;
      this.hasDragged = false;

      this.init();
    }

    init() {
      this.container.setAttribute('role', 'region');
      this.container.setAttribute('aria-roledescription', 'carousel');
      this.container.setAttribute('aria-label', 'Selected architectural projects');

      const infoStage = this.container.querySelector('.voyage-slides-infos');
      if (infoStage) {
        infoStage.setAttribute('aria-live', 'polite');
      }

      // Initial state render
      this.updateState(0, 0);

      // Event listeners
      this.setupControls();
      this.setupMouseAndTouchDrag();
      this.setupKeyboard();

      this.motionQuery.addEventListener('change', (event) => {
        this.animationDuration = event.matches ? 0 : 750;
      });

      // Export refresh function globally for language / window resize updates
      window.refreshVoyageSlider = () => {
        this.updateState(this.currentIndex, 0);
      };
    }

    setupControls() {
      if (this.btnPrev) {
        this.btnPrev.addEventListener('click', (e) => {
          e.preventDefault();
          this.navigate(-1);
        });
      }

      if (this.btnNext) {
        this.btnNext.addEventListener('click', (e) => {
          e.preventDefault();
          this.navigate(1);
        });
      }

      // Dot navigation
      this.dots.forEach((dot, idx) => {
        dot.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (idx === this.currentIndex || this.isAnimating) return;
          const dir = idx > this.currentIndex ? 1 : -1;
          this.goTo(idx, dir);
        });
      });

      // Click on side cards (previous / next) to navigate
      this.slides.forEach((slide) => {
        slide.addEventListener('click', (e) => {
          if (this.hasDragged) return; // ignore click if user was dragging
          // If clicked directly on a social action link or button, let it navigate
          if (e.target.closest('.voyage-social-circle') || e.target.closest('.voyage-explore-btn')) {
            return;
          }

          if (slide.hasAttribute('data-previous')) {
            e.preventDefault();
            this.navigate(-1);
          } else if (slide.hasAttribute('data-next')) {
            e.preventDefault();
            this.navigate(1);
          } else if (slide.hasAttribute('data-current')) {
            // Toggle active state for mobile / click
            slide.classList.toggle('actions-visible');
          }
        });
      });
    }

    navigate(direction) {
      if (this.isAnimating) return;
      const isRTL = document.documentElement.getAttribute('dir') === 'rtl';
      // In RTL, standard visual flow may invert next/prev
      const effectiveDir = isRTL ? -direction : direction;
      const newIndex = wrap(this.currentIndex + effectiveDir, this.total);
      this.goTo(newIndex, effectiveDir);
    }

    goTo(targetIndex, direction = 1) {
      if (this.isAnimating || targetIndex === this.currentIndex) return;
      this.isAnimating = true;

      this.currentIndex = targetIndex;
      this.updateState(this.currentIndex, direction);

      // Track analytics if available
      if (window.AzuraAnalytics) {
        window.AzuraAnalytics.track('project_slide_view', {
          slideIndex: this.currentIndex + 1,
          totalSlides: this.total
        });
      }

      if (this.animationDuration === 0) {
        this.isAnimating = false;
      } else {
        setTimeout(() => {
          this.isAnimating = false;
        }, this.animationDuration);
      }
    }

    updateState(currIdx, direction = 1) {
      const prevIdx = wrap(currIdx - 1, this.total);
      const nextIdx = wrap(currIdx + 1, this.total);

      // Update all slides
      this.slides.forEach((slide, idx) => {
        slide.removeAttribute('data-current');
        slide.removeAttribute('data-previous');
        slide.removeAttribute('data-next');
        slide.removeAttribute('data-idle');
        slide.classList.remove('actions-visible');

        if (idx === currIdx) {
          slide.setAttribute('data-current', '');
          slide.style.zIndex = '20';
        } else if (idx === prevIdx) {
          slide.setAttribute('data-previous', '');
          slide.style.zIndex = direction === -1 ? '30' : '10';
        } else if (idx === nextIdx) {
          slide.setAttribute('data-next', '');
          slide.style.zIndex = direction === 1 ? '30' : '10';
        } else {
          slide.setAttribute('data-idle', '');
          slide.style.zIndex = '1';
        }

        const isCurrent = idx === currIdx;
        slide.setAttribute('aria-hidden', String(!isCurrent));
        slide.querySelectorAll('a, button').forEach((control) => {
          control.tabIndex = isCurrent ? 0 : -1;
        });
      });

      // Update slide infos
      this.slideInfos.forEach((info, idx) => {
        info.removeAttribute('data-current');
        info.removeAttribute('data-previous');
        info.removeAttribute('data-next');
        info.removeAttribute('data-idle');

        if (idx === currIdx) {
          info.setAttribute('data-current', '');
        } else if (idx === prevIdx) {
          info.setAttribute('data-previous', '');
        } else if (idx === nextIdx) {
          info.setAttribute('data-next', '');
        } else {
          info.setAttribute('data-idle', '');
        }

        info.setAttribute('aria-hidden', String(idx !== currIdx));
      });

      // Update ambient background
      this.ambientBgs.forEach((bg, idx) => {
        bg.removeAttribute('data-current');
        bg.removeAttribute('data-previous');
        bg.removeAttribute('data-next');
        bg.removeAttribute('data-idle');

        if (idx === currIdx) {
          bg.setAttribute('data-current', '');
        } else if (idx === prevIdx) {
          bg.setAttribute('data-previous', '');
        } else if (idx === nextIdx) {
          bg.setAttribute('data-next', '');
        } else {
          bg.setAttribute('data-idle', '');
        }
      });

      // Update dots
      this.dots.forEach((dot, idx) => {
        if (idx === currIdx) {
          dot.classList.add('active');
          dot.setAttribute('aria-current', 'true');
        } else {
          dot.classList.remove('active');
          dot.removeAttribute('aria-current');
        }
      });
    }

    setupMouseAndTouchDrag() {
      const stage = this.container.querySelector('.voyage-slides-wrapper') || this.container;

      const getClientPos = (e) => {
        if (e.touches && e.touches.length > 0) {
          return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }
        if (e.changedTouches && e.changedTouches.length > 0) {
          return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        }
        return { x: e.clientX, y: e.clientY };
      };

      const onStart = (e) => {
        // If clicking on social circle links, don't drag
        if (e.target.closest('.voyage-social-circle') || e.target.closest('.voyage-explore-btn')) {
          return;
        }
        this.isDragging = true;
        this.hasDragged = false;
        const pos = getClientPos(e);
        this.dragStartX = pos.x;
        this.dragStartY = pos.y;
        stage.classList.add('is-dragging');
      };

      const onMove = (e) => {
        if (!this.isDragging) return;
        const pos = getClientPos(e);
        const diffX = pos.x - this.dragStartX;
        const diffY = pos.y - this.dragStartY;

        if (Math.abs(diffX) > 8) {
          this.hasDragged = true;
        }
      };

      const onEnd = (e) => {
        if (!this.isDragging) return;
        this.isDragging = false;
        stage.classList.remove('is-dragging');

        const pos = getClientPos(e);
        const diffX = pos.x - this.dragStartX;
        const diffY = pos.y - this.dragStartY;

        // Ensure horizontal swipe is dominant
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > this.dragThreshold) {
          if (diffX < 0) {
            // Dragged left -> advance next
            this.navigate(1);
          } else {
            // Dragged right -> previous
            this.navigate(-1);
          }
        }

        setTimeout(() => {
          this.hasDragged = false;
        }, 80);
      };

      // Mouse drag listeners
      stage.addEventListener('mousedown', onStart);
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);

      // Touch drag listeners
      stage.addEventListener('touchstart', onStart, { passive: true });
      stage.addEventListener('touchmove', onMove, { passive: true });
      stage.addEventListener('touchend', onEnd, { passive: true });
    }

    setupKeyboard() {
      this.container.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.navigate(1);
        } else if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.navigate(-1);
        }
      });
    }
  }

  // Initialize on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const sliderEl = document.querySelector('.voyage-slider-container');
      if (sliderEl) {
        window.azuraVoyageSlider = new VoyageSlider(sliderEl);
      }
    });
  } else {
    const sliderEl = document.querySelector('.voyage-slider-container');
    if (sliderEl) {
      window.azuraVoyageSlider = new VoyageSlider(sliderEl);
    }
  }
})();
