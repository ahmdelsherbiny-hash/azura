/**
 * AZURA STUDIO — HERO STATIONARY LASER SCAN ENGINE
 * Purely autonomous, cinematic slow-looping laser scan that transforms the static 2D sketch into a photorealistic render in place.
 * Completely independent of mouse/touch interactions for a steady, uninterrupted visual loop.
 */

(function () {
  const container = document.getElementById('hero-visual-wrapper');
  const canvas = document.getElementById('hero-laser-canvas');
  const laserBeam = document.getElementById('hero-laser-beam');

  if (!container || !canvas || !laserBeam) return;

  const ctx = canvas.getContext('2d', { alpha: false });
  let width, height;
  let renderImg = new Image();
  let sketchImg = new Image();
  let imagesLoaded = 0;

  let autoLoopTime = 0;
  const loopDuration = 11000; // 11 seconds for a steady, majestic architectural loop
  let animationFrameId;

  function onImageLoad() {
    imagesLoaded++;
    if (imagesLoaded === 2) {
      resizeCanvas();
      startEngine();
    }
  }

  renderImg.onload = onImageLoad;
  sketchImg.onload = onImageLoad;
  renderImg.src = 'assets/images/hero_render.jpg';
  sketchImg.src = 'assets/images/hero_sketch.jpg';

  function resizeCanvas() {
    const rect = container.getBoundingClientRect();
    width = canvas.width = Math.floor(rect.width);
    height = canvas.height = Math.floor(rect.height);
  }

  function startEngine() {
    let lastTimestamp = performance.now();

    function renderLoop(timestamp) {
      const delta = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      // Pure continuous sinusoidal loop independent of mouse
      autoLoopTime = (autoLoopTime + delta) % loopDuration;
      const progress = autoLoopTime / loopDuration;
      const wave = (Math.sin(progress * Math.PI * 2 - Math.PI / 2) + 1) / 2;
      const currentPos = 0.05 + wave * 0.90;

      const isRTL = document.documentElement.getAttribute('dir') === 'rtl';
      const scanPercent = isRTL ? (1 - currentPos) : currentPos;
      const splitX = Math.floor(scanPercent * width);

      // Position the glowing laser beam indicator
      laserBeam.style.left = `${scanPercent * 100}%`;

      // 1. Draw base realistic render (FULL static frame)
      drawImageCover(ctx, renderImg, 0, 0, width, height);

      // 2. Draw 2D architectural sketch (Right side of the laser beam, matching exact same static coordinates)
      ctx.save();
      ctx.beginPath();
      if (isRTL) {
        ctx.rect(0, 0, splitX, height);
      } else {
        ctx.rect(splitX, 0, width - splitX, height);
      }
      ctx.clip();
      drawImageCover(ctx, sketchImg, 0, 0, width, height);
      ctx.restore();

      // 3. Draw Laser Light Blend Glow directly on Canvas
      drawLaserCanvasGlow(ctx, splitX, height);

      animationFrameId = requestAnimationFrame(renderLoop);
    }

    animationFrameId = requestAnimationFrame(renderLoop);
  }

  // Draw image to cover canvas exactly without stretching/shifting
  function drawImageCover(ctx, img, x, y, w, h) {
    const imgRatio = img.width / img.height;
    const canvasRatio = w / h;
    let sw, sh, sx, sy;

    if (imgRatio > canvasRatio) {
      sh = img.height;
      sw = img.height * canvasRatio;
      sx = (img.width - sw) / 2;
      sy = 0;
    } else {
      sw = img.width;
      sh = img.width / canvasRatio;
      sx = 0;
      sy = (img.height - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  }

  // Real-time canvas laser glow gradient
  function drawLaserCanvasGlow(ctx, x, h) {
    const glowWidth = 36;
    const gradient = ctx.createLinearGradient(x - glowWidth, 0, x + glowWidth, 0);
    gradient.addColorStop(0, 'rgba(56, 189, 248, 0)');
    gradient.addColorStop(0.4, 'rgba(56, 189, 248, 0.25)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
    gradient.addColorStop(0.6, 'rgba(56, 189, 248, 0.25)');
    gradient.addColorStop(1, 'rgba(56, 189, 248, 0)');

    ctx.fillStyle = gradient;
    ctx.fillRect(x - glowWidth, 0, glowWidth * 2, h);
  }

  window.addEventListener('resize', resizeCanvas);
})();
