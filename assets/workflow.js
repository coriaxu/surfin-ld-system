/* Application workflows, built on the shared workbench surfaces. */
(() => {
  const D=LDDomain, $=id=>document.getElementById(id), esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const today=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const currentMonth=()=>today().slice(0,7), money=n=>'¥'+Number(n||0).toLocaleString('zh-CN',{maximumFractionDigits:2});
  const fmt=n=>n===null?'待回收':Number(n).toLocaleString('zh-CN',{maximumFractionDigits:2});
  const el=(tag,cls,html)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(html!==undefined)n.innerHTML=html;return n;};
  const btn=(label,action,id='',primary=false)=>`<button type="button" class="btn ${primary?'btn-primary':'btn-secondary'} btn-sm" data-action="${action}" data-record="${esc(id)}">${esc(label)}</button>`;
  const filterState={}, drawers={};let activePage='dashboard', refreshing=false;
  document.body.classList.add('workflow-ready');

  // Persistent save status distinguishes local durability from remote visibility.
  const syncBar=el('div','save-status'); syncBar.setAttribute('role','status');syncBar.setAttribute('aria-live','polite');
  $('topbarActions').before(syncBar);
  const loadBanner=el('div','data-load-banner');loadBanner.id='dataLoadBanner';loadBanner.setAttribute('role','alert');$('mainContent').prepend(loadBanner);
  const loadUnavailable=()=>LDDataLoad.unavailable(window.LDLoadInfo.status);
  function syncStatus(info) {
    // 后续真正拉取/同步成功时恢复读取展示；不更改同步控制器本身。
    const load=window.LDLoadInfo;
    if(info.status==='synced'&&info.lastCloud&&info.lastCloud!==load.cloudTimestamp&&['failed','snapshot'].includes(load.status)){
      window.LDLoadInfo={status:'cloud',cloudTimestamp:info.lastCloud};
    }
    document.documentElement.dataset.dataLoad=window.LDLoadInfo.status;
    loadBanner.hidden=!loadUnavailable();
    loadBanner.textContent=window.LDLoadInfo.status==='failed'?LDDataLoad.FAILURE:'正在加载数据，请稍候…';
    info=LDDataLoad.presentation(window.LDLoadInfo,info);
    const labels={'save-error':'本机保存失败',ready:'已载入',local:'本机已保存 · 待同步',syncing:'正在同步…',synced:'云端已同步',error:'同步失败 · 本机已保留',...LDDataLoad.LABELS};
    syncBar.dataset.status=info.status;
    syncBar.innerHTML=`<span>${labels[info.status] || '已载入'}</span>${info.lastCloud?`<time title="最近成功同步：${esc(new Date(info.lastCloud).toLocaleString('zh-CN'))}">${new Date(info.lastCloud).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</time>`:''}${info.status==='error'?btn('重试','retry-sync'):''}`;
    syncBar.title=info.error || (info.lastLocal?'本机保存：'+new Date(info.lastLocal).toLocaleString('zh-CN'):'');
    if($('syncBtnText'))$('syncBtnText').textContent='同步设置';
    if($('syncLastTime'))$('syncLastTime').textContent=info.lastCloud?new Date(info.lastCloud).toLocaleString('zh-CN'):'尚未成功同步';
    const box=$('syncStatusBox');
    if(box){box.className='sync-status';box.textContent=labels[info.status]+(info.error?'：'+info.error:'');}
  }
  document.addEventListener('ld-sync-state',e=>syncStatus(e.detail));syncController.emit();
  document.addEventListener('ld-load-state',()=>{syncStatus(syncController.getStatus());renderStats();if(['monthly','annual'].includes(activePage))renderMonthly();});
  const syncSettingsUpdate=updateSyncUI;
  updateSyncUI=function(){syncSettingsUpdate();syncController.emit();};

  function card(title,body,id,actions='') {const c=el('section','card',`<div class="card-header"><h2 class="card-title">${title}</h2>${actions}</div><div class="card-body">${body}</div>`);if(id)c.id=id;return c;}
  // Readable dates for summaries; tables keep ISO dates for scanning and sorting.
  const shortDate=d=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(d||'');if(!m)return d||'日期待补';const md=`${Number(m[2])}月${Number(m[3])}日`;return m[1]===today().slice(0,4)?md:`${m[1]}年${md}`;};
  const chevron='<svg class="row-chevron" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="m9 6 6 6-6 6"/></svg>';
  function createPage(id,title) {const p=el('div','page');p.id='page-'+id;$('mainContent').append(p);pageTitles[id]=title;return p;}
  const projectPage=createPage('projects','项目进展');
  const monthlyPage=createPage('monthly','月度 OKR');
  const annualPage=createPage('annual','年度总结');
  const closeoutPage=createPage('closeout','结项报告');
  const subbar=el('nav','module-tabs');subbar.setAttribute('aria-label','模块导航');$('mainContent').prepend(subbar);
  const legacyNav=document.querySelector('.sidebar-nav');legacyNav.hidden=true;legacyNav.id='legacyNav';
  const mainNav=el('nav','sidebar-nav primary-navigation');mainNav.setAttribute('aria-label','主导航');legacyNav.after(mainNav);
  const groups={
    overview:{label:'工作总览',icon:'<rect x="3.5" y="3.5" width="7" height="8" rx="1.8"/><rect x="13.5" y="3.5" width="7" height="5" rx="1.8"/><rect x="13.5" y="11.5" width="7" height="9" rx="1.8"/><rect x="3.5" y="14.5" width="7" height="6" rx="1.8"/>',pages:[['dashboard','培训大屏']]},
    records:{label:'台账',icon:'<rect x="4.5" y="3.5" width="15" height="17" rx="2.2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',pages:[['training','培训场次'],['aiknowledge','AI 内容'],['finance','金融百科'],['budget','预算与开销']]},
    projects:{label:'培训项目',icon:'<path d="m12 3.8 8.2 4.4L12 12.6 3.8 8.2z"/><path d="m3.8 12.2 8.2 4.4 8.2-4.4"/><path d="m3.8 16.1 8.2 4.4 8.2-4.4"/>',pages:[['projects','项目进展'],['closeout','结项报告']]},
    reports:{label:'工作汇报',icon:'<path d="M4.5 20h15"/><path d="M7 16.5v-5M12 16.5V7M17 16.5v-8"/>',pages:[['monthly','月度 OKR'],['annual','年度总结']]},
    managers:{label:'管理者发展',icon:'<circle cx="9" cy="8" r="3.2"/><path d="M3.8 19.5a5.2 5.2 0 0 1 10.4 0"/><path d="M16 5.5a3 3 0 0 1 0 5.6M17.5 14.2a5 5 0 0 1 2.7 5.3"/>',pages:[['caselib','案例与手册'],['assessment','测评报告']]}
  };
  for(const [key,g] of Object.entries(groups)){
    const b=el('button','primary-nav',`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${g.icon}</svg><span>${g.label}</span>`);b.type='button';b.dataset.group=key;b.addEventListener('click',()=>navigate(g.pages[0][0]));mainNav.append(b);
  }
  function groupFor(page){return Object.keys(groups).find(key=>groups[key].pages.some(p=>p[0]===page)) || 'overview';}
  function updateRoute(page) {
    activePage=page;const key=groupFor(page);
    mainNav.querySelectorAll('button').forEach(b=>{b.classList.toggle('active',b.dataset.group===key);b.setAttribute('aria-current',b.dataset.group===key?'page':'false');});
    subbar.innerHTML=groups[key].pages.map(([id,label])=>`<button class="module-tab ${id===page?'active':''}" data-action="navigate" data-record="${id}" aria-current="${id===page?'page':'false'}">${label}</button>`).join('');
    subbar.hidden=groups[key].pages.length===1;
    $('sidebar').classList.remove('open');document.querySelector('.sidebar-scrim')?.classList.remove('visible');
    if(page==='budget')switchBudgetTab('expense-list');
    if(page==='finance')switchFinanceView('stats');
    if(page==='monthly'||page==='annual'){renderMonthly();renderStats();}
    if(page==='dashboard'&&window.getDashboardAggregate){renderStats();renderCharts();renderOverview();}
    if(page==='projects')renderProjects();
    if(page==='closeout')renderCloseout();
  }
  // 结项报告：手写结论在前，系统记录在后；数字口径与月度/年度总结一致。
  function renderCloseout(){
    const C=window.LDCloseout;if(!C)return;
    const n=v=>Number(v).toLocaleString('zh-CN',{maximumFractionDigits:2});
    closeoutPage.innerHTML='<div class="section-heading"><h2>结项报告</h2><span>每个项目一页：先看结论，再看数据和经验</span></div>'+C.reports.map(r=>{
      const rec=C.records(state,r);
      const links=r.links.length?r.links.map(l=>`<a class="btn btn-secondary btn-sm" href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)}</a>`).join(''):'<span class="closeout-muted">完整报告：内部渠道查阅</span>';
      return `<section class="card closeout-card"><div class="card-header"><div><h2 class="card-title">${esc(r.name)}</h2><span class="closeout-muted">${esc(r.start)} 至 ${esc(r.end)} · 报告日期 ${esc(r.reportDate)}</span></div><span class="kind-tag" data-kind="finance">${esc(r.status)}</span></div><div class="card-body">
        <p class="summary-prose closeout-lead">${esc(r.conclusion)}</p>
        <div class="compact-metrics">${r.results.map(([v,l])=>`<div><strong>${esc(v)}</strong><span>${esc(l)}</span></div>`).join('')}</div>
        <p class="closeout-muted closeout-note">${esc(r.resultsNote)}</p>
        <ul class="report-list">${r.verdict.map(([k,v])=>`<li><span>${esc(k)}</span><span>${esc(v)}</span></li>`).join('')}</ul>
        <h3 class="closeout-sub">经验与风险</h3><ul class="closeout-lessons">${r.lessons.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>
        <h3 class="closeout-sub">系统记录（自动汇总）</h3><div class="compact-metrics"><div><strong>${rec.sessions}</strong><span>培训与辅导场次</span></div><div><strong>${n(rec.people)}</strong><span>参训人次</span></div><div><strong>${n(rec.hours)}</strong><span>总人时${rec.pending?`（${rec.pending} 条待补）`:''}</span></div></div>
        <p class="closeout-muted closeout-note">按培训记录中项目「${esc(r.project)}」、${esc(r.start)} 至 ${esc(r.end)} 汇总，与月度、年度总结同一口径。</p>
        <div class="closeout-links">${links}</div></div></section>`;
    }).join('');
  }
  function navigate(page) {
    const original=document.querySelector(`#legacyNav [data-page="${page}"]`);
    if(original){original.click();return;}
    document.querySelectorAll('.page').forEach(n=>n.classList.toggle('active',n.id==='page-'+page));
    $('pageTitle').textContent=pageTitles[page];updateRoute(page);window.scrollTo({top:0,behavior:'instant'});
  }
  document.querySelectorAll('#legacyNav .nav-item').forEach(n=>n.addEventListener('click',()=>updateRoute(n.dataset.page)));
  updateRoute('dashboard');

  // Common table filters: searches do not modify the underlying records.
  function addFilters(key,tableId,fields,{year=false,project=false,status=false}={}) {
    const table=$(tableId).closest('table'), wrap=table.closest('.table-wrap') || table.parentElement;
    const bar=el('div','record-filters',`<label>搜索<input type="search" data-filter="query" placeholder="${{sessions:'课程、讲师或备注',expenses:'用途说明或分类'}[key]||'期数、主题或备注'}"></label><label>${year?'年份':'月份'}<input type="${year?'number':'month'}" data-filter="period" ${year?'placeholder="全部年份" min="2000" max="2100"':''}></label>${project?'<label>项目<select data-filter="project"><option value="">全部项目</option></select></label>':''}${status?'<label>状态<select data-filter="status"><option value="">全部状态</option><option value="pending">待回收</option><option value="review">待核对</option><option value="collected">已回收</option><option value="draft">制作中</option></select></label>':''}<button class="btn btn-secondary" type="button" data-reset>清除筛选</button>`);
    wrap.before(bar);const pager=el('div','table-pagination');wrap.after(pager);
    filterState[key]={query:'',period:'',project:'',status:'',page:1,fields,bar,pager};
    bar.addEventListener('input',e=>{if(e.target.dataset.filter){filterState[key][e.target.dataset.filter]=e.target.value;filterState[key].page=1;refreshTables();}});
    bar.querySelector('[data-reset]').addEventListener('click',()=>{bar.querySelectorAll('input,select').forEach(n=>n.value='');Object.assign(filterState[key],{query:'',period:'',project:'',status:'',page:1});refreshTables();});
  }
  function records(key,source) {
    const f=filterState[key];if(!f)return source;
    let result=D.search(source,f.query,f.period,f.fields);
    if(f.project)result=result.filter(s=>trainingProjectName(s.project)===trainingProjectName(f.project));
    if(f.status)result=result.filter(s=>key==='stations'?D.stationMetric(s).status===f.status:(f.status==='collected'?'complete':f.status)===D.financeStatus(s).key);
    const pages=Math.max(1,Math.ceil(result.length/20));f.page=Math.min(f.page,pages);
    f.pager.innerHTML=`<span>共 ${result.length} 条 · 第 ${f.page} / ${pages} 页</span>${btn('上一页','page-prev',key)}${btn('下一页','page-next',key)}`;
    f.pager.querySelector('[data-action="page-prev"]').disabled=f.page===1;f.pager.querySelector('[data-action="page-next"]').disabled=f.page===pages;
    f.result=result;
    return result.slice((f.page-1)*20,f.page*20);
  }
  const actions=(kind,id,copy=false)=>`<div class="actions-row">${btn('编辑','edit-'+kind,id)}${copy?btn('复制','copy-session',id):''}<button type="button" class="btn btn-delete" data-action="delete-${kind}" data-record="${esc(id)}">删除</button></div>`;
  function rows(tbody,data,columns,render){
    const tb=$(tbody);tb.innerHTML=data.length?data.map(render).join(''):`<tr><td class="empty-cell" colspan="${columns}">暂无匹配记录</td></tr>`;
    // 手机端卡片布局：把表头写进每个单元格的 data-label，CSS 在窄屏下显示为“字段：值”。
    const table=tb.closest('table');table.classList.add('card-table');
    const heads=[...table.querySelectorAll('thead th')].map(th=>th.textContent.trim());
    tb.querySelectorAll('tr').forEach(tr=>[...tr.children].forEach((td,i)=>{if(heads[i]&&!td.classList.contains('empty-cell'))td.dataset.label=heads[i];}));
  }
  addFilters('sessions','sessionTable',['course','lecturer','project','note'],{project:true});
  addFilters('expenses','expenseTable',['desc','type'],{});
  // The expense add action closes the filter row instead of taking a row of its own.
  const expenseToolbar=$('panel-expense-list').querySelector('.record-toolbar');if(expenseToolbar){filterState.expenses.bar.append(...expenseToolbar.children);expenseToolbar.remove();}
  addFilters('stations','stationTable',['episode','title','note'],{year:true,status:true});
  addFilters('shares','shareTable',['episode','title','note'],{year:true});
  addFilters('finance','financeStatsTable',['episode','title','note'],{year:true,status:true});
  filterState.stations.bar.querySelector('option[value=draft]').remove();
  renderSessions=function(){
    const options=filterState.sessions.bar.querySelector('select');const selected=options.value;
    options.innerHTML='<option value="">全部项目</option>'+[...new Set(state.sessions.map(s=>trainingProjectName(s.project)).filter(Boolean))].sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');options.value=trainingProjectName(selected);
    rows('sessionTable',records('sessions',[...state.sessions].sort((a,b)=>String(b.date).localeCompare(a.date))),9,s=>`<tr><td>${esc(s.date)}</td><td>${esc(s.course)}${s.source==='ai_share'?'<small class="record-note">来自 AI 分享月</small>':''}</td><td>${esc(s.project)}</td><td>${esc(s.lecturer)}</td><td>${fmt(D.number(s.people))}</td><td>${fmt(D.number(s.duration))} h</td><td>${D.number(s.people)===null || D.number(s.duration)===null?'待补录':fmt(s.people*s.duration)}</td><td>${esc(s.note || '—')}</td><td>${actions('session',s.id,true)}</td></tr>`);
    // 筛选合计：和总览、月度汇报同一口径，人数或时长缺失的场次只计条数、不按 0 计入。
    const f=filterState.sessions,list=f.result||[],known=list.filter(x=>D.number(x.people)!==null&&D.number(x.duration)!==null);
    const people=list.reduce((n,x)=>n+(D.number(x.people)??0),0),hours=known.reduce((n,x)=>n+x.people*x.duration,0),missing=list.length-known.length;
    const scope=[f.period||'全部月份',f.project||'全部项目',f.query?`含“${f.query}”`:''].filter(Boolean).join(' · ');
    const table=$('sessionTable').closest('table');let foot=table.querySelector('tfoot');if(!foot){foot=document.createElement('tfoot');table.append(foot);}
    foot.innerHTML=list.length?`<tr class="table-total"><td data-label="筛选合计">筛选合计</td><td colspan="3">${esc(scope)} · ${list.length} 条${missing?` · ${missing} 条待补`:''}</td><td data-label="人次">${fmt(people)}</td><td></td><td data-label="人时">${fmt(Math.round(hours*100)/100)}</td><td colspan="2"></td></tr>`:'';
    for(const [input,field] of [['sessionProject','project'],['sessionLecturer','lecturer']]){
      let list=$(input+'-suggestions');if(!list){list=el('datalist');list.id=input+'-suggestions';document.body.append(list);$(input).setAttribute('list',list.id);}
      list.innerHTML=[...new Set(state.sessions.map(s=>s[field]).filter(Boolean))].map(v=>`<option value="${esc(v)}"></option>`).join('');
    }
  };
  renderExpenses=function(){rows('expenseTable',records('expenses',[...(state.expenses||[])].sort((a,b)=>String(b.date).localeCompare(a.date))),6,s=>`<tr><td>${esc(s.date)}</td><td>${esc(s.month)}</td><td>${s.type==='special'?'特殊项目':'常规项目'}</td><td>${money(s.amount)}</td><td>${esc(s.desc)}</td><td>${actions('expense',s.id)}</td></tr>`);renderExpenseSummary();};
  renderStations=function(){rows('stationTable',records('stations',[...state.aiStations].sort((a,b)=>b.episode-a.episode)),9,s=>{const m=D.stationMetric(s);return `<tr><td>${esc(D.stationLabel(s))}</td><td>${esc(s.date)}</td><td>${esc(s.title)}</td><td>${esc({news:'AI 新闻',tool:'AI 工具',paper:'AI 论文',thought:'AI 思考',mixed:'综合'}[s.category] || '综合')}</td><td>${m.status==='collected'?fmt(s.views):'—'}</td><td>${fmt(D.number(s.total))}</td><td><span class="data-state ${m.status}">${m.label}</span></td><td>${esc(s.note)}</td><td>${actions('station',s.id)}</td></tr>`;});renderAIOverview('station');};
  // AI 分享月 lists share records together with sessions entered under that project in 培训记录.
  renderShares=function(){rows('shareTable',records('shares',D.shareEvents(state)),9,s=>{const r=D.rate(s.people,s.total);return `<tr><td>${s.episode?`第 ${esc(s.episode)} 期`:'—'}</td><td>${esc(s.date)}</td><td>${esc(s.title)}${s.kind==='session'?'<small class="record-note">来自培训记录</small>':''}${/^https?:\/\//.test(s.materialUrl||'')?`<a class="record-note" target="_blank" rel="noopener" href="${esc(s.materialUrl)}">查看分享资料 ↗</a>`:''}</td><td>${fmt(s.people)}</td><td>${s.total===null?'—':fmt(s.total)}</td><td>${r!==null?r+'%':s.total===null?'—':'待回收'}</td><td>${s.minutes===null?'待补录':s.minutes+' 分钟'}</td><td>${esc(s.note)}</td><td>${actions(s.kind,s.id)}</td></tr>`;});renderAIOverview('share');};
  $('financeStatsTable').closest('table').querySelector('thead').innerHTML='<tr>'+['期数','主题','发布日期','状态','已读人数','查看率','下载人数','下载率','操作'].map(v=>'<th>'+v+'</th>').join('')+'</tr>';
  renderFinanceStatsTable=function(){rows('financeStatsTable',records('finance',[...(state.financeWiki||[])].sort((a,b)=>b.episode-a.episode)),9,s=>{const m=D.financeStatus(s),r=D.financeMetric(s,'read'),d=D.financeMetric(s,'downloads'),pendingRate=m.key==='review'?'待核对':'待回收';return `<tr><td>第 ${esc(s.episode)} 期</td><td>${esc(s.title)}</td><td>${esc(s.date||'待定')}</td><td><span class="data-state ${m.key}">${m.label}</span></td><td>${fmt(D.number(s.read))}</td><td>${r===null?pendingRate:r+'%'}</td><td>${fmt(D.number(s.downloads))}</td><td>${d===null?pendingRate:d+'%'}</td><td>${actions('finance',s.id)}</td></tr>`;});};
  const financeTitle=financeTaskTemplate.find(s=>s.stage==='copy');financeTitle.name='宣发文案';
  document.querySelector('[data-stage="copy"] .kanban-column-header span').textContent='宣发文案';
  document.querySelector('[data-stage="data"] .kanban-column-header span').textContent='已发布';
  getFinanceStage=function(item){if(D.financeStatus(item).key!=='draft')return 'data';for(const step of financeTaskTemplate.filter(s=>s.stage!=='data'))if(!item.workflow?.[step.stage] || step.stage==='publish')return step.stage;return 'publish';};
  renderFinanceHeatmap=function(){const container=$('financeTimeline');if(!container)return;const list=state.financeWiki||[],published=list.filter(s=>D.financeStatus(s).key!=='draft'),valid=published.map(s=>D.financeMetric(s,'read')).filter(n=>n!==null),pending=published.filter(s=>['pending','review'].includes(D.financeStatus(s).key));container.innerHTML=`<div class="compact-metrics"><div><strong>${published.length} / ${list.length}</strong><span>已发布期数</span></div><div><strong>${valid.length?(valid.reduce((a,b)=>a+b,0)/valid.length).toFixed(1)+'%':'—'}</strong><span>平均查看率 · ${valid.length} 期已回收</span></div><div><strong>${pending.length}</strong><span>已发布 · 待回收或核对</span></div></div>`;};

  // AI record drawers keep primary fields compact; workflows remain available on demand.
  function makeAIDrawer(kind) {
    const form=$(kind+'Form'), host=form.closest('.card');host.remove();
    const drawer=el('dialog','record-drawer'), title=kind==='station'?'广播站记录':'分享月记录';
    drawer.innerHTML=`<div class="modal-header"><h2>${title}</h2><button type="button" class="modal-close" aria-label="关闭编辑">×</button></div><div class="modal-body"></div>`;
    drawer.setAttribute('aria-label',title);drawer.querySelector('.modal-body').append(form);document.body.append(drawer);drawers[kind]=drawer;
    drawer.querySelector('.modal-close').onclick=()=>drawer.close();
    const cancel=el('button','btn btn-secondary','取消');cancel.type='button';cancel.onclick=()=>drawer.close();form.querySelector('.form-footer').prepend(cancel);
    form.addEventListener('reset',()=>{if(drawer.open)queueMicrotask(()=>drawer.close());});
    const details=el('details','optional-fields','<summary>分类与备注</summary>');const grid=form.querySelector('.form-grid');
    [kind==='station'?'stationCategory':null,kind+'Note'].filter(Boolean).forEach(id=>details.append($(id).closest('.form-group')));grid.append(details);
    const last=el('button','btn btn-secondary btn-sm','沿用上一期总人数');last.type='button';$(kind+'Total').after(last);
    last.onclick=()=>{const list=kind==='station'?state.aiStations:state.aiShares;const ep=Number($(kind+'Episode').value);const previous=[...list].filter(s=>!s.special && s.episode<ep && D.number(s.total)>0).sort((a,b)=>b.episode-a.episode)[0];if(!previous){showToast('没有可沿用的上一期总人数','info');return;}$(kind+'Total').value=previous.total;$(kind+'Total').dispatchEvent(new Event('input',{bubbles:true}));showToast(`已沿用第 ${previous.episode} 期总人数，请确认本期范围`,'info');};
    const note=el('p','field-help','回收数据可稍后补录；留空会显示“待回收”。');grid.before(note);
    return drawer;
  }
  makeAIDrawer('station');makeAIDrawer('share');
  ['shareAttendees','shareTotal','shareDuration'].forEach(id=>$(id).required=false);
  const material=el('div','form-group span-full','<label class="form-label" for="shareMaterialUrl">资料链接</label><input type="url" id="shareMaterialUrl" placeholder="选填，可供查看分享材料">');$('shareForm').querySelector('.form-grid').append(material);
  window.newStationEpisode=()=>{resetStationForm();stationEpisode.value=Math.max(0,...state.aiStations.filter(s=>!s.special).map(s=>s.episode))+1;stationDate.value=today();drawers.station.showModal();stationTitle.focus();};
  window.newShareEpisode=()=>{resetShareForm();shareEpisode.value=Math.max(0,...state.aiShares.map(s=>s.episode))+1;shareDate.value=today();drawers.share.showModal();shareTitle.focus();};
  window.editStation=id=>{const s=state.aiStations.find(s=>s.id===id);if(!s)return;stationId.value=s.id;stationEpisode.value=s.episode;stationDate.value=s.date;stationTitle.value=s.title;stationTotal.value=s.total??'';stationCategory.value=s.category||'mixed';stationNote.value=s.note||'';const m=D.stationMetric(s);stationUnviewed.value=m.status==='collected'?s.total-s.views:'';updateStationViewsHint();drawers.station.showModal();};
  window.editShare=id=>{const s=state.aiShares.find(s=>s.id===id);if(!s)return;for(const [field,key] of [['Id','id'],['Episode','episode'],['Date','date'],['Title','title'],['Attendees','attendees'],['Total','total'],['Duration','duration'],['Note','note'],['MaterialUrl','materialUrl']])$('share'+field).value=s[key]??'';drawers.share.showModal();};
  const existingSessionEdit=window.editSession;
  const deleteSessionOriginal=window.deleteSession;window.deleteSession=id=>{const record=state.sessions.find(s=>s.id===id);if(record?.source==='ai_share'){const share=state.aiShares.find(s=>s.id===record.sourceId||s.linkedSessionId===id);if(share){deleteShare(share.id);return;}}deleteSessionOriginal(id);};
  window.editSession=id=>{const record=state.sessions.find(s=>s.id===id);if(record?.source==='ai_share'){const share=state.aiShares.find(s=>s.id===record.sourceId || s.linkedSessionId===record.id);if(share){navigate('aiknowledge');document.querySelector('.ai-tab[data-tab="share"]').click();editShare(share.id);return;}}existingSessionEdit(id);};
  function copySession(id){const s=state.sessions.find(s=>s.id===id);if(!s)return;existingSessionEdit(id);sessionId.value='';sessionDate.value=today();$('sessionForm-heading').textContent='复制培训记录';showToast('已复制为新记录，请核对日期与人数','info');}
  function setupAIPanel(kind){
    const panel=$('panel-'+kind),workflow=panel.querySelector('.ai-kanban-card');
    const fold=el('details','workflow-fold','<summary>查看制作流程与历史步骤</summary>');fold.append(workflow);panel.append(fold);
    const chart=$(kind+'Chart').closest('.card');panel.prepend(chart);
    const overview=card(kind==='station'?'AI 广播站':'AI 分享月',`<div id="${kind}Overview"></div>`,kind+'OverviewCard',btn('＋ 新增一期','new-'+kind,'',true));panel.prepend(overview);
    panel.querySelectorAll('.ai-top-grid').forEach(n=>{if(!n.children.length)n.remove();});
    if(kind==='station')$('stationChart').closest('.card').classList.add('compact-chart');
    fold.addEventListener('toggle',()=>{if(fold.open){if(kind==='station')renderStationKanban();else renderShareKanban();}});
  }
  setupAIPanel('station');setupAIPanel('share');
  function renderAIOverview(kind){
    const host=$(kind+'Overview');if(!host)return;
    if(kind==='share'){
      const events=D.shareEvents(state),latest=events[0];
      if(!latest){host.innerHTML='<p class="empty-copy">还没有记录，可以先记下日期和主题。</p>';return;}
      const counted=events.filter(e=>e.people!==null),people=counted.reduce((n,e)=>n+e.people,0);
      host.innerHTML=`<div class="record-latest"><div><span class="record-kicker">最近一场 · ${esc(shortDate(latest.date))}</span><h3>${latest.episode?`第 ${esc(latest.episode)} 期 · `:''}${esc(latest.title)}</h3></div>${btn('编辑 / 补录','edit-'+latest.kind,latest.id)}</div><div class="compact-metrics"><div><strong>${events.length}</strong><span>累计场次</span></div><div><strong>${people.toLocaleString('zh-CN')}</strong><span>累计参与人次</span></div><div><strong>${counted.length?Math.round(people/counted.length):'—'}</strong><span>场均参与人数</span></div></div>`;
      return;
    }
    const list=[...state.aiStations].sort((a,b)=>b.episode-a.episode),latest=list[0];
    if(!latest){host.innerHTML='<p class="empty-copy">还没有记录，可以先记下期数、日期和主题。</p>';return;}
    const values=list.slice(0,6).map(s=>D.stationMetric(s).value).filter(n=>n!==null),pending=list.filter(s=>D.stationMetric(s).status!=='collected').length;
    host.innerHTML=`<div class="record-latest"><div><span class="record-kicker">最新一期 · ${esc(shortDate(latest.date))}</span><h3>${esc(D.stationLabel(latest))} · ${esc(latest.title)}</h3></div>${btn('编辑 / 补录','edit-station',latest.id)}</div><div class="compact-metrics"><div><strong>${list.length}</strong><span>累计期数</span></div><div><strong>${values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(1)+'%':'—'}</strong><span>最近 6 期平均查看率 · ${values.length} 期有数据</span></div><div><strong class="${pending?'is-warn':''}">${pending}</strong><span>待回收或核对</span></div></div>`;
  }

  // Finance publication state and workflow share one saved source of truth.
  const pub=el('div','form-group span-2','<label class="checkbox-line"><input type="checkbox" id="finPublished">已正式发布</label><small class="field-help">发布日期和发布状态用于列表、项目摘要与月度 OKR。</small>');$('financeForm').querySelector('.form-grid').append(pub);finDate.required=false;
  let financeDraft=null;const openFinance=window.openFinanceModal;
  window.openFinanceModal=function(id,temp){const item=temp||state.financeWiki.find(i=>i.id===id);if(!item)return;openFinance(id,temp);financeDraft=structuredClone(item);financeDraft.workflow||={};finPublished.checked=D.financeStatus(item).key!=='draft';renderFinanceDraft();};
  function renderFinanceDraft(){if(!financeDraft)return;$('finWorkflowChips').innerHTML=financeTaskTemplate.map(step=>`<button class="fin-chip ${financeDraft.workflow[step.stage]?'done':''}" type="button" data-action="finance-step" data-record="${step.stage}">${financeDraft.workflow[step.stage]?'✓ ':''}${step.name}</button>`).join('');}
  const financeForm=$('financeForm');financeForm.addEventListener('submit',e=>{
    const total=D.number(finTotal.value),read=D.number(finRead.value),downloads=D.number(finDownloads.value),unread=D.number(finUnread.value);
    let error='';if(finPublished.checked && !finDate.value)error='已发布期次需要填写发布日期';
    else if(state.financeWiki.some(s=>s.id!==finId.value && s.episode===Number(finEpisode.value)))error='该期数已存在';
    else if([read,downloads,unread].some(v=>v!==null && (!Number.isInteger(v)||v<0)))error='人数必须为非负整数';
    else if(total!==null && (!Number.isInteger(total)||total<=0))error='总人数必须为正整数';
    else if(total===null && ((read!==null && read!==D.number(financeDraft?.read)) || (downloads!==null && downloads!==D.number(financeDraft?.downloads))))error='请填写本期总人数以计算比率';
    else if(total && [read,downloads,unread].some(v=>v!==null&&v>total))error='人数不能超过本期总人数';
    if(error){e.preventDefault();e.stopImmediatePropagation();showToast(error,'error');return;}
    calculateFinanceRates();const existing=state.financeWiki.find(s=>s.id===finId.value);if(existing && financeDraft)existing.workflow=structuredClone(financeDraft.workflow);
  },true);
  financeForm.addEventListener('submit',()=>{const item=state.financeWiki.find(s=>s.id===finId.value);if(item && financeDraft){item.workflow={...financeDraft.workflow,publish:finPublished.checked,data:finPublished.checked&&!!financeDraft.workflow.data};persist();renderFinanceWiki();}});
  const finbar=document.querySelector('.fin-tab-bar'),finSegment=el('div','fin-segment');finSegment.setAttribute('role','tablist');finbar.prepend(finSegment);finSegment.append($('finView-stats'),$('finView-kanban'));$('finView-stats').lastChild.textContent=' 期次与统计';
  // Statistics view reads top-down: overall progress, the episode table, then the trend.
  const finStats=$('finStatsView'),finSummary=$('financeTimeline').closest('.card'),finGrid=finStats.querySelector('.stats-dashboard-grid'),finTrend=$('financeTrendChart').closest('.card');
  [finSummary,finSummary.querySelector('.card-body'),finGrid,finTrend,finTrend.querySelector('.card-body')].forEach(n=>n.removeAttribute('style'));
  finSummary.querySelector('.card-title').textContent='整体进度';finSummary.classList.add('fin-summary-card');finStats.prepend(finSummary);
  $('financeStatsTable').closest('.card').classList.add('fin-table-card');finGrid.classList.add('fin-chart-grid');finTrend.querySelector('.card-body').classList.add('fin-chart-body');
  // Remove the old arbitrary population default for newly created episodes.
  window.newFinanceEpisode=()=>{const item={id:uid(),episode:Math.max(0,...(state.financeWiki||[]).map(s=>s.episode))+1,title:'',date:'',read:null,unread:null,downloads:null,total:null,workflow:{},published:false};openFinanceModal(null,item);};

  const expenseSummary=el('div','expense-summary');$('panel-expense-list').prepend(expenseSummary);
  function renderExpenseSummary(){const month=filterState.expenses.period || currentMonth(),data=D.monthly(state,month);expenseSummary.innerHTML=`<div class="compact-metrics"><div><strong>${money(data.spend)}</strong><span>${esc(month)} 实际支出 · ${data.expenses.length} 笔</span></div><div><strong class="${data.budget===null?'is-empty':''}">${data.budget===null?'尚未设置预算':money(data.budget)}</strong><span>${data.budget===null?'可继续记录开销':'本月预算'}</span></div><div><strong class="${data.budget===null?'is-empty':''}">${data.budget===null?'—':money(data.budget-data.spend)}</strong><span>${data.budget===null?'设置预算后显示预实比较':'预算余额'}</span></div></div>`;}
  const budgetCompare=renderBudgetCompare;renderBudgetCompare=function(){budgetCompare();if(!state.budgets.length){const host=$('budgetCompareContainer');if(host)host.innerHTML='<p class="empty-copy">尚未设置预算。实际开销已正常记录，设置预算后可查看预实比较。</p>';}};

  // One selection survives navigation between overview and both report pages.
  const R=LDReport, selection={mode:'month',month:R.today().slice(0,7)};
  let reportSnapshot=null,exportSnapshot=null,exporting=false;
  const selected=mode=>R.aggregate(state,R.period(mode||selection.mode,selection.month));
  function setPeriod(mode,month=selection.month){const p=R.period(mode,month);selection.mode=p.mode;selection.month=p.month;renderStats();renderCharts();renderOverview();if(['monthly','annual'].includes(activePage))renderMonthly();}
  window.getDashboardAggregate=(scope='ytd')=>selected(scope==='selected'?selection.mode:scope);
  const dashboard=$('page-dashboard'),monthGrid=dashboard.querySelector('.stats-grid'),yearGrid=dashboard.querySelectorAll('.stats-grid')[1];
  const monthLabel=el('div','section-heading period-heading',`<h2 id="overviewPeriodTitle">本月概览</h2><div class="period-controls"><div class="period-switch" role="group" aria-label="统计范围"><button type="button" data-period="month">月度</button><button type="button" data-period="ytd">年度累计</button></div><label><span id="cutoffLabel">选择月份</span><input aria-label="统计月份" id="overviewMonth" type="month" max="${R.today().slice(0,7)}" value="${selection.month}"></label></div><span id="overviewRange"></span>`);monthGrid.before(monthLabel);
  monthLabel.querySelectorAll('[data-period]').forEach(b=>b.addEventListener('click',()=>setPeriod(b.dataset.period)));
  $('overviewMonth').addEventListener('change',e=>{if(e.target.value)setPeriod(selection.mode,e.target.value);else e.target.value=selection.month;});
  const annual=el('details','annual-summary','<summary>查看年度累计</summary>');yearGrid.before(annual);annual.append(yearGrid);
  const overviewExtra=el('div','overview-extra');annual.after(overviewExtra);
  function stat(id,value,label,description){const node=$(id);node.textContent=LDDataLoad.metric(value,window.LDLoadInfo.status);const card=node.closest('.stat-card');card.querySelector('.stat-label').textContent=label;card.querySelector('.stat-desc').textContent=loadUnavailable()?'未加载':description;}
  renderStats=function(){
    const main=selected(),fold=selected(selection.mode==='ytd'?'month':'ytd'),p=main.period;selection.month=p.month;
    const prefix=selection.mode==='ytd'?'年度累计':p.ongoing?'本月':`${Number(p.month.slice(5))} 月`;
    stat('statSessions',main.sessions.length,prefix+'培训场次',main.sessions.length?'最近：'+[...main.sessions].sort((a,b)=>b.date.localeCompare(a.date))[0].course:'暂无培训记录');
    stat('statHours',R.fmt(main.hours),prefix+'总人时',main.pending.hours?`${main.pending.hours} 条待补 · 已知人时合计`:'人数 × 时长');
    stat('statMonthPeople',R.fmt(main.people),prefix+'参训人次',main.pending.people?`${main.pending.people} 条人数待补`:'参加人次合计');
    stat('statMonthSpend',R.money(main.spend),prefix+'所有项目支出',main.pending.spend?`${main.pending.spend} 条金额待补`:'按归属月份 · 含常规与专项');
    const foldPrefix=selection.mode==='ytd'?`${Number(p.month.slice(5))} 月`:`${p.year} 年累计`;
    for(const [id,value,label,key] of [['statYearSessions',fold.sessions.length,'培训场次',null],['statYearPeople',R.fmt(fold.people),'参训人次','people'],['statYearHours',R.fmt(fold.hours),'总人时','hours'],['statYearSpend',R.money(fold.spend),'项目支出','spend']])stat(id,value,foldPrefix+label,key&&fold.pending[key]?`${fold.pending[key]} 条待补`:fold.period.range);
    $('overviewPeriodTitle').textContent=selection.mode==='ytd'?'年度累计':p.ongoing?'本月概览':'月度概览';
    $('overviewRange').textContent=p.range+(p.ongoing?' · 本月进行中':'');$('overviewMonth').value=p.month;$('overviewMonth').max=R.today().slice(0,7);$('cutoffLabel').textContent=selection.mode==='ytd'?'截至月份':'选择月份';
    monthLabel.querySelectorAll('[data-period]').forEach(b=>{b.classList.toggle('active',b.dataset.period===selection.mode);b.setAttribute('aria-pressed',String(b.dataset.period===selection.mode));});
    annual.querySelector('summary').textContent=selection.mode==='ytd'?`查看 ${Number(p.month.slice(5))} 月数据`:`查看 ${p.year} 年度累计（截至 ${Number(p.month.slice(5))} 月）`;
    document.querySelectorAll('[onclick="openMonthlyReportModal()"]').forEach(reportButton=>{const textNode=[...reportButton.childNodes].find(n=>n.nodeType===3&&n.textContent.trim());if(textNode)textNode.textContent=selection.mode==='ytd'?'年度总结':'月度 OKR';});
    if($('statFinanceTotal'))$('statFinanceTotal').textContent=(state.financeWiki||[]).length;
  };
  const byDateDesc=(a,b)=>String(b.date||'').localeCompare(String(a.date||''));
  // Only the confirmed fourth-cohort aliases share an identity; do not merge other cohorts.
  // Normalize at read time so record IDs, original names and cloud data remain untouched.
  function trainingProjectName(name){
    return /^AI赋能(?:训练营)?第四期$/.test(String(name??'').replace(/\s+/g,''))?'AI 赋能训练营第四期':name;
  }
  function projectSummaries(source=state){
    const sessions=source.sessions||[],shares=D.shareEvents(source),people=list=>list.reduce((n,r)=>n+(D.number(r.people)??0),0);
    const training=[...new Set(sessions.map(s=>trainingProjectName(s.project)).filter(p=>p&&!D.isShareProject(p)))].map(name=>{const records=sessions.filter(s=>trainingProjectName(s.project)===name).map(s=>({date:s.date,title:s.course,people:s.people}));return {name,page:'training',unit:'场',records,pending:records.filter(r=>D.number(r.people)===null).length,people:people(records)};});
    const list=[
      {name:'AI 广播站',page:'aiknowledge',tab:'station',unit:'期',records:source.aiStations,pending:source.aiStations.filter(s=>D.stationMetric(s).status!=='collected').length},
      {name:'AI 分享月',page:'aiknowledge',tab:'share',unit:'场',records:shares,pending:shares.filter(s=>s.people===null).length,people:people(shares)},
      {name:'金融小百科',page:'finance',unit:'期',records:source.financeWiki||[],pending:(source.financeWiki||[]).filter(s=>D.financeStatus(s).key==='pending').length,review:(source.financeWiki||[]).filter(s=>D.financeStatus(s).key==='review').length},
      ...training];
    // 项目状态与显示名由负责人确认；未登记的项目不加标签。筹备中的项目暂无记录。
    const meta={'AI 赋能训练营':{label:'AI 赋能训练营 · 第三期',status:'已结项'},'海外 HR 分享项目':{status:'已结项'},'新员工入职培训':{status:'阶段性已结项'},'金融小百科':{status:'已结项'},'AI 广播站':{status:'项目持续进行'},'AI 分享月':{status:'项目持续进行'},'2026管理者训练营 1.0':{status:'项目持续进行'}};
    list.forEach(p=>Object.assign(p,meta[p.name]||{}));
    const fourth=list.find(p=>p.name===trainingProjectName('AI 赋能第四期'));
    if(fourth)fourth.status='项目持续进行';
    else list.push({name:trainingProjectName('AI 赋能第四期'),unit:'场',records:[],status:'筹备中',note:'尚无培训记录'});
    list.forEach(p=>{p.latest=[...p.records].filter(r=>r.date).sort(byDateDesc)[0];});
    // 按状态分组：筹备中 → 持续进行 → 阶段性已结项 → 已结项；组内按最近更新排序。
    const order={'筹备中':0,'项目持续进行':1,'阶段性已结项':2,'已结项':3},rank=p=>order[p.status]??1;
    return list.sort((a,b)=>rank(a)-rank(b)||byDateDesc(a.latest||{},b.latest||{}));
  }
  function projectRows(max,source=state){
    return projectSummaries(source).slice(0,max).map(p=>{
      const last=p.latest,warn=p.pending||p.review,status=p.review?`${p.review} ${p.unit}待核对`:p.pending?`${p.pending} ${p.unit}待补录`:p.people!==undefined?`累计 ${p.people.toLocaleString('zh-CN')} 人次`:'数据已回收';
      const tag=p.status?`<span class="project-status" data-status="${esc(p.status)}">${esc(p.status)}</span>`:'';
      const main=`<span class="project-main"><span class="project-name">${esc(p.label||p.name)}${tag}</span><span class="project-latest">${last?`${esc(shortDate(last.date))} · ${esc(last.title||last.course)}`:esc(p.note||'暂无记录')}</span></span>`;
      if(!p.page)return `<div class="project-row is-static">${main}<span class="project-stat"><strong>—</strong><small>暂无数据</small></span><span></span></div>`;
      return `<button type="button" class="project-row" data-action="project-open" data-record="${esc(p.name)}">${main}<span class="project-stat"><strong>${p.records.length} ${p.unit}</strong><small class="${warn?'is-warn':''}">${status}</small></span>${chevron}</button>`;
    }).join('') || '<p class="empty-copy">暂无项目记录</p>';
  }
  function recentResults(source=state){
    const items=[...source.aiStations.map(s=>({...s,kind:'AI 广播站',key:'station'})),...D.shareEvents(source).map(s=>({...s,kind:'AI 分享月',key:'share'})),...(source.financeWiki||[]).filter(s=>D.financeStatus(s).key!=='draft').map(s=>({...s,kind:'金融小百科',key:'finance'}))].filter(s=>s.date).sort(byDateDesc).slice(0,4);
    return items.map(s=>`<li><button type="button" class="result-row" data-action="project-open" data-record="${s.kind}"><span class="result-main"><strong>${esc(s.title)}</strong><small><span class="kind-tag" data-kind="${s.key}">${s.kind}</span>${esc(shortDate(s.date))}</small></span>${chevron}</button></li>`).join('') || '<li class="empty-copy">暂无已记录成果</li>';
  }
  const linkBtn=(label,action,id)=>`<button type="button" class="link-btn" data-action="${action}" data-record="${esc(id)}">${esc(label)}</button>`;
  function overviewSource(){if(selection.mode!=='ytd')return state;const d=selected();return {sessions:d.sessions,aiStations:d.stations,aiShares:(state.aiShares||[]).filter(s=>s.date>=d.period.start&&s.date<=d.period.end),financeWiki:d.finance};}
  function renderOverview(){const ytd=selection.mode==='ytd',source=overviewSource();overviewExtra.innerHTML=`<section class="card"><div class="card-header"><h2 class="card-title">${ytd?'年度项目进展':'项目最近更新'}</h2>${linkBtn('全部项目','navigate','projects')}</div><div class="card-body list-body">${projectRows(4,source)}</div></section><section class="card"><div class="card-header"><h2 class="card-title">${ytd?'年度最新成果':'近期成果'}</h2>${linkBtn(ytd?'年度总结':'月度 OKR','navigate',ytd?'annual':'monthly')}</div><div class="card-body list-body"><ul class="result-list">${recentResults(source)}</ul></div></section>`;}
  function renderProjects(){projectPage.innerHTML='<div class="section-heading"><h2>项目进展</h2><span>从培训、发布和回收记录自动汇集，按筹备、进行、结项分组</span></div>'+`<section class="card"><div class="card-body list-body">${projectRows(100)}</div></section>`;}
  for(const [page,id,label] of [[monthlyPage,'summaryMonth','选择月份'],[annualPage,'annualMonth','截至月份']]){
    page.append(card(page===annualPage?'年度总结':'月度 OKR',`<div class="report-controls"><label for="${id}">${label}</label><input type="month" id="${id}" max="${R.today().slice(0,7)}" value="${selection.month}">${btn('导出设置','monthly-export')}</div><div id="${page===annualPage?'annualSummary':'monthlySummary'}"></div>`));
    $(id).addEventListener('change',e=>{if(e.target.value)setPeriod(page===annualPage?'ytd':'month',e.target.value);else e.target.value=selection.month;});
  }
  function renderMonthly(){
    const ytd=activePage==='annual';selection.mode=ytd?'ytd':'month';const d=selected();reportSnapshot=d;selection.month=d.period.month;
    $('summaryMonth').value=selection.month;$('annualMonth').value=selection.month;
    if(loadUnavailable()){
      reportSnapshot=null;
      $(ytd?'annualSummary':'monthlySummary').innerHTML=`<p class="field-help">${window.LDLoadInfo.status==='failed'?LDDataLoad.FAILURE:'正在加载数据，请稍候…'}</p><div class="compact-metrics">${['培训场次','培训人时','参训人次','实际支出'].map(label=>`<div><strong>—</strong><span>${label} · 未加载</span></div>`).join('')}</div>`;
      return;
    }
    const list=(rows,empty)=>rows.join('')||`<li>${empty}</li>`;
    $(ytd?'annualSummary':'monthlySummary').innerHTML=(ytd?'':okrBlock(d.period.month))+`<h3 class="report-month">${esc(d.period.title)} ${ytd?'学习发展工作摘要':'本月数据'}</h3><p class="field-help">${d.period.range}${d.period.ongoing?' · 本月进行中':''} · 按当前已录入记录汇总，后续补录会更新本报告</p><div class="compact-metrics"><div><strong>${d.sessions.length}</strong><span>培训场次</span></div><div><strong>${R.fmt(d.hours)}</strong><span>培训人时${d.pending.hours?' · '+d.pending.hours+' 条待补':''}</span></div><div><strong>${R.fmt(d.people)}</strong><span>参训人次${d.pending.people?' · '+d.pending.people+' 条待补':''}</span></div><div><strong>${R.money(d.spend)}</strong><span>实际支出${d.pending.spend?' · '+d.pending.spend+' 条待补':''}</span></div></div><p class="summary-prose">期间记录 ${d.stations.length} 期 AI 广播站、${d.shares.length} 场 AI 分享月、${d.finance.length} 期已发布金融百科。广播站 ${d.pending.stations} 期待回收或核对；金融百科 ${d.pending.finance} 期待回收、${d.pending.financeReview} 期待核对。${esc(R.budgetNote(d))}。参训人数按人次累加；AI 分享的关联培训只计一次。</p><h3>培训明细</h3><ul class="report-list">${list(d.sessions.map(s=>`<li><span>${esc(s.date)} · ${esc(s.course)}</span><span>${R.fmt(D.number(s.people))} 人次 · ${R.fmt(R.hours(s))} 人时</span></li>`),'期间暂无培训记录')}</ul><h3>内容成果</h3><ul class="report-list">${list([...d.stations.map(s=>({...s,kind:'AI 广播站'})),...d.shares.map(s=>({...s,kind:'AI 分享月'})),...d.finance.map(s=>({...s,kind:'金融小百科'}))].sort((a,b)=>String(b.date).localeCompare(a.date)).map(s=>`<li><span>${esc(s.date)} · ${s.kind}${s.special?' 特别篇':s.episode?`第 ${esc(s.episode)} 期`:""}</span><span>${esc(s.title)}</span></li>`),'期间暂无内容发布记录')}</ul><h3>开销明细</h3><ul class="report-list">${list(d.expenses.map(s=>`<li><span>${esc(s.date)} · ${esc(s.desc)}<small class="record-note">归属月份 ${esc(s.month)}</small></span><span>${R.money(D.number(s.amount))}</span></li>`),'期间暂无开销记录')}</ul>`;
  }
  // 月度 OKR：上半部分是目标与结果（手写，来自 OKR 文档），下半部分是系统自动汇总的本月数据。
  function okrBlock(month){
    const os=window.LDOkr&&LDOkr.forMonth(month);
    if(!os)return `<div class="okr-empty">本月 OKR 未整理，下方为系统自动汇总的本月数据。</div>`;
    const c=LDOkr.count(month);
    const src=LDOkr.sourceNote?LDOkr.sourceNote(month):'';
    return `<div class="okr-block"><p class="field-help">${c.objectives} 个目标 · ${c.krs} 项关键结果 · 已完成 ${c.done} 项${src?`　｜　${esc(src)}`:''}</p>${os.map((o,i)=>`<section class="okr-objective"><h3>O${i+1}　${esc(o.o)}</h3><ul class="okr-krs">${o.krs.map(([kr,st,res])=>`<li><span class="okr-status okr-${{'完成':'done','进行中':'doing','部分完成':'partial','改期':'moved'}[st]||'doing'}">${esc(st)}</span><div><strong>${esc(kr)}</strong><span>${esc(res)}</span></div></li>`).join('')}</ul></section>`).join('')}</div>`;
  }
  window.openMonthlyReportModal=()=>navigate(selection.mode==='ytd'?'annual':'monthly');
  function openExportSettings(){
    if(loadUnavailable()){showToast(LDDataLoad.FAILURE,'error');return;}
    exportSnapshot=structuredClone(reportSnapshot||selected());const d=exportSnapshot;
    $('monthlyReportModal').querySelector('.modal-header').textContent='生成'+(d.period.mode==='ytd'?'年度':'月度')+'总结报告';
    const select=$('reportMonthSelect');select.innerHTML=`<option>${esc(d.period.title)}（${d.period.range}）</option>`;select.disabled=true;select.previousElementSibling.textContent='导出范围（与当前报告一致）';$('monthlyReportModal').classList.add('active');
  }
  window.generateMonthlyReport=async()=>{
    if(loadUnavailable()){showToast(LDDataLoad.FAILURE,'error');return;}
    if(exporting)return;const pdf=$('exportPdfCheck').checked,xlsx=$('exportExcelCheck').checked;if(!pdf&&!xlsx){showToast('请至少选择一种导出格式','error');return;}
    const d=exportSnapshot||selected(),opts=Object.fromEntries(['includeTraining','includeBudget','includeAI','includeFinance'].map(k=>[k,$(k).checked]));const model=R.model(d,opts);
    exporting=true;closeMonthlyReportModal();showToast('正在生成报告…','info');
    try{if(pdf)await LDReportExport.pdf(model);if(xlsx)LDReportExport.excel(model);showToast('报告生成成功','success');}catch(err){console.error(err);showToast('报告生成失败：'+err.message,'error');}finally{exporting=false;}
  };
  const originalExcel=window.exportExcel;
  window.exportExcel=()=>{
    if(loadUnavailable()){showToast(LDDataLoad.FAILURE,'error');return;}
    if(!['dashboard','monthly','annual'].includes(activePage))return originalExcel();
    try{const d=activePage==='dashboard'?selected():reportSnapshot;LDReportExport.excel(R.model(d));showToast('Excel 已生成','success');}catch(err){console.error(err);showToast('Excel 生成失败：'+err.message,'error');}
  };
  const originalPdf=window.exportPdf;
  window.exportPdf=async()=>{
    if(loadUnavailable()){showToast(LDDataLoad.FAILURE,'error');return;}
    if(!['dashboard','monthly','annual'].includes(activePage))return originalPdf();if(exporting)return;exporting=true;
    try{const d=activePage==='dashboard'?selected():reportSnapshot;showToast('正在生成完整报告…','info');await LDReportExport.pdf(R.model(d));showToast('PDF 已生成','success');}catch(err){console.error(err);showToast('PDF 生成失败：'+err.message,'error');}finally{exporting=false;}
  };
  renderStats();renderCharts();

  // Content libraries: keep useful case situations, reduce repeated introductions.
  document.querySelector('.case-hero-subtitle')?.remove();document.querySelector('.case-hero-desc')?.remove();document.querySelector('.case-stats')?.remove();
  const caseHeader=document.querySelector('.case-hero');caseHeader.append(el('p','field-help','按管理情境查找案例，按国家查找手册。'));
  const caseSearch=el('div','library-search','<label>查找案例与手册<input type="search" id="caseSearch" placeholder="主题、国家或关键词"></label><span id="caseSearchCount" role="status"></span>');caseHeader.after(caseSearch);
  const caseCards=[...document.querySelectorAll('.case-card,.case-playbook-card')];
  $('caseSearch').addEventListener('input',()=>{const q=$('caseSearch').value.trim().toLowerCase();let found=0;caseCards.forEach(c=>{const match=!q||c.textContent.toLowerCase().includes(q);c.hidden=!match;if(match)found++;});document.querySelectorAll('.case-tab-panel').forEach(p=>{p.classList.toggle('search-all',!!q);});$('caseSearchCount').textContent=q?`找到 ${found} 项`:'';});
  const assessHome=$('assess-home'), assessSearch=el('div','library-search','<label>查找已载入报告<input type="search" id="assessmentSearch" placeholder="姓名、部门或年份"></label><span class="field-help">其他年度可从年度入口进入</span>');assessHome.prepend(assessSearch);const resultBox=el('div','assessment-search-results');assessSearch.after(resultBox);
  const sourceCards=[...document.querySelectorAll('.assess-manager-card')];
  $('assessmentSearch').addEventListener('input',()=>{const q=$('assessmentSearch').value.trim().toLowerCase();resultBox.replaceChildren();resultBox.hidden=!q;if(!q)return;const matches=sourceCards.filter(c=>((c.closest('[id^="assess-detail-"]')?.id||'')+' '+c.textContent).toLowerCase().includes(q));const count=el('p','field-help',`找到 ${matches.length} 份已载入报告`);resultBox.append(count);for(const c of matches){const copy=c.cloneNode(true);copy.removeAttribute('id');const year=c.closest('[id^="assess-detail-"]')?.id.split('-').at(-1);copy.prepend(el('span','report-year',esc(year)));copy.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();copy.click();}});resultBox.append(copy);}});
  const latestTeam=document.querySelector('#assess-detail-2025 .assess-team-banner');
  if(latestTeam){const copy=latestTeam.cloneNode(true);copy.removeAttribute('id');copy.classList.add('latest-team-report');assessSearch.after(copy);}
  document.querySelectorAll('.assess-year-card[onclick],.assess-manager-card[onclick]').forEach(n=>{n.tabIndex=0;n.setAttribute('role','button');n.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();n.click();}});});

  function refreshTables(){renderSessions();renderExpenses();renderStations();renderShares();renderFinanceStatsTable();}
  function refresh(){if(refreshing)return;refreshing=true;try{refreshTables();renderOverview();if(activePage==='projects')renderProjects();if(activePage==='monthly'||activePage==='annual')renderMonthly();}finally{refreshing=false;}}
  document.addEventListener('ld-data-updated',()=>queueMicrotask(refresh));
  document.addEventListener('click',async e=>{
    const target=e.target.closest('[data-action]');if(!target)return;const action=target.dataset.action,id=target.dataset.record;
    if(action==='navigate')navigate(id);
    else if(action==='retry-sync'){try{await pushToCloud();}catch(err){showToast(err.message,'error');}}
    else if(action==='new-station')newStationEpisode();else if(action==='new-share')newShareEpisode();
    else if(action==='copy-session')copySession(id);
    else if(action==='page-prev'||action==='page-next'){filterState[id].page+=action==='page-next'?1:-1;refreshTables();}
    else if(action==='monthly-export')openExportSettings();
    else if(action==='project-open'){const p=projectSummaries().find(p=>p.name===id);if(p){navigate(p.page);if(p.tab)document.querySelector(`.ai-tab[data-tab="${p.tab}"]`).click();if(p.page==='training'){filterState.sessions.project=p.name;filterState.sessions.page=1;filterState.sessions.bar.querySelector('select').value=p.name;renderSessions();}}}
    else if(action==='finance-step' && financeDraft){financeDraft.workflow[id]=!financeDraft.workflow[id];if(id==='publish')finPublished.checked=!!financeDraft.workflow.publish;renderFinanceDraft();}
    else if(action.startsWith('edit-'))({session:editSession,expense:editExpense,station:editStation,share:editShare,finance:openFinanceModal}[action.slice(5)])?.(id);
    else if(action.startsWith('delete-'))({session:deleteSession,expense:deleteExpense,station:deleteStation,share:deleteShare,finance:deleteEpisodeFromTable}[action.slice(7)])?.(id);
  });
  refresh();
})();
