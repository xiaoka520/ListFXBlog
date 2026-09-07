(() => {
  const init = () => {
    const hero = document.querySelector('#page-header.full_page');
    if (!hero || hero.dataset.heroParallax) return;
    hero.dataset.heroParallax = 'true';

    const image = document.createElement('div');
    image.className = 'hero-parallax__image';
    image.setAttribute('aria-hidden', 'true');
    const background = getComputedStyle(hero).backgroundImage;
    image.style.backgroundImage = background;
    hero.prepend(image);
    hero.classList.add('hero-parallax');

    const imageUrl = background.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    if (imageUrl) {
      hero.classList.add('hero-parallax--loading');
      const preload = new Image();
      preload.onload = () => {
        if (preload.decode) {
          preload.decode().catch(() => {}).finally(() => hero.classList.remove('hero-parallax--loading'));
        } else {
          hero.classList.remove('hero-parallax--loading');
        }
      };
      preload.onerror = () => hero.classList.remove('hero-parallax--loading');
      preload.src = imageUrl;
    }

    const motion = matchMedia('(prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine) and (min-width: 769px)');
    hero.addEventListener('mousemove', event => {
      if (!motion.matches) return;
      const rect = hero.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width - 0.5;
      const y = (event.clientY - rect.top) / rect.height - 0.5;
      hero.style.setProperty('--hero-x', `${x * -14}px`);
      hero.style.setProperty('--hero-y', `${y * -10}px`);
    });
    hero.addEventListener('mouseleave', () => {
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