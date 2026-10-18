(() => {
  'use strict';

  function init() {
    const chapterParts = {
      home: [
        ['.hero-copy', 'motion-left'], ['.hero-art', 'motion-right']
      ],
      memories: [
        ['.section-top', 'motion-up'], ['.section-heading-row', 'motion-up'],
        ['.memory-row', 'motion-up']
      ],
      letter: [
        ['.letter-intro', 'motion-left'], ['.letter-paper', 'motion-right']
      ],
      wish: [
        ['.section-top', 'motion-up'], ['.cake-scene', 'motion-left'],
        ['.wish-copy', 'motion-right']
      ],
      night: [
        ['.eyebrow', 'motion-up'], ['h2', 'motion-up'],
        ['p', 'motion-up'], ['.open-fireworks', 'motion-up']
      ]
    };
    const chapters = Object.keys(chapterParts)
      .map((id) => document.getElementById(id)).filter(Boolean);
    const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
    const chapterLinks = Array.from(document.querySelectorAll('.chapter-nav a'));
    const ambientNodes = Array.from(document.querySelectorAll('.page-ambient'));
    const motionQuery = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const reducedMotion = () => Boolean(motionQuery && motionQuery.matches);
    const entranceFrames = new Map();
    let activeChapter = null;
    let updateFrame = 0;
    let measureNeeded = true;

    chapters.forEach((chapter) => {
      let index = 0;
      const seen = new Set();
      chapterParts[chapter.id].forEach(([selector, direction]) => {
        chapter.querySelectorAll(selector).forEach((part) => {
          if (seen.has(part)) return;
          seen.add(part);
          part.classList.add('chapter-motion-part', direction);
          part.style.setProperty('--enter-delay', `${index * 120}ms`);
          index += 1;
        });
      });
    });

    function chapterIdFromUrl(value) {
      try {
        const url = new URL(value, window.location.href);
        if (url.origin !== window.location.origin || url.pathname !== window.location.pathname ||
            url.search !== window.location.search || !url.hash) return null;
        const id = decodeURIComponent(url.hash.slice(1));
        return chapterById.has(id) ? id : null;
      } catch (_) {
        return null;
      }
    }

    function updateNavigation(chapter) {
      chapterLinks.forEach((link) => {
        if (chapterIdFromUrl(link.getAttribute('href') || '') === chapter.id) {
          link.setAttribute('aria-current', 'location');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }

    function updateHash(chapter) {
      const hash = `#${chapter.id}`;
      if (window.location.hash === hash) return;
      try {
        const url = new URL(window.location.href);
        url.hash = chapter.id;
        window.history.pushState(window.history.state, '', url.href);
      } catch (_) {
        // Restricted embedding or file contexts can reject History writes.
        // Scrolling and the visible chapter navigation still work in that case.
      }
    }

    function cancelEntrance(chapter) {
      const frame = entranceFrames.get(chapter);
      if (frame) window.cancelAnimationFrame(frame);
      entranceFrames.delete(chapter);
      chapter.classList.remove('chapter-entering');
    }

    function replayEntrance(chapter) {
      cancelEntrance(chapter);
      if (reducedMotion() || document.hidden) return;
      // The next frame gives CSS a clean class change when revisiting a chapter.
      const frame = window.requestAnimationFrame(() => {
        entranceFrames.delete(chapter);
        if (chapter === activeChapter && !reducedMotion() && !document.hidden) {
          chapter.classList.add('chapter-entering');
        }
      });
      entranceFrames.set(chapter, frame);
    }

    function activateChapter(chapter) {
      if (!chapter) return;
      if (chapter !== activeChapter) {
        if (activeChapter) {
          activeChapter.classList.remove('chapter-active');
          cancelEntrance(activeChapter);
        }
        activeChapter = chapter;
        chapter.classList.add('chapter-active');
        replayEntrance(chapter);
      }
      updateNavigation(chapter);
    }

    function measureAmbient() {
      ambientNodes.forEach((ambient) => {
        const section = ambient.closest('section');
        if (!section) return;
        const distance = `${Math.ceil(section.getBoundingClientRect().height + 260)}px`;
        if (ambient.style.getPropertyValue('--rise-distance') !== distance) {
          ambient.style.setProperty('--rise-distance', distance);
        }
      });
    }

    function selectVisibleChapter() {
      if (!chapters.length) return null;
      const line = (window.innerHeight || document.documentElement.clientHeight) * 0.42;
      let selected = chapters[0];
      for (const chapter of chapters) {
        if (chapter.getBoundingClientRect().top <= line) selected = chapter;
        else break;
      }
      return selected;
    }

    function requestUpdate(measure = false) {
      measureNeeded = measureNeeded || measure;
      if (updateFrame) return;
      updateFrame = window.requestAnimationFrame(() => {
        updateFrame = 0;
        if (measureNeeded) {
          measureNeeded = false;
          measureAmbient();
        }
        const selected = selectVisibleChapter();
        activateChapter(selected);
      });
    }

    document.addEventListener('click', (event) => {
      if (event.defaultPrevented || (typeof event.button === 'number' && event.button !== 0) ||
          event.ctrlKey || event.metaKey || event.altKey || event.shiftKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const link = target && target.closest('a[href]');
      if (!link || link.hasAttribute('download') ||
          (link.getAttribute('target') && link.getAttribute('target').toLowerCase() !== '_self')) return;
      const id = chapterIdFromUrl(link.getAttribute('href') || '');
      const chapter = id && chapterById.get(id);
      if (!chapter) return;
      event.preventDefault();
      updateHash(chapter);
      chapter.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      requestUpdate();
    });

    window.addEventListener('scroll', () => requestUpdate(), { passive: true });
    window.addEventListener('resize', () => requestUpdate(true), { passive: true });
    window.addEventListener('hashchange', () => requestUpdate());
    window.addEventListener('popstate', () => requestUpdate());
    window.addEventListener('load', () => requestUpdate(true), { once: true });

    if (typeof window.ResizeObserver === 'function') {
      const observer = new window.ResizeObserver(() => requestUpdate(true));
      const sections = new Set(ambientNodes.map((ambient) => ambient.closest('section')).filter(Boolean));
      sections.forEach((section) => observer.observe(section));
    }
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => requestUpdate(true)).catch(() => {});
    }

    function updateVisibility() {
      document.documentElement.classList.toggle('motion-inactive', document.hidden);
      if (!document.hidden) {
        if (activeChapter && !activeChapter.classList.contains('chapter-entering')) replayEntrance(activeChapter);
        requestUpdate(true);
      }
    }
    document.addEventListener('visibilitychange', updateVisibility);
    if (motionQuery) {
      const onMotionChange = () => {
        chapters.forEach(cancelEntrance);
        if (!reducedMotion() && activeChapter) replayEntrance(activeChapter);
        requestUpdate(true);
      };
      if (typeof motionQuery.addEventListener === 'function') motionQuery.addEventListener('change', onMotionChange);
      else if (typeof motionQuery.addListener === 'function') motionQuery.addListener(onMotionChange);
    }

    updateVisibility();
    requestUpdate(true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
