/* This presentation layer is backed by server authorization on every private route. */
(() => {
  const account=window.LD_SERVER;if(!account)return;
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  document.body.dataset.role=account.role;
  document.getElementById('authOverlay').hidden=true;
  const status=document.createElement('span');status.className='account-status';status.textContent=account.role==='editor'?'可编辑':'只读';status.title=account.email;
  const logout=document.createElement('button');logout.type='button';logout.className='btn btn-secondary btn-sm';logout.textContent='退出';
  document.getElementById('topbarActions').append(status,logout);
  logout.onclick=async()=>{
    if(syncController.hasPending()&&!confirm('本机还有尚未同步的修改。退出前建议先同步或导出，仍要退出吗？'))return;
    const response=await fetch('/api/logout',{method:'POST'});
    if(response.ok){for(let i=sessionStorage.length-1;i>=0;i--){const key=sessionStorage.key(i);if(key.startsWith(STORAGE_KEY))sessionStorage.removeItem(key);}location.replace('/login');}
  };
  window.openSyncModal=()=>{showToast(account.role==='editor'?'当前账号通过私有服务器自动同步':'当前账号为只读权限','info');};
  // The server has already removed all report names and URLs not permitted for this account.
  const host=document.getElementById('assess-home');
  host.innerHTML='<section class="card"><div class="card-header"><h2 class="card-title">测评报告</h2></div><div class="card-body"><div class="library-search"><label>查找报告<input id="privateReportSearch" type="search" placeholder="姓名、部门或年份"></label></div><div id="privateReports"></div></div></section>';
  const render=()=>{const query=document.getElementById('privateReportSearch').value.trim().toLowerCase();const reports=account.reports.filter(r=>[r.title,r.department,r.year].join(' ').toLowerCase().includes(query)).sort((a,b)=>Number(b.year)-Number(a.year)||Number(a.kind==='personal')-Number(b.kind==='personal'));document.getElementById('privateReports').innerHTML=reports.length?'<ul class="report-list">'+reports.map(r=>`<li><div><strong>${esc(r.title)}</strong><small class="record-note">${esc(r.year)} · ${r.kind==='team'?'团队共性':esc(r.department)}</small></div><a class="btn btn-secondary btn-sm" href="/reports/${encodeURIComponent(r.id)}" target="_blank" rel="noopener">查看报告</a></li>`).join('')+'</ul>':'<p class="empty-copy">当前没有已接入且向你开放的报告。</p>';};
  document.getElementById('privateReportSearch').addEventListener('input',render);render();
  window.openAssessmentHub=()=>document.querySelector('#legacyNav [data-page="assessment"]').click();
  window.openAssessReport=window.openAssessReport2024=()=>showToast('请从获准报告列表进入','info');
  if(account.role==='reader'){
    const style=document.createElement('style');style.textContent=`body[data-role=reader] .record-toolbar,body[data-role=reader] .actions-row,body[data-role=reader] .fin-new-btn,body[data-role=reader] [data-action^="edit-"],body[data-role=reader] [data-action^="new-"],body[data-role=reader] [onclick*="newFinanceEpisode"],body[data-role=reader] [onclick*="openModal"],body[data-role=reader] [onclick*="import"],body[data-role=reader] [onclick*="resetData"]{display:none!important}`;document.head.append(style);
    document.addEventListener('submit',e=>{if(e.target.matches('#sessionForm,#expenseForm,#budgetForm,#stationForm,#shareForm,#financeForm')){e.preventDefault();e.stopImmediatePropagation();}},true);
    document.querySelectorAll('.record-drawer').forEach(d=>d.hidden=true);
    document.querySelectorAll('.record-toolbar-trigger').forEach(b=>b.hidden=true);
    document.addEventListener('click',e=>{if(e.target.closest('[onclick*="toggleStationTask"],[onclick*="toggleShareTask"],.fin-chip,[onclick*="applyStation"],[onclick*="applyShare"]')){e.preventDefault();e.stopImmediatePropagation();}},true);
  }
})();
