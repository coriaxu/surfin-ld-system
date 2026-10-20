// Usage: node --test tests/projects.test.cjs
// Node's test runner supplies the test path; fixtures below never read or write live records.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const D=require('../assets/ld-domain.js');
const code=fs.readFileSync(path.join(__dirname,'../assets/workflow.js'),'utf8');
function section(start,end){
  const a=code.indexOf(start),b=code.indexOf(end,a);
  assert.ok(a>=0&&b>a,`Missing workflow section: ${start}`);
  return code.slice(a,b);
}
// Execute the production functions, not a second implementation of the grouping rule.
const summaries=section('  const byDateDesc=', '  function recentResults(');
const filtering=section('  function records(key,source)', '  const actions=');
const api=new Function('D','filterState','esc','shortDate','chevron','btn',summaries+filtering+'\nreturn {projectSummaries,projectRows,records,trainingProjectName};');
function setup(sessions=[]){
  const state={sessions,aiStations:[],aiShares:[],financeWiki:[]};
  const filters={sessions:{query:'',period:'',project:'',page:1,fields:['course','project'],pager:{innerHTML:'',querySelector:()=>({})}}};
  return {state,filters,...api(D,filters,String,String,'',()=>'')};
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
  const a=setup([session(1,'AI 赋能第四期',2),session(2,canonical,3),session(3,'AI赋能训练营第四期',4),session(4,'AI 赋能训练营',10),session(5,'AI 赋能训练营第五期',20)]);
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
  const run=new Function('state','filterState','trainingProjectName','esc','records','rows',`let renderSessions;${render};renderSessions();`);
  assert.throws(()=>run(a.state,a.filters,a.trainingProjectName,String,()=>[],()=>{throw stop;}),e=>e===stop);
  assert.equal(options.value,canonical);
  assert.equal((options.innerHTML.match(/<option value="AI 赋能训练营第四期">/g)||[]).length,1);
  assert.doesNotMatch(options.innerHTML,/>AI 赋能第四期</);
});
