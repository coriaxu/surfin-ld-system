/* 外观：浅色／深色／跟随系统 × 三个主色。在 <head> 里同步执行，首屏绘制前就设好 html 属性，避免闪烁。
 * 令牌见 assets/tokens.css（由 tools/tokens.py 生成）。偏好只存在本浏览器，不进云端数据。 */
(() => {
  const MODES = [['light', '浅色'], ['dark', '深色'], ['auto', '跟随系统']];
  // 明账 2.0：三个明亮主色。旧版鼠尾草、山梗紫、淡咖啡的偏好读不到就回落晴空蓝。
  const ACCENTS = [['blue', '晴空蓝', '#006EDC'], ['lagoon', '湖光青', '#007AA1'], ['iris', '鸢尾紫', '#5C5BE2']];
  const root = document.documentElement;
  const read = (key, allowed, fallback) => {
    try { const v = localStorage.getItem(key); return allowed.some(([id]) => id === v) ? v : fallback; } catch (_) { return fallback; }
  };
  const write = (key, value) => { try { localStorage.setItem(key, value); } catch (_) {} };
  // 旧版五套主题的偏好不再适用，读到就清掉。
  try { localStorage.removeItem('surfin_theme'); } catch (_) {}

  let mode = read('ld_mode', MODES, 'light'), accent = read('ld_accent', ACCENTS, 'blue');
  const media = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  const isDark = () => mode === 'dark' || (mode === 'auto' && !!media?.matches);
  function apply() {
    root.dataset.mode = mode; root.dataset.accent = accent;
    root.classList.toggle('is-dark', isDark());
  }
  apply();

  let rerender;
  function changed(message) {
    apply(); sync();
    // 图表在绘制时读取 CSS 变量，换色后重画一次。
    clearTimeout(rerender);
    rerender = setTimeout(() => { if (typeof window.renderAll === 'function') window.renderAll(); }, 60);
    if (message && typeof window.showToast === 'function') window.showToast(message, 'info');
  }
  media?.addEventListener?.('change', () => { if (mode === 'auto') changed(); });

  function group(label, items, current, attr) {
    return `<div class="appearance-group" role="group" aria-label="${label}"><span class="tools-panel-caption">${label}</span><div class="appearance-options">${
      items.map(([id, name, swatch]) => `<button type="button" class="appearance-option" data-${attr}="${id}" aria-pressed="${id === current}">${
        swatch ? `<span class="appearance-swatch" style="background:${swatch}" aria-hidden="true"></span>` : ''}${name}</button>`).join('')
    }</div></div>`;
  }
  function sync() {
    document.querySelectorAll('.appearance-option').forEach(b => {
      const on = b.dataset.mode ? b.dataset.mode === mode : b.dataset.accent === accent;
      b.setAttribute('aria-pressed', String(on));
    });
  }
  function build() {
    const panel = document.getElementById('appearancePanel');
    if (!panel) return;
    panel.innerHTML = group('外观', MODES, mode, 'mode') + group('主色', ACCENTS, accent, 'accent');
    panel.addEventListener('click', e => {
      const b = e.target.closest('.appearance-option');
      if (!b) return;
      // 留在菜单里，方便连续比较几种组合。
      e.stopPropagation();
      if (b.dataset.mode) { mode = b.dataset.mode; write('ld_mode', mode); changed(); }
      else { accent = b.dataset.accent; write('ld_accent', accent); changed(); }
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', build); else build();

  window.LDAppearance = { get mode() { return mode; }, get accent() { return accent; }, isDark };
})();
