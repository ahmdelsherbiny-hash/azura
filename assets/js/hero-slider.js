/**
 * AZURA STUDIO — HERO STATIONARY LASER SCAN ENGINE
 * Starts 100% as an architectural pencil sketch at the far left (0%).
 * Once loaded, autonomously sweeps smoothly across to reveal the photorealistic render,
 * continuing a majestic, uninterrupted architectural comparison loop.
 */

(function () {
  const container = document.getElementById('hero-visual-wrapper');
  const canvas = document.getElementById('hero-laser-canvas');
  const laserBeam = document.getElementById('hero-laser-beam');
  const heroVideo = document.getElementById('hero-cinematic-video');

  if (!container || !canvas || !laserBeam) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  let width = 0, height = 0;
  const renderImg = new Image();
  const sketchImg = new Image();
  let imagesLoaded = 0;

  const loopDuration = 10000; // 10s per full back-and-forth cycle
  let startTime = null;
  let animationFrameId;
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

  // Initialize beam at far left immediately
  laserBeam.style.left = '0%';

  function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    width = canvas.width = Math.floor(rect.width);
    height = canvas.height = Math.floor(rect.height);

    // If sketch is already loaded, draw sketch immediately to guarantee no render flicker
    if (sketchImg.complete && sketchImg.naturalWidth > 0 && width > 0 && height > 0) {
      drawImageCover(ctx, sketchImg, 0, 0, width, height);
    }

    if (motionQuery.matches && imagesLoaded === 2) {
      renderFrame(0.5);
    }
  }

  resizeCanvas();

  function onImageLoad() {
    imagesLoaded++;
    if (imagesLoaded === 1 && sketchImg.complete) {
      // Paint sketch immediately as first visual frame
      if (width > 0 && height > 0) {
        drawImageCover(ctx, sketchImg, 0, 0, width, height);
      }
    }
    if (imagesLoaded === 2) {
      resizeCanvas();
      if (motionQuery.matches) {
        renderStaticFrame();
        return;
      }
      // Brief luxury hold at initial 100% sketch state before starting sweep
      setTimeout(() => {
        startEngine();
      }, 400);
    }
  }

  sketchImg.onload = onImageLoad;
  renderImg.onload = onImageLoad;
  sketchImg.src = 'assets/images/hero_sketch.jpg';
  renderImg.src = 'assets/images/hero_render.jpg';

  function renderFrame(currentPos) {
    const splitX = Math.round(currentPos * width);

    laserBeam.style.left = `${currentPos * 100}%`;
    drawImageCover(ctx, renderImg, 0, 0, width, height);

    if (splitX < width) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(splitX, 0, width - splitX, height);
      ctx.clip();
      drawImageCover(ctx, sketchImg, 0, 0, width, height);
      ctx.restore();
    }

    drawLaserCanvasGlow(ctx, splitX, height);
  }

  function renderStaticFrame() {
    cancelAnimationFrame(animationFrameId);
    startTime = null;
    heroVideo?.pause();
    laserBeam.style.opacity = '0';
    renderFrame(0.5);
  }

  function startEngine() {
    if (motionQuery.matches || document.hidden) {
      renderStaticFrame();
      return;
    }

    cancelAnimationFrame(animationFrameId);
    laserBeam.style.opacity = '1';

    function renderLoop(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      // Pure cosine loop starting at pos = 0.0 (far left, 100% sketch)
      // (1 - cos(2*PI*t)) / 2 gives 0 at t=0, 1 at t=0.5, 0 at t=1.0 with smooth ease-in-out
      const progress = (elapsed % loopDuration) / loopDuration;
      const currentPos = (1 - Math.cos(progress * Math.PI * 2)) / 2;

      renderFrame(currentPos);

      animationFrameId = requestAnimationFrame(renderLoop);
    }

    animationFrameId = requestAnimationFrame(renderLoop);
  }

  // Draw image to cover canvas exactly without distortion
  function drawImageCover(ctx, img, x, y, w, h) {
    if (!w || !h || !img.naturalWidth || !img.naturalHeight) return;
    const imgRatio = img.naturalWidth / img.naturalHeight;
    const canvasRatio = w / h;
    let sw, sh, sx, sy;

    if (imgRatio > canvasRatio) {
      sh = img.naturalHeight;
      sw = img.naturalHeight * canvasRatio;
      sx = (img.naturalWidth - sw) / 2;
      sy = 0;
    } else {
      sw = img.naturalWidth;
      sh = img.naturalWidth / canvasRatio;
      sx = 0;
      sy = (img.naturalHeight - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  // Softens the transition edge without competing with the architecture.
  function drawLaserCanvasGlow(ctx, x, h) {
    const glowWidth = 14;
    const gradient = ctx.createLinearGradient(x - glowWidth, 0, x + glowWidth, 0);
    gradient.addColorStop(0, 'rgba(91, 174, 211, 0)');
    gradient.addColorStop(0.4, 'rgba(91, 174, 211, 0.08)');
    gradient.addColorStop(0.5, 'rgba(232, 246, 251, 0.32)');
    gradient.addColorStop(0.6, 'rgba(91, 174, 211, 0.08)');
    gradient.addColorStop(1, 'rgba(91, 174, 211, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(x - glowWidth, 0, glowWidth * 2, h);
  }

  window.addEventListener('resize', resizeCanvas);

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrameId);
    } else if (!motionQuery.matches && imagesLoaded === 2) {
      startTime = null;
      startEngine();
    }
  });

  motionQuery.addEventListener('change', (event) => {
    if (event.matches) {
      renderStaticFrame();
    } else if (imagesLoaded === 2) {
      heroVideo?.play().catch(() => {});
      startTime = null;
      startEngine();
    }
  });
})();
