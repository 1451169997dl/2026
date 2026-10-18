(() => {
  'use strict';
  function init() {
    const section = document.getElementById('night');
    const canvas = document.getElementById('night-preview-canvas');
    if (!section || !canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const colors = ['#efc984', '#e8aab7', '#93bdd6', '#aac9a7'];
    let width = 0, height = 0, dpr = 1, visible = false, running = false;
    let frame = 0, previous = 0, clock = 0, nextFire = 0, nextMeteor = 0, side = 0;
    let bursts = [], meteors = [];
    const random = (min, max) => min + Math.random() * (max - min);
    const modalOpen = () => document.body.classList.contains('modal-open') || Boolean(document.querySelector('dialog[open]'));
    function stop() {
      if (frame) window.cancelAnimationFrame(frame);
      frame = 0; running = false; previous = 0; bursts = []; meteors = [];
      ctx.clearRect(0, 0, width, height);
    }
    function launch(immediate = false) {
      if (bursts.length >= 2) return;
      const left = side++ % 2 === 0;
      const x = width * (left ? random(.12, .30) : random(.72, .90));
      const duration = random(.8, 1.05);
      bursts.push({ x, y: height * random(.13, .34), startX: x + random(-18, 18),
        age: immediate ? duration * .42 : 0, duration, trail: [], particles: null,
        flower: Math.random() > .4, color: colors[Math.floor(Math.random() * colors.length)] });
    }
    function explode(burst) {
      const count = width < 700 ? 50 : 90, scale = width < 700 ? .68 : 1;
      burst.particles = Array.from({ length: count }, (_, index) => {
        const angle = index / count * Math.PI * 2 + random(-.035, .035);
        const petal = burst.flower ? .68 + .32 * Math.cos(angle * 5) : random(.86, 1);
        const speed = random(66, 92) * petal * scale;
        return { x: burst.x, y: burst.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          life: random(1.6, 2.05), age: 0, size: random(.95, 1.8), color: burst.color };
      });
    }
    function drawBurst(burst, dt) {
      if (!burst.particles) {
        burst.age += dt;
        const t = Math.min(1, burst.age / burst.duration), ease = 1 - (1 - t) ** 1.8;
        const x = burst.startX + (burst.x - burst.startX) * t;
        const y = height + 15 + (burst.y - height - 15) * ease;
        burst.trail.push({ x, y });
        if (burst.trail.length > 13) burst.trail.shift();
        burst.trail.forEach((point, index) => {
          ctx.globalAlpha = .5 * index / burst.trail.length; ctx.fillStyle = '#efc984';
          ctx.beginPath(); ctx.arc(point.x, point.y, 1.2, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = .9; ctx.fillStyle = '#f4d79f';
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
        if (t >= 1) explode(burst);
        return true;
      }
      burst.particles = burst.particles.filter((particle) => {
        particle.age += dt;
        if (particle.age >= particle.life) return false;
        particle.x += particle.vx * dt; particle.y += particle.vy * dt; particle.vy += 15 * dt;
        const drag = Math.exp(-.42 * dt); particle.vx *= drag; particle.vy *= drag;
        ctx.globalAlpha = .78 * (1 - particle.age / particle.life);
        ctx.fillStyle = particle.color;
        ctx.beginPath(); ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); ctx.fill();
        return true;
      });
      return burst.particles.length > 0;
    }
    function addMeteor() {
      if (meteors.length >= 2) return;
      const direction = Math.random() > .5 ? 1 : -1;
      meteors.push({ x: width * (direction > 0 ? random(.02, .17) : random(.83, .98)),
        y: height * random(.04, .16), vx: direction * random(240, 340), vy: random(70, 100),
        age: 0, life: random(.9, 1.15), length: Math.min(width * .23, 150) });
    }
    function drawMeteor(meteor, dt) {
      meteor.age += dt;
      if (meteor.age >= meteor.life) return false;
      meteor.x += meteor.vx * dt; meteor.y += meteor.vy * dt;
      const speed = Math.hypot(meteor.vx, meteor.vy);
      const tx = meteor.x - meteor.vx / speed * meteor.length;
      const ty = meteor.y - meteor.vy / speed * meteor.length;
      const fade = Math.min(1, meteor.age / .12, (meteor.life - meteor.age) / .25);
      const trail = ctx.createLinearGradient(tx, ty, meteor.x, meteor.y);
      trail.addColorStop(0, 'rgba(155,195,212,0)'); trail.addColorStop(1, 'rgba(208,226,230,.82)');
      ctx.globalAlpha = fade; ctx.strokeStyle = trail; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(meteor.x, meteor.y); ctx.stroke();
      ctx.fillStyle = '#e5e8dc'; ctx.beginPath(); ctx.arc(meteor.x, meteor.y, 2, 0, Math.PI * 2); ctx.fill();
      return true;
    }
    function draw(time) {
      if (!running) return;
      const dt = previous ? Math.min((time - previous) / 1000, .05) : 1 / 60;
      previous = time; clock += dt; ctx.clearRect(0, 0, width, height);
      if (clock >= nextFire) { launch(); nextFire = clock + random(1.5, 2); }
      if (clock >= nextMeteor) { addMeteor(); nextMeteor = clock + random(2.5, 4); }
      bursts = bursts.filter((burst) => drawBurst(burst, dt));
      meteors = meteors.filter((meteor) => drawMeteor(meteor, dt));
      ctx.globalAlpha = 1; frame = window.requestAnimationFrame(draw);
    }
    function reconcile() {
      canvas.hidden = motion.matches;
      const canRun = visible && !document.hidden && !motion.matches && !modalOpen() && width > 0 && height > 0;
      if (!canRun) { stop(); return; }
      if (running) return;
      running = true; clock = 0; nextFire = random(1.5, 2); nextMeteor = .8;
      launch(true); frame = window.requestAnimationFrame(draw);
    }
    function resize() {
      const box = canvas.getBoundingClientRect(), mobile = box.width < 700;
      const nextDpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
      if (width === box.width && height === box.height && dpr === nextDpr) return;
      stop(); width = box.width; height = box.height; dpr = nextDpr;
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); reconcile();
    }
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting && entries[0].intersectionRatio >= .025; reconcile();
      }, { threshold: [0, .025] }).observe(section);
    } else {
      const check = () => { const box = section.getBoundingClientRect(); visible = box.bottom > 0 && box.top < window.innerHeight; reconcile(); };
      window.addEventListener('scroll', check, { passive: true }); check();
    }
    if ('ResizeObserver' in window) new ResizeObserver(resize).observe(section);
    window.addEventListener('resize', resize, { passive: true });
    document.addEventListener('visibilitychange', reconcile);
    window.addEventListener('pagehide', stop);
    new MutationObserver((records) => {
      if (records.some((record) => record.target === document.body || record.target.tagName === 'DIALOG')) reconcile();
    }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['class', 'open'] });
    const motionChanged = () => { canvas.hidden = motion.matches; resize(); reconcile(); };
    if (motion.addEventListener) motion.addEventListener('change', motionChanged);
    else if (motion.addListener) motion.addListener(motionChanged);
    resize(); reconcile();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
