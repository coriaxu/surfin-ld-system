// 培训明细的展示辅助：按周分组、项目配色、1 对 1 识别、月历网格与周历 HTML。
// 只读原始记录，不改动任何字段；浏览器挂在 window.LDTrainingView，Node 测试用 require。
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LDTrainingView = api;
})(globalThis, () => {
  const DAY = 86400000;
  const parse = s => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || '')); return m ? Date.UTC(+m[1], m[2] - 1, +m[3]) : null; };
  const iso = t => new Date(t).toISOString().slice(0, 10);
  const addDays = (s, n) => iso(parse(s) + n * DAY);
  // 周一为一周开始；没有日期的记录返回空串，单独成组。
  function weekStart(date) {
    const t = parse(date); if (t === null) return '';
    return iso(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY);
  }
  const md = s => `${+s.slice(5, 7)}/${+s.slice(8, 10)}`;
  const weekLabel = start => start ? `${md(start)} – ${md(addDays(start, 6))}` : '未填日期';
  const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v))) ? null : Number(v);
  // 与总览口径一致：人数或时长缺失的场次只计条数，不按 0 计入人时。
  function summarize(list) {
    let hours = 0, missing = 0;
    for (const s of list) { const p = num(s.people), d = num(s.duration); if (p === null || d === null) missing++; else hours += p * d; }
    return { count: list.length, hours: Math.round(hours * 100) / 100, missing };
  }
  function groupByWeek(list) {
    const map = new Map();
    for (const s of list) { const k = weekStart(s.date); if (!map.has(k)) map.set(k, []); map.get(k).push(s); }
    return map;
  }
  // 项目配色只用于展示；标签文字仍显示原始项目名。
  function tone(project) {
    const n = String(project || '').replace(/\s+/g, '');
    if (!n) return 'none';
    if (n.includes('管理者')) return 'mgr';
    if (/^AI赋能(?:训练营)?第四期$/.test(n)) return 'ai4';
    if (n.includes('咖啡')) return 'cafe';
    if (/^AI赋能(?:训练营)?$/.test(n)) return 'past';
    let h = 0; for (const c of n) h = (h * 31 + c.codePointAt(0)) >>> 0;
    return 't' + (h % 4 + 1);
  }
  // “1 对 1 辅导答疑” → {one:true, rest:'辅导答疑'}；其余课程原样返回。
  function splitOneOnOne(course) {
    const text = String(course || ''), m = /^\s*1\s*(?:对|v|V)\s*1\s*/.exec(text);
    if (!m) return { one: false, rest: text };
    const rest = text.slice(m[0].length).trim();
    return { one: true, rest: rest || text };
  }
  // 月历：从 1 号所在周的周一到月末所在周的周日。
  function monthGrid(month) {
    const first = month + '-01', y = +month.slice(0, 4), mo = +month.slice(5, 7);
    const last = iso(Date.UTC(y, mo, 0));
    const weeks = [];
    for (let s = weekStart(first); s <= last; s = addDays(s, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(s, i)));
    return weeks;
  }
  function shiftMonth(month, n) { const y = +month.slice(0, 4), m = +month.slice(5, 7) - 1 + n; return iso(Date.UTC(y, m, 1)).slice(0, 7); }

  const defaultEsc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const defaultFmt = n => n === null ? '待补' : Number(n).toLocaleString('zh-CN', { maximumFractionDigits: 2 });
  const WEEKDAYS = ['周一', '周二', '周三', '周四', '周五', '周六', '周日'];

  // 周历 HTML：一周一行，左侧本周小计，七列按日期放课程。
  function calendarHTML({ month, sessions, today, esc = defaultEsc, fmt = defaultFmt }) {
    const weeks = monthGrid(month), byDate = new Map();
    for (const s of sessions) { if (!parse(s.date)) continue; if (!byDate.has(s.date)) byDate.set(s.date, []); byDate.get(s.date).push(s); }
    const weekTotals = weeks.map(days => summarize(days.flatMap(d => byDate.get(d) || [])));
    const max = Math.max(1, ...weekTotals.map(w => w.hours));
    const card = s => {
      const p = num(s.people), d = num(s.duration), split = splitOneOnOne(s.course), plan = today && s.date > today;
      const t = tone(s.project);
      if (split.one) {
        return `<div class="tv-pill${plan ? ' is-plan' : ''}" title="${esc(s.course + ' · ' + (s.project || ''))}"><div class="tv-pill-row"><i class="tv-dot tone-${t}"></i><span class="tv-who">${esc(s.note || split.rest)}</span><span class="tv-len">${d === null ? '待补' : fmt(d) + ' h'}</span></div><div class="tv-sub">1 对 1 · ${esc(s.project || '未填项目')}</div></div>`;
      }
      const hours = p === null || d === null ? '待补' : `<b>${fmt(p * d)}</b> 人时`;
      return `<div class="tv-card tone-${t}${plan ? ' is-plan' : ''}"><div class="tv-title">${esc(s.course || '未填课程')}${plan ? '<span class="tv-chip">计划</span>' : ''}</div><div class="tv-meta">${p === null ? '待补' : fmt(p)} 人 × ${d === null ? '待补' : fmt(d)} h · ${hours}</div>${s.note ? `<div class="tv-note">${esc(s.note)}</div>` : ''}</div>`;
    };
    let html = `<div class="tv-grid"><div class="tv-h">周</div>${WEEKDAYS.map((w, i) => `<div class="tv-h${i > 4 ? ' is-we' : ''}">${w}</div>`).join('')}`;
    weeks.forEach((days, wi) => {
      const sum = weekTotals[wi], now = today && days[0] <= today && today <= days[6];
      const mix = new Map();
      for (const s of days.flatMap(d => byDate.get(d) || [])) { const p = num(s.people), d = num(s.duration); if (p !== null && d !== null) { const t = tone(s.project); mix.set(t, (mix.get(t) || 0) + p * d); } }
      const meter = [...mix].map(([t, h]) => `<span class="tone-${t}" style="width:${(h / max * 100).toFixed(1)}%"></span>`).join('');
      html += `<div class="tv-wk${now ? ' is-now' : ''}"><div class="tv-wn">${weekLabel(days[0])}${now ? '<em>本周</em>' : ''}</div><div class="tv-big">${fmt(sum.hours)}<small>人时</small></div><div class="tv-cnt">${sum.count} 场${sum.missing ? ` · ${sum.missing} 场待补` : ''}</div><div class="tv-meter">${meter}</div></div>`;
      days.forEach((d, di) => {
        const list = (byDate.get(d) || []).slice().sort((a, b) => splitOneOnOne(a.course).one - splitOneOnOne(b.course).one);
        const out = d.slice(0, 7) !== month, isToday = d === today;
        const label = out ? md(d) : String(+d.slice(8, 10));
        html += `<div class="tv-day${di > 4 ? ' is-we' : ''}${isToday ? ' is-today' : ''}${out ? ' is-out' : ''}${list.length ? ' has' : ''}"><div class="tv-dn"><span class="tv-dn-wd">${WEEKDAYS[di]}</span>${label}${isToday ? '<span class="tv-today">今天</span>' : ''}</div>${list.map(card).join('')}</div>`;
      });
    });
    return html + '</div>';
  }

  return { weekStart, weekLabel, summarize, groupByWeek, tone, splitOneOnOne, monthGrid, shiftMonth, calendarHTML, addDays };
});
