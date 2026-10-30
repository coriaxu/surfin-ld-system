/* 「看得见的口径」纯计算：录入预览、指标口径说明、数据来源说明。
 * 只读状态、不写数据；所有数字都走 LDReport.aggregate，与首页、月报、导出同一套算法。
 * 浏览器：window.LDInsight；Node 测试：require('./assets/ld-insight.js')。 */
(function(root,factory){
  const node=typeof module==='object'&&module.exports;
  const D=node?require('./ld-domain.js'):root.LDDomain, R=node?require('./ld-report.js'):root.LDReport;
  const api=factory(D,R);
  if(node)module.exports=api;else root.LDInsight=api;
})(globalThis,(D,R)=>{
  const DRAFT_ID='__draft__';
  const isDate=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v);
  const squash=v=>String(v??'').replace(/\s+/g,'').toLocaleLowerCase();
  const fmt=n=>n===null||n===undefined?'待补':Number(n).toLocaleString('zh-CN',{maximumFractionDigits:2});
  const monthName=m=>`${m.slice(0,4)} 年 ${Number(m.slice(5,7))} 月`;
  const totals=a=>({sessions:a.sessions.length,people:a.people,hours:a.hours,pendingPeople:a.pending.people,pendingHours:a.pending.hours});
  const diff=(after,before)=>after===null||before===null?null:Math.round((after-before)*100)/100;

  // 把草稿放进状态副本：编辑时替换原记录，新增时追加。原状态不变。
  function withDraft(state,draft,editingId){
    const record={...draft,id:editingId||DRAFT_ID};
    const sessions=(state.sessions||[]).filter(s=>s.id!==editingId).concat(isDate(record.date)?[record]:[]);
    return {...state,sessions};
  }
  function monthTotals(state,month,asOf){return totals(R.aggregate(state,R.period('month',month,asOf)));}

  /* 录入一场培训时，保存后会怎样计入。
   * draft: {date,course,project,people,duration}；editingId: 正在编辑的记录 id（新增为空）。 */
  function sessionImpact(state,draft,{editingId='',asOf=R.today()}={}){
    const notes=[], others=(state.sessions||[]).filter(s=>s.id!==editingId);
    const original=editingId?(state.sessions||[]).find(s=>s.id===editingId):null;
    const people=D.number(draft.people), duration=D.number(draft.duration);
    if(!isDate(draft.date))return {ready:false,hint:'填写培训日期后，这里会显示保存后各项数字怎样变化。',notes};
    const month=draft.date.slice(0,7), future=draft.date>asOf;
    const result={ready:true,month,monthLabel:monthName(month),future,counted:!future,notes};
    if(future){
      result.headline=`日期在今天之后，先记为计划场次；到 ${draft.date.slice(5).replace('-','月')}日当天才计入首页和月报。`;
    }else{
      const after=withDraft(state,draft,editingId);
      const before=monthTotals(state,month,asOf), next=monthTotals(after,month,asOf);
      result.before=before;result.after=next;
      result.delta={sessions:next.sessions-before.sessions,people:diff(next.people,before.people),hours:diff(next.hours,before.hours)};
      const year=month.slice(0,4), yearEnd=asOf.slice(0,4)===year?asOf.slice(0,7):`${year}-12`;
      const yp=R.period('ytd',yearEnd,asOf), yb=R.aggregate(state,yp), ya=R.aggregate(after,yp);
      result.year={label:`${year} 年累计`,before:totals(yb),after:totals(ya)};
      if(people===null||duration===null)notes.push({tone:'info',text:`${people===null?'人数':'时长'}还没填：这场照常算 1 场，${people===null?'人次和':''}人时记为「待补」，不按 0 计算。`});
      // 编辑时改了月份：原月份会少一场。
      if(original&&isDate(original.date)&&original.date.slice(0,7)!==month&&original.date<=asOf){
        notes.push({tone:'info',text:`这条记录原来在 ${monthName(original.date.slice(0,7))}，保存后那个月会少 1 场。`});
      }
      // AI 分享月：与分享月模块同日同主题的记录视为同一场。
      if(D.isShareProject(draft.project)){
        const inMonth=s=>s.date&&s.date.startsWith(month)&&s.date<=asOf;
        const b=D.shareEvents(state).filter(inMonth).length, a=D.shareEvents(after).filter(inMonth).length;
        notes.push(a>b?{tone:'info',text:`项目是 AI 分享月：同时计为分享月 1 场（${monthName(month)}分享月 ${b} → ${a} 场）。`}
          :{tone:'info',text:'分享月模块里已有同日同主题的分享，两边算同一场，分享月场次不会重复增加。'});
      }
    }
    // 重复登记：同日同名课程（10-29 两条重复记录就是这样产生的）。
    if(squash(draft.course)){
      const same=others.filter(s=>s.date===draft.date&&squash(s.course)===squash(draft.course));
      if(same.length){
        const s=same[0];
        notes.unshift({tone:'warn',text:`同一天已有同名课程「${s.course}」（${fmt(D.number(s.people))} 人 · ${fmt(D.number(s.duration))} 小时）${same.length>1?`等 ${same.length} 条`:''}。保存后会算成两场；如果是同一场，请关掉这里，去编辑那条记录。`});
      }
    }
    if(duration!==null&&duration>8)notes.push({tone:'warn',text:`单场 ${fmt(duration)} 小时偏长，月报会列入「需要核对」。如果是多天合计，建议按天分开登记。`});
    // 项目名：新项目，或与已有项目只差空格、大小写。
    const project=String(draft.project??'').trim();
    if(project){
      const names=[...new Set(others.map(s=>String(s.project??'').trim()).filter(Boolean))];
      if(!names.includes(project)){
        const near=names.find(n=>squash(n)===squash(project));
        notes.push(near?{tone:'warn',text:`和已有项目「${near}」只差空格或大小写，统计时会被算成两个项目。建议从下拉建议里直接选。`}
          :{tone:'info',text:`「${project}」是新项目名，项目进展和月报会多出这一栏。若是已有项目，请从下拉建议里选。`});
      }
    }
    return result;
  }

  // 已有项目名，按最近使用排序，用作项目输入框的下拉建议。
  function projectSuggestions(state){
    const latest=new Map();
    for(const s of state.sessions||[]){const p=String(s.project??'').trim();if(p&&(!latest.has(p)||String(s.date)>latest.get(p)))latest.set(p,String(s.date||''));}
    return [...latest].sort((a,b)=>b[1].localeCompare(a[1])).map(([p])=>p);
  }

  /* 指标口径：规则 + 本期实际参与计算的记录。agg 来自 LDReport.aggregate。 */
  const sessionHours=s=>{const p=D.number(s.people),d=D.number(s.duration);return p===null||d===null?null:Math.round(p*d*100)/100;};
  function topProjects(sessions,n=4){
    const map=new Map();for(const s of sessions){const k=String(s.project??'').trim()||'未填项目';map.set(k,(map.get(k)||0)+1);}
    const list=[...map].sort((a,b)=>b[1]-a[1]);
    return list.slice(0,n).map(([k,v])=>`${k} ${v} 场`).join('、')+(list.length>n?` 等 ${list.length} 个项目`:'');
  }
  function explainMetric(key,agg){
    const p=agg.period, scope=p.mode==='ytd'?p.title:`${p.year} 年 ${Number(p.month.slice(5))} 月`;
    const range=`${p.start} 至 ${p.end}`, s=agg.sessions;
    const base={scope,range};
    if(key==='sessions')return {...base,title:'培训场次',value:`${s.length} 场`,
      rules:[`培训台账里日期在 ${range} 之间的记录，每条算 1 场。`,'日期在今天之后的记录是计划场次，到当天才计入。','AI 分享月通过它关联的培训记录计入，分享月列表不再另加一次。'],
      facts:s.length?[`按项目：${topProjects(s)}。`]:['本期还没有培训记录。'],
      records:s.slice(0,6).map(x=>({date:x.date,text:x.course||'未填课程',value:String(x.project||'未填项目')}))};
    if(key==='people'){const known=s.filter(x=>D.number(x.people)!==null).length;return {...base,title:'参训人次',value:`${fmt(agg.people)} 人次`,
      rules:['每场的参加人数相加；同一个人参加 3 场，记 3 人次。','人数没填的场次不计入，标「待补」，不按 0 算。'],
      facts:[`本期 ${s.length} 场中 ${known} 场有人数${agg.pending.people?`，${agg.pending.people} 场待补，合计只含已知值`:''}。`],
      records:[...s].filter(x=>D.number(x.people)!==null).sort((a,b)=>D.number(b.people)-D.number(a.people)).slice(0,5).map(x=>({date:x.date,text:x.course||'未填课程',value:`${fmt(D.number(x.people))} 人`}))};}
    if(key==='hours'){const ranked=[...s].filter(x=>sessionHours(x)!==null).sort((a,b)=>sessionHours(b)-sessionHours(a));return {...base,title:'培训人时',value:`${fmt(agg.hours)} 人时`,
      rules:['每场「人数 × 时长」相加。例：20 人 × 1.5 小时 = 30 人时。','人数或时长缺一项，这场不计人时，标「待补」。'],
      facts:[`本期 ${s.length} 场中 ${ranked.length} 场可计算人时${agg.pending.hours?`，${agg.pending.hours} 场待补`:''}。贡献最大的几场如下。`],
      records:ranked.slice(0,5).map(x=>({date:x.date,text:x.course||'未填课程',value:`${fmt(D.number(x.people))} 人 × ${fmt(D.number(x.duration))} 时 = ${fmt(sessionHours(x))}`}))};}
    if(key==='spend'){const e=agg.expenses;return {...base,title:'项目支出',value:agg.spend===null?'待补':`¥${fmt(agg.spend)}`,
      rules:[`按开销的「归属月份」统计（${p.months.length>1?`${p.months[0]} 至 ${p.months.at(-1)}`:p.month}），之后补录的也算进对应月份。`,'日期在今天之后的开销暂不算实际支出。','只含系统里录入的支出，不含项目报销。'],
      facts:[`本期 ${e.length} 笔${agg.pending.spend?`，${agg.pending.spend} 笔金额待补`:''}。${R.budgetNote(agg)}。`],
      records:[...e].sort((a,b)=>(D.number(b.amount)??-1)-(D.number(a.amount)??-1)).slice(0,5).map(x=>({date:x.date||x.month,text:x.desc||x.note||'未填事项',value:D.number(x.amount)===null?'待补':`¥${fmt(D.number(x.amount))}`}))};}
    throw new Error('未知指标：'+key);
  }

  // 全站统计口径，供口径弹窗里的「全部统计口径」展开阅读（由 README「数据口径」改写）。
  const METHODOLOGY=[
    ['期间','月度看所选月份；年度累计从 1 月 1 日统计到所选月份月底。当月只统计到今天（上海时间），未来的培训和发布不计入。'],
    ['待补与 0','没填的人数、时长、金额记为「待补」，合计只算已知值，不当作 0；明确填写的 0 是真实的 0。'],
    ['场次与人次','一条培训记录算 1 场；多场的人数相加叫「参训人次」；人时 = 每场人数 × 时长再相加。'],
    ['AI 分享月','分享月模块记录 + 培训记录里项目为「AI 分享月」的场次；同日同主题算同一场，只计一次。'],
    ['开销与预算','开销按归属月份统计；没有预算和预算为 0 分开处理，没设预算时不显示超支或余额。'],
    ['金融小百科','以「已发布」判定是否计入；查看、下载人数大于本期总人数时显示「待核对」。'],
    ['报告','月度/年度总结、PDF、Excel 用同一份汇总；历史报告会随补录更新，不是封存快照。']
  ];

  /* 数据来源与保存位置。load: window.LDLoadInfo；sync: 同步控制器状态（含 configured）。 */
  function stamp(iso,now=new Date()){
    if(!iso)return '';
    const d=new Date(iso), same=d.toDateString()===now.toDateString();
    const t=d.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',hour12:false});
    return same?t:`${d.getMonth()+1}月${d.getDate()}日 ${t}`;
  }
  function dataSource(load={},sync={},now=new Date()){
    const configured=!!sync.configured;
    const origin=load.status==='snapshot'?'站点快照（可能比云端晚几分钟）':load.status==='failed'?'未能加载':load.status==='loading'?'正在加载':'云端';
    const synced=sync.lastCloud?`最近同步 ${stamp(sync.lastCloud,now)}`:'';
    let save, tone='ok';
    if(sync.status==='error'){save='同步失败：改动只保留在这个浏览器，请点「重试」或导出备份。';tone='warn';}
    else if(sync.status==='save-error'){save='本机保存失败：请先导出备份，再检查浏览器存储空间。';tone='warn';}
    else if(!configured){save='当前未开启云同步：保存的改动只在这台电脑的这个浏览器里，换电脑或清缓存后看不到。';tone=sync.dirty?'warn':'info';}
    else if(sync.dirty||sync.status==='local'||sync.status==='syncing'){save='已存到本机，几秒后自动同步到云端。';tone='info';}
    else save='保存后自动同步到云端，其他电脑刷新即可看到。';
    return {origin,synced,save,tone,configured,localOnly:!configured&&!!sync.dirty,line:`数据来源：${origin}${synced?' · '+synced:''}`};
  }

  return {sessionImpact,projectSuggestions,explainMetric,METHODOLOGY,dataSource,stamp,fmt};
});
