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
  function model(d,opts={}){
    const include=key=>opts[key]!==false;
    const overview=[['统计范围',d.period.range],['统计口径','参训人次按场次累加；培训场次仅统计培训记录（含已关联的 AI 分享）'],['培训场次',d.sessions.length],['总人时',d.hours??'待补'],['参训人次',d.people??'待补'],['实际支出',d.spend??'待补'],['待补人数记录',d.pending.people],['待补人时记录',d.pending.hours],['待补支出记录',d.pending.spend],['预算说明',budgetNote(d)],['AI 广播站',d.stations.length],['AI 分享月',d.shares.length],['已发布金融百科',d.finance.length],['广播站待回收或核对',d.pending.stations],['金融百科待回收',d.pending.finance],['金融百科待核对',d.pending.financeReview]];
    const sections=[];
    if(include('includeTraining'))sections.push({name:'培训明细',header:['日期','课程','项目','讲师','人次','时长(h)','人时'],rows:d.sessions.map(s=>[s.date,s.course,s.project,s.lecturer,D.number(s.people)??'待补',D.number(s.duration)??'待补',hours(s)??'待补'])});
    if(include('includeBudget'))sections.push({name:'预算明细',header:['归属月份','类型','预算'],rows:d.budgets.map(b=>[b.month,b.type,D.number(b.amount)??'待补'])},{name:'实际开销',header:['日期','归属月份','类型','金额','用途'],rows:d.expenses.map(e=>[e.date,e.month,e.type,D.number(e.amount)??'待补',e.desc])});
    if(include('includeAI'))sections.push({name:'AI 广播站',header:['日期','期数','主题','回收状态'],rows:d.stations.map(s=>[s.date,s.special?'特别篇':s.episode,s.title,D.stationMetric(s).label])},{name:'AI 分享月',header:['日期','期数','主题','参训人次','时长(分钟)'],rows:d.shares.map(s=>[s.date,s.episode,s.title,D.number(s.people)??'待补',D.number(s.minutes)??'待补'])});
    if(include('includeFinance'))sections.push({name:'金融小百科',header:['日期','期数','主题','状态','查看率'],rows:d.finance.map(s=>[s.date,s.episode,s.title,D.financeStatus(s).label,D.financeMetric(s,'read')===null?'待回收':D.financeMetric(s,'read')+'%'])});
    return {title:d.period.title,range:d.period.range,filename:`Surfin_${d.period.mode==='ytd'?'Annual_YTD':'Monthly'}_${d.period.month}`,overview,sections};
  }
  return {today,period,aggregate,model,fmt,money,metric,budgetNote,hours};
});
