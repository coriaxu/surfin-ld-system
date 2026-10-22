/* 明账 2.0 动效：侧栏选中块与模块标签下划线跟随切换滑动。
 * 只移动一个装饰层，导航本身的选中状态与点击逻辑不变；减少动态效果时直接到位。 */
(() => {
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  // 在容器里放一个指示层，跟随 selector 选中的元素移动
  function follow(container, selector, className, measure) {
    if (!container) return;
    const ind = document.createElement('span');
    ind.className = className; ind.setAttribute('aria-hidden', 'true');
    let shown = false;
    function place() {
      if (!ind.isConnected) container.prepend(ind);
      const el = container.querySelector(selector);
      if (!el || !el.offsetParent) { ind.style.opacity = '0'; shown = false; return; }
      const box = measure(el, container);
      ind.classList.toggle('no-anim', !shown || calm());
      Object.assign(ind.style, { opacity: '1', transform: `translate(${box.x}px,${box.y}px)`, width: box.w + 'px', height: box.h + 'px' });
      shown = true;
    }
    new MutationObserver(ms => { if (ms.some(m => m.target !== ind)) requestAnimationFrame(place); }).observe(container, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    addEventListener('resize', place);
    container.classList.add('has-indicator');
    place();
    return place;
  }

  const rel = (el, box) => { const a = el.getBoundingClientRect(), b = box.getBoundingClientRect(); return { x: a.left - b.left + box.scrollLeft, y: a.top - b.top + box.scrollTop, w: a.width, h: a.height }; };
  follow(document.querySelector('.primary-navigation'), '.primary-nav.active', 'mz-nav-pill', rel);
  follow(document.querySelector('.module-tabs'), '.module-tab.active', 'mz-tab-ink', (el, box) => { const r = rel(el, box); return { x: r.x, y: r.y + r.h - 2, w: r.w, h: 2 }; });
})();
