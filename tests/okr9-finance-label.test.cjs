// Usage: node --test tests/okr9-finance-label.test.cjs
// 回归：9 月 OKR 正文写当月培训总量 11 场 / 91 人次（不出现旧口径 78）；金融小百科项目进展显示名带年份，跳转键与状态不变。
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const O=require('../assets/okr.js');
const D=require('../assets/ld-domain.js');
const C=require('../assets/closeout-reports.js');
const code=fs.readFileSync(path.join(__dirname,'../assets/workflow.js'),'utf8');
function section(start,end){const a=code.indexOf(start),b=code.indexOf(end,a);assert.ok(a>=0&&b>a,start);return code.slice(a,b);}

test('九月 OKR 正文写 11 场、91 人次，且不含 78',()=>{
  const sum=O.summary('2026-09');
  assert.match(sum,/11 场/);assert.match(sum,/91 人次/);
  const all=sum+JSON.stringify(O.forMonth('2026-09'));
  assert.ok(!all.includes('78'),'九月正文不应出现 78');
  assert.ok(!/原提交|对账/.test(all));
  assert.equal(O.summary('2026-08'),'');
  // 费用说明保持原样
  assert.match(O.sourceNote('2026-09'),/¥4,593\.42/);
});

test('九月 OKR 区块渲染出总量概述',()=>{
  const block=section('  function okrBlock(month){','  window.openMonthlyReportModal=');
  const okrBlock=new Function('window','LDOkr','esc',block+'\nreturn okrBlock;')({LDOkr:O},O,String);
  const html=okrBlock('2026-09');
  assert.match(html,/<p class="summary-prose okr-summary">9 月共开展培训 11 场、91 人次。<\/p>/);
  assert.doesNotMatch(okrBlock('2026-08'),/okr-summary/);
});

test('金融小百科显示名带年份，name、跳转键、状态不变',()=>{
  const summaries=section('  const byDateDesc=','  function recentResults(');
  const filtering=section('  function records(key,source)','  const actions=');
  const api=new Function('D','filterState','esc','shortDate','chevron','btn','window','renderSessions',summaries+filtering+'\nreturn {projectSummaries,projectRows};')(D,{sessions:{}},String,String,'',()=>'',{LDCloseout:C},()=>{});
  const state={sessions:[],aiStations:[],aiShares:[],financeWiki:Array.from({length:12},(_,i)=>({id:'f'+i,episode:i+1,title:'t'+i,date:'2026-0'+(1+(i%9))+'-01',published:true,read:1,downloads:1}))};
  const p=api.projectSummaries(state).find(p=>p.name==='金融小百科');
  assert.ok(p);assert.equal(p.label,'金融小百科（2025–2026 年）');assert.equal(p.status,'已结项');
  assert.equal(p.page,'finance');assert.equal(p.records.length,12);
  const html=api.projectRows(100,state);
  assert.match(html,/金融小百科（2025–2026 年）/);
  assert.match(html,/data-record="金融小百科"/);
  assert.match(html,/12 期/);
});
