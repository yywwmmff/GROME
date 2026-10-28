(() => {
  const themes = ['azure', 'sage', 'violet', 'coral'];
  const root = document.documentElement;
  const defaultTheme = themes.includes(root.dataset.defaultTheme) ? root.dataset.defaultTheme : 'original';
  const requestedTheme = new URLSearchParams(location.search).get('theme');
  const theme = themes.includes(requestedTheme) || requestedTheme === 'original' ? requestedTheme : defaultTheme;
  if (themes.includes(theme)) {
    root.dataset.theme = theme;
  } else delete root.dataset.theme;
  document.addEventListener('DOMContentLoaded', () => {
    const picker = document.getElementById('theme-picker');
    if (!picker) return;
    const sync = () => {
      picker.value = themes.includes(root.dataset.theme) ? root.dataset.theme : 'original';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', getComputedStyle(root).getPropertyValue('--bg').trim());
    };
    picker.addEventListener('change', () => {
      if (themes.includes(picker.value)) root.dataset.theme = picker.value;
      else delete root.dataset.theme;
      const url = new URL(location.href);
      if (picker.value === defaultTheme) url.searchParams.delete('theme');
      else url.searchParams.set('theme', picker.value);
      history.replaceState(null, '', url);
      sync();
      window.dispatchEvent(new CustomEvent('grome-theme-change', { detail: picker.value }));
    });
    new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    sync();
  });
})();
