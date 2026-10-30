const {test}=require('node:test');const assert=require('node:assert/strict');
const I=require('../assets/ld-insight.js'), R=require('../assets/ld-report.js');
const asOf='2026-10-30';
const base=()=>({sessions:[
  {id:'a',date:'2026-10-22',course:'认可与建设性反馈',project:'2026管理者训练营 1.0',people:12,duration:2},
  {id:'b',date:'2026-10-29',course:'第三期：用 AI 做一支视频',project:'咖啡开小灶',people:4,duration:1},
  {id:'c',date:'2026-09-08',course:'新员工入职',project:'新员工入职',people:13,duration:0.5},
  {id:'d',date:'2026-10-15',course:'Prompt 入门',project:'AI 分享月',people:30,duration:1}
],budgets:[],expenses:[{id:'e1',date:'2026-10-15',month:'2026-10',amount:140,desc:'ChatGPT plus 费用'},{id:'e2',date:'2026-10-13',month:'2026-10',amount:168,desc:'Claude pro 会员'}],aiStations:[],aiShares:[{id:'s1',episode:3,date:'2026-10-15',title:'Prompt 入门',attendees:30,duration:60}],financeWiki:[]});

test('new session shows the same before/after numbers as the dashboard aggregate',()=>{
  const st=base(), r=I.sessionImpact(st,{date:'2026-10-28',course:'复盘工作坊',project:'咖啡开小灶',people:10,duration:1.5},{asOf});
  const agg=R.aggregate(st,R.period('month','2026-10',asOf));
  assert.equal(r.ready,true);assert.equal(r.counted,true);
  assert.deepEqual([r.before.sessions,r.before.people,r.before.hours],[agg.sessions.length,agg.people,agg.hours]);
  assert.deepEqual(r.delta,{sessions:1,people:10,hours:15});
  assert.equal(r.year.after.sessions-r.year.before.sessions,1);
  assert.equal(st.sessions.length,4,'preview must not mutate state');
});
test('editing a record changes figures without adding a session; moving months is noted',()=>{
  const st=base();
  const same=I.sessionImpact(st,{...st.sessions[0],people:15},{editingId:'a',asOf});
  assert.deepEqual(same.delta,{sessions:0,people:3,hours:6});
  const moved=I.sessionImpact(st,{...st.sessions[2],date:'2026-10-09'},{editingId:'c',asOf});
  assert.equal(moved.delta.sessions,1);
  assert.ok(moved.notes.some(n=>/原来在 2026 年 9 月/.test(n.text)));
});
test('future dates are plans and are not counted yet',()=>{
  const r=I.sessionImpact(base(),{date:'2026-11-03',course:'x',project:'咖啡开小灶',people:5,duration:1},{asOf});
  assert.equal(r.counted,false);assert.match(r.headline,/计划场次/);assert.equal(r.delta,undefined);
});
test('same-day same-course records are flagged first, ignoring spaces and case',()=>{
  const r=I.sessionImpact(base(),{date:'2026-10-29',course:'第三期：用AI做一支视频',project:'咖啡开小灶',people:4,duration:1},{asOf});
  assert.equal(r.notes[0].tone,'warn');assert.match(r.notes[0].text,/算成两场/);
  const self=I.sessionImpact(base(),{...base().sessions[1]},{editingId:'b',asOf});
  assert.ok(!self.notes.some(n=>/算成两场/.test(n.text)),'editing a record never matches itself');
});
test('project names: new project is announced, near-duplicate spelling is warned',()=>{
  const fresh=I.sessionImpact(base(),{date:'2026-10-28',course:'x',project:'海外 HR',people:3,duration:1},{asOf});
  assert.ok(fresh.notes.some(n=>n.tone==='info'&&/新项目名/.test(n.text)));
  const near=I.sessionImpact(base(),{date:'2026-10-28',course:'x',project:'咖啡 开小灶',people:3,duration:1},{asOf});
  assert.ok(near.notes.some(n=>n.tone==='warn'&&/只差空格/.test(n.text)));
  const known=I.sessionImpact(base(),{date:'2026-10-28',course:'x',project:'咖啡开小灶',people:3,duration:1},{asOf});
  assert.ok(!known.notes.some(n=>/项目/.test(n.text)));
  assert.deepEqual(I.projectSuggestions(base()),['咖啡开小灶','2026管理者训练营 1.0','AI 分享月','新员工入职']);
});
test('AI 分享月: a matching share record is the same event, otherwise it adds one',()=>{
  const st=base();st.sessions=st.sessions.filter(s=>s.id!=='d');
  const merged=I.sessionImpact(st,{date:'2026-10-15',course:'Prompt 入门',project:'AI 分享月',people:30,duration:1},{asOf});
  assert.ok(merged.notes.some(n=>/不会重复增加/.test(n.text)));
  const added=I.sessionImpact(st,{date:'2026-10-20',course:'AI 做表',project:'AI 分享月',people:20,duration:1},{asOf});
  assert.ok(added.notes.some(n=>/同时计为分享月 1 场/.test(n.text)));
});
test('long single sessions and missing figures are explained, not treated as zero',()=>{
  const long=I.sessionImpact(base(),{date:'2026-10-28',course:'x',project:'咖啡开小灶',people:12,duration:12},{asOf});
  assert.ok(long.notes.some(n=>n.tone==='warn'&&/12 小时偏长/.test(n.text)));
  const missing=I.sessionImpact(base(),{date:'2026-10-28',course:'x',project:'咖啡开小灶',people:'',duration:1},{asOf});
  assert.equal(missing.delta.sessions,1);assert.equal(missing.delta.people,0);
  assert.ok(missing.notes.some(n=>/待补/.test(n.text)));
  assert.equal(I.sessionImpact(base(),{date:''},{asOf}).ready,false);
});
test('metric explanations use the aggregate figures and list the contributing records',()=>{
  const agg=R.aggregate(base(),R.period('month','2026-10',asOf));
  const h=I.explainMetric('hours',agg);
  assert.equal(h.value,`${agg.hours} 人时`);assert.match(h.records[0].value,/30 人 × 1 时 = 30/);
  assert.equal(I.explainMetric('sessions',agg).value,'3 场');
  assert.equal(I.explainMetric('people',agg).value,'46 人次');
  const s=I.explainMetric('spend',agg);assert.equal(s.value,'¥308');assert.equal(s.records[0].text,'Claude pro 会员');
  assert.ok(I.METHODOLOGY.length>=6);
  assert.throws(()=>I.explainMetric('nope',agg));
});
test('data source says plainly where saved edits live',()=>{
  const local=I.dataSource({status:'cloud'},{status:'local',dirty:true,configured:false});
  assert.equal(local.localOnly,true);assert.equal(local.tone,'warn');assert.match(local.save,/只在这台电脑的这个浏览器/);
  const ok=I.dataSource({status:'cloud'},{status:'synced',dirty:false,configured:true,lastCloud:new Date().toISOString()});
  assert.equal(ok.localOnly,false);assert.match(ok.line,/云端 · 最近同步 \d\d:\d\d/);
  assert.match(I.dataSource({status:'snapshot'},{status:'ready',configured:false}).origin,/站点快照/);
  assert.match(I.dataSource({status:'cloud'},{status:'error',configured:true}).save,/同步失败/);
  assert.equal(I.stamp('2026-10-29T09:40:00+08:00',new Date('2026-10-30T10:00:00+08:00')),'10月29日 09:40');
});
