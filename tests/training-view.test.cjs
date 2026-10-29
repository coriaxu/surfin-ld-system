const {test}=require('node:test');const assert=require('node:assert/strict');const TV=require('../assets/training-view.js');
test('weeks start on Monday and records without dates form their own group',()=>{
 assert.equal(TV.weekStart('2026-10-29'),'2026-10-26');
 assert.equal(TV.weekStart('2026-10-26'),'2026-10-26');
 assert.equal(TV.weekStart('2026-11-01'),'2026-10-26');
 assert.equal(TV.weekStart(''),'');
 assert.equal(TV.weekLabel('2026-10-26'),'10/26 – 11/1');
 assert.equal(TV.weekLabel(''),'未填日期');
 const g=TV.groupByWeek([{date:'2026-10-29'},{date:'2026-10-30'},{date:'2026-10-23'},{date:''}]);
 assert.deepEqual([...g.keys()],['2026-10-26','2026-10-19','']);
 assert.equal(g.get('2026-10-26').length,2);
});
test('weekly subtotal follows the dashboard rule: missing people or duration counts as a session only',()=>{
 assert.deepEqual(TV.summarize([{people:6,duration:2},{people:4,duration:1},{people:null,duration:1}]),{count:3,hours:16,missing:1});
 assert.deepEqual(TV.summarize([{people:1,duration:0.5},{people:1,duration:0.5}]),{count:2,hours:1,missing:0});
});
test('project tones are stable and only affect display',()=>{
 assert.equal(TV.tone('2026管理者训练营 1.0'),'mgr');
 assert.equal(TV.tone('AI 赋能训练营第四期'),'ai4');
 assert.equal(TV.tone('AI赋能第四期'),'ai4');
 assert.equal(TV.tone('咖啡开小灶'),'cafe');
 assert.equal(TV.tone('AI 赋能训练营'),'past');
 assert.equal(TV.tone(''),'none');
 assert.match(TV.tone('新员工入职'),/^t[1-4]$/);
 assert.equal(TV.tone('新员工入职'),TV.tone('新员工 入职'));
});
test('one-on-one courses get a short label without losing other course names',()=>{
 assert.deepEqual(TV.splitOneOnOne('1 对 1 辅导答疑'),{one:true,rest:'辅导答疑'});
 assert.deepEqual(TV.splitOneOnOne('1对1'),{one:true,rest:'1对1'});
 assert.deepEqual(TV.splitOneOnOne('认可与建设性反馈'),{one:false,rest:'认可与建设性反馈'});
 assert.deepEqual(TV.splitOneOnOne('第三期：用 AI 做一支视频'),{one:false,rest:'第三期：用 AI 做一支视频'});
});
test('month grid covers full Monday-to-Sunday weeks',()=>{
 const g=TV.monthGrid('2026-10');
 assert.equal(g.length,5);assert.equal(g[0][0],'2026-09-28');assert.equal(g.at(-1)[6],'2026-11-01');
 assert.ok(g.every(w=>w.length===7));
 assert.equal(TV.shiftMonth('2026-01',-1),'2025-12');assert.equal(TV.shiftMonth('2026-12',1),'2027-01');
});
test('calendar places sessions by date, marks future ones as planned and escapes text',()=>{
 const html=TV.calendarHTML({month:'2026-10',today:'2026-10-29',sessions:[
  {id:'a',date:'2026-10-29',course:'认可与建设性反馈',project:'2026管理者训练营 1.0',people:6,duration:2,note:'第四课'},
  {id:'b',date:'2026-10-30',course:'第三期：用 AI 做一支视频',project:'咖啡开小灶',people:4,duration:1,note:'<b>往期</b>'},
  {id:'c',date:'2026-10-21',course:'1 对 1 辅导答疑',project:'AI 赋能训练营第四期',people:1,duration:1,note:'江国浩'}]});
 assert.equal((html.match(/class="tv-wk/g)||[]).length,5);
 assert.equal((html.match(/class="tv-card[ "]/g)||[]).length,2);
 assert.equal((html.match(/class="tv-pill[ "]/g)||[]).length,1);
 assert.match(html,/tv-card tone-cafe is-plan/);
 assert.doesNotMatch(html,/tv-card tone-mgr is-plan/);
 assert.match(html,/&lt;b&gt;往期&lt;\/b&gt;/);
 assert.match(html,/江国浩/);
 assert.match(html,/10\/26 – 11\/1<em>本周<\/em>/);
 assert.match(html,/<div class="tv-big">16<small>/);
});
test('live data: removed duplicates stay removed and the last October week totals 16 person-hours',()=>{
 const data=require('../user-data.json');
 assert.ok(!data.sessions.some(s=>['jg6gouut','0u63sk00'].includes(s.id)));
 const wk=TV.groupByWeek(data.sessions).get('2026-10-26')||[];
 assert.equal(TV.summarize(wk).hours,16);
});
