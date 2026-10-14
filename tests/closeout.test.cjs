const {test}=require('node:test');const assert=require('node:assert/strict');const C=require('../assets/closeout-reports.js');
const r={project:'P',start:'2026-04-01',end:'2026-04-30'};
test('closeout records filter by project and date range, using report hours rule',()=>{
  const d=C.records({sessions:[{project:'P',date:'2026-03-31',people:9,duration:9},{project:'P',date:'2026-04-01',people:3,duration:2},{project:'P',date:'2026-04-30',people:2,duration:1.5},{project:'Q',date:'2026-04-10',people:5,duration:1}]},r);
  assert.deepEqual(d,{sessions:2,people:5,hours:9,pending:0});
});
test('missing values are counted as pending, not zero-filled',()=>{
  const d=C.records({sessions:[{project:'P',date:'2026-04-02',people:null,duration:1},{project:'P',date:'2026-04-03',people:4,duration:1}]},r);
  assert.deepEqual(d,{sessions:2,people:4,hours:4,pending:1});
});
test('every report has the fields the page renders, and no personal names in public text',()=>{
  for(const x of C.reports){
    for(const k of ['id','name','project','start','end','status','reportDate','conclusion','results','resultsNote','verdict','lessons','links'])assert.ok(k in x,k);
    assert.ok(!/曹弘扬|李蓓|宋阳梅|郭嘉宇|宁奕然|戴鸿超/.test(JSON.stringify(x)));
  }
});
