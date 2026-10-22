/* 明账 2.0 月份选择：替换浏览器自带的 month 控件外观（空值显示「--------- ----」、跟系统语言显示英文月份）。
 * 原 input 留在原处只是看不见，value、change 事件和表单校验都不变，旧代码无需改动。 */
(() => {
  const fmt = v => /^\d{4}-\d{2}$/.test(v || '') ? `${v.slice(0, 4)} 年 ${Number(v.slice(5))} 月` : '';
  const proto = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  let open = null;

  function enhance(input) {
    if (input.dataset.mzMonth) return;
    input.dataset.mzMonth = '1';
    const wrap = document.createElement('span');
    wrap.className = 'mz-month';
    input.before(wrap); wrap.append(input);
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'mz-month-btn';
    btn.setAttribute('aria-haspopup', 'dialog');
    const label = input.getAttribute('aria-label') || input.closest('label')?.firstChild?.textContent?.trim() || '月份';
    btn.setAttribute('aria-label', `${label}：选择月份`);
    btn.innerHTML = '<span class="mz-month-text"></span><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>';
    wrap.append(btn);
    const text = btn.firstChild;
    const placeholder = () => input.placeholder || (input.dataset.filter ? '全部月份' : '选择月份');
    const sync = () => { const v = proto.get.call(input); text.textContent = fmt(v) || placeholder(); btn.classList.toggle('is-empty', !v); btn.disabled = input.disabled; };
    // 代码里直接赋值 input.value 时同步显示
    Object.defineProperty(input, 'value', { configurable: true, get() { return proto.get.call(this); }, set(v) { proto.set.call(this, v); sync(); } });
    input.addEventListener('input', sync); input.addEventListener('change', sync);
    input.form?.addEventListener('reset', () => setTimeout(sync));
    input.tabIndex = -1; input.setAttribute('aria-hidden', 'true');
    btn.addEventListener('click', () => toggle(input, btn));
    sync();
  }

  function close(restore = true) {
    if (!open) return;
    const { panel, btn } = open; open = null;
    panel.remove(); btn.setAttribute('aria-expanded', 'false');
    if (restore) btn.focus();
  }

  function toggle(input, btn) {
    if (open?.input === input) return close();
    close(false);
    const v = proto.get.call(input) || new Date().toISOString().slice(0, 7);
    let year = Number(v.slice(0, 4));
    const panel = document.createElement('div');
    panel.className = 'mz-month-panel'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', '选择月份');
    const render = () => {
      const cur = proto.get.call(input), min = input.min || '', max = input.max || '';
      panel.innerHTML = `<div class="mz-month-head"><button type="button" data-step="-1" aria-label="上一年">‹</button><strong>${year} 年</strong><button type="button" data-step="1" aria-label="下一年">›</button></div>
        <div class="mz-month-grid">${Array.from({ length: 12 }, (_, i) => {
          const m = `${year}-${String(i + 1).padStart(2, '0')}`, off = (min && m < min) || (max && m > max);
          return `<button type="button" data-m="${m}" ${off ? 'disabled' : ''} aria-pressed="${m === cur}">${i + 1} 月</button>`; }).join('')}</div>
        <div class="mz-month-foot">${input.dataset.filter || (input.form && !input.required) ? '<button type="button" data-clear>清除</button>' : ''}<button type="button" data-now>本月</button></div>`;
    };
    render();
    panel.addEventListener('click', e => {
      const b = e.target.closest('button'); if (!b || b.disabled) return;
      if (b.dataset.step) { year += Number(b.dataset.step); render(); panel.querySelector('[data-step="' + b.dataset.step + '"]').focus(); return; }
      let next = b.dataset.m;
      if (b.hasAttribute('data-now')) { const n = new Date(); next = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`; if (input.max && next > input.max) next = input.max; }
      if (b.hasAttribute('data-clear')) next = '';
      if (next === undefined) return;
      proto.set.call(input, next);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.value = proto.get.call(input);
      close();
    });
    panel.addEventListener('keydown', e => {
      if (e.key === 'Escape') { e.stopPropagation(); close(); }
      const cells = [...panel.querySelectorAll('[data-m]:not(:disabled)')], i = cells.indexOf(document.activeElement);
      const d = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -3, ArrowDown: 3 }[e.key];
      if (d && i >= 0) { e.preventDefault(); cells[Math.max(0, Math.min(cells.length - 1, i + d))]?.focus(); }
    });
    document.body.append(panel);
    const r = btn.getBoundingClientRect(), w = panel.offsetWidth, h = panel.offsetHeight;
    panel.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + 'px';
    panel.style.top = (r.bottom + 6 + h > innerHeight && r.top - 6 - h > 0 ? r.top - 6 - h : r.bottom + 6) + 'px';
    btn.setAttribute('aria-expanded', 'true');
    open = { input, btn, panel };
    (panel.querySelector('[aria-pressed="true"]') || panel.querySelector('[data-m]:not(:disabled)'))?.focus();
  }

  document.addEventListener('pointerdown', e => { if (open && !open.panel.contains(e.target) && !open.btn.contains(e.target)) close(false); });
  addEventListener('resize', () => close(false)); addEventListener('scroll', e => { if (open && !open.panel.contains(e.target)) close(false); }, true);
  const scan = root => root.querySelectorAll?.('input[type="month"]').forEach(enhance);
  scan(document);
  new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(n => { if (n.nodeType === 1) { if (n.matches('input[type="month"]')) enhance(n); else scan(n); } })))
    .observe(document.body, { childList: true, subtree: true });
})();
