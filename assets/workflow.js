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
  function syncStatus(info) {
    const labels={'save-error':'本机保存失败',ready:'已载入',local:'本机已保存 · 待同步',syncing:'正在同步…',synced:'云端已同步',error:'同步失败 · 本机已保留'};
    syncBar.dataset.status=info.status;
    syncBar.innerHTML=`<span>${labels[info.status] || '已载入'}</span>${info.lastCloud?`<time title="最近成功同步">${new Date(info.lastCloud).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'})}</time>`:''}${info.status==='error'?btn('重试','retry-sync'):''}`;
    syncBar.title=info.error || (info.lastLocal?'本机保存：'+new Date(info.lastLocal).toLocaleString('zh-CN'):'');
    if($('syncBtnText'))$('syncBtnText').textContent='同步设置';
    const box=$('syncStatusBox');
    if(box){box.className='sync-status';box.textContent=labels[info.status]+(info.error?'：'+info.error:'');}
  }
  document.addEventListener('ld-sync-state',e=>syncStatus(e.detail));syncController.emit();
  const syncSettingsUpdate=updateSyncUI;
  updateSyncUI=function(){syncSettingsUpdate();syncController.emit();};

  function card(title,body,id) {const c=el('section','card',`<div class="card-header"><h2 class="card-title">${title}</h2></div><div class="card-body">${body}</div>`);if(id)c.id=id;return c;}
  function createPage(id,title) {const p=el('div','page');p.id='page-'+id;$('mainContent').append(p);pageTitles[id]=title;return p;}
  const projectPage=createPage('projects','项目进展');
  const monthlyPage=createPage('monthly','月度总结');
  const subbar=el('nav','module-tabs');subbar.setAttribute('aria-label','模块导航');$('mainContent').prepend(subbar);
  const legacyNav=document.querySelector('.sidebar-nav');legacyNav.hidden=true;legacyNav.id='legacyNav';
  const mainNav=el('nav','sidebar-nav primary-navigation');mainNav.setAttribute('aria-label','主导航');legacyNav.after(mainNav);
  const groups={overview:{label:'工作总览',icon:0,pages:[['dashboard','培训大屏']]},records:{label:'记录',icon:1,pages:[['training','培训记录'],['aiknowledge','AI 内容'],['finance','金融百科'],['budget','预算与开销']]},projects:{label:'项目',icon:3,pages:[['projects','项目进展']]},results:{label:'成果与报告',icon:5,pages:[['caselib','案例与手册'],['assessment','测评报告'],['monthly','月度总结']]}};
  for(const [key,g] of Object.entries(groups)){
    const b=el('button','primary-nav',`<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 14h6"/></svg><span>${g.label}</span>`);b.type='button';b.dataset.group=key;b.dataset.moduleIcon=g.icon;b.addEventListener('click',()=>navigate(g.pages[0][0]));mainNav.append(b);
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
    if(page==='monthly')renderMonthly();
    if(page==='projects')renderProjects();
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
    const bar=el('div','record-filters',`<label>搜索<input type="search" data-filter="query" placeholder="${key==='sessions'?'课程、讲师或备注':'期数、主题或备注'}"></label><label>${year?'年份':'月份'}<input type="${year?'number':'month'}" data-filter="period" ${year?'placeholder="全部年份" min="2000" max="2100"':''}></label>${project?'<label>项目<select data-filter="project"><option value="">全部项目</option></select></label>':''}${status?'<label>状态<select data-filter="status"><option value="">全部状态</option><option value="pending">待回收</option><option value="review">待核对</option><option value="collected">已回收</option><option value="draft">制作中</option></select></label>':''}<button class="btn btn-secondary" type="button" data-reset>清除筛选</button>`);
    wrap.before(bar);const pager=el('div','table-pagination');wrap.after(pager);
    filterState[key]={query:'',period:'',project:'',status:'',page:1,fields,bar,pager};
    bar.addEventListener('input',e=>{if(e.target.dataset.filter){filterState[key][e.target.dataset.filter]=e.target.value;filterState[key].page=1;refreshTables();}});
    bar.querySelector('[data-reset]').addEventListener('click',()=>{bar.querySelectorAll('input,select').forEach(n=>n.value='');Object.assign(filterState[key],{query:'',period:'',project:'',status:'',page:1});refreshTables();});
  }
  function records(key,source) {
    const f=filterState[key];if(!f)return source;
    let result=D.search(source,f.query,f.period,f.fields);
    if(f.project)result=result.filter(s=>s.project===f.project);
    if(f.status)result=result.filter(s=>key==='stations'?D.stationMetric(s).status===f.status:(f.status==='collected'?'complete':f.status)===D.financeStatus(s).key);
    const pages=Math.max(1,Math.ceil(result.length/20));f.page=Math.min(f.page,pages);
    f.pager.innerHTML=`<span>共 ${result.length} 条 · 第 ${f.page} / ${pages} 页</span>${btn('上一页','page-prev',key)}${btn('下一页','page-next',key)}`;
    f.pager.querySelector('[data-action="page-prev"]').disabled=f.page===1;f.pager.querySelector('[data-action="page-next"]').disabled=f.page===pages;
    return result.slice((f.page-1)*20,f.page*20);
  }
  const actions=(kind,id,copy=false)=>`<div class="actions-row">${btn('编辑','edit-'+kind,id)}${copy?btn('复制','copy-session',id):''}<button type="button" class="btn btn-delete" data-action="delete-${kind}" data-record="${esc(id)}">删除</button></div>`;
  function rows(tbody,data,columns,render){$(tbody).innerHTML=data.length?data.map(render).join(''):`<tr><td class="empty-cell" colspan="${columns}">暂无匹配记录</td></tr>`;}
  addFilters('sessions','sessionTable',['course','lecturer','project','note'],{project:true});
  addFilters('expenses','expenseTable',['desc','type'],{});
  addFilters('stations','stationTable',['episode','title','note'],{year:true,status:true});
  addFilters('shares','shareTable',['episode','title','note'],{year:true});
  addFilters('finance','financeStatsTable',['episode','title','note'],{year:true,status:true});
  filterState.finance.bar.querySelector('option[value=review]').remove();filterState.stations.bar.querySelector('option[value=draft]').remove();
  renderSessions=function(){
    const options=filterState.sessions.bar.querySelector('select');const selected=options.value;
    options.innerHTML='<option value="">全部项目</option>'+[...new Set(state.sessions.map(s=>s.project).filter(Boolean))].sort().map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');options.value=selected;
    rows('sessionTable',records('sessions',[...state.sessions].sort((a,b)=>String(b.date).localeCompare(a.date))),9,s=>`<tr><td>${esc(s.date)}</td><td>${esc(s.course)}${s.source==='ai_share'?'<small class="record-note">来自 AI 分享月</small>':''}</td><td>${esc(s.project)}</td><td>${esc(s.lecturer)}</td><td>${fmt(D.number(s.people))}</td><td>${fmt(D.number(s.duration))} h</td><td>${D.number(s.people)===null || D.number(s.duration)===null?'待补录':fmt(s.people*s.duration)}</td><td>${esc(s.note || '—')}</td><td>${actions('session',s.id,true)}</td></tr>`);
    for(const [input,field] of [['sessionProject','project'],['sessionLecturer','lecturer']]){
      let list=$(input+'-suggestions');if(!list){list=el('datalist');list.id=input+'-suggestions';document.body.append(list);$(input).setAttribute('list',list.id);}
      list.innerHTML=[...new Set(state.sessions.map(s=>s[field]).filter(Boolean))].map(v=>`<option value="${esc(v)}"></option>`).join('');
    }
  };
  renderExpenses=function(){rows('expenseTable',records('expenses',[...(state.expenses||[])].sort((a,b)=>String(b.date).localeCompare(a.date))),6,s=>`<tr><td>${esc(s.date)}</td><td>${esc(s.month)}</td><td>${s.type==='special'?'特殊项目':'常规项目'}</td><td>${money(s.amount)}</td><td>${esc(s.desc)}</td><td>${actions('expense',s.id)}</td></tr>`);renderExpenseSummary();};
  renderStations=function(){rows('stationTable',records('stations',[...state.aiStations].sort((a,b)=>b.episode-a.episode)),9,s=>{const m=D.stationMetric(s);return `<tr><td>第 ${esc(s.episode)} 期</td><td>${esc(s.date)}</td><td>${esc(s.title)}</td><td>${esc({news:'AI 新闻',tool:'AI 工具',paper:'AI 论文',thought:'AI 思考',mixed:'综合'}[s.category] || '综合')}</td><td>${m.status==='collected'?fmt(s.views):'—'}</td><td>${fmt(D.number(s.total))}</td><td><span class="data-state ${m.status}">${m.label}</span></td><td>${esc(s.note)}</td><td>${actions('station',s.id)}</td></tr>`;});renderAIOverview('station');};
  renderShares=function(){rows('shareTable',records('shares',[...state.aiShares].sort((a,b)=>b.episode-a.episode)),9,s=>`<tr><td>第 ${esc(s.episode)} 期</td><td>${esc(s.date)}</td><td>${esc(s.title)}${/^https?:\/\//.test(s.materialUrl||'')?`<a class="record-note" target="_blank" rel="noopener" href="${esc(s.materialUrl)}">查看分享资料 ↗</a>`:''}</td><td>${fmt(D.number(s.attendees))}</td><td>${fmt(D.number(s.total))}</td><td>${D.rate(s.attendees,s.total)===null?'待回收':D.rate(s.attendees,s.total)+'%'}</td><td>${fmt(D.number(s.duration))} 分钟</td><td>${esc(s.note)}</td><td>${actions('share',s.id)}</td></tr>`);renderAIOverview('share');};
  $('financeStatsTable').closest('table').querySelector('thead').innerHTML='<tr>'+['期数','主题','发布日期','状态','已读人数','查看率','下载人数','下载率','操作'].map(v=>'<th>'+v+'</th>').join('')+'</tr>';
  renderFinanceStatsTable=function(){rows('financeStatsTable',records('finance',[...(state.financeWiki||[])].sort((a,b)=>b.episode-a.episode)),9,s=>{const m=D.financeStatus(s),r=D.financeMetric(s,'read'),d=D.financeMetric(s,'downloads');return `<tr><td>第 ${esc(s.episode)} 期</td><td>${esc(s.title)}</td><td>${esc(s.date||'待定')}</td><td><span class="data-state ${m.key}">${m.label}</span></td><td>${fmt(D.number(s.read))}</td><td>${r===null?'待回收':r+'%'}</td><td>${fmt(D.number(s.downloads))}</td><td>${d===null?'待回收':d+'%'}</td><td>${actions('finance',s.id)}</td></tr>`;});};
  const financeTitle=financeTaskTemplate.find(s=>s.stage==='copy');financeTitle.name='宣发文案';
  document.querySelector('[data-stage="copy"] .kanban-column-header span').textContent='宣发文案';
  document.querySelector('[data-stage="data"] .kanban-column-header span').textContent='已发布';
  getFinanceStage=function(item){if(D.financeStatus(item).key!=='draft')return 'data';for(const step of financeTaskTemplate.filter(s=>s.stage!=='data'))if(!item.workflow?.[step.stage] || step.stage==='publish')return step.stage;return 'publish';};
  renderFinanceHeatmap=function(){const container=$('financeTimeline');if(!container)return;const list=state.financeWiki||[],published=list.filter(s=>D.financeStatus(s).key!=='draft'),valid=published.map(s=>D.financeMetric(s,'read')).filter(n=>n!==null),pending=published.filter(s=>D.financeStatus(s).key==='pending');container.innerHTML=`<div class="compact-metrics"><div><strong>${published.length} / ${list.length}</strong><span>已发布期数</span></div><div><strong>${valid.length?(valid.reduce((a,b)=>a+b,0)/valid.length).toFixed(1)+'%':'—'}</strong><span>平均查看率 · ${valid.length} 期已回收</span></div><div><strong>${pending.length}</strong><span>已发布待回收</span></div></div>`;};
  const originalMonthly=getMonthlyData;getMonthlyData=function(month){const data=originalMonthly(month);data.finance.published=data.finance.items.filter(s=>D.financeStatus(s).key!=='draft').length;return data;};

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
    last.onclick=()=>{const list=kind==='station'?state.aiStations:state.aiShares;const ep=Number($(kind+'Episode').value);const previous=[...list].filter(s=>s.episode<ep && D.number(s.total)>0).sort((a,b)=>b.episode-a.episode)[0];if(!previous){showToast('没有可沿用的上一期总人数','info');return;}$(kind+'Total').value=previous.total;$(kind+'Total').dispatchEvent(new Event('input',{bubbles:true}));showToast(`已沿用第 ${previous.episode} 期总人数，请确认本期范围`,'info');};
    const note=el('p','field-help','回收数据可稍后补录；留空会显示“待回收”。');grid.before(note);
    return drawer;
  }
  makeAIDrawer('station');makeAIDrawer('share');
  ['shareAttendees','shareTotal','shareDuration'].forEach(id=>$(id).required=false);
  const material=el('div','form-group span-full','<label class="form-label" for="shareMaterialUrl">资料链接</label><input type="url" id="shareMaterialUrl" placeholder="选填，可供查看分享材料">');$('shareForm').querySelector('.form-grid').append(material);
  window.newStationEpisode=()=>{resetStationForm();stationEpisode.value=Math.max(0,...state.aiStations.map(s=>s.episode))+1;stationDate.value=today();drawers.station.showModal();stationTitle.focus();};
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
    const overview=card(kind==='station'?'AI 广播站':'AI 分享月',`<div id="${kind}Overview"></div><div class="record-toolbar">${btn('新增一期','new-'+kind,'',true)}</div>`,kind+'OverviewCard');panel.prepend(overview);
    panel.querySelectorAll('.ai-top-grid').forEach(n=>{if(!n.children.length)n.remove();});
    if(kind==='station')$('stationChart').closest('.card').classList.add('compact-chart');
    fold.addEventListener('toggle',()=>{if(fold.open){if(kind==='station')renderStationKanban();else renderShareKanban();}});
  }
  setupAIPanel('station');setupAIPanel('share');
  function renderAIOverview(kind){const host=$(kind+'Overview');if(!host)return;const list=[...(kind==='station'?state.aiStations:state.aiShares)].sort((a,b)=>b.episode-a.episode),latest=list[0];if(!latest){host.innerHTML='<p class="empty-copy">还没有记录，可以先记下期数、日期和主题。</p>';return;}const sample=list.slice(0,6),values=sample.map(s=>kind==='station'?D.stationMetric(s).value:D.rate(s.attendees,s.total)).filter(n=>n!==null);const pending=list.filter(s=>kind==='station'?D.stationMetric(s).status!=='collected':D.rate(s.attendees,s.total)===null).length;host.innerHTML=`<div class="record-latest"><div><span class="record-note">最新一期 · ${esc(latest.date)}</span><h3>第 ${esc(latest.episode)} 期 · ${esc(latest.title)}</h3></div>${btn('编辑 / 补录','edit-'+kind,latest.id)}</div><div class="compact-metrics"><div><strong>${list.length}</strong><span>累计期数</span></div><div><strong>${values.length?(values.reduce((a,b)=>a+b,0)/values.length).toFixed(1)+'%':'—'}</strong><span>最近 6 期平均${kind==='station'?'查看':'参与'}率 · ${values.length} 期有数据</span></div><div><strong>${pending}</strong><span>待回收或核对</span></div></div>`;}

  // Finance publication state and workflow share one saved source of truth.
  const pub=el('div','form-group span-2','<label class="checkbox-line"><input type="checkbox" id="finPublished">已正式发布</label><small class="field-help">发布日期和发布状态用于列表、项目摘要与月度总结。</small>');$('financeForm').querySelector('.form-grid').append(pub);finDate.required=false;
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
  const finbar=document.querySelector('.fin-tab-bar');finbar.prepend($('finView-stats'));$('finView-stats').lastChild.textContent=' 期次与统计';
  // Remove the old arbitrary population default for newly created episodes.
  window.newFinanceEpisode=()=>{const item={id:uid(),episode:Math.max(0,...(state.financeWiki||[]).map(s=>s.episode))+1,title:'',date:'',read:null,unread:null,downloads:null,total:null,workflow:{},published:false};openFinanceModal(null,item);};

  const expenseSummary=el('div','expense-summary');$('panel-expense-list').prepend(expenseSummary);
  function renderExpenseSummary(){const month=filterState.expenses.period || currentMonth(),data=D.monthly(state,month);expenseSummary.innerHTML=`<div class="compact-metrics"><div><strong>${money(data.spend)}</strong><span>${esc(month)} 实际支出 · ${data.expenses.length} 笔</span></div><div><strong>${data.budget===null?'尚未设置预算':money(data.budget)}</strong><span>${data.budget===null?'可继续记录开销':'本月预算'}</span></div><div><strong>${data.budget===null?'—':money(data.budget-data.spend)}</strong><span>${data.budget===null?'设置预算后显示预实比较':'预算余额'}</span></div></div>`;}
  const budgetCompare=renderBudgetCompare;renderBudgetCompare=function(){budgetCompare();if(!state.budgets.length){const host=$('budgetCompareContainer');if(host)host.innerHTML='<p class="empty-copy">尚未设置预算。实际开销已正常记录，设置预算后可查看预实比较。</p>';}};

  // Automatically assembled overview and project summaries, without extra bookkeeping.
  const dashboard=$('page-dashboard'), monthGrid=dashboard.querySelector('.stats-grid'),yearGrid=dashboard.querySelectorAll('.stats-grid')[1];
  const monthLabel=el('div','section-heading',`<h2>本月概览</h2><span>${currentMonth()}</span>`);monthGrid.before(monthLabel);
  const annual=el('details','annual-summary','<summary>查看年度累计</summary>');yearGrid.before(annual);annual.append(yearGrid);
  const overviewExtra=el('div','overview-extra');annual.after(overviewExtra);
  function projectSummaries(){const training=[...new Set(state.sessions.map(s=>s.project).filter(p=>p&&!p.startsWith('AI分享月')))];return [{name:'AI 广播站',page:'aiknowledge',tab:'station',records:state.aiStations,unit:'期',pending:state.aiStations.filter(s=>D.stationMetric(s).status!=='collected').length},{name:'AI 分享月',page:'aiknowledge',tab:'share',records:state.aiShares,unit:'期',pending:state.aiShares.filter(s=>D.rate(s.attendees,s.total)===null).length},{name:'金融小百科',page:'finance',records:state.financeWiki||[],unit:'期',pending:(state.financeWiki||[]).filter(s=>D.financeStatus(s).key==='pending').length},...training.map(name=>({name,page:'training',records:state.sessions.filter(s=>s.project===name),unit:'场',pending:0}))];}
  function projectRows(max){return projectSummaries().slice(0,max).map(p=>{const last=[...p.records].sort((a,b)=>String(b.date||'').localeCompare(a.date||''))[0];return `<article class="project-row"><div><h3>${esc(p.name)}</h3><p>${last?`${esc(last.date||'日期待补')} · ${esc(last.title||last.course)}`:'暂无记录'}</p></div><div><strong>${p.records.length} ${p.unit}</strong><small>${p.pending?p.pending+' 期待补录':'已有记录自动汇总'}</small></div>${btn('查看','project-open',p.name)}</article>`;}).join('');}
  function recentResults(){const items=[...state.aiStations.map(s=>({...s,kind:'AI 广播站',page:'aiknowledge'})),...state.aiShares.map(s=>({...s,kind:'AI 分享月',page:'aiknowledge'})),...(state.financeWiki||[]).filter(s=>D.financeStatus(s).key!=='draft').map(s=>({...s,kind:'金融小百科',page:'finance'}))].filter(s=>s.date).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,4);return items.map(s=>`<li><div><strong>${esc(s.title)}</strong><small>${esc(s.date)} · ${s.kind}</small></div>${btn('查看','project-open',s.kind)}</li>`).join('') || '<li>暂无已记录成果</li>';}
  function renderOverview(){overviewExtra.innerHTML=`<section class="card"><div class="card-header"><h2 class="card-title">项目最近更新</h2>${btn('全部项目','navigate','projects')}</div><div class="card-body">${projectRows(3)}</div></section><section class="card"><div class="card-header"><h2 class="card-title">近期成果</h2>${btn('月度总结','navigate','monthly')}</div><div class="card-body"><ul class="result-list">${recentResults()}</ul></div></section>`;}
  function renderProjects(){projectPage.innerHTML='<div class="section-heading"><h2>项目进展</h2><p>从培训、发布和回收记录自动汇集</p></div>'+`<section class="card"><div class="card-body">${projectRows(100)}</div></section>`;}
  monthlyPage.append(card('月度总结',`<div class="report-controls"><label for="summaryMonth">选择月份</label><input type="month" id="summaryMonth" value="${currentMonth()}">${btn('导出设置','monthly-export')}</div><div id="monthlySummary"></div>`));
  $('summaryMonth').addEventListener('change',renderMonthly);
  function renderMonthly(){const month=$('summaryMonth').value || currentMonth(),d=D.monthly(state,month);$('monthlySummary').innerHTML=`<h3 class="report-month">${esc(month)} 学习发展工作摘要</h3><div class="compact-metrics"><div><strong>${d.sessions.length}</strong><span>培训场次</span></div><div><strong>${fmt(d.people)}</strong><span>参训人次</span></div><div><strong>${fmt(d.hours)}</strong><span>培训人时</span></div><div><strong>${money(d.spend)}</strong><span>实际支出</span></div></div><p class="summary-prose">本月记录 ${d.stations.length} 期 AI 广播站、${d.finance.length} 期已发布金融百科。广播站中有 ${d.pending} 期待回收或核对。${d.budget===null?'本月尚未设置预算。':'本月预算 '+money(d.budget)+'，余额 '+money(d.budget-d.spend)+'。'}</p><h3>本月培训</h3><ul class="report-list">${d.sessions.map(s=>`<li><span>${esc(s.date)} · ${esc(s.course)}</span><span>${fmt(D.number(s.people))} 人次 · ${fmt(D.number(s.people)===null||D.number(s.duration)===null?null:s.people*s.duration)} 人时</span></li>`).join('')||'<li>本月暂无培训记录</li>'}</ul><h3>本月内容成果</h3><ul class="report-list">${[...d.stations,...d.finance].sort((a,b)=>String(b.date).localeCompare(a.date)).map(s=>`<li><span>${esc(s.date)} · 第 ${esc(s.episode)} 期</span><span>${esc(s.title)}</span></li>`).join('')||'<li>本月暂无内容发布记录</li>'}</ul><h3>开销明细</h3><ul class="report-list">${d.expenses.map(s=>`<li><span>${esc(s.date)} · ${esc(s.desc)}</span><span>${money(s.amount)}</span></li>`).join('')||'<li>本月暂无开销记录</li>'}</ul>`;}
  const monthlyExport=window.openMonthlyReportModal;window.openMonthlyReportModal=()=>navigate('monthly');

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
  function refresh(){if(refreshing)return;refreshing=true;try{refreshTables();renderOverview();if(activePage==='projects')renderProjects();if(activePage==='monthly')renderMonthly();}finally{refreshing=false;}}
  document.addEventListener('ld-data-updated',()=>queueMicrotask(refresh));
  document.addEventListener('click',async e=>{
    const target=e.target.closest('[data-action]');if(!target)return;const action=target.dataset.action,id=target.dataset.record;
    if(action==='navigate')navigate(id);
    else if(action==='retry-sync'){try{await pushToCloud();}catch(err){showToast(err.message,'error');}}
    else if(action==='new-station')newStationEpisode();else if(action==='new-share')newShareEpisode();
    else if(action==='copy-session')copySession(id);
    else if(action==='page-prev'||action==='page-next'){filterState[id].page+=action==='page-next'?1:-1;refreshTables();}
    else if(action==='monthly-export'){monthlyExport();$('reportMonthSelect').value=$('summaryMonth').value;}
    else if(action==='project-open'){const p=projectSummaries().find(p=>p.name===id);if(p){navigate(p.page);if(p.tab)document.querySelector(`.ai-tab[data-tab="${p.tab}"]`).click();if(p.page==='training'){filterState.sessions.project=p.name;filterState.sessions.page=1;filterState.sessions.bar.querySelector('select').value=p.name;renderSessions();}}}
    else if(action==='finance-step' && financeDraft){financeDraft.workflow[id]=!financeDraft.workflow[id];if(id==='publish')finPublished.checked=!!financeDraft.workflow.publish;renderFinanceDraft();}
    else if(action.startsWith('edit-'))({session:editSession,expense:editExpense,station:editStation,share:editShare,finance:openFinanceModal}[action.slice(5)])?.(id);
    else if(action.startsWith('delete-'))({session:deleteSession,expense:deleteExpense,station:deleteStation,share:deleteShare,finance:deleteEpisodeFromTable}[action.slice(7)])?.(id);
  });
  refresh();
})();
