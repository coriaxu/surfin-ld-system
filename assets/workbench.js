/* Presentation-only enhancements; existing actions retain their original handlers. */
(() => {
  document.querySelectorAll('.form-group').forEach(group => {
    const label = group.querySelector('label'), input = group.querySelector('input[id],select[id],textarea[id]');
    if (label && input && !label.htmlFor) label.htmlFor = input.id;
  });
  const symbolPaths = {
    '⭐':'<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z"/>',
    '🎯':'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    '💬':'<path d="M21 11a8 8 0 0 1-8 8H8l-5 3V7a4 4 0 0 1 4-4h6a8 8 0 0 1 8 8Z"/><path d="M7 9h10M7 13h7"/>',
    '🧱':'<path d="M3 4h18v16H3zM3 12h18M12 4v8M8 12v8M16 12v8"/>',
    '👔':'<path d="M8 3h8v5l5 3v10H3V11l5-3zM8 3l4 5 4-5M12 8v13"/>',
    '📋':'<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="4" rx="1"/><path d="M9 11h6M9 15h6"/>',
    '🗺️':'<path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zM9 3v16M15 5v16"/>'
  };
  document.querySelectorAll('.case-card-icon,.case-section-icon').forEach(el => {
    const path = symbolPaths[el.textContent.trim()];
    if (path && !el.querySelector('img')) el.innerHTML = `<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;
  });
  document.querySelectorAll('.budget-tab').forEach(tab => {
    tab.textContent = tab.textContent.replace(/^[📊💳📈\s]+/u, '').trim();
  });
  const sidebar = document.getElementById('sidebar');
  const scrim = document.createElement('button');
  scrim.className = 'sidebar-scrim';
  scrim.setAttribute('aria-label', '关闭导航');
  document.body.append(scrim);
  const closeSidebar = () => {
    sidebar.classList.remove('open'); scrim.classList.remove('visible');
    document.getElementById('sidebarOpen').setAttribute('aria-expanded', 'false');
  };
  scrim.addEventListener('click', closeSidebar);
  document.getElementById('sidebarOpen').addEventListener('click', () => {
    if (matchMedia('(max-width:1024px)').matches) {
      sidebar.classList.add('open'); scrim.classList.add('visible');
      document.getElementById('sidebarOpen').setAttribute('aria-expanded', 'true');
    }
  });
  document.getElementById('sidebarToggle').addEventListener('click', closeSidebar);
  document.querySelectorAll('.nav-item').forEach((item, index) => {
    item.setAttribute('role', 'button'); item.tabIndex = 0;
    item.setAttribute('aria-current', item.classList.contains('active') ? 'page' : 'false');
    item.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); item.click(); } });
    item.addEventListener('click', () => {
      document.querySelectorAll('.nav-item').forEach(n => n.setAttribute('aria-current', n === item ? 'page' : 'false'));
      closeSidebar(); window.scrollTo({top:0, behavior:'instant'});
    });
    item.dataset.moduleIcon = index;
  });
  const actions = document.getElementById('topbarActions');
  const tools = document.createElement('details');
  tools.className = 'workbench-tools';
  tools.innerHTML = '<summary class="btn btn-secondary btn-sm" aria-label="打开工具菜单">工具 <span aria-hidden="true">⌄</span></summary><div class="tools-panel"><div class="tools-panel-caption">数据与偏好</div></div>';
  const panel = tools.querySelector('.tools-panel');
  [...actions.children].forEach(el => {
    const action = el.getAttribute('onclick') || '';
    if (!action.includes('openMonthlyReportModal') && !action.includes('exportPdf')) panel.append(el);
    if (action.includes('exportPdf')) { el.classList.remove('btn-primary'); el.classList.add('btn-secondary'); }
  });
  actions.append(tools);
  const defaultTheme = document.querySelector('.theme-option');
  if (defaultTheme) {
    defaultTheme.lastChild.textContent = ' 暖灰工作台';
    defaultTheme.querySelector('.theme-dot').style.background = '#507568';
  }
  document.querySelectorAll('.theme-option').forEach(option => {
    option.setAttribute('role', 'button'); option.tabIndex = 0;
    option.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); option.click(); } });
  });
  const positionMenu = details => {
    const popup = details.querySelector('.tools-panel,.row-more-panel');
    const rect = details.querySelector('summary').getBoundingClientRect();
    const width = popup.offsetWidth;
    popup.style.left = Math.max(8, Math.min(rect.right - width, innerWidth - width - 8)) + 'px';
    popup.style.top = Math.max(8, Math.min(rect.bottom + 6, innerHeight - popup.offsetHeight - 8)) + 'px';
  };
  const wireMenu = details => {
    details.addEventListener('toggle', () => {
      details.querySelector('summary').setAttribute('aria-expanded', String(details.open));
      if (details.open) {
        document.querySelectorAll('.workbench-tools[open],.row-more[open]').forEach(other => { if (other !== details) other.open = false; });
        positionMenu(details);
      }
    });
  };
  wireMenu(tools);
  panel.addEventListener('click', e => { if (e.target.closest('button:not(#themeBtn)')) tools.open = false; });
  const wrapDeleteActions = () => {
    document.querySelectorAll('.actions-row > .btn-delete, #financeForm .form-footer > .btn-delete').forEach(button => {
      const details = document.createElement('details'); details.className = 'row-more';
      details.innerHTML = '<summary class="btn btn-secondary btn-sm" aria-label="更多操作">更多 <span aria-hidden="true">⌄</span></summary><div class="row-more-panel"></div>';
      button.before(details); details.lastElementChild.append(button);
      button.addEventListener('click', () => { details.open = false; }); wireMenu(details);
    });
  };
  wrapDeleteActions();
  new MutationObserver(wrapDeleteActions).observe(document.getElementById('mainContent'), {childList:true,subtree:true});
  const closeMenus = () => document.querySelectorAll('.workbench-tools[open],.row-more[open]').forEach(d => d.open = false);
  document.addEventListener('click', e => { if (!e.target.closest('.workbench-tools,.row-more,.theme-dropdown')) closeMenus(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeSidebar(); closeMenus(); } });
  window.addEventListener('resize', () => { closeMenus(); if (!matchMedia('(max-width:1024px)').matches) closeSidebar(); });
  document.addEventListener('scroll', closeMenus, true);
  // Keep fixed editing surfaces outside animated page containers.
  const financeModal = document.getElementById('financeModal');
  document.body.append(financeModal);
  financeModal.setAttribute('role', 'dialog'); financeModal.setAttribute('aria-modal', 'true');
  financeModal.setAttribute('aria-labelledby', 'finModalTitle');
  financeModal.querySelector('.modal-close').setAttribute('aria-label', '关闭编辑');
  let financeReturnFocus;
  new MutationObserver(() => {
    if (financeModal.classList.contains('active')) {
      financeReturnFocus = document.activeElement;
      financeModal.querySelector('.modal-close').focus();
    } else if (financeReturnFocus?.isConnected) financeReturnFocus.focus();
  }).observe(financeModal, {attributes:true,attributeFilter:['class']});
  financeModal.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); window.closeFinanceModal(); }
    if (e.key === 'Tab') {
      const focusable = [...financeModal.querySelectorAll('button,input,select,textarea,summary')].filter(el => !el.disabled && el.getClientRects().length);
      const first = focusable[0], last = focusable.at(-1);
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  // Move existing forms, preserving listeners, validation and save behavior.
  const formDrawers = [
    ['sessionForm', '培训记录', 'editSession', 'resetSessionForm'],
    ['budgetForm', '预算计划', 'editBudget', 'resetBudgetForm'],
    ['expenseForm', '开销记录', 'editExpense', 'resetExpenseForm']
  ];
  formDrawers.forEach(([id, label, editName, resetName]) => {
    const form = document.getElementById(id);
    const toolbar = document.createElement('div'); toolbar.className = 'record-toolbar';
    const add = document.createElement('button'); add.className = 'btn btn-primary';
    add.type = 'button'; add.textContent = '＋ 新增' + label;
    toolbar.append(add); form.before(toolbar);
    const drawer = document.createElement('dialog'); drawer.className = 'record-drawer';
    drawer.setAttribute('aria-labelledby', id + '-heading');
    drawer.innerHTML = `<div class="modal-header"><h2 id="${id}-heading">${label}</h2><button type="button" class="modal-close" aria-label="关闭编辑">×</button></div><div class="modal-body"></div>`;
    drawer.querySelector('.modal-body').append(form); document.body.append(drawer);
    const heading = drawer.querySelector('h2');
    drawer.querySelector('.modal-close').addEventListener('click', () => drawer.close());
    const cancel = document.createElement('button'); cancel.type = 'button';
    cancel.className = 'btn btn-secondary'; cancel.textContent = '取消';
    cancel.addEventListener('click', () => drawer.close());
    form.querySelector('.form-footer').prepend(cancel);
    add.addEventListener('click', () => {
      window[resetName](); heading.textContent = '新增' + label; drawer.showModal();
    });
    const edit = window[editName];
    window[editName] = function(...args) {
      const result = edit.apply(this, args); heading.textContent = '编辑' + label;
      if (!drawer.open) drawer.showModal();
      return result;
    };
    // Existing successful saves reset the form; failed validation leaves it open.
    form.addEventListener('reset', () => { if (drawer.open) queueMicrotask(() => drawer.close()); });
  });
  const atlas = new Image();
  atlas.onload = () => {
    document.querySelectorAll('[data-module-icon]').forEach(item => {
      const i = Number(item.dataset.moduleIcon), icon = document.createElement('span');
      icon.className = 'module-icon'; icon.setAttribute('aria-hidden', 'true');
      icon.style.backgroundPosition = `${-(5 + i % 4 * 310) * 38 / 320}px ${-(260 + Math.floor(i / 4) * 395) * 38 / 320}px`;
      item.querySelector('svg')?.replaceWith(icon);
    });
    const brand = document.querySelector('.brand-mark');
    brand.innerHTML = '<span class="module-icon" aria-hidden="true"></span>';
    brand.firstChild.style.backgroundPosition = `${-935 * 38 / 320}px ${-655 * 38 / 320}px`;
  };
  atlas.src = new URL('./module-icons.png', document.currentScript.src).href;
})();
