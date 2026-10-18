(() => {
  'use strict';

  function init() {
    const config = Object.assign({
      name: '陈佳怡', shortName: '老大', year: 2026, date: '10.18',
      tagline: '天天开心', signature: '小助理'
    }, window.BIRTHDAY_CONFIG || {});
    const motionQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const reduceMotion = () => Boolean(motionQuery && motionQuery.matches);
    const select = (selector) => document.querySelector(selector);

    document.querySelectorAll('[data-config]').forEach((element) => {
      const key = element.dataset.config;
      if (Object.prototype.hasOwnProperty.call(config, key)) {
        element.textContent = String(config[key]);
      }
    });
    document.title = `${config.name}${config.year}生日快乐`;

    // A single dialog controller keeps focus and page scrolling consistent.
    const returnFocus = new WeakMap();
    const dialogs = Array.from(document.querySelectorAll('dialog'));
    const syncModalState = () => {
      document.body.classList.toggle('modal-open', dialogs.some((dialog) => dialog.open));
    };
    function dialogClosed(dialog) {
      syncModalState();
      const trigger = returnFocus.get(dialog);
      returnFocus.delete(dialog);
      if (trigger && trigger.isConnected && !dialogs.some((item) => item.open)) {
        trigger.focus({ preventScroll: true });
      }
    }
    function openDialog(dialog, trigger) {
      if (!dialog || dialog.open) return;
      returnFocus.set(dialog, trigger || document.activeElement);
      if (typeof dialog.showModal === 'function') {
        try {
          dialog.showModal();
        } catch (_) {
          returnFocus.delete(dialog);
          return;
        }
      } else {
        dialog.setAttribute('open', '');
        dialog.setAttribute('aria-modal', 'true');
        const firstControl = dialog.querySelector('button, [href], input, textarea, [tabindex="0"]');
        if (firstControl) firstControl.focus();
      }
      syncModalState();
    }
    function closeDialog(dialog) {
      if (!dialog || !dialog.open) return;
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
        dialogClosed(dialog);
      }
    }
    dialogs.forEach((dialog) => {
      dialog.addEventListener('close', () => dialogClosed(dialog));
      dialog.addEventListener('click', (event) => {
        if (event.target !== dialog) return;
        const bounds = dialog.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right ||
            event.clientY < bounds.top || event.clientY > bounds.bottom) {
          closeDialog(dialog);
        }
      });
    });
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target : null;
      const closeButton = target && target.closest('[data-close-dialog]');
      if (closeButton) closeDialog(closeButton.closest('dialog'));
    });
    document.querySelectorAll('.open-letter').forEach((button) => {
      button.addEventListener('click', () => openDialog(select('#letter-dialog'), button));
    });
    document.querySelectorAll('.open-fireworks').forEach((button) => {
      button.addEventListener('click', () => openDialog(select('#firework-dialog'), button));
    });

    const audio = select('#background-music');
    const musicButton = select('#music-toggle');
    if (audio && musicButton) {
      const label = musicButton.querySelector('.music-label');
      const nextMusicButton = select('#music-next');
      const tracks = [
        { src: 'assets/music-dang-wo-ai-shang-ni.mp3', name: '《当我爱上你》' },
        { src: 'assets/music-birthday.mp3', name: '生日配乐' },
        { src: 'assets/music-memories.mp3', name: '回忆配乐' }
      ];
      const initialSource = (audio.getAttribute('src') || '').split(/[?#]/)[0];
      let currentTrack = tracks.findIndex((track) => initialSource.endsWith(track.src));
      if (currentTrack < 0) {
        currentTrack = 0;
        audio.src = tracks[currentTrack].src;
      }
      let playRequested = false;
      let requestNumber = 0;
      let waitingForGesture = false;
      let userPaused = false;
      let initialAutoPending = true;
      function updateNextMusicLabel() {
        if (nextMusicButton) {
          nextMusicButton.setAttribute('aria-label', `换一首配乐，下一曲：${tracks[(currentTrack + 1) % tracks.length].name}`);
        }
      }
      function setMusicState(playing, failed = false) {
        const trackName = tracks[currentTrack].name;
        const text = playing ? `${trackName} · 播放中` : waitingForGesture
          ? `轻点页面播放${trackName}` : failed ? `${trackName} · 点击重试` : `播放${trackName}`;
        if (label) label.textContent = text;
        musicButton.setAttribute('aria-pressed', String(playing));
        musicButton.setAttribute('aria-label', playing ? `暂停${trackName}` : text);
        musicButton.classList.toggle('is-playing', playing);
      }
      function disarmGestureRetry() {
        waitingForGesture = false;
        document.removeEventListener('pointerdown', onPlaybackGesture, true);
        document.removeEventListener('click', onPlaybackGesture, true);
        document.removeEventListener('keydown', onPlaybackGesture, true);
      }
      function onPlaybackGesture(event) {
        if (!waitingForGesture || userPaused || document.hidden) return;
        const target = event.target instanceof Element ? event.target : null;
        if (target && target.closest('input, textarea, select, audio, video, [contenteditable], #music-toggle, #music-next')) return;
        if (event.type === 'keydown' && (event.isComposing || event.ctrlKey || event.altKey || event.metaKey ||
            ['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(event.key))) return;
        disarmGestureRetry();
        playMusic('gesture');
      }
      function armGestureRetry() {
        if (userPaused || document.hidden) return;
        if (!waitingForGesture) {
          waitingForGesture = true;
          document.addEventListener('pointerdown', onPlaybackGesture, { capture: true, passive: true });
          document.addEventListener('click', onPlaybackGesture, true);
          document.addEventListener('keydown', onPlaybackGesture, true);
        }
        setMusicState(false);
      }
      function pauseMusic(byUser = false) {
        if (byUser) { userPaused = true; initialAutoPending = false; }
        disarmGestureRetry();
        playRequested = false;
        requestNumber += 1;
        audio.pause();
        setMusicState(false);
      }
      function playMusic(source = 'manual') {
        if (document.hidden || (source !== 'manual' && userPaused)) return;
        if (source === 'manual') userPaused = false;
        initialAutoPending = false;
        disarmGestureRetry();
        playRequested = true;
        const thisRequest = ++requestNumber;
        function failedPlayback(error) {
          if (thisRequest !== requestNumber) return;
          playRequested = false;
          if (source === 'auto' || (error && error.name === 'NotAllowedError')) armGestureRetry();
          else setMusicState(false, true);
        }
        let playback;
        try {
          playback = audio.play();
        } catch (error) {
          failedPlayback(error);
          return;
        }
        Promise.resolve(playback).then(() => {
          if (thisRequest !== requestNumber) return;
          playRequested = false;
          setMusicState(!audio.paused);
        }).catch(failedPlayback);
      }
      audio.loop = true;
      setMusicState(false);
      updateNextMusicLabel();
      musicButton.addEventListener('click', () => {
        if (!audio.paused || playRequested) pauseMusic(true);
        else playMusic();
      });
      if (nextMusicButton) nextMusicButton.addEventListener('click', () => {
        const resumePlayback = (!audio.paused || playRequested) && !document.hidden;
        pauseMusic();
        currentTrack = (currentTrack + 1) % tracks.length;
        audio.src = tracks[currentTrack].src;
        audio.load();
        setMusicState(false);
        updateNextMusicLabel();
        if (resumePlayback) playMusic();
      });
      audio.addEventListener('playing', () => {
        if (userPaused || document.hidden) {
          pauseMusic();
          return;
        }
        disarmGestureRetry();
        setMusicState(!audio.paused);
      });
      audio.addEventListener('pause', () => setMusicState(false));
      audio.addEventListener('error', () => {
        disarmGestureRetry();
        playRequested = false;
        requestNumber += 1;
        setMusicState(false, true);
      });
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) pauseMusic();
        else if (initialAutoPending && !userPaused) playMusic('auto');
      });
      playMusic('auto');
    }

    const memoryRows = Array.from(document.querySelectorAll('.memory-row'));
    const galleryPause = select('#gallery-pause');
    const lightbox = select('#lightbox');
    const lightboxImage = select('#lightbox-image');
    const lightboxCaption = select('#lightbox-caption');
    const lightboxCounter = select('#lightbox-counter');
    let currentPhoto = 0;
    let activeMemoryButtons = [];
    let userPaused = false;
    let motionPaused = reduceMotion();
    let galleryKeyboardFocus = false;
    let galleryFrame = 0;
    let previousGalleryTime = 0;
    const galleryStates = [];

    function showPhoto(index) {
      if (!activeMemoryButtons.length) return;
      currentPhoto = (index + activeMemoryButtons.length) % activeMemoryButtons.length;
      const button = activeMemoryButtons[currentPhoto];
      const thumbnail = button.querySelector('img');
      const caption = button.dataset.caption || thumbnail.alt;
      lightboxImage.src = `assets/photo-${button.dataset.photo}.webp`;
      lightboxImage.alt = caption;
      if (lightboxCaption) lightboxCaption.textContent = caption;
      if (lightboxCounter) lightboxCounter.textContent = `${String(currentPhoto + 1).padStart(2, '0')} / ${String(activeMemoryButtons.length).padStart(2, '0')}`;
    }
    const lightboxPrevious = select('#lightbox-prev');
    const lightboxNext = select('#lightbox-next');
    if (lightboxPrevious) lightboxPrevious.addEventListener('click', () => showPhoto(currentPhoto - 1));
    if (lightboxNext) lightboxNext.addEventListener('click', () => showPhoto(currentPhoto + 1));
    document.addEventListener('keydown', (event) => {
      if (!lightbox || !lightbox.open) return;
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        showPhoto(currentPhoto + (event.key === 'ArrowLeft' ? -1 : 1));
      }
    });

    function updateGalleryPause() {
      if (!galleryPause) return;
      galleryPause.setAttribute('aria-pressed', String(userPaused || motionPaused));
      galleryPause.textContent = userPaused || motionPaused ? '继续滑动' : '暂停滑动';
    }
    function stopGallery() {
      if (galleryFrame) window.cancelAnimationFrame(galleryFrame);
      galleryFrame = 0;
      previousGalleryTime = 0;
      galleryStates.forEach((state) => { state.autoRunning = false; });
    }
    function rowCanMove(state) {
      return state.inView && state.cycle > 0 && !state.hovered && !state.interacting &&
        !(galleryKeyboardFocus && state.row.contains(document.activeElement));
    }
    function galleryCanMove() {
      return !userPaused && !motionPaused && !document.hidden && !dialogs.some((dialog) => dialog.open);
    }
    function normalizeGallery(state) {
      if (!state.cycle || state.interacting) return;
      const position = state.window.scrollLeft;
      let shift = 0;
      if (position < state.cycle - 1) shift = state.cycle;
      else if (position >= state.cycle * 2 - 1) shift = -state.cycle;
      if (shift) {
        state.window.scrollLeft = position + shift;
        state.position = state.autoRunning ? state.position + shift : state.window.scrollLeft;
      }
    }
    function animateGallery(time) {
      galleryFrame = 0;
      if (!galleryCanMove()) { previousGalleryTime = 0; return; }
      const delta = previousGalleryTime ? Math.min((time - previousGalleryTime) / 1000, 0.05) : 0;
      previousGalleryTime = time;
      let keepRunning = false;
      galleryStates.forEach((state) => {
        if (!rowCanMove(state)) { state.autoRunning = false; return; }
        keepRunning = true;
        if (time < state.restUntil) { state.autoRunning = false; return; }
        if (!state.autoRunning) state.position = state.window.scrollLeft;
        state.autoRunning = true;
        state.position += 14 * delta;
        state.window.scrollLeft = state.position;
        normalizeGallery(state);
      });
      if (keepRunning) galleryFrame = window.requestAnimationFrame(animateGallery);
      else previousGalleryTime = 0;
    }
    function requestGallery() {
      if (!galleryCanMove() || !galleryStates.some(rowCanMove)) { stopGallery(); return; }
      if (!galleryFrame) {
        previousGalleryTime = 0;
        galleryFrame = window.requestAnimationFrame(animateGallery);
      }
    }
    function measureGallery(state) {
      const oldCycle = state.cycle;
      const progress = oldCycle ? ((state.window.scrollLeft / oldCycle) % 1 + 1) % 1 : 0;
      state.cycle = state.originals.getBoundingClientRect().width;
      state.window.scrollLeft = state.cycle * (1 + progress);
      state.position = state.window.scrollLeft;
      state.autoRunning = false;
    }
    function visualCopy(originals) {
      const copy = document.createElement('div');
      copy.className = 'memory-set memory-set-copy';
      copy.setAttribute('aria-hidden', 'true');
      originals.querySelectorAll('.memory-photo').forEach((button) => {
        const item = document.createElement('span');
        item.className = button.className;
        item.dataset.photo = button.dataset.photo;
        item.innerHTML = button.innerHTML;
        item.querySelectorAll('[id]').forEach((node) => node.removeAttribute('id'));
        item.querySelectorAll('img').forEach((img) => { img.alt = ''; });
        copy.appendChild(item);
      });
      return copy;
    }

    memoryRows.forEach((row) => {
      const viewport = row.querySelector('.memory-window');
      const loop = row.querySelector('.memory-loop');
      const originals = row.querySelector('.memory-set');
      if (!viewport || !loop || !originals) return;
      const buttons = Array.from(originals.querySelectorAll('.memory-photo'));
      const state = { row, window: viewport, originals, buttons, cycle: 0, inView: true,
        hovered: false, interacting: false, restUntil: 0 };
      galleryStates.push(state);
      loop.insertBefore(visualCopy(originals), originals);
      loop.appendChild(visualCopy(originals));
      measureGallery(state);
      viewport.addEventListener('scroll', () => normalizeGallery(state), { passive: true });
      row.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'mouse') { state.hovered = true; requestGallery(); }
      });
      row.addEventListener('pointerleave', () => { state.hovered = false; requestGallery(); });
      row.addEventListener('focusin', requestGallery);
      row.addEventListener('focusout', () => window.requestAnimationFrame(requestGallery));
      viewport.addEventListener('pointerdown', () => {
        state.interacting = true; state.autoRunning = false;
        state.restUntil = performance.now() + 3500; requestGallery();
      }, { passive: true });
      viewport.addEventListener('wheel', () => {
        state.autoRunning = false; state.restUntil = performance.now() + 3500; requestGallery();
      }, { passive: true });
      viewport.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        state.restUntil = performance.now() + 3500;
        viewport.scrollBy({ left: (event.key === 'ArrowLeft' ? -1 : 1) * (buttons[0].offsetWidth + 20), behavior: 'smooth' });
      });
      row.addEventListener('click', (event) => {
        const item = event.target instanceof Element && event.target.closest('.memory-photo');
        if (!item) return;
        const index = buttons.findIndex((button) => button.dataset.photo === item.dataset.photo);
        if (index < 0) return;
        state.interacting = false;
        normalizeGallery(state);
        activeMemoryButtons = buttons;
        showPhoto(index);
        openDialog(lightbox, buttons[index]);
        stopGallery();
      });
      buttons.forEach((button) => button.addEventListener('focus', () => {
        const start = button.getBoundingClientRect().left - viewport.getBoundingClientRect().left + viewport.scrollLeft;
        if (start < viewport.scrollLeft || start + button.offsetWidth > viewport.scrollLeft + viewport.clientWidth) {
          viewport.scrollLeft = start;
        }
      }));
    });
    ['pointerup', 'pointercancel'].forEach((name) => window.addEventListener(name, () => {
      galleryStates.forEach((state) => {
        if (!state.interacting) return;
        state.interacting = false;
        state.restUntil = performance.now() + 3500;
        normalizeGallery(state);
      });
      requestGallery();
    }, { passive: true }));
    if ('IntersectionObserver' in window) {
      const galleryObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const state = galleryStates.find((item) => item.row === entry.target);
          if (state) state.inView = entry.isIntersecting;
        });
        requestGallery();
      }, { threshold: 0.01 });
      galleryStates.forEach((state) => galleryObserver.observe(state.row));
    }
    if (galleryPause) galleryPause.addEventListener('click', () => {
      if (motionPaused) { motionPaused = false; userPaused = false; }
      else userPaused = !userPaused;
      updateGalleryPause(); requestGallery();
    });
    if (motionQuery && typeof motionQuery.addEventListener === 'function') {
      motionQuery.addEventListener('change', () => {
        motionPaused = reduceMotion(); updateGalleryPause(); requestGallery();
      });
    }
    document.addEventListener('visibilitychange', requestGallery);
    document.addEventListener('keydown', (event) => {
      if (['Tab', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'Escape'].includes(event.key)) {
        galleryKeyboardFocus = true; requestGallery();
      }
    }, true);
    document.addEventListener('pointerdown', () => {
      galleryKeyboardFocus = false; requestGallery();
    }, { capture: true, passive: true });
    dialogs.forEach((dialog) => dialog.addEventListener('close', requestGallery));
    window.addEventListener('resize', () => {
      galleryStates.forEach(measureGallery); requestGallery();
    }, { passive: true });
    updateGalleryPause();
    requestGallery();


    const confettiCanvas = select('#confetti-canvas');
    const confettiContext = confettiCanvas && confettiCanvas.getContext('2d');
    let confettiFrame = 0;
    let confettiSize = { width: 0, height: 0 };
    function stopConfetti() {
      if (confettiFrame) window.cancelAnimationFrame(confettiFrame);
      confettiFrame = 0;
      if (confettiContext) confettiContext.clearRect(0, 0, confettiSize.width, confettiSize.height);
    }
    function celebrate() {
      stopConfetti();
      if (!confettiCanvas || !confettiContext || reduceMotion() || document.hidden) return;
      const width = window.innerWidth;
      const height = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      confettiSize = { width, height };
      confettiCanvas.width = Math.round(width * dpr);
      confettiCanvas.height = Math.round(height * dpr);
      confettiContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      const colors = ['#e9af5c', '#edb3b6', '#8baca1', '#c8b8db', '#f8dca8'];
      const count = Math.min(150, Math.max(75, Math.round(width / 8)));
      const particles = Array.from({ length: count }, () => ({
        x: Math.random() * width, y: -Math.random() * height * 0.7 - 15,
        vx: (Math.random() - 0.5) * 110, vy: 110 + Math.random() * 150,
        size: 4 + Math.random() * 6, angle: Math.random() * Math.PI,
        turn: (Math.random() - 0.5) * 8, phase: Math.random() * Math.PI * 2,
        color: colors[Math.floor(Math.random() * colors.length)]
      }));
      let started = 0;
      let previous = 0;
      function draw(now) {
        if (!started) started = now;
        const elapsed = (now - started) / 1000;
        const dt = previous ? Math.min((now - previous) / 1000, 0.05) : 1 / 60;
        previous = now;
        confettiContext.clearRect(0, 0, width, height);
        const opacity = Math.min(1, Math.max(0, (4 - elapsed) / 0.7));
        confettiContext.globalAlpha = opacity;
        particles.forEach((particle) => {
          particle.x += (particle.vx + Math.sin(elapsed * 2 + particle.phase) * 25) * dt;
          particle.vy += 26 * dt;
          particle.y += particle.vy * dt;
          particle.angle += particle.turn * dt;
          confettiContext.save();
          confettiContext.translate(particle.x, particle.y);
          confettiContext.rotate(particle.angle);
          confettiContext.scale(1, Math.cos(elapsed * 4 + particle.phase));
          confettiContext.fillStyle = particle.color;
          confettiContext.fillRect(-particle.size / 2, -particle.size / 2, particle.size, particle.size * 0.6);
          confettiContext.restore();
        });
        confettiContext.globalAlpha = 1;
        if (elapsed < 4 && !document.hidden && !reduceMotion()) {
          confettiFrame = window.requestAnimationFrame(draw);
        } else {
          stopConfetti();
        }
      }
      confettiFrame = window.requestAnimationFrame(draw);
    }
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) stopConfetti();
    });
    window.addEventListener('resize', stopConfetti, { passive: true });
    if (motionQuery) {
      const onMotionChange = () => { if (reduceMotion()) stopConfetti(); };
      if (typeof motionQuery.addEventListener === 'function') motionQuery.addEventListener('change', onMotionChange);
      else if (typeof motionQuery.addListener === 'function') motionQuery.addListener(onMotionChange);
    }

    const wishForm = select('#wish-form');
    const wishInput = select('#wish-input');
    const wishSubmit = select('#wish-submit');
    const wishStatus = select('#wish-status');
    const wishReplay = select('#wish-replay');
    const wishKeepPrivate = select('#wish-keep-private');
    const cake = select('.cake-scene');
    const wishApiBase = typeof config.wishApiBase === 'string' ? config.wishApiBase.trim().replace(/\/+$/, '') : '';
    const sentWishes = new Map();
    let wishStage = 'ready';
    let wishWasSent = false;
    let wishUploading = false;
    let preparedWish = '';
    let currentAttempt = null;
    function wishMessage() {
      return (wishInput ? wishInput.value : '').trim().slice(0, 120).replace(/[\uD800-\uDBFF]$/, '');
    }
    function newRequestId() {
      const secureCrypto = window.crypto;
      if (secureCrypto && typeof secureCrypto.randomUUID === 'function') {
        try { return secureCrypto.randomUUID(); } catch (_) { /* Use the secure UUID fallback below. */ }
      }
      if (!secureCrypto || typeof secureCrypto.getRandomValues !== 'function') throw new Error('Secure randomness unavailable');
      const bytes = new Uint8Array(16);
      secureCrypto.getRandomValues(bytes);
      bytes[6] = (bytes[6] & 0x0f) | 0x40;
      bytes[8] = (bytes[8] & 0x3f) | 0x80;
      const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
      return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
    }
    function setWishBusy(busy) {
      wishUploading = busy;
      if (wishForm) wishForm.setAttribute('aria-busy', String(busy));
      if (wishSubmit) {
        wishSubmit.disabled = busy;
        wishSubmit.textContent = busy ? '正在发送…' : wishStage === 'blow' ? '吹灭蜡烛，愿望出发' : '把愿望发送给小助理';
      }
      // Once sending starts, skipping cannot cancel a wish already accepted by the server.
      if (wishKeepPrivate) wishKeepPrivate.disabled = busy;
    }
    function enterBlowStage(sent, message) {
      wishStage = 'blow';
      wishWasSent = sent;
      preparedWish = message;
      if (wishForm) wishForm.dataset.wishState = wishStage;
      if (wishSubmit) wishSubmit.textContent = '吹灭蜡烛，愿望出发';
      if (wishKeepPrivate) wishKeepPrivate.hidden = true;
      if (wishStatus) wishStatus.textContent = sent
        ? '愿望已送到小助理的收件箱。准备好就吹灭蜡烛吧。'
        : '那就把愿望留在心里。准备好就吹灭蜡烛吧。';
    }
    function resetWish(showPrevious = false) {
      wishStage = 'ready';
      wishWasSent = false;
      preparedWish = '';
      if (wishForm) wishForm.dataset.wishState = wishStage;
      if (cake) cake.classList.remove('is-blown');
      if (wishSubmit) {
        wishSubmit.hidden = false;
        wishSubmit.textContent = '把愿望发送给小助理';
      }
      if (wishKeepPrivate) wishKeepPrivate.hidden = false;
      if (wishReplay) wishReplay.hidden = true;
      if (wishStatus) wishStatus.textContent = showPrevious && sentWishes.has(wishMessage())
        ? '这份愿望已经送到小助理的收件箱，再许一次也不会重复发送。' : '';
      setWishBusy(false);
      stopConfetti();
    }
    async function sendWish(message) {
      if (sentWishes.has(message)) {
        enterBlowStage(true, message);
        return;
      }
      setWishBusy(true);
      if (wishStatus) wishStatus.textContent = '正在把你的愿望送给小助理…';
      let controller = null;
      let timeout = 0;
      try {
        if (!currentAttempt || currentAttempt.message !== message) {
          currentAttempt = { message, requestId: newRequestId() };
        }
        const attempt = currentAttempt;
        controller = new AbortController();
        timeout = window.setTimeout(() => controller.abort(), 20000);
        const ticketResponse = await window.fetch(`${wishApiBase}/api/wish-ticket`, {
          credentials: 'omit', cache: 'no-store', signal: controller.signal,
          headers: { Accept: 'application/json' }
        });
        if (!ticketResponse.ok) throw new Error('Ticket request failed');
        const ticket = await ticketResponse.json();
        if (!ticket || typeof ticket.token !== 'string' || !ticket.token) throw new Error('Invalid ticket');
        const response = await window.fetch(`${wishApiBase}/api/wishes`, {
          method: 'POST', credentials: 'omit', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', 'X-Wish-Token': ticket.token, Accept: 'application/json' },
          body: JSON.stringify({ message, requestId: attempt.requestId })
        });
        if (response.status !== 201 && response.status !== 200) throw new Error('Wish request failed');
        const receipt = await response.json();
        if (!receipt || typeof receipt.id !== 'string' || !receipt.id ||
            typeof receipt.createdAt !== 'string' || !receipt.createdAt) throw new Error('Invalid receipt');
        sentWishes.set(message, receipt);
        if (wishMessage() === message) {
          enterBlowStage(true, message);
        } else if (wishStatus) {
          wishStatus.textContent = '刚才的愿望已送到小助理的收件箱。你修改后的内容还没发送，可以继续发送，或把它留在心里。';
        }
      } catch (_) {
        if (wishStatus) wishStatus.textContent = controller && controller.signal.aborted
          ? '发送有点久，还没确认愿望送达。内容还在，可以再试一次，或把愿望留在心里。'
          : '暂时还没确认愿望送达。内容还在，可以重试，或把愿望留在心里。';
      } finally {
        if (timeout) window.clearTimeout(timeout);
        setWishBusy(false);
      }
    }
    if (wishForm) {
      resetWish();
      wishForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (wishStage === 'done' || wishUploading) return;
        if (wishStage === 'ready') {
          const message = wishMessage();
          if (!message) {
            if (wishStatus) wishStatus.textContent = '先写下一个愿望再发送吧，也可以选择把愿望留在心里。';
            if (wishInput) wishInput.focus({ preventScroll: true });
            return;
          }
          sendWish(message);
          return;
        }
        wishStage = 'done';
        wishForm.dataset.wishState = wishStage;
        if (cake) cake.classList.add('is-blown');
        if (wishStatus) wishStatus.textContent = `${wishWasSent ? '愿望已送到小助理的收件箱。' : '把愿望留在心里。'}${config.shortName}，新的一岁，${config.tagline}！`;
        if (wishSubmit) wishSubmit.hidden = true;
        if (wishReplay) {
          wishReplay.hidden = false;
          wishReplay.focus({ preventScroll: true });
        }
        celebrate();
      });
    }
    if (wishKeepPrivate) wishKeepPrivate.addEventListener('click', () => {
      if (wishUploading || wishStage !== 'ready') return;
      const message = wishMessage();
      // A previously sent message remains sent; this action never sends it again.
      enterBlowStage(sentWishes.has(message), message);
    });
    if (wishInput) wishInput.addEventListener('input', () => {
      const message = wishMessage();
      if (currentAttempt && currentAttempt.message !== message) currentAttempt = null;
      if (wishStage === 'blow' && message !== preparedWish) {
        resetWish();
        if (wishStatus) wishStatus.textContent = '愿望有了新内容，重新发送或留在心里后，再吹蜡烛吧。';
      }
    });
    if (wishReplay) wishReplay.addEventListener('click', () => {
      if (wishUploading) return;
      resetWish(true);
      if (wishInput) wishInput.focus({ preventScroll: true });
    });

    const revealElements = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      }, { threshold: 0.08 });
      revealElements.forEach((element) => observer.observe(element));
    } else {
      revealElements.forEach((element) => element.classList.add('is-visible'));
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
