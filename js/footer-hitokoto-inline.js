(() => {
  const init = () => {
    const quote = document.querySelector('.footer-hitokoto');
    if (!quote || quote.dataset.loaded) return;
    quote.dataset.loaded = 'true';

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    fetch('https://hi.logacg.com/', {
      signal: controller.signal,
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store'
    })
      .then(response => response.ok ? response.json() : Promise.reject(new Error('Request failed')))
      .then(data => {
        if (typeof data.hitokoto !== 'string' || !data.hitokoto.trim()) return;
        const author = typeof data.from_who === 'string' ? data.from_who : '';
        const source = typeof data.from === 'string' && data.from ? `《${data.from}》` : '';
        quote.textContent = `${data.hitokoto}${author || source ? `——${author}${source}` : ''}`;
      })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  document.addEventListener('pjax:complete', init);
})();