/* One immutable reporting snapshot for dashboard, reports and exports. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./ld-domain.js'):root.LDDomain);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.LDReport=api;
})(globalThis,D=>{
  const round=n=>Math.round((n+Number.EPSILON)*100)/100;
  const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  function period(mode='month',month=today().slice(0,7),asOf=today()){
    if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))throw new Error('请选择有效月份');
    month=month>asOf.slice(0,7)?asOf.slice(0,7):month;
    mode=mode==='ytd'?'ytd':'month';
    const [year,m]=month.split('-').map(Number),start=mode==='ytd'?`${year}-01-01`:`${month}-01`;
    const last=`${month}-${new Date(Date.UTC(year,m,0)).getUTCDate()}`,end=last>asOf?asOf:last;
    const months=Array.from({length:mode==='ytd'?m:1},(_,i)=>mode==='ytd'?`${year}-${String(i+1).padStart(2,'0')}`:month);
    return {mode,month,year,start,end,asOf,months,ongoing:month===asOf.slice(0,7),title:mode==='ytd'?`${year} 年度累计 · 截至 ${m} 月`:`${year} 年 ${m} 月`,range:`${start} 至 ${end}`};
  }
  function sumKnown(items,get){const values=items.map(get).map(D.number),known=values.filter(v=>v!==null);return {value:items.length&&!known.length?null:round(known.reduce((a,b)=>a+b,0)),pending:values.length-known.length};}
  const hours=s=>D.number(s.people)===null||D.number(s.duration)===null?null:round(Number(s.people)*Number(s.duration));
  function aggregate(state,p){
    const within=date=>typeof date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&date>=p.start&&date<=p.end;
    // Expenses use the attributed month, including later backfills; future dated records are not actuals yet.
    const attributed=r=>p.months.includes(r.month)&&(!r.date||r.date<=p.asOf);
    // Report details read newest first, like the ledger; a stable sort keeps same-day records in entry order.
    const newest=(a,b)=>String(b.date||'').localeCompare(String(a.date||''));
    const sessions=(state.sessions||[]).filter(s=>within(s.date)).sort(newest);
    const expenses=(state.expenses||[]).filter(attributed).sort(newest),budgets=(state.budgets||[]).filter(b=>p.months.includes(b.month));
    const stations=(state.aiStations||[]).filter(s=>within(s.date)).sort(newest),shares=D.shareEvents(state).filter(s=>within(s.date)).sort(newest);
    const finance=(state.financeWiki||[]).filter(s=>within(s.date)&&D.financeStatus(s).key!=='draft').sort(newest);
    const people=sumKnown(sessions,s=>s.people),trainingHours=sumKnown(sessions,hours),spend=sumKnown(expenses,s=>s.amount),budget=sumKnown(budgets,s=>s.amount);
    const missingBudgetMonths=p.months.filter(m=>!budgets.some(b=>b.month===m&&D.number(b.amount)!==null));
    // Clone records so an edit while a PDF renders cannot alter the subsequent XLSX.
    return structuredClone({period:p,sessions,expenses,budgets,stations,shares,finance,people:people.value,hours:trainingHours.value,spend:spend.value,budget:budgets.length?budget.value:null,pending:{people:people.pending,hours:trainingHours.pending,spend:spend.pending,budget:budget.pending,stations:stations.filter(s=>D.stationMetric(s).status!=='collected').length,finance:finance.filter(s=>D.financeStatus(s).key==='pending').length,financeReview:finance.filter(s=>D.financeStatus(s).key==='review').length},missingBudgetMonths});
  }
  const fmt=n=>n===null?'待补':Number(n).toLocaleString('zh-CN',{maximumFractionDigits:2});
  const money=n=>n===null?'待补':'¥'+fmt(n);
  const metric=(d,key,currency=false)=>(currency?money:fmt)(d[key])+(d.pending[key]?`（${d.pending[key]} 条待补）`:'');
  const budgetNote=d=>d.budget===null?'尚未设置预算':`${d.missingBudgetMonths.length||d.pending.budget?'已录入预算合计':'预算合计'} ${money(d.budget)}${d.missingBudgetMonths.length?`；${d.missingBudgetMonths.join('、')} 未录入预算`:''}${d.pending.budget?`；${d.pending.budget} 条预算金额待补`:''}`;
  const hasText=v=>/[\p{L}\p{N}]/u.test(String(v??''));
  const previousMonth=month=>{const [y,m]=month.split('-').map(Number);return m===1?`${y-1}-12`:`${y}-${String(m-1).padStart(2,'0')}`;};
  function groupBy(sessions,keyOf){
    const map=new Map();for(const s of sessions){const k=keyOf(s);if(!map.has(k))map.set(k,[]);map.get(k).push(s);}
    return [...map].map(([name,items])=>({name,sessions:items.length,people:sumKnown(items,s=>s.people).value,hours:sumKnown(items,hours).value})).sort((a,b)=>(b.hours??-1)-(a.hours??-1)||b.sessions-a.sessions);
  }
  // One-page brief for managers: scale, where effort went, spend, and what needs checking. Full detail stays in Excel.
  function brief(d,prev=null,show={}){
    const total=d.hours||0,share=h=>total&&h!==null?Math.round(h/total*100):null;
    const projects=groupBy(d.sessions,s=>hasText(s.project)?String(s.project).trim():'未填项目').map(g=>({...g,share:share(g.hours)}));
    const courses=groupBy(d.sessions,s=>hasText(s.course)?String(s.course).trim():'未填课程');
    const rates=d.stations.map(s=>D.stationMetric(s).value).filter(v=>v!==null);
    const stationAvg=rates.length?Math.round(rates.reduce((a,b)=>a+b,0)/rates.length*10)/10:null;
    // Data checks: surface records that would change the headline numbers.
    const checks=[],dupGroups=new Map();let biggest=0;
    for(const s of d.sessions){const n=D.number(s.people);if(n!==null&&n>1){const k=[s.date,String(s.course||'').trim(),n].join('|');dupGroups.set(k,[...(dupGroups.get(k)||[]),s]);}}
    const dupOf=s=>{const n=D.number(s.people);const g=dupGroups.get([s.date,String(s.course||'').trim(),n].join('|'));return g&&g.length>1?g:null;};
    const noted=new Set(),flagged=new Set(),ranked=[];
    for(const s of d.sessions){
      const dur=D.number(s.duration),issues=[];
      if(dur!==null&&dur>8)issues.push(`单场时长 ${fmt(dur)} 小时`);
      if(!hasText(s.project))issues.push('项目未填');
      if(!issues.length)continue;
      flagged.add(String(s.course||'').trim());
      const g=dupOf(s);if(g){issues.push(`同日另有 ${g.length-1} 条同名课程记录`);g.forEach(x=>noted.add(x));}
      const h=hours(s),pct=share(h);if(pct!==null)biggest=Math.max(biggest,pct);
      ranked.push([pct??0,`${s.date.slice(5)}「${s.course||'未填课程'}」${issues.join('、')}${pct!==null?`，计入 ${fmt(h)} 人时（占本期 ${pct}%）`:''}，请核对。`]);
    }
    // Most distorting record first, independent of entry or display order.
    ranked.sort((a,b)=>b[0]-a[0]).forEach(([,t])=>checks.push(t));
    for(const g of dupGroups.values())if(g.length>1&&!g.some(x=>noted.has(x)))checks.push(`${g[0].date.slice(5)}「${g[0].course}」同日有 ${g.length} 条人数相同的记录，请确认是否重复登记。`);
    if(d.pending.people||d.pending.hours)checks.push(`${d.pending.people} 条记录缺人数、${d.pending.hours} 条缺人时，合计只含已知值。`);
    if(show.budget!==false&&d.pending.spend)checks.push(`${d.pending.spend} 条开销金额待补。`);
    if(show.ai!==false&&d.pending.stations)checks.push(`AI 广播站 ${d.pending.stations} 期回收数据待回收或核对。`);
    if(show.finance!==false&&(d.pending.finance||d.pending.financeReview))checks.push(`金融小百科 ${d.pending.finance} 期待回收、${d.pending.financeReview} 期待核对。`);
    const ytd=d.period.mode==='ytd',top=projects.find(g=>g.name!=='未填项目');
    let headline=d.sessions.length?`${ytd?'年度累计':'本月'}完成 ${d.sessions.length} 场培训，覆盖 ${fmt(d.people)} 人次、${d.hours===null?'待补':Number(d.hours).toLocaleString('zh-CN',{maximumFractionDigits:1})} 人时`:`${ytd?'本年度':'本月'}暂无培训记录`;
    if(top&&top.share!==null&&projects.length>1)headline+=`；投入最多的是「${top.name}」（${top.sessions} 场，占人时 ${top.share}%）`;
    headline+='。';
    if(biggest>=30)headline+=`其中一条记录占人时 ${biggest}%，核对后总人时可能明显变化。`;
    const kpi=(label,value,prevValue,unit='',pending=0)=>({label,value,unit,prev:prev?prevValue:undefined,pending});
    const kpis=[kpi('培训场次',d.sessions.length,prev?.sessions.length,'场'),kpi('参训人次',d.people,prev?.people,'人次',d.pending.people),kpi('培训人时',d.hours,prev?.hours,'小时',d.pending.hours)];
    if(show.budget!==false)kpis.push(kpi('实际支出',d.spend,prev?.spend,'元',d.pending.spend));
    const expenses=d.expenses.map(e=>({desc:hasText(e.desc)?e.desc:(e.type||'未填用途'),amount:D.number(e.amount),date:e.date})).sort((a,b)=>(b.amount??-1)-(a.amount??-1));
    // Outcomes: verifiable statements of what was delivered, derived only from records (no claimed impact).
    const outcomes=[],kindOf=s=>/1对1|一对一|答疑/.test(s.course||'')?'coach':/交流|咖啡/.test(s.course||'')?'talk':'topic';
    if(show.training!==false)for(const g of projects.filter(g=>g.name!=='未填项目').slice(0,3)){
      const items=d.sessions.filter(s=>String(s.project||'').trim()===g.name).sort((a,b)=>String(a.date).localeCompare(String(b.date)));
      const topics=[...new Set(items.filter(s=>kindOf(s)==='topic').map(s=>String(s.course||'').trim()).filter(Boolean))];
      const topicPeople=sumKnown(items.filter(s=>kindOf(s)==='topic'),s=>s.people).value;
      const coach=items.filter(s=>kindOf(s)==='coach').length,talk=items.filter(s=>kindOf(s)==='talk').length,parts=[];
      if(topics.length)parts.push(`主题课推进 ${topics.length} 门（${topics.join(' → ')}）${topicPeople?`，覆盖 ${fmt(topicPeople)} 人次`:''}`);
      if(coach)parts.push(`${topics.length?'配套 ':''}${coach} 场 1对1 辅导跟进`);
      if(talk)parts.push(`${talk} 场交流`);
      if(parts.length)outcomes.push(`「${g.name}」：${parts.join('；')}。`);
    }
    const projectLines=outcomes.length;
    if(show.ai!==false&&d.stations.length){
      const best=d.stations.map(s=>({s,v:D.stationMetric(s).value})).filter(x=>x.v!==null).sort((a,b)=>b.v-a.v)[0];
      const t=best?String(best.s.title||'').trim().replace(/[。．.！!]+$/,''):'',short=t.length>18?t.slice(0,18)+'…':t;
      outcomes.push(`AI 广播站发布 ${d.stations.length} 期${stationAvg!==null?`，平均回收率 ${stationAvg}%`:''}${best&&d.stations.length>1?`；表现最好的是「${short}」（${best.v}%）`:''}${d.shares.length?`；AI 分享月 ${d.shares.length} 场`:''}。`);
    }
    if(show.finance!==false&&d.finance.length)outcomes.push(`金融小百科发布 ${d.finance.length} 期。`);
    return {headline,kpis,projects,courses,checks,flaggedCourses:[...flagged],outcomes,outcomeTail:outcomes.length-projectLines,stationAvg,stations:d.stations.map(s=>({date:s.date,episode:s.special?'特别篇':`第 ${s.episode} 期`,title:s.title,label:D.stationMetric(s).label})),shares:{count:d.shares.length,people:sumKnown(d.shares,s=>s.people).value},finance:{count:d.finance.length},expenses,spend:d.spend,budgetNote:budgetNote(d),show,prevLabel:prev?(ytd?'上期':'上月'):null};
  }
  function model(d,opts={}){
    const include=key=>opts[key]!==false;
    const overview=[['统计范围',d.period.range],['统计口径','参训人次按场次累加；培训场次仅统计培训记录（含已关联的 AI 分享）'],['培训场次',d.sessions.length],['总人时',d.hours??'待补'],['参训人次',d.people??'待补'],['实际支出',d.spend??'待补'],['待补人数记录',d.pending.people],['待补人时记录',d.pending.hours],['待补支出记录',d.pending.spend],['预算说明',budgetNote(d)],['AI 广播站',d.stations.length],['AI 分享月',d.shares.length],['已发布金融百科',d.finance.length],['广播站待回收或核对',d.pending.stations],['金融百科待回收',d.pending.finance],['金融百科待核对',d.pending.financeReview]];
    const sections=[];
    if(include('includeTraining'))sections.push({name:'培训明细',header:['日期','课程','项目','讲师','人次','时长(h)','人时'],rows:d.sessions.map(s=>[s.date,s.course,s.project,s.lecturer,D.number(s.people)??'待补',D.number(s.duration)??'待补',hours(s)??'待补'])});
    if(include('includeBudget'))sections.push({name:'预算明细',header:['归属月份','类型','预算'],rows:d.budgets.map(b=>[b.month,b.type,D.number(b.amount)??'待补'])},{name:'实际开销',header:['日期','归属月份','类型','金额','用途'],rows:d.expenses.map(e=>[e.date,e.month,e.type,D.number(e.amount)??'待补',e.desc])});
    if(include('includeAI'))sections.push({name:'AI 广播站',header:['日期','期数','主题','回收状态'],rows:d.stations.map(s=>[s.date,s.special?'特别篇':s.episode,s.title,D.stationMetric(s).label])},{name:'AI 分享月',header:['日期','期数','主题','参训人次','时长(分钟)'],rows:d.shares.map(s=>[s.date,s.episode,s.title,D.number(s.people)??'待补',D.number(s.minutes)??'待补'])});
    if(include('includeFinance'))sections.push({name:'金融小百科',header:['日期','期数','主题','状态','查看率'],rows:d.finance.map(s=>[s.date,s.episode,s.title,D.financeStatus(s).label,D.financeMetric(s,'read')===null?'待回收':D.financeMetric(s,'read')+'%'])});
    const show={training:include('includeTraining'),budget:include('includeBudget'),ai:include('includeAI'),finance:include('includeFinance')};
    return {title:d.period.title,range:d.period.range,asOf:d.period.asOf,period:{mode:d.period.mode,year:d.period.year,month:d.period.month,start:d.period.start,end:d.period.end},brief:brief(d,opts.previous||null,show),filename:`Surfin_${d.period.mode==='ytd'?'Annual_YTD':'Monthly'}_${d.period.month}`,overview,sections};
  }
  return {today,period,previousMonth,aggregate,brief,model,fmt,money,metric,budgetNote,hours};
});
