/* 明账 2.0 首屏：每个数下方一条迷你趋势，数字切换时滚动到新值。
 * 只读期间汇总（LDReport.aggregate），不改数字本身；缺数月份断开，不补零。 */
(() => {
  const R = window.LDReport, $ = id => document.getElementById(id);
  if (!R || typeof renderStats !== 'function') return;
  const calm = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const METRICS = [
    ['statSessions', d => d.sessions.length],
    ['statHours', d => d.hours],
    ['statMonthPeople', d => d.people],
    ['statMonthSpend', d => d.spend],
  ];

  // 月度看截至所选月的近 12 个月；年度累计看当年 1 月到所选月。
  function months() {
    const month = $('overviewMonth')?.value || R.today().slice(0, 7);
    const ytd = document.querySelector('.period-switch [data-period="ytd"]')?.classList.contains('active');
    const [y, m] = month.split('-').map(Number), out = [];
    const n = ytd ? m : 12;
    for (let i = n - 1; i >= 0; i--) { const d = new Date(Date.UTC(y, m - 1 - i, 1)); out.push(d.toISOString().slice(0, 7)); }
    return out;
  }

  function spark(values, labels, ongoing) {
    const W = 200, H = 34, pad = 3, known = values.filter(v => v !== null);
    if (known.length < 2) return '';
    const max = Math.max(...known, 0), min = 0, span = max - min || 1;
    const x = i => pad + (W - pad * 2) * (values.length === 1 ? 0 : i / (values.length - 1));
    const y = v => H - pad - (H - pad * 2) * ((v - min) / span);
    // 缺数断开成几段，各自成线
    const runs = []; let run = [];
    values.forEach((v, i) => { if (v === null) { if (run.length) runs.push(run); run = []; } else run.push([x(i), y(v)]); });
    if (run.length) runs.push(run);
    const path = r => 'M' + r.map(p => p.map(n => n.toFixed(1)).join(' ')).join('L');
    // 本月还没过完：最后一段画虚线，避免读成下滑
    const tail = ongoing && run.length > 1 && values[values.length - 1] !== null ? runs[runs.length - 1].splice(-2, 2) : null;
    if (tail) runs[runs.length - 1].push(tail[0]);
    const line = runs.filter(r => r.length).map(path).join('');
    if (tail) runs[runs.length - 1].push(tail[1]);
    const area = runs.filter(r => r.length > 1).map(r => `M${r[0][0].toFixed(1)} ${H}L` + r.map(p => p.map(n => n.toFixed(1)).join(' ')).join('L') + `L${r[r.length - 1][0].toFixed(1)} ${H}Z`).join('');
    const li = values.length - 1, last = values[li];
    const dot = last === null ? '' : `<circle class="dot" cx="${x(li).toFixed(1)}" cy="${y(last).toFixed(1)}" r="3"/>`;
    return `<svg class="mz-spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${labels[0]} 至 ${labels[li]} 每月趋势"><path class="area" d="${area}"/><path class="line" d="${line}"/>${tail ? `<path class="line ongoing" d="${path(tail)}"/>` : ''}${dot}</svg>`;
  }
  const short = (m, ref) => (m.slice(0, 4) === ref.slice(0, 4) ? '' : `${m.slice(2, 4)}年`) + `${Number(m.slice(5))}月`;

  function drawSparks() {
    const list = months(), data = list.map(m => R.aggregate(state, R.period('month', m)));
    for (const [id, get] of METRICS) {
      const card = $(id)?.closest('.stat-card');
      if (!card) continue;
      card.querySelectorAll('.mz-spark,.mz-spark-cap').forEach(n => n.remove());
      const values = data.map(d => { const v = get(d); return v === null || v === undefined ? null : Number(v); });
      const svg = spark(values, list, list[list.length - 1] === R.today().slice(0, 7));
      if (!svg) continue;
      card.querySelector('.stat-desc').insertAdjacentHTML('beforebegin', svg + `<div class="mz-spark-cap" aria-hidden="true"><span>${short(list[0], list[list.length - 1])}</span><span>${short(list[list.length - 1], list[list.length - 1])}</span></div>`);
    }
  }

  // 数字滚动：只处理纯数值（可带 ¥ 与千分位），待补、未加载等文字原样显示。
  const timers = new WeakMap();
  function roll(node) {
    const text = node.textContent, m = /^(¥?)([\d,]+(?:\.\d+)?)$/.exec(text.trim());
    const prev = node.dataset.mzValue === undefined ? 0 : Number(node.dataset.mzValue);
    if (!m) { delete node.dataset.mzValue; return; }
    const to = Number(m[2].replace(/,/g, '')), decimals = (m[2].split('.')[1] || '').length;
    node.dataset.mzValue = to;
    const from = Number.isFinite(prev) ? prev : 0;
    if (calm() || from === to) return;
    cancelAnimationFrame(timers.get(node));
    const fmt = v => m[1] + v.toLocaleString('zh-CN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    const t0 = performance.now(), dur = 600;
    const step = t => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      node.textContent = k < 1 ? fmt(from + (to - from) * e) : text;
      if (k < 1) timers.set(node, requestAnimationFrame(step));
    };
    timers.set(node, requestAnimationFrame(step));
  }

  const base = renderStats;
  renderStats = function () {
    base.apply(this, arguments);
    try { drawSparks(); } catch (err) { console.warn('趋势线未绘制', err); }
    METRICS.forEach(([id]) => { const n = $(id); if (n) roll(n); });
  };
  renderStats();
})();
