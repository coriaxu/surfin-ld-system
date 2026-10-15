/* 「明账」交互层：侧栏「记一笔」、手机底栏。
 * 所有录入仍走原来的抽屉与保存逻辑，这里只提供入口。 */
(() => {
  const icon = p => `<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
  const plus = icon('<path d="M12 5v14M5 12h14"/>');
  const isReader = () => document.body.dataset.role === 'reader';

  /* ---------- 记一笔 ---------- */
  const TYPES = [
    ['session', '培训场次', '一场培训、辅导或分享', () => window.LDNew?.sessionForm?.()],
    ['station', 'AI 广播站', '新一期，回收数据可稍后补', () => window.newStationEpisode?.()],
    ['share', 'AI 分享月', '新一场分享', () => window.newShareEpisode?.()],
    ['finance', '金融小百科', '新一期', () => window.newFinanceEpisode?.()],
    ['expense', '开销', '按归属月份记一笔支出', () => window.LDNew?.expenseForm?.()],
  ];
  // 触发按钮在侧栏；菜单挂在 body 上，手机侧栏是位移出去的，菜单放在里面会跟着跑。
  const trigger = document.createElement('button');
  trigger.type = 'button'; trigger.className = 'quick-add-trigger';
  trigger.setAttribute('aria-haspopup', 'menu'); trigger.setAttribute('aria-expanded', 'false');
  trigger.innerHTML = `${plus}<span>记一笔</span><kbd aria-hidden="true">N</kbd>`;
  document.querySelector('.sidebar-header')?.after(trigger);
  const menu = document.createElement('div');
  menu.className = 'quick-add-menu'; menu.hidden = true; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', '记一笔');
  menu.innerHTML = `<p class="quick-add-title">记一笔</p>${TYPES.map(([id, name, hint]) =>
    `<button type="button" role="menuitem" data-quick="${id}"><strong>${name}</strong><small>${hint}</small></button>`).join('')}`;
  const sheetScrim = Object.assign(document.createElement('div'), {className: 'quick-add-scrim', hidden: true});
  document.body.append(sheetScrim, menu);
  let returnFocus = null;
  function openQuick(from) {
    returnFocus = from || document.activeElement;
    const phone = matchMedia('(max-width:640px)').matches;
    menu.classList.toggle('is-sheet', phone); sheetScrim.hidden = !phone;
    menu.hidden = false; trigger.setAttribute('aria-expanded', 'true');
    if (!phone) {
      const r = trigger.getBoundingClientRect();
      menu.style.left = Math.max(8, r.left) + 'px';
      menu.style.top = Math.min(r.bottom + 6, innerHeight - menu.offsetHeight - 8) + 'px';
      menu.style.width = Math.max(r.width, 248) + 'px';
    } else { menu.style.left = menu.style.top = menu.style.width = ''; }
    menu.querySelector('[data-quick]').focus();
  }
  function closeQuick(restore = true) {
    if (menu.hidden) return;
    menu.hidden = true; sheetScrim.hidden = true; trigger.setAttribute('aria-expanded', 'false');
    if (restore && returnFocus?.isConnected) returnFocus.focus();
  }
  trigger.addEventListener('click', e => { e.stopPropagation(); menu.hidden ? openQuick(trigger) : closeQuick(); });
  sheetScrim.addEventListener('click', () => closeQuick());
  menu.addEventListener('click', e => {
    const b = e.target.closest('[data-quick]');
    if (!b) return;
    closeQuick(false);
    document.querySelector('#sidebar')?.classList.remove('open');
    document.querySelector('.sidebar-scrim')?.classList.remove('visible');
    TYPES.find(t => t[0] === b.dataset.quick)?.[3]();
  });
  document.addEventListener('click', e => { if (!menu.hidden && !e.target.closest('.quick-add-menu,.quick-add-trigger,.bottom-add')) closeQuick(false); });
  window.addEventListener('resize', () => closeQuick(false));
  document.addEventListener('keydown', e => {
    if (!menu.hidden && e.key === 'Escape') { e.preventDefault(); closeQuick(); return; }
    if (!menu.hidden && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      const items = [...menu.querySelectorAll('[data-quick]')], i = items.indexOf(document.activeElement);
      e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length].focus(); return;
    }
    const typing = e.target.closest?.('input,textarea,select,[contenteditable="true"]') || document.querySelector('dialog[open], .modal-overlay.active');
    if (e.key.toLowerCase() === 'n' && !e.metaKey && !e.ctrlKey && !e.altKey && !typing && !isReader() && menu.hidden) {
      e.preventDefault(); openQuick(document.activeElement);
    }
  });

  /* ---------- 手机底栏 ---------- */
  const groups = [['overview', '总览'], ['records', '台账'], [null, '记一笔'], ['projects', '项目'], ['reports', '汇报']];
  const bar = document.createElement('nav');
  bar.className = 'bottom-bar'; bar.setAttribute('aria-label', '主导航（手机）');
  bar.innerHTML = groups.map(([g, label]) => {
    if (!g) return `<button type="button" class="bottom-add" aria-label="记一笔">${plus}</button>`;
    const svg = document.querySelector(`.primary-nav[data-group="${g}"] svg`)?.outerHTML || '';
    return `<button type="button" data-bottom="${g}">${svg}<span>${label}</span></button>`;
  }).join('');
  document.body.append(bar);
  bar.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.classList.contains('bottom-add')) { openQuick(b); return; }
    document.querySelector(`.primary-nav[data-group="${b.dataset.bottom}"]`)?.click();
  });
  const syncBar = () => {
    const active = document.querySelector('.primary-nav.active')?.dataset.group;
    bar.querySelectorAll('[data-bottom]').forEach(b => b.setAttribute('aria-current', b.dataset.bottom === active ? 'page' : 'false'));
  };
  new MutationObserver(syncBar).observe(document.querySelector('.primary-navigation') || document.body, {subtree: true, attributes: true, attributeFilter: ['class']});
  syncBar();
})();
