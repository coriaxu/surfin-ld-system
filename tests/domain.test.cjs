const {test}=require('node:test');const assert=require('node:assert/strict');const D=require('../assets/ld-domain.js');
test('missing metrics, explicit zero and ambiguous historical zero remain distinct',()=>{
 assert.deepEqual(D.stationMetric({views:null,total:100}),{value:null,status:'pending',label:'待回收'});
 assert.equal(D.stationMetric({views:0,total:100}).status,'review');
 assert.equal(D.stationMetric({views:0,total:100,collectionState:'collected'}).value,0);
 const payload=D.stationPayload({episode:1,title:'期次',unviewed:'',total:'',date:'2026-09-12'},'one');
 assert.equal(payload.views,null);assert.equal(payload.total,null);assert.equal(payload.collectionState,'pending');
 assert.throws(()=>D.stationPayload({title:'期次',unviewed:101,total:100},'one'));
});
test('finance ratios clear when a field is blank and all views use one publication rule',()=>{
 assert.equal(D.rate('',100),null);assert.equal(D.rate(0,100),0);assert.equal(D.rate(10,''),null);
 assert.equal(D.financeStatus({workflow:{publish:true},read:null,downloads:0,total:10}).key,'pending');
 assert.equal(D.financeStatus({published:false,workflow:{publish:true},read:2,downloads:0,total:10}).key,'draft');
 assert.equal(D.financeStatus({published:true,read:2,downloads:0,total:10}).key,'complete');
});
test('share edits retain the linked training record across date and episode changes',()=>{
 const state={sessions:[],aiShares:[]};let count=0;
 D.upsertShare(state,{id:'s1',episode:1,date:'2026-09-01',title:'一次',attendees:3,duration:90},()=>`r${++count}`);
 D.upsertShare(state,{id:'s1',episode:2,date:'2026-09-02',title:'更新',attendees:4,duration:90},()=>`r${++count}`);
 assert.equal(state.sessions.length,1);assert.equal(state.sessions[0].id,'r1');assert.equal(state.sessions[0].duration,1.5);
 assert.equal(D.monthly({...state,expenses:[],budgets:[]},'2026-09').hours,6);
 D.upsertShare(state,{id:'s1',episode:2,date:'2026-09-02',title:'更新',attendees:null,duration:null},()=>`r${++count}`);
 assert.equal(state.sessions.length,1);assert.equal(D.monthly(state,'2026-09').hours,0);
});
test('uncollected share does not create a false zero training record',()=>{
 const state={sessions:[],aiShares:[]};D.upsertShare(state,{id:'s1',episode:1,date:'2026-09-01',title:'待补',attendees:null,duration:null},()=>1);assert.equal(state.sessions.length,0);
});
test('three-way merge preserves unrelated remote changes and local deletions',()=>{
 const base={sessions:[{id:'a',people:1},{id:'b',people:2}]};const local={sessions:[{id:'a',people:3}]};const remote={sessions:[{id:'a',people:1},{id:'b',people:2},{id:'c',people:4}]};
 assert.deepEqual(D.mergeThreeWay(base,local,remote).sessions,[{id:'a',people:3},{id:'c',people:4}]);
 assert.throws(()=>D.mergeThreeWay(base,{sessions:[{id:'a',people:3}]},{sessions:[{id:'a',people:5}]}),e=>e.code==='CONFLICT');
});
test('monthly aggregation counts attendance and does not invent a zero budget',()=>{
 const result=D.monthly({sessions:[{date:'2026-09-01',people:3,duration:2},{date:'2026-09-02',people:4,duration:1}],expenses:[{month:'2026-09',amount:100}],budgets:[]},'2026-09');
 assert.equal(result.people,7);assert.equal(result.hours,10);assert.equal(result.budget,null);assert.equal(result.spend,100);
});
test('viewing a workflow previews missing steps without creating or deleting records',()=>{
 const source=[{id:'old',episode:1,name:'旧任务',stage:'prep',done:true}],before=JSON.stringify(source),template=[{name:'制作',stage:'dev'}];
 const first=D.taskPreview(source,1,template,{},'share'),second=D.taskPreview(source,1,template,{},'share');
 assert.equal(JSON.stringify(source),before);assert.deepEqual(first,second);assert.equal(first[0].done,false);
});
