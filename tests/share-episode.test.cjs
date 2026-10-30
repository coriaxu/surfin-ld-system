const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');const D=require('../assets/ld-domain.js');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'..','user-data.json'),'utf8'));

test('AI 分享月期数按日期连续编号：分享月记录和培训记录里的分享一起排，不再出现“—”',()=>{
  const events=D.shareEvents(data);
  assert.ok(events.length>=7);
  assert.ok(events.every(e=>e.date&&Number.isInteger(e.episode)),'每一场都有期数');
  const asc=[...events].reverse();
  assert.deepEqual(asc.map(e=>e.episode),asc.map((_,i)=>i+1),'从早到晚 1…N');
  assert.ok(asc.every((e,i)=>!i||asc[i-1].date<=e.date));
  const first=asc[0];assert.equal(first.date,'2026-01-22');assert.equal(first.episode,1);assert.equal(first.storedEpisode,1);
  const sep=events.find(e=>e.date==='2026-09-23');assert.equal(sep.episode,7);assert.equal(sep.lecturer,'冯世祺');
});
test('维度与培训场次一致：讲师、人数、时长可直接算总人时；未填日期的场次没有期数',()=>{
  const state={aiShares:[{id:'a',episode:5,date:'2026-02-01',title:'甲',attendees:10,duration:90}],sessions:[
    {id:'b',date:'2026-01-10',course:'乙',project:'AI 分享月',lecturer:'张三',people:8,duration:1},
    {id:'c',date:'',course:'丙',project:'AI 分享月',people:3,duration:1}]};
  const ev=D.shareEvents(state);
  assert.deepEqual(ev.map(e=>[e.id,e.episode]),[['a',2],['b',1],['c',null]]);
  assert.equal(ev[0].storedEpisode,5,'原先手填的期号保留');
  const b=ev.find(e=>e.id==='b');assert.equal(b.lecturer,'张三');assert.equal(b.people*b.minutes/60,8);
});
