// Usage: node --test tests/projects.test.cjs
// Node's test runner supplies the test path; fixtures below never read or write live records.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const D=require('../assets/ld-domain.js');
const C=require('../assets/closeout-reports.js');
const code=fs.readFileSync(path.join(__dirname,'../assets/workflow.js'),'utf8');
function section(start,end){
  const a=code.indexOf(start),b=code.indexOf(end,a);
  assert.ok(a>=0&&b>a,`Missing workflow section: ${start}`);
  return code.slice(a,b);
}
// Execute the production functions, not a second implementation of the grouping rule.
const summaries=section('  const byDateDesc=', '  function recentResults(');
const filtering=section('  function records(key,source)', '  const actions=');
const api=new Function('D','filterState','esc','shortDate','chevron','btn','window','renderSessions',summaries+filtering+'\nreturn {projectSummaries,projectRows,records,trainingProjectName,trainingProjectOptions,openTrainingProject};');
function setup(sessions=[]){
  const state={sessions,aiStations:[],aiShares:[],financeWiki:[]};
  const filters={sessions:{query:'',period:'',project:'',page:1,fields:['course','project'],pager:{innerHTML:'',querySelector:()=>({})}}};
  return {state,filters,...api(D,filters,String,String,'',()=>'',{LDCloseout:C},()=>{})};
}
const canonical='AI 赋能训练营第四期';
const session=(id,project,people=1,date='2026-10-20')=>({id,project,people,date,course:'1 对 1 辅导答疑',duration:1});
const fourth=rows=>rows.filter(p=>p.name===canonical);

test('第四期无记录时仅保留一个筹备占位',()=>{
  const a=setup(),p=fourth(a.projectSummaries(a.state));
  assert.equal(p.length,1);assert.equal(p[0].status,'筹备中');assert.equal(p[0].records.length,0);
  assert.match(a.projectRows(100,a.state),/尚无培训记录/);
});
test('截图回归：三场三人次只展示一个第四期，旧占位消失',()=>{
  const a=setup([1,2,3].map(id=>session(id,canonical)));
  const p=fourth(a.projectSummaries(a.state));
  assert.equal(p.length,1);assert.equal(p[0].records.length,3);assert.equal(p[0].people,3);
  assert.equal(p[0].status,'项目持续进行');assert.equal(p[0].latest.date,'2026-10-20');
  for(const max of [4,100]){
    const html=a.projectRows(max,a.state);
    assert.equal((html.match(/data-record="AI 赋能训练营第四期"/g)||[]).length,1);
    assert.match(html,/3 场/);assert.match(html,/累计 3 人次/);
    assert.doesNotMatch(html,/筹备中|尚无培训记录/);
  }
});
test('两个别名归并但第三期、第五期独立，且不改动原始数据',()=>{
  const a=setup([session(1,'AI 赋能第四期',2),session(2,canonical,3),session(3,'AI赋能训练营第四期',4),session(4,'AI 赋能训练营',10,'2026-04-28'),session(5,'AI 赋能训练营第五期',20)]);
  const before=JSON.stringify(a.state),rows=a.projectSummaries(a.state),p=fourth(rows)[0];
  assert.equal(fourth(rows).length,1);assert.equal(p.records.length,3);assert.equal(p.people,9);
  const third=rows.find(p=>p.name==='AI 赋能训练营');
  assert.equal(third.label,'AI 赋能训练营 · 第三期');assert.equal(third.status,'已结项');assert.equal(third.people,10);
  assert.equal(rows.find(p=>p.name==='AI 赋能训练营第五期').people,20);
  assert.equal(JSON.stringify(a.state),before);
});
test('点击统一项目后筛出所有别名记录，不包含其他期',()=>{
  const a=setup([session(1,'AI 赋能第四期'),session(2,canonical),session(3,'AI 赋能训练营')]);
  for(const selected of [canonical,'AI 赋能第四期']){
    a.filters.sessions.project=selected;
    assert.deepEqual(a.records('sessions',a.state.sessions).map(r=>r.id),[1,2]);
  }
});
test('混合缺失人数保留待补标记，不把缺失值当作真实零',()=>{
  const a=setup([session(1,'AI 赋能第四期',null),session(2,canonical,0)]),p=fourth(a.projectSummaries(a.state))[0];
  assert.equal(p.pending,1);assert.equal(p.records.length,2);assert.equal(p.people,0);
  assert.match(a.projectRows(100,a.state),/1 场待补录/);
});
test('培训筛选下拉去重且仍可选中统一项目',()=>{
  const a=setup([session(1,'AI 赋能第四期'),session(2,canonical)]);
  const options={value:'AI 赋能第四期',innerHTML:''};
  a.filters.sessions.bar={querySelector:()=>options};
  // Stop after building the dropdown, before unrelated table rendering.
  const stop=Symbol('dropdown-ready');
  const render=section('  renderSessions=function(){','  renderExpenses=function()');
  const run=new Function('state','filterState','trainingProjectName','trainingProjectOptions','esc','records','rows',`let renderSessions;${render};renderSessions();`);
  assert.throws(()=>run(a.state,a.filters,a.trainingProjectName,a.trainingProjectOptions,String,()=>[],()=>{throw stop;}),e=>e===stop);
  assert.equal(options.value,canonical);
  assert.equal((options.innerHTML.match(/<option value="AI 赋能训练营第四期">/g)||[]).length,1);
  assert.doesNotMatch(options.innerHTML,/>AI 赋能第四期</);
});

const base='AI 赋能训练营';
test('第三期日期四边界互斥分组，往期备注、状态和未分期标签准确',()=>{
  const a=setup(['2026-04-27','2026-04-28','2026-09-30','2026-10-01'].map((date,i)=>session(i,base,i+1,date)));
  const before=JSON.stringify(a.state),groups=a.projectSummaries(a.state).filter(p=>p.name===base);
  const get=key=>groups.find(p=>p.key===key);
  assert.deepEqual([get('ai-prior').records.length,get('ai-s3').records.length,get('ai-unassigned').records.length],[1,2,1]);
  assert.equal(get('ai-s3').people,5);assert.equal(get('ai-s3').status,'已结项');assert.equal(get('ai-prior').status,'已结项');
  assert.equal(get('ai-prior').note,'第一、二期结项后的零散辅导');
  assert.equal(get('ai-unassigned').label,'AI 赋能训练营（未分期）');
  for(const [key,ids] of [['ai-prior',[0]],['ai-s3',[1,2]],['ai-unassigned',[3]]]){
    a.filters.sessions.project=key;assert.deepEqual(a.records('sessions',a.state.sessions).map(r=>r.id),ids);
    assert.match(a.projectRows(100,a.state),new RegExp(`data-record="${key}"`));
  }
  assert.equal(JSON.stringify(a.state),before);
});
test('点击第三期和往期先清除残留月份/搜索/页码，分别筛出 40/126 和 21/24',()=>{
  const sessions=[...Array.from({length:40},(_,i)=>session('third-'+i,base,i?1:87,'2026-04-28')),...Array.from({length:21},(_,i)=>session('prior-'+i,base,i?1:4,'2026-04-27')),session('fourth',canonical)];
  const a=setup(sessions),f=a.filters.sessions,inputs=[{value:'2026-10'},{value:'不匹配'}];
  f.bar={querySelectorAll:()=>inputs};
  for(const [key,count,people] of [['ai-s3',40,126],['ai-prior',21,24]]){
    Object.assign(f,{period:'2026-10',query:'不匹配',page:99});a.openTrainingProject(key);
    assert.equal(f.page,1);assert.equal(f.query,'');assert.equal(f.period,'');assert.ok(inputs.every(n=>n.value===''));
    a.records('sessions',a.state.sessions);assert.equal(f.result.length,count);
    assert.equal(f.result.reduce((n,s)=>n+s.people,0),people);
    const row=a.projectSummaries(a.state).find(p=>p.key===key);assert.equal(row.records.length,count);assert.equal(row.people,people);
  }
  assert.match(code,/if\(p\.page==='training'\)openTrainingProject\(p\.key\|\|p\.name\)/);
  assert.match(code,/find\(p=>\(p\.key\|\|p\.name\)===id\)/);
});
test('台账下拉与项目行共用分组；没有区间后记录时不展示未分期',()=>{
  const a=setup([session(1,base,1,'2026-04-27'),session(2,base,1,'2026-04-28')]);
  assert.deepEqual(a.trainingProjectOptions(a.state),[
    {value:'ai-s3',label:'AI 赋能训练营 · 第三期'},
    {value:'ai-prior',label:'AI 赋能训练营 · 往期辅导（第一、二期）'}
  ]);
  assert.doesNotMatch(a.projectRows(100,a.state),/未分期/);
  const options={value:'ai-prior',innerHTML:''};a.filters.sessions.project='ai-prior';a.filters.sessions.bar={querySelector:()=>options};
  const stop=Symbol('ready'),render=section('  renderSessions=function(){','  renderExpenses=function()');
  const run=new Function('state','filterState','trainingProjectName','trainingProjectOptions','esc','records','rows',`let renderSessions;${render};renderSessions();`);
  assert.throws(()=>run(a.state,a.filters,a.trainingProjectName,a.trainingProjectOptions,String,()=>[],()=>{throw stop;}),e=>e===stop);
  assert.equal(options.value,'ai-prior');assert.match(options.innerHTML,/value="ai-s3">AI 赋能训练营 · 第三期/);
  assert.match(options.innerHTML,/value="ai-prior">AI 赋能训练营 · 往期辅导（第一、二期）/);
});
test('修改结项配置即改变分组和台账边界，不另写一份日期',()=>{
  const C2={reports:[{...C.reports[0],start:'2030-03-01',end:'2030-03-31'}]},a=setup();
  const custom=api(D,a.filters,String,String,'',()=>'',{LDCloseout:C2},()=>{});
  a.state.sessions=[session(1,base,1,'2030-02-28'),session(2,base,1,'2030-03-01'),session(3,base,1,'2030-04-01')];
  for(const [key,id] of [['ai-prior',1],['ai-s3',2],['ai-unassigned',3]]){
    const p=custom.projectSummaries(a.state).find(p=>p.key===key);assert.equal(p.records.length,1);
    a.filters.sessions.project=key;assert.deepEqual(custom.records('sessions',a.state.sessions).map(s=>s.id),[id]);
  }
  assert.doesNotMatch(summaries,/2026-(?:04-28|09-30)/);
});
test('缺失日期落未分期，缺失结项配置明确报错而非误计第三期',()=>{
  const a=setup([session(1,base,1,'')]);assert.equal(a.projectSummaries(a.state).find(p=>p.name===base).key,'ai-unassigned');
  const bad=api(D,a.filters,String,String,'',()=>'',{LDCloseout:{reports:[]}},()=>{});
  assert.throws(()=>bad.projectSummaries(a.state),/第三期结项日期配置缺失/);
});
