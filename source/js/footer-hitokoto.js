(() => {
  const init = () => {
    const root = document.getElementById('footer-hitokoto');
    if (!root || root.dataset.initialized) return;
    root.dataset.initialized = 'true';
    const button = root.querySelector('.hitokoto-refresh');
    const status = root.querySelector('.hitokoto-status');
    let lastRequest = 0;

    const refresh = async () => {
      if (button.disabled || Date.now() - lastRequest < 1000) return;
      lastRequest = Date.now();
      button.disabled = true;
      status.textContent = '加载中…';
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      try {
        const response = await fetch('https://hi.logacg.com/', {
          signal: controller.signal,
          credentials: 'omit',
          referrerPolicy: 'no-referrer',
          cache: 'no-store'
        });
        if (!response.ok) throw new Error('Request failed');
        const data = await response.json();
        if (typeof data.hitokoto !== 'string' || !data.hitokoto.trim()) {
          throw new Error('Invalid quote');
        }
        if (!root.isConnected) return;
        root.querySelector('.hitokoto-text').textContent = data.hitokoto;
        const author = typeof data.from_who === 'string' ? data.from_who : '';
        const source = typeof data.from === 'string' && data.from ? `《${data.from}》` : '';
        root.querySelector('.hitokoto-source').textContent = author || source ? `—— ${author}${source}` : '';
        status.textContent = '';
      } catch {
        status.textContent = '暂时无法获取新一言，请稍后重试。';
      } finally {
        clearTimeout(timer);
        button.disabled = false;
      }
    };
    button.addEventListener('click', refresh);
    refresh();
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
  document.addEventListener('pjax:complete', init);
})();