const {test}=require('node:test');const assert=require('node:assert/strict');const O=require('../assets/okr.js');
test('months with OKR documents are present; missing months return null',()=>{
  for(const m of ['2026-01','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09'])assert.ok(O.forMonth(m),m);
  for(const m of ['2026-02'])assert.equal(O.forMonth(m),null,m);
});
test('every KR has name, valid status and one-line result',()=>{
  for(const [m,os] of Object.entries(O.months)){
    assert.ok(os.length>=1&&os.length<=3,m);
    for(const o of os){assert.ok(o.o);for(const k of o.krs){assert.equal(k.length,3);assert.ok(O.STATUS.includes(k[1]),m+' '+k[1]);assert.ok(k[2].length>4);}}
  }
});
test('九月第三期Skill应用数为26并保留截至日期',()=>{
  const kr=O.forMonth('2026-09').find(o=>o.o==='AI 赋能第三期').krs.find(k=>k[0]==='项目整体报告与复盘');
  assert.ok(kr[2].includes('36 个 Skill 中 26 个已用于实际工作（截至 9 月 5 日）。'));
  assert.ok(!kr[2].includes('36 个 Skill 中 25 个已用于实际工作。'));
});
test('count summarises objectives, KRs and done',()=>{
  assert.deepEqual(O.count('2026-01'),{objectives:3,krs:5,done:4});
  assert.deepEqual(O.count('2026-02'),{objectives:0,krs:0,done:0});
});
test('June is compiled from the half-year report and says so',()=>{
  assert.match(O.sourceNote('2026-06'),/上半年学习发展汇报/);
  assert.equal(O.sourceNote('2026-08'),'');
});
test('no personal names in public OKR text',()=>{
  const txt=JSON.stringify(O.months);
  assert.ok(!/曹弘扬|李蓓|宋阳梅|郭嘉宇|宁奕然|戴鸿超|王可心|庞建恒|李恺|路璐|Nathan|杨蕊|安广海|张立夏|高忠强|李帅隆|冯世祺|何霄鹏|王雅平|孙颖|李迪|荣萌|燕燕|可心|付玲|Coria/.test(txt));
});
