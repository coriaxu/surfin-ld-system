// 用法：node --test tests/okr10.test.cjs；在项目根执行，无外部服务和写操作。
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const O=require('../assets/okr.js');
const workflow=fs.readFileSync(path.join(__dirname,'../assets/workflow.js'),'utf8');
const start=workflow.indexOf('  function okrBlock(month){');
const end=workflow.indexOf('  window.openMonthlyReportModal',start);
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function render(api,month){
  const context={window:{LDOkr:api},LDOkr:api,esc};
  vm.createContext(context);
  vm.runInContext(workflow.slice(start,end)+'\nthis.render=okrBlock;',context);
  return context.render(month);
}
test('10 月保持 3 个目标、7 项关键结果，4 完成、3 部分完成',()=>{
  assert.deepEqual(O.count('2026-10'),{objectives:3,krs:7,done:4});
  assert.deepEqual(O.forMonth('2026-10').flatMap(o=>o.krs.map(k=>k[1])),['部分完成','完成','部分完成','完成','部分完成','完成','完成']);
  const text=JSON.stringify(O.forMonth('2026-10'));
  for(const phrase of ['六人全到','6/6','第六课未开始','四人访谈全部完成','21 条','¥1,031.00','85.7%','4.6 个百分点'])assert.ok(text.includes(phrase),phrase);
});
test('完整月报口径和实时台账边界明确，不改未来日期计数规则',()=>{
  for(const phrase of ['14 场','27 人次','15.5 小时','38.5 人时','提前登记','10 月 30 日'])assert.ok(O.summary('2026-10').includes(phrase),phrase);
  for(const phrase of ['¥1,339.00','¥1,031.00','¥308.00','活动日期到来前不计入','不含项目报销'])assert.ok(O.sourceNote('2026-10').includes(phrase),phrase);
});
test('11 月计划有 3 目标、8 项计划，不伪装为已完成的 11 月回顾',()=>{
  const p=O.nextPlan('2026-10');
  assert.equal(p.month,'2026-11');assert.equal(p.objectives.length,3);
  assert.deepEqual(p.objectives.map(o=>o.krs.length),[3,3,2]);
  assert.equal(O.forMonth('2026-11'),null);assert.equal(O.nextPlan('2026-09'),null);
  const text=JSON.stringify(p);
  for(const phrase of ['11 月 20 日','11 月 30 日','11 月 5 日','11 月 17 日','11 月 11 日','4/4','6 条'])assert.ok(text.includes(phrase),phrase);
});
test('新增公开文字去除人员姓名且不链接完整私有报告',()=>{
  const text=JSON.stringify([O.forMonth('2026-10'),O.nextPlan('2026-10'),O.sourceNote('2026-10'),O.summary('2026-10')]);
  assert.doesNotMatch(text,/陈雨菲|秦园春|高磊|江国浩|韩静|刘琳|侯冰|秦鹏|张立夏|安广海|戴鸿超|韩丽辉|张冬君|宋阳梅|荣萌|王雅平|郭嘉宇|路璐|付玲|Coria|uploads\/|file:\/\//);
});
test('真实页面渲染函数展示 10 月回顾和 11 月计划，历史月份不受影响',()=>{
  assert.ok(start>=0&&end>start);
  const html=render(O,'2026-10');
  assert.match(html,/3 个目标 · 7 项关键结果 · 已完成 4 项/);
  assert.match(html,/2026-11 OKR 计划/);
  assert.equal((html.match(/class="okr-objective"/g)||[]).length,6);
  assert.equal((html.match(/class="okr-status okr-partial"/g)||[]).length,3);
  assert.doesNotMatch(html,/本月 OKR 未整理/);
  const old=render(O,'2026-09');assert.match(old,/11 场、91 人次/);assert.doesNotMatch(old,/okr-next-plan/);
  assert.match(render(O,'2026-02'),/本月 OKR 未整理/);
  const unsafe={...O,nextPlan:()=>({month:'<script>',objectives:[{o:'<b>',krs:['<img onerror=x>']}]})};
  const safe=render(unsafe,'2026-10');assert.match(safe,/&lt;script&gt;/);assert.doesNotMatch(safe,/<img onerror/);
});
test('两个修改脚本都更新缓存版本号',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  assert.ok(html.includes('assets/okr.js?v=20261029-okr10'));
  assert.ok(html.includes('assets/workflow.js?v=20261029-okr10'));
});
