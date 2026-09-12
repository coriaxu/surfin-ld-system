(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.LDDomain = api;
})(globalThis, () => {
  const number = value => value === null || value === undefined || String(value).trim() === '' || !Number.isFinite(Number(value)) ? null : Number(value);
  const rate = (count, total) => {
    const a = number(count), b = number(total);
    return a === null || b === null || b <= 0 || a < 0 || a > b ? null : Math.round(a / b * 1000) / 10;
  };
  function stationMetric(item) {
    if (item.collectionState === 'pending' || number(item.views) === null) return {value:null,status:'pending',label:'待回收'};
    if (number(item.views) === 0 && item.collectionState !== 'collected') return {value:null,status:'review',label:'待核对'};
    const value = rate(item.views, item.total);
    return {value,status:value === null ? 'pending' : 'collected',label:value === null ? '待回收' : value + '%'};
  }
  function stationPayload(values, id) {
    const total = number(values.total), unviewed = number(values.unviewed);
    if (total !== null && (!Number.isInteger(total) || total <= 0)) throw new Error('公司总人数必须为正整数');
    if (unviewed !== null && (!Number.isInteger(unviewed) || unviewed < 0 || total === null || unviewed > total)) throw new Error('请填写有效总人数，未查看人数应在 0 到总人数之间');
    return {id,episode:Number(values.episode),date:values.date,title:values.title.trim(),total,views:unviewed === null ? null : total - unviewed,collectionState:unviewed === null ? 'pending' : 'collected',category:values.category,note:values.note};
  }
  function financeMetric(item, field) {
    const count = number(item[field]), total = number(item.total);
    if (count === null) return null;
    if (total !== null && total > 0) return rate(count,total);
    // Retain historical reported rates when the original denominator was not stored.
    const historical = number(item[field === 'read' ? 'viewRate' : 'downloadRate']);
    return historical !== null && historical >= 0 && historical <= 100 ? historical : null;
  }
  function financeStatus(item) {
    const published = typeof item.published === 'boolean' ? item.published : Boolean(item.workflow?.publish || item.workflow?.data);
    if (!published) return {key:'draft',label:'制作中'};
    if (financeMetric(item,'read') === null || financeMetric(item,'downloads') === null) return {key:'pending',label:'已发布 · 待回收'};
    return {key:'complete',label:'已发布 · 已回收'};
  }
  function upsertShare(state, payload, makeId) {
    const existing = state.aiShares.find(s => s.id === payload.id);
    let session = state.sessions.find(s => s.id === existing?.linkedSessionId || (s.source === 'ai_share' && s.sourceId === payload.id));
    if (!session) {
      const candidates = state.sessions.filter(s => s.source === 'ai_share' && s.project === `AI分享月(第${existing?.episode ?? payload.episode}期)`);
      if (candidates.length === 1) session = candidates[0];
      else session = candidates.find(s => s.date === (existing?.date ?? payload.date));
    }
    const complete = number(payload.attendees) !== null && number(payload.duration) !== null && payload.duration > 0 && payload.date;
    if (complete) {
      const next = {id:session?.id || makeId(),date:payload.date,course:payload.title,project:`AI分享月(第${payload.episode}期)`,lecturer:session?.lecturer || '',people:payload.attendees,duration:payload.duration / 60,note:payload.note || '',source:'ai_share',sourceId:payload.id};
      if (session) Object.assign(session,next); else state.sessions.push(next);
      payload.linkedSessionId = next.id;
    } else if (session) {
      // The linked record remains traceable and stops contributing incomplete figures.
      Object.assign(session,{date:payload.date,course:payload.title,people:payload.attendees,duration:number(payload.duration) === null ? null : payload.duration / 60,sourceId:payload.id});
      payload.linkedSessionId = session.id;
    }
    if (existing) Object.assign(existing,payload); else state.aiShares.push(payload);
    return payload;
  }
  function taskPreview(list,episode,template,aliases,kind){
    return template.map(task=>list.find(item=>item.episode===episode&&(item.name===task.name||aliases[item.name]===task.name))||{...task,id:`preview_${kind}_${episode}_${task.stage}`,episode,done:false});
  }
  const sum = (items, fn) => items.reduce((n,item) => n + (number(fn(item)) || 0),0);
  function monthly(state, month) {
    const sessions = (state.sessions || []).filter(s => s.date?.startsWith(month));
    const expenses = (state.expenses || []).filter(s => s.month === month);
    const budgets = (state.budgets || []).filter(s => s.month === month);
    const stations = (state.aiStations || []).filter(s => s.date?.startsWith(month));
    const finance = (state.financeWiki || []).filter(s => s.date?.startsWith(month) && financeStatus(s).key !== 'draft');
    return {sessions,expenses,budgets,stations,finance,people:sum(sessions,s=>s.people),hours:sum(sessions,s=>number(s.people) * number(s.duration)),spend:sum(expenses,s=>s.amount),budget:budgets.length ? sum(budgets,s=>s.amount) : null,pending:stations.filter(s=>stationMetric(s).status !== 'collected').length};
  }
  function search(items, query, month, fields) {
    const q = query.trim().toLocaleLowerCase();
    return items.filter(item => (!month || (item.date || item.month || '').startsWith(month)) && (!q || fields.some(field=>String(item[field] ?? '').toLocaleLowerCase().includes(q))));
  }
  const equal = (a,b) => JSON.stringify(a) === JSON.stringify(b);
  function mergeThreeWay(base, local, remote) {
    const output = structuredClone(remote), conflicts = [];
    for (const key of Object.keys(local)) {
      if (equal(local[key],base[key])) continue;
      if (equal(remote[key],base[key]) || equal(local[key],remote[key])) { output[key] = structuredClone(local[key]); continue; }
      const arrays = [base[key],local[key],remote[key]];
      if (arrays.every(a => Array.isArray(a) && a.every(v=>v && typeof v === 'object' && v.id))) {
        const maps = arrays.map(a=>new Map(a.map(v=>[v.id,v]))), merged=[];
        for (const id of new Set(arrays.flat().map(v=>v.id))) {
          const [b,l,r]=maps.map(m=>m.get(id));
          let selected;
          if (equal(l,b)) selected=r;
          else if (equal(r,b) || equal(l,r)) selected=l;
          else { conflicts.push(key+':'+id); continue; }
          if (selected !== undefined) merged.push(structuredClone(selected));
        }
        output[key]=merged;
      } else conflicts.push(key);
    }
    if (conflicts.length) { const error=new Error('云端与本机修改了同一记录，请先导出本机副本，再拉取云端核对。'); error.code='CONFLICT'; error.conflicts=conflicts; throw error; }
    return output;
  }
  return {number,rate,stationMetric,stationPayload,financeMetric,financeStatus,upsertShare,taskPreview,monthly,search,mergeThreeWay};
});
