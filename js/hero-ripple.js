/* Click ripple for the homepage hero.
   Ported from the water-ripple effect used by kiseki.blog (Myriad): every
   click refracts the hero background image inside an expanding ring, then the
   canvas fades back out and the untouched image shows through again.
   If the image host does not allow reading pixels back (CORS), it degrades to
   plain expanding rings instead of disappearing silently. */
(() => {
  const MAX_RIPPLES = 3;
  const LIFETIME = 2;      // s, how long a ripple lives
  const SPEED = 400;       // px/s, ring radius growth
  const RING = 160;        // px, half width of the refracted ring
  const WAVELENGTH = 80;   // px, spatial wavelength of the ripple
  const PHASE_SPEED = 10;  // temporal phase speed
  const DISPLACEMENT = 15; // px, peak refraction offset
  const FRAME = 33;        // ms, ~30fps is plenty for water
  const SKIP = 'a, button, input, select, textarea, label, [role="button"], [data-no-ripple]';

  let hero = null;
  let canvas = null;
  let ctx = null;
  let source = null;
  let target = null;
  let ringsOnly = false;
  let ripples = [];
  let raf = null;
  let lastFrame = 0;
  let fadeTimer = null;

  const quality = () =>
    window.matchMedia('(hover: none), (pointer: coarse)').matches ? 0.5 : 0.7;

  /* Size the bitmap to the layout box, so the CSS transform that aligns the
     canvas with the hero image never affects our pixel maths. */
  const measure = () => {
    const width = Math.max(1, Math.round(canvas.offsetWidth * quality()));
    const height = Math.max(1, Math.round(canvas.offsetHeight * quality()));
    if (canvas.width === width && canvas.height === height) return false;
    canvas.width = width;
    canvas.height = height;
    source = null;
    target = null;
    ripples = [];
    return true;
  };

  const onResize = () => {
    if (!measure()) return;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = null;
    }
    canvas.style.transition = 'opacity .3s ease-out';
    canvas.style.opacity = '0';
  };

  const loadSource = () => new Promise(resolve => {
    const layer = hero.querySelector('.hero-parallax__image') || hero;
    const background = getComputedStyle(layer).backgroundImage;
    const match = background && background.match(/url\(["']?([^"')]+)["']?\)/);
    if (!match) return resolve(false);

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      const w = canvas.width;
      const h = canvas.height;
      const ratio = image.width / image.height;
      let dw = w;
      let dh = w / ratio;
      if (dh < h) {
        dh = h;
        dw = h * ratio;
      }
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
      try {
        source = ctx.getImageData(0, 0, w, h);
        target = ctx.createImageData(w, h);
        resolve(true);
      } catch (_error) {
        resolve(false); // image host blocked pixel readback
      }
    };
    image.onerror = () => resolve(false);
    image.src = match[1];
  });

  /* Refract the image: every pixel inside the ring is displaced along the
     ring normal by a damped, oscillating Gaussian.
     The Gaussian and the wave only depend on the distance from the click, so
     they are precomputed into a lookup table indexed by that distance. That
     replaces two transcendental calls per pixel with one array read, which is
     what keeps this at a smooth frame rate on a full-screen image. */
  const refract = now => {
    if (!source || !target) return;
    const w = canvas.width;
    const h = canvas.height;
    const q = w / canvas.offsetWidth;
    const src = new Uint32Array(source.data.buffer);
    const out = new Uint32Array(target.data.buffer);
    out.set(src);

    const sigma2 = WAVELENGTH * q * (WAVELENGTH * q);
    const peak = DISPLACEMENT * q;
    const k = 2 * Math.PI / WAVELENGTH / q;

    const active = [];
    let x0 = w;
    let x1 = -1;
    let y0 = h;
    let y1 = -1;

    for (const ripple of ripples) {
      const t = (now - ripple.start) / 1000;
      const travelled = SPEED * t;
      const inner = Math.max(0, (travelled - RING) * q);
      const outer = (travelled + RING) * q;
      const radius = travelled * q;
      const envelope = 1 - (t / LIFETIME) * (t / LIFETIME);
      const reach = Math.min(1024, Math.ceil(outer) + 1);
      const lut = new Float32Array(reach + 1);
      for (let i = 0; i <= reach; i++) {
        const diff = i - radius;
        lut[i] = peak * Math.exp(-diff * diff / sigma2) * envelope *
          Math.sin(i * k - PHASE_SPEED * t);
      }

      const item = {
        x: ripple.x * q,
        y: ripple.y * q,
        inner2: inner * inner,
        outer2: outer * outer,
        lut,
        reach,
      };
      active.push(item);
      x0 = Math.min(x0, Math.max(0, Math.floor(item.x - outer)));
      x1 = Math.max(x1, Math.min(w - 1, Math.ceil(item.x + outer)));
      y0 = Math.min(y0, Math.max(0, Math.floor(item.y - outer)));
      y1 = Math.max(y1, Math.min(h - 1, Math.ceil(item.y + outer)));
    }

    if (x1 >= x0 && y1 >= y0) {
      for (let y = y0; y <= y1; y++) {
        const row = y * w;
        for (let x = x0; x <= x1; x++) {
          let ox = 0;
          let oy = 0;
          for (let i = 0; i < active.length; i++) {
            const r = active[i];
            const dx = x - r.x;
            const dy = y - r.y;
            const d2 = dx * dx + dy * dy;
            if (d2 > r.outer2 || d2 < r.inner2) continue;
            const d = Math.sqrt(d2);
            if (d < 0.1) continue;
            const index = d < r.reach ? d | 0 : r.reach;
            const amount = r.lut[index] / d;
            ox += dx * amount;
            oy += dy * amount;
          }
          if (ox === 0 && oy === 0) continue;
          const sx = (x - ox + 0.5) | 0;
          const sy = (y - oy + 0.5) | 0;
          if (sx >= 0 && sx < w && sy >= 0 && sy < h) out[row + x] = src[sy * w + sx];
        }
      }
    }

    ctx.putImageData(target, 0, 0);
  };

  /* Fallback when pixels cannot be read: expanding rings of light. */
  const rings = now => {
    const w = canvas.width;
    const h = canvas.height;
    const q = w / canvas.offsetWidth;
    ctx.clearRect(0, 0, w, h);
    for (const ripple of ripples) {
      const t = (now - ripple.start) / 1000;
      const envelope = 1 - (t / LIFETIME) * (t / LIFETIME);
      ctx.beginPath();
      ctx.arc(ripple.x * q, ripple.y * q, SPEED * t * q, 0, Math.PI * 2);
      ctx.lineWidth = (RING / 2) * q * envelope;
      ctx.strokeStyle = `rgba(255, 255, 255, ${(0.28 * envelope).toFixed(3)})`;
      ctx.stroke();
    }
  };

  const frame = now => {
    raf = null;
    if (document.hidden) {
      raf = requestAnimationFrame(frame);
      return;
    }
    if (now - lastFrame < FRAME) {
      raf = requestAnimationFrame(frame);
      return;
    }
    lastFrame = now;
    ripples = ripples.filter(ripple => (now - ripple.start) / 1000 <= LIFETIME);

    if (ringsOnly) rings(now);
    else refract(now);

    if (ripples.length) {
      raf = requestAnimationFrame(frame);
      return;
    }
    canvas.style.transition = 'opacity .75s ease-out';
    canvas.style.opacity = '0';
    fadeTimer = setTimeout(() => {
      fadeTimer = null;
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }, 800);
  };

  const onClick = async event => {
    if (event.button !== 0) return;
    if (event.target && event.target.closest(SKIP)) return;

    measure();
    if (!source && !ringsOnly && !(await loadSource())) ringsOnly = true;

    if (fadeTimer) {
      clearTimeout(fadeTimer);
      fadeTimer = null;
    }
    if (ripples.length >= MAX_RIPPLES) ripples.shift();

    // rect is affected by the hero transform, offsetWidth/Height are not,
    // so this ratio maps the click onto the bitmap in both cases.
    const rect = canvas.getBoundingClientRect();
    ripples.push({
      x: (event.clientX - rect.left) / rect.width * canvas.offsetWidth,
      y: (event.clientY - rect.top) / rect.height * canvas.offsetHeight,
      start: performance.now(),
    });

    canvas.style.transition = 'opacity .15s ease-out';
    canvas.style.opacity = '1';
    if (!raf) {
      lastFrame = 0;
      raf = requestAnimationFrame(frame);
    }
  };

  const init = () => {
    const el = document.querySelector('#page-header.full_page');
    if (!el || el.dataset.heroRipple) return;
    if (!window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return;
    if (!el.classList.contains('hero-parallax')) return;
    el.dataset.heroRipple = 'true';

    hero = el;
    canvas = document.createElement('canvas');
    canvas.className = 'hero-ripple';
    canvas.setAttribute('aria-hidden', 'true');
    const layer = hero.querySelector('.hero-parallax__image');
    if (layer) layer.after(canvas);
    else hero.prepend(canvas);

    ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    measure();
    hero.addEventListener('click', onClick, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  document.addEventListener('pjax:complete', init);
})();
