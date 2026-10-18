/* A small, self-contained birthday sky. No network requests or dependencies. */
(() => {
  'use strict';
  const boot = () => {
    const dialog = document.getElementById('firework-dialog');
    const canvas = document.getElementById('firework-canvas');
    const pauseButton = document.getElementById('firework-pause');
    if (!dialog || !canvas || canvas.dataset.skyReady) return;
    canvas.dataset.skyReady = 'true';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.pointerEvents = 'auto';
    canvas.style.touchAction = 'manipulation';
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const colors = [
      [255, 217, 139], [255, 182, 207], [169, 239, 211],
      [242, 211, 255], [255, 236, 190]
    ];
    const random = (a, b) => a + Math.random() * (b - a);
    const pick = list => list[Math.floor(Math.random() * list.length)];
    const rgba = (c, alpha = 1) => `rgba(${c[0]},${c[1]},${c[2]},${Math.max(0, Math.min(1, alpha))})`;
    const TAU = Math.PI * 2;
    let width = 1, height = 1, dpr = 1, mobile = false, limit = 1000;
    let running = false, paused = false, raf = 0, previous = 0, time = 0;
    let nextRocket = 0, nextMeteor = 0;
    let stars = [], particles = [], rockets = [], flowers = [], petals = [], meteors = [];
    let staticFlowers = [];
    let background, atmosphere;

    function resize() {
      if (!dialog.open) return;
      const box = canvas.getBoundingClientRect();
      width = Math.max(1, box.width || window.innerWidth);
      height = Math.max(1, box.height || window.innerHeight);
      mobile = width < 700;
      limit = mobile ? 650 : 1000;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      background = ctx.createLinearGradient(0, 0, 0, height);
      background.addColorStop(0, '#060b23');
      background.addColorStop(0.48, '#121332');
      background.addColorStop(1, '#23142f');
      atmosphere = ctx.createRadialGradient(width * .5, height * .68, 0, width * .5, height * .68, Math.max(width, height) * .7);
      atmosphere.addColorStop(0, 'rgba(83,49,111,.18)');
      atmosphere.addColorStop(1, 'rgba(10,10,30,0)');
      stars = Array.from({ length: mobile ? 58 : 100 }, () => ({
        x: Math.random() * width, y: Math.random() * height * .86,
        r: random(.45, 1.35), phase: random(0, TAU), speed: random(.45, 1.2), alpha: random(.2, .7)
      }));
      if (running && !raf) render(0);
    }

    // One petal is a pair of softly curved, pointed lobes, meeting at the heart.
    function flowerPath(radius, count, rotation = 0) {
      ctx.beginPath();
      for (let i = 0; i < count; i++) {
        const a = rotation + i * TAU / count;
        const ux = Math.cos(a), uy = Math.sin(a), vx = -uy, vy = ux;
        const p = (forward, side) => [radius * (ux * forward + vx * side), radius * (uy * forward + vy * side)];
        const a1 = p(.33, -.43), a2 = p(1.14, -.43), tip = p(1, 0);
        const b1 = p(1.14, .43), b2 = p(.33, .43);
        ctx.moveTo(0, 0);
        ctx.bezierCurveTo(...a1, ...a2, ...tip);
        ctx.bezierCurveTo(...b1, ...b2, 0, 0);
      }
    }

    function drawFlower(f, fixed = false) {
      const progress = fixed ? 1 : 1 - Math.exp(-f.age * 4.5);
      const fade = fixed ? .65 : Math.max(0, 1 - Math.pow(f.age / f.life, 1.55));
      if (fade <= 0) return;
      ctx.save();
      ctx.translate(f.x, f.y + (fixed ? 0 : f.age * 9));
      ctx.rotate(f.rotation + (fixed ? 0 : f.age * .025));
      ctx.globalCompositeOperation = 'lighter';
      const radius = f.radius * progress;
      ctx.strokeStyle = rgba(f.color, fade * .62);
      ctx.lineWidth = fixed ? .8 : 1.15;
      ctx.shadowColor = rgba(f.color, .9);
      ctx.shadowBlur = fixed ? 5 : 12;
      flowerPath(radius, f.count);
      ctx.stroke();
      ctx.shadowBlur = 0;
      // Fine pinpoints around each petal make the outline read as fireworks.
      for (let i = 0; i < f.count; i++) {
        const angle = i * TAU / f.count;
        const x = Math.cos(angle) * radius, y = Math.sin(angle) * radius;
        ctx.fillStyle = rgba(f.color, fade * .95);
        ctx.beginPath(); ctx.arc(x, y, fixed ? 1.3 : 1.6, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = rgba([255, 245, 212], fade);
      ctx.beginPath(); ctx.arc(0, 0, fixed ? 2 : 2.7, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(f.color, fade * .5);
      ctx.lineWidth = .7;
      ctx.beginPath(); ctx.arc(0, 0, Math.max(3, radius * .09), 0, TAU); ctx.stroke();
      ctx.restore();
    }

    function makeFlower(x, y, options = {}) {
      return {
        x, y, age: options.age || 0, life: random(2.6, 3.4),
        radius: options.radius || random(mobile ? 39 : 52, mobile ? 66 : 94),
        count: Math.random() < .6 ? 5 : 6, rotation: random(0, TAU), color: options.color || pick(colors)
      };
    }

    function burst(x, y, floral = true, opening = false) {
      const color = pick(colors);
      if (floral) {
        flowers.push(makeFlower(x, y, { color, age: opening ? .38 : 0 }));
        if (flowers.length > (mobile ? 6 : 9)) flowers.shift();
      }
      const count = floral ? (mobile ? 42 : 65) : (mobile ? 62 : 96);
      const available = Math.max(0, limit - particles.length);
      for (let i = 0; i < Math.min(count, available); i++) {
        const angle = i / count * TAU + random(-.03, .03);
        const speed = floral ? random(20, 94) : random(50, 170);
        particles.push({
          x, y, px: x, py: y, vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed, age: 0, life: random(1.3, 2.6),
          color, r: random(.8, 1.8), sparkle: Math.random() < .3
        });
      }
      if (floral) {
        for (let i = 0; i < (mobile ? 3 : 5); i++) {
          petals.push({ x: x + random(-26, 26), y: y + random(-12, 16), vx: random(-19, 19),
            vy: random(19, 33), age: 0, life: random(5, 7.2), size: random(3.5, 6),
            phase: random(0, TAU), rotation: random(0, TAU), spin: random(-.7, .7), color });
        }
        if (petals.length > 38) petals.splice(0, petals.length - 38);
      }
    }

    function launch() {
      const targetX = random(width * .14, width * .86);
      const targetY = random(height * .13, height * .52);
      rockets.push({ sx: random(width * .12, width * .88), sy: height + 12,
        x: 0, y: 0, targetX, targetY, age: 0, duration: random(1.15, 1.65),
        trail: [], floral: Math.random() < .78 });
    }

    function meteor(immediate = false) {
      const speed = random(390, 650);
      meteors.push({ x: immediate ? random(width * -.1, width * .7) : random(-width * .28, width * .8),
        y: immediate ? random(height * .03, height * .36) : random(-height * .16, height * .12),
        vx: speed, vy: speed * .37, length: random(mobile ? 80 : 110, mobile ? 145 : 220),
        age: immediate ? .35 : 0, life: random(1.6, 2.3) });
      if (meteors.length > 5) meteors.shift();
    }

    function drawGround() {
      ctx.save();
      const ground = ctx.createLinearGradient(0, height * .87, 0, height);
      ground.addColorStop(0, 'rgba(8,13,26,0)'); ground.addColorStop(1, 'rgba(7,11,21,.72)');
      ctx.fillStyle = ground; ctx.fillRect(0, height * .85, width, height * .15);
      // Botanical silhouettes frame the sky without covering the central greeting.
      for (const side of [0, 1]) {
        const baseX = side ? width - 16 : 16;
        const direction = side ? -1 : 1;
        for (let i = 0; i < 3; i++) {
          const x = baseX + direction * i * 22;
          const top = height - (mobile ? 54 : 76) - i * 18;
          ctx.strokeStyle = 'rgba(133,178,159,.24)'; ctx.lineWidth = 1.1;
          ctx.beginPath(); ctx.moveTo(x, height + 4);
          ctx.bezierCurveTo(x - direction * 11, height - 32, x + direction * 14, top + 20, x + direction * 8, top); ctx.stroke();
          ctx.save(); ctx.translate(x + direction * 8, top);
          ctx.strokeStyle = i === 1 ? 'rgba(234,186,204,.26)' : 'rgba(207,210,171,.25)';
          flowerPath(i === 1 ? 9 : 7, 5, -.3); ctx.stroke(); ctx.restore();
          ctx.fillStyle = 'rgba(115,169,145,.16)';
          ctx.beginPath(); ctx.ellipse(x + direction * 5, height - 28 - i * 8, 9, 2.5, direction * -.7, 0, TAU); ctx.fill();
        }
      }
      ctx.restore();
    }

    function drawSky(staticMode) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = background || '#090e27'; ctx.fillRect(0, 0, width, height);
      if (atmosphere) { ctx.fillStyle = atmosphere; ctx.fillRect(0, 0, width, height); }
      for (const s of stars) {
        const alpha = s.alpha * (staticMode ? .85 : .65 + .35 * Math.sin(time * s.speed + s.phase));
        ctx.fillStyle = `rgba(223,231,255,${alpha})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, TAU); ctx.fill();
      }
      drawGround();
    }

    function update(dt) {
      time += dt;
      nextRocket -= dt; nextMeteor -= dt;
      if (nextRocket <= 0) { launch(); nextRocket = random(mobile ? 1.15 : .85, mobile ? 1.9 : 1.55); }
      if (nextMeteor <= 0) { meteor(); nextMeteor = random(.65, 1.25); }
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i]; r.age += dt;
        const p = Math.min(1, r.age / r.duration);
        const ease = 1 - Math.pow(1 - p, 1.7);
        r.x = r.sx + (r.targetX - r.sx) * p;
        r.y = r.sy + (r.targetY - r.sy) * ease;
        r.trail.push({ x: r.x, y: r.y, age: 0 });
        for (const t of r.trail) t.age += dt;
        r.trail = r.trail.filter(t => t.age < .35);
        if (p >= 1) { burst(r.targetX, r.targetY, r.floral); rockets.splice(i, 1); }
      }
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i]; p.age += dt;
        if (p.age > p.life) { particles.splice(i, 1); continue; }
        p.px = p.x; p.py = p.y;
        const drag = Math.exp(-dt * .62); p.vx *= drag; p.vy = p.vy * drag + dt * 31;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      for (let i = flowers.length - 1; i >= 0; i--) {
        flowers[i].age += dt; if (flowers[i].age > flowers[i].life) flowers.splice(i, 1);
      }
      for (let i = petals.length - 1; i >= 0; i--) {
        const p = petals[i]; p.age += dt;
        if (p.age > p.life || p.y > height + 15) { petals.splice(i, 1); continue; }
        p.x += (p.vx + Math.sin(p.age * 1.5 + p.phase) * 12) * dt;
        p.y += p.vy * dt; p.rotation += p.spin * dt;
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]; m.age += dt; m.x += m.vx * dt; m.y += m.vy * dt;
        if (m.age > m.life || m.x > width + m.length || m.y > height) meteors.splice(i, 1);
      }
    }

    function drawDynamic() {
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      for (const m of meteors) {
        const fade = Math.min(1, m.age * 5) * Math.min(1, (m.life - m.age) * 2);
        const norm = Math.hypot(m.vx, m.vy), tailX = m.x - m.vx / norm * m.length, tailY = m.y - m.vy / norm * m.length;
        const gradient = ctx.createLinearGradient(tailX, tailY, m.x, m.y);
        gradient.addColorStop(0, 'rgba(171,192,255,0)');
        gradient.addColorStop(.7, `rgba(191,209,255,${fade * .26})`);
        gradient.addColorStop(1, `rgba(242,246,255,${fade * .9})`);
        ctx.strokeStyle = gradient; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(tailX, tailY); ctx.lineTo(m.x, m.y); ctx.stroke();
        ctx.fillStyle = `rgba(255,250,236,${fade})`;
        ctx.shadowColor = '#e1e8ff'; ctx.shadowBlur = 9;
        ctx.beginPath(); ctx.arc(m.x, m.y, 1.8, 0, TAU); ctx.fill();
        ctx.shadowBlur = 0;
      }
      for (const r of rockets) {
        if (r.trail.length < 2) continue;
        for (let i = 1; i < r.trail.length; i++) {
          const a = r.trail[i - 1], b = r.trail[i];
          ctx.strokeStyle = `rgba(255,220,151,${Math.max(0, 1 - b.age / .35) * .55})`;
          ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.fillStyle = '#fff0cc'; ctx.beginPath(); ctx.arc(r.x, r.y, 1.8, 0, TAU); ctx.fill();
      }
      for (const p of particles) {
        const fade = Math.pow(Math.max(0, 1 - p.age / p.life), 1.5);
        const twinkle = p.sparkle ? .7 + .3 * Math.sin(p.age * 22) : 1;
        ctx.strokeStyle = rgba(p.color, fade * .34); ctx.lineWidth = p.r * .65;
        ctx.beginPath(); ctx.moveTo(p.x - p.vx * .035, p.y - p.vy * .035); ctx.lineTo(p.x, p.y); ctx.stroke();
        ctx.fillStyle = rgba(p.color, fade * twinkle);
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (.55 + fade * .45), 0, TAU); ctx.fill();
      }
      ctx.restore();
      for (const f of flowers) drawFlower(f);
      for (const p of petals) {
        const fade = Math.min(1, p.age * 2) * Math.min(1, (p.life - p.age) / 1.5);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
        ctx.scale(.55 + Math.abs(Math.cos(p.age * 1.5 + p.phase)) * .45, 1);
        ctx.fillStyle = rgba(p.color, fade * .52);
        ctx.beginPath(); ctx.moveTo(0, -p.size);
        ctx.bezierCurveTo(p.size, -p.size * .5, p.size * .7, p.size * .7, 0, p.size);
        ctx.bezierCurveTo(-p.size * .65, p.size * .25, -p.size * .7, -p.size * .55, 0, -p.size); ctx.fill();
        ctx.restore();
      }
    }

    function render(dt) {
      const reduced = motion.matches;
      if (!reduced && dt) update(dt);
      drawSky(reduced);
      if (reduced) {
        for (const f of staticFlowers) drawFlower({ ...f, x: f.nx * width, y: f.ny * height }, true);
      } else drawDynamic();
    }

    function frame(stamp) {
      raf = 0;
      if (!running || paused || !dialog.open || document.hidden || motion.matches) return;
      const dt = previous ? Math.min((stamp - previous) / 1000, .05) : 0;
      previous = stamp;
      render(dt);
      raf = requestAnimationFrame(frame);
    }

    function cancel() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; previous = 0;
    }

    function beginFrames() {
      cancel();
      if (running && !paused && !document.hidden && !motion.matches) raf = requestAnimationFrame(frame);
    }

    function syncPauseButton() {
      if (!pauseButton) return;
      pauseButton.disabled = motion.matches;
      pauseButton.textContent = motion.matches ? '静态夜空' : paused ? '继续动画' : '暂停动画';
      pauseButton.setAttribute('aria-pressed', String(paused || motion.matches));
    }

    if (pauseButton) pauseButton.addEventListener('click', () => {
      if (!running || !dialog.open || motion.matches) return;
      paused = !paused;
      // Cancelling also resets the timestamp, so resuming never jumps forward.
      if (paused) cancel();
      else beginFrames();
      syncPauseButton();
    });

    function openSky() {
      if (running) return;
      running = true; paused = false; time = 0;
      syncPauseButton();
      nextRocket = .55; nextMeteor = .65;
      resize();
      staticFlowers = [
        { ...makeFlower(0, 0, { radius: mobile ? 44 : 67, color: colors[0] }), nx: .22, ny: .27 },
        { ...makeFlower(0, 0, { radius: mobile ? 35 : 54, color: colors[1] }), nx: .78, ny: .2 },
        { ...makeFlower(0, 0, { radius: mobile ? 28 : 45, color: colors[2] }), nx: .74, ny: .67 }
      ];
      if (!motion.matches) {
        burst(width * .23, height * .28, true, true);
        burst(width * .76, height * .19, true, true);
        meteor(true); meteor(true); meteor(true);
        launch();
      }
      render(0); beginFrames();
    }

    function closeSky() {
      running = false; paused = false; cancel();
      syncPauseButton();
      particles = []; rockets = []; flowers = []; petals = []; meteors = []; stars = []; staticFlowers = [];
      background = atmosphere = null;
      ctx.clearRect(0, 0, width, height);
      // Drop the full-screen backing store while the dialog is closed.
      canvas.width = canvas.height = 1;
    }

    canvas.addEventListener('pointerdown', event => {
      if (!dialog.open || !running || paused || event.button > 0) return;
      const rect = canvas.getBoundingClientRect();
      const x = Math.max(0, Math.min(width, event.clientX - rect.left));
      const y = Math.max(0, Math.min(height, event.clientY - rect.top));
      if (motion.matches) {
        staticFlowers.push({ ...makeFlower(x, y), nx: x / width, ny: y / height });
        if (staticFlowers.length > 10) staticFlowers.shift();
        render(0);
      } else burst(x, y, true);
    }, { passive: true });

    new MutationObserver(() => dialog.open ? openSky() : closeSky())
      .observe(dialog, { attributes: true, attributeFilter: ['open'] });
    window.addEventListener('resize', () => { if (running) { resize(); render(0); } }, { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (!running) return;
      if (document.hidden) cancel();
      else { render(0); beginFrames(); }
    });
    const changeMotion = () => {
      syncPauseButton();
      if (!running) return;
      cancel(); particles = []; rockets = []; flowers = []; petals = []; meteors = [];
      if (!motion.matches) {
        burst(width * .23, height * .28, true, true); meteor(true); nextRocket = .5; nextMeteor = .5;
      }
      render(0); beginFrames();
    };
    if (motion.addEventListener) motion.addEventListener('change', changeMotion);
    else motion.addListener(changeMotion);
    syncPauseButton();
    if (dialog.open) openSky();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();
