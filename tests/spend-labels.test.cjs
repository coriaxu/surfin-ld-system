// Usage: node --test tests/spend-labels.test.cjs
// Run from the repository root. Executes production renderers with isolated DOM/data stubs.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const code=fs.readFileSync(path.join(__dirname,'../assets/workflow.js'),'utf8');
function section(start,end){const a=code.indexOf(start),b=code.indexOf(end,a);assert.ok(a>=0&&b>a);return code.slice(a,b);}
const spend=section('  const SPEND_NOTE=','  const R=LDReport,');
const note='系统已录入支出 · 不含项目报销';
const R={today:()=> '2026-10-22',fmt:String,money:String,budgetNote:()=> '未设置预算'};
function fixture(pending=0){return {sessions:[],hours:0,people:0,spend:0,stations:[],shares:[],finance:[],expenses:[],pending:{spend:pending,hours:0,people:0,stations:0,finance:0,financeReview:0},period:{mode:'month',month:'2026-10',year:'2026',range:'测试期间',title:'测试月份',ongoing:true}};}
function dom(){const nodes={};return {nodes,$:id=>nodes[id]||(nodes[id]={value:'',textContent:'',innerHTML:''})};}
test('首页月度/年度主卡和折叠卡均说明支出口径，金额待补信息不丢失',()=>{
  const stats=section('  renderStats=function(){','  const byDateDesc=');
  const run=new Function('selected','selection','R','stat','$','monthLabel','annual','document','state',spend+`let renderStats;${stats};renderStats();`);
  for(const mode of ['month','ytd'])for(const pending of [0,2]){
    const d=fixture(pending),calls=[],view=dom();
    run(()=>d,{mode,month:d.period.month},R,(...a)=>calls.push(a),view.$,{querySelectorAll:()=>[]},{querySelector:()=>({})},{querySelectorAll:()=>[]},{financeWiki:[]});
    for(const id of ['statMonthSpend','statYearSpend']){
      const description=calls.find(c=>c[0]===id)[3];
      assert.equal(description,note+(pending?' · 2 条金额待补':''));
    }
  }
});
test('月度及年度汇报实际支出显示同一口径，包括金额待补和加载失败',()=>{
  const monthly=section('  function renderMonthly(){','  // 月度 OKR：');
  const run=new Function('activePage','selection','selected','R','D','$','loadUnavailable','okrBlock','esc','window',spend+`let reportSnapshot;${monthly};renderMonthly();`);
  for(const page of ['monthly','annual'])for(const pending of [0,2])for(const unavailable of [false,true]){
    const d=fixture(pending),view=dom();
    run(page,{mode:'month',month:d.period.month},()=>d,R,{number:Number},view.$,()=>unavailable,()=>'',String,{LDLoadInfo:{status:'loading'}});
    const html=view.nodes[page==='annual'?'annualSummary':'monthlySummary'].innerHTML;
    assert.ok(html.includes('实际支出 · '+note));
    if(!unavailable&&pending)assert.ok(html.includes('2 条金额待补'));
    if(unavailable)assert.ok(html.includes('未加载'));
  }
});
