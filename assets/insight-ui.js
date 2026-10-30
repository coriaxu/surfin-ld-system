/* 「看得见的口径」界面层：① 录入培训时实时显示计入结果 ② 首页指标「怎么算」 ③ 数据来源与保存位置。
 * 只读状态、不改保存与同步逻辑；计算全部交给 LDInsight（assets/ld-insight.js）。须在 workflow.js 之后加载。 */
(() => {
  const I=window.LDInsight, $=id=>document.getElementById(id);
  if(!I||!$('sessionForm'))return;
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getState=()=>state; // index.html 中的全局 const state
  // index.html 用全局 const 声明，不挂在 window 上，按名称安全取用。
  const SC=typeof syncController!=='undefined'?syncController:null;
  const toast=(m,t)=>{if(typeof showToast==='function')showToast(m,t);};
  let syncInfo=SC?.getStatus?.()||{};
  const source=()=>I.dataSource(window.LDLoadInfo||{},syncInfo);

  /* ③ 保存位置：三个录入抽屉都写明“存到哪里” */
  function saveLine(cls=''){const s=source();return `<p class="save-target ${cls}" data-tone="${s.tone}"><span class="save-dot" aria-hidden="true"></span>${esc(s.save)}</p>`;}
  const extraForms=['budgetForm','expenseForm'].map($).filter(Boolean);
  extraForms.forEach(f=>{const slot=document.createElement('div');slot.className='save-target-slot span-full';f.querySelector('.form-footer')?.before(slot);});
  function refreshSaveLines(){extraForms.forEach(f=>{const slot=f.querySelector('.save-target-slot');if(slot)slot.innerHTML=saveLine();});}

  /* ① 录入预览 */
  const form=$('sessionForm'), panel=document.createElement('section');
  panel.className='impact-panel span-full';panel.setAttribute('aria-live','polite');panel.setAttribute('aria-label','保存后会怎样计入');
  form.querySelector('.form-footer').before(panel);
  const projectInput=$('sessionProject'), options=document.createElement('datalist');
  options.id='sessionProjectOptions';projectInput.setAttribute('list',options.id);projectInput.setAttribute('autocomplete','off');projectInput.after(options);
  const draft=()=>({date:$('sessionDate').value,course:$('sessionCourse').value,project:$('sessionProject').value,people:$('sessionPeople').value,duration:$('sessionDuration').value});
  const flow=(label,b,a,d,unit)=>{
    const kind=d===null?'':d>0?'up':d<0?'down':'same', text=d===null?'待补':d===0?'不变':(d>0?'+':'−')+I.fmt(Math.abs(d));
    return `<div class="ip-metric"><span class="ip-label">${label}</span><span class="ip-flow"><span class="ip-before">${I.fmt(b)}</span><span class="ip-arrow" aria-label="变为">→</span><b>${I.fmt(a)}</b><small>${unit}</small></span><span class="ip-delta ${kind}">${text}</span></div>`;
  };
  function renderImpact(){
    let r;try{r=I.sessionImpact(getState(),draft(),{editingId:$('sessionId').value});}catch(err){panel.hidden=true;console.warn('录入预览未能计算',err);return;}
    panel.hidden=false;
    const head=`<div class="ip-head"><span class="ip-kicker">保存后会这样计入</span>${r.ready?`<span class="ip-period">${esc(r.monthLabel)}</span>`:''}</div>`;
    let body='';
    if(!r.ready)body=`<p class="ip-hint">${esc(r.hint)}</p>`;
    else if(!r.counted)body=`<p class="ip-headline">${esc(r.headline)}</p>`;
    else{
      const b=r.before,a=r.after,d=r.delta;
      body=`<div class="ip-metrics">${flow('培训场次',b.sessions,a.sessions,d.sessions,'场')}${flow('参训人次',b.people,a.people,d.people,'人次')}${flow('培训人时',b.hours,a.hours,d.hours,'人时')}</div>`+
        `<p class="ip-year">${esc(r.year.label)}：${I.fmt(r.year.before.sessions)} → ${I.fmt(r.year.after.sessions)} 场 · ${I.fmt(r.year.before.hours)} → ${I.fmt(r.year.after.hours)} 人时</p>`;
    }
    const notes=r.notes.length?`<ul class="ip-notes">${r.notes.map(n=>`<li data-tone="${n.tone}">${esc(n.text)}</li>`).join('')}</ul>`:'';
    panel.dataset.warn=r.notes.some(n=>n.tone==='warn')?'1':'';
    panel.innerHTML=head+body+notes+saveLine('ip-save');
  }
  function refreshOptions(){options.innerHTML=I.projectSuggestions(getState()).map(p=>`<option value="${esc(p)}"></option>`).join('');}
  form.addEventListener('input',renderImpact);form.addEventListener('change',renderImpact);
  // 新增、编辑、复制都会打开抽屉；在打开后（各自填完字段）再计算。
  const drawer=form.closest('dialog');
  if(drawer)new MutationObserver(()=>{if(drawer.open){refreshOptions();renderImpact();}}).observe(drawer,{attributes:true,attributeFilter:['open']});
  extraForms.forEach(f=>{const d=f.closest('dialog');if(d)new MutationObserver(()=>{if(d.open)refreshSaveLines();}).observe(d,{attributes:true,attributeFilter:['open']});});

  /* ② 首页指标「怎么算」 */
  const CARDS=[['statSessions','sessions','main'],['statMonthPeople','people','main'],['statHours','hours','main'],['statMonthSpend','spend','main'],
    ['statYearSessions','sessions','fold'],['statYearPeople','people','fold'],['statYearHours','hours','fold'],['statYearSpend','spend','fold']];
  const why=document.createElement('dialog');why.className='why-dialog';why.setAttribute('aria-labelledby','whyTitle');document.body.append(why);
  why.addEventListener('click',e=>{if(e.target===why||e.target.closest('[data-why-close]'))why.close();});
  function aggregateFor(scope){
    const main=window.getDashboardAggregate('selected');
    return scope==='main'?main:window.getDashboardAggregate(main.period.mode==='ytd'?'month':'ytd');
  }
  function openWhy(key,scope,opener){
    if(LDDataLoad.unavailable(window.LDLoadInfo?.status)){toast('数据还没加载完，稍后再看口径','info');return;}
    const x=I.explainMetric(key,aggregateFor(scope)), src=source();
    why.innerHTML=`<div class="why-head"><div><span class="why-scope">${esc(x.scope)}</span><h2 id="whyTitle">${esc(x.title)}怎么算</h2></div><button type="button" class="modal-close" data-why-close aria-label="关闭">×</button></div>
      <div class="why-body">
        <p class="why-value">${esc(x.value)}<small>${esc(x.range)}</small></p>
        <h3>规则</h3><ul class="why-rules">${x.rules.map(t=>`<li>${esc(t)}</li>`).join('')}</ul>
        <h3>本期数据</h3>${x.facts.map(t=>`<p class="why-fact">${esc(t)}</p>`).join('')}
        ${x.records.length?`<ol class="why-records">${x.records.map(r=>`<li><time>${esc(String(r.date||'').slice(5)||'—')}</time><span>${esc(r.text)}</span><b>${esc(r.value)}</b></li>`).join('')}</ol>`:''}
        <details class="why-all"><summary>全部统计口径</summary><dl>${I.METHODOLOGY.map(([k,v])=>`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('')}</dl></details>
      </div>
      <p class="why-foot" data-tone="${src.tone}">${esc(src.line)}</p>`;
    why._opener=opener;why.showModal();why.querySelector('.modal-close').focus();
  }
  why.addEventListener('close',()=>{if(why._opener?.isConnected)why._opener.focus();});
  for(const [id,key,scope] of CARDS){
    const card=$(id)?.closest('.stat-card');if(!card||card.querySelector('.metric-why'))continue;
    const b=document.createElement('button');b.type='button';b.className='metric-why';b.dataset.metric=key;b.dataset.scope=scope;
    b.innerHTML='怎么算<span aria-hidden="true">›</span>';
    b.setAttribute('aria-label',`${card.querySelector('.stat-label')?.textContent||''} 怎么算`);
    b.addEventListener('click',e=>{e.stopPropagation();openWhy(key,scope,b);});
    card.append(b);
  }

  /* ③ 顶部状态条：未开启同步时写明“仅本浏览器”；非今天的同步时间带上日期 */
  function patchBar(){
    const bar=document.querySelector('.save-status');if(!bar)return;
    const s=source(), time=bar.querySelector('time');
    if(time&&syncInfo.lastCloud)time.textContent=I.stamp(syncInfo.lastCloud);
    bar.classList.toggle('is-local-only',s.localOnly);
    if(s.localOnly){const label=bar.querySelector('span');if(label)label.textContent='仅本浏览器 · 未同步';bar.title=s.save;}
  }
  function refreshSource(){patchBar();refreshSaveLines();if(drawer?.open)renderImpact();}
  document.addEventListener('ld-sync-state',e=>{syncInfo=e.detail||{};refreshSource();});
  document.addEventListener('ld-load-state',refreshSource);
  SC?.emit?.();
  refreshSource();
})();
