/**
 * AZURA STUDIO — DIAMOND PARTICLE CONSTELLATION
 * Subtle, high-performance background canvas inspired by blue diamonds & celestial stars.
 */

(function () {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  let animationFrameId;
  let width, height;
  let particles = [];

  // Configuration
  const isMobile = window.innerWidth < 768;
  const particleCount = isMobile ? 28 : 55;
  const maxDistance = isMobile ? 85 : 130;

  // Particle Class
  class Particle {
    constructor() {
      this.reset(true);
    }

    reset(initial = false) {
      this.x = Math.random() * width;
      this.y = initial ? Math.random() * height : Math.random() * height;
      this.vx = (Math.random() - 0.5) * 0.35;
      this.vy = (Math.random() - 0.5) * 0.35;
      this.size = Math.random() * 2 + 1;
      this.baseAlpha = Math.random() * 0.45 + 0.15;
      this.alpha = this.baseAlpha;
      this.isDiamond = Math.random() > 0.4;
      this.shimmerSpeed = Math.random() * 0.02 + 0.008;
      this.shimmerAngle = Math.random() * Math.PI * 2;
    }

    update() {
      this.x += this.vx;
      this.y += this.vy;

      if (this.x < 0) this.x = width;
      if (this.x > width) this.x = 0;
      if (this.y < 0) this.y = height;
      if (this.y > height) this.y = 0;

      // Shimmering alpha
      this.shimmerAngle += this.shimmerSpeed;
      this.alpha = this.baseAlpha + Math.sin(this.shimmerAngle) * 0.18;
    }

    draw(ctx, isDarkTheme) {
      ctx.save();
      ctx.translate(this.x, this.y);

      const color = isDarkTheme
        ? (this.isDiamond ? `rgba(56, 189, 248, ${Math.max(0, this.alpha)})` : `rgba(223, 202, 167, ${Math.max(0, this.alpha * 0.8)})`)
        : (this.isDiamond ? `rgba(14, 59, 100, ${Math.max(0, this.alpha * 0.6)})` : `rgba(140, 115, 78, ${Math.max(0, this.alpha * 0.5)})`);

      ctx.fillStyle = color;

      if (this.isDiamond) {
        // Draw small 4-pointed diamond
        ctx.beginPath();
        const s = this.size * 1.5;
        ctx.moveTo(0, -s);
        ctx.lineTo(s * 0.7, 0);
        ctx.lineTo(0, s);
        ctx.lineTo(-s * 0.7, 0);
        ctx.closePath();
        ctx.fill();
      } else {
        // Draw soft round particle
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  }

  function init() {
    resize();
    particles = [];
    for (let i = 0; i < particleCount; i++) {
      particles.push(new Particle());
    }
  }

  function animate() {
    const isDarkTheme = document.documentElement.getAttribute('data-theme') !== 'light';
    ctx.clearRect(0, 0, width, height);

    // Draw connecting constellation lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxDistance) {
          const lineAlpha = (1 - dist / maxDistance) * (isDarkTheme ? 0.12 : 0.06);
          ctx.strokeStyle = isDarkTheme
            ? `rgba(56, 189, 248, ${lineAlpha})`
            : `rgba(14, 59, 100, ${lineAlpha})`;
          ctx.lineWidth = 0.75;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // Update and draw particles
    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw(ctx, isDarkTheme);
    }

    animationFrameId = requestAnimationFrame(animate);
  }

  // Handle visibility changes to save CPU/battery
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      cancelAnimationFrame(animationFrameId);
    } else {
      animate();
    }
  });

  window.addEventListener('resize', resize);

  // Initialize
  init();
  animate();
})();
