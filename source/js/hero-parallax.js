(() => {
  const init = () => {
    const hero = document.querySelector('#page-header.full_page');
    if (!hero || hero.dataset.heroParallax) return;
    hero.dataset.heroParallax = 'true';
    // Drop any blob from a previous page so the ripple can never draw it while
    // this hero is still loading. undefined means "not ready yet".
    window.__listfxHeroImage = undefined;

    const image = document.createElement('div');
    image.className = 'hero-parallax__image';
    image.setAttribute('aria-hidden', 'true');
    hero.prepend(image);
    hero.classList.add('hero-parallax');

    // custom.css blanks the header background while JS is available, so the
    // browser never fetches it and the single request below is the only one.
    const inline = hero.style.backgroundImage || getComputedStyle(hero).backgroundImage;
    const imageUrl = inline.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    if (!imageUrl) {
      window.__listfxHeroImage = '';
      document.dispatchEvent(new Event('hero-image-ready'));
    } else {
      hero.classList.add('hero-parallax--loading');
      // The hero image comes from a random photo endpoint: every request hands
      // back a different photo. Load it once here and let both the background
      // and the click ripple read that one response, otherwise the ripple would
      // paint an unrelated photo over the hero and look like the wallpaper
      // switched.
      fetch(imageUrl, { mode: 'cors', credentials: 'omit' })
        .then(response => (response.ok ? response.blob() : Promise.reject(new Error(`http ${response.status}`))))
        .then(blob => {
          if (!blob.type.startsWith('image/')) throw new Error('not an image');
          const objectUrl = URL.createObjectURL(blob);
          image.style.backgroundImage = `url("${objectUrl}")`;
          window.__listfxHeroImage = objectUrl;
        })
        .catch(() => {
          // Could not read the pixels: hand the job back to the browser so the
          // hero still gets a photo. The ripple then falls back to plain rings.
          image.style.backgroundImage = `url("${imageUrl}")`;
          window.__listfxHeroImage = '';
        })
        .finally(() => {
          hero.classList.remove('hero-parallax--loading');
          document.dispatchEvent(new Event('hero-image-ready'));
        });
    }

    // Read the pointer in the event but write in the next frame, so a burst of
    // mousemove events cannot each force a style/layout recalculation.
    const motion = matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine) and (min-width: 769px)');
    let pointer = null;
    let pending = 0;
    const flush = () => {
      pending = 0;
      if (!pointer) return;
      hero.style.setProperty('--hero-x', `${pointer.x * -14}px`);
      hero.style.setProperty('--hero-y', `${pointer.y * -10}px`);
    };
    hero.addEventListener('mousemove', event => {
      if (!motion.matches) return;
      const rect = hero.getBoundingClientRect();
      pointer = {
        x: (event.clientX - rect.left) / rect.width - 0.5,
        y: (event.clientY - rect.top) / rect.height - 0.5,
      };
      if (!pending) pending = requestAnimationFrame(flush);
    }, { passive: true });
    hero.addEventListener('mouseleave', () => {
      pointer = null;
      if (pending) {
        cancelAnimationFrame(pending);
        pending = 0;
      }
      hero.style.setProperty('--hero-x', '0px');
      hero.style.setProperty('--hero-y', '0px');
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  document.addEventListener('pjax:complete', init);
})();