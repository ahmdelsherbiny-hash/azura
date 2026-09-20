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

  if (!container || !canvas || !laserBeam) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  let width = 0, height = 0;
  const renderImg = new Image();
  const sketchImg = new Image();
  let imagesLoaded = 0;

  const loopDuration = 10000; // 10s per full back-and-forth cycle
  let startTime = null;
  let animationFrameId;

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

  function startEngine() {
    function renderLoop(timestamp) {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;

      // Pure cosine loop starting at pos = 0.0 (far left, 100% sketch)
      // (1 - cos(2*PI*t)) / 2 gives 0 at t=0, 1 at t=0.5, 0 at t=1.0 with smooth ease-in-out
      const progress = (elapsed % loopDuration) / loopDuration;
      const currentPos = (1 - Math.cos(progress * Math.PI * 2)) / 2;

      const splitX = Math.round(currentPos * width);

      // Position glowing laser beam indicator precisely
      laserBeam.style.left = `${currentPos * 100}%`;

      // 1. Draw photorealistic render as base layer
      drawImageCover(ctx, renderImg, 0, 0, width, height);

      // 2. Draw 2D architectural sketch clipped to the right side of the laser beam
      // When splitX = 0, sketch covers the full canvas (100% sketch)
      // When splitX = width, sketch width is 0 (100% render)
      if (splitX < width) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(splitX, 0, width - splitX, height);
        ctx.clip();
        drawImageCover(ctx, sketchImg, 0, 0, width, height);
        ctx.restore();
      }

      // 3. Draw Laser Light Blend Glow on Canvas along the laser divider line
      drawLaserCanvasGlow(ctx, splitX, height);

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

  // Real-time canvas laser glow gradient
  function drawLaserCanvasGlow(ctx, x, h) {
    const glowWidth = 32;
    const gradient = ctx.createLinearGradient(x - glowWidth, 0, x + glowWidth, 0);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0)');
    gradient.addColorStop(0.35, 'rgba(56, 189, 248, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
    gradient.addColorStop(0.65, 'rgba(212, 175, 55, 0.35)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(x - glowWidth, 0, glowWidth * 2, h);
  }

  window.addEventListener('resize', resizeCanvas);
})();
