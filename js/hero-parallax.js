(() => {
  const init = () => {
    const hero = document.querySelector('#page-header.full_page');
    if (!hero || hero.dataset.heroParallax) return;
    hero.dataset.heroParallax = 'true';

    const image = document.createElement('div');
    image.className = 'hero-parallax__image';
    image.setAttribute('aria-hidden', 'true');
    image.style.backgroundImage = getComputedStyle(hero).backgroundImage;
    hero.prepend(image);
    hero.classList.add('hero-parallax');

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