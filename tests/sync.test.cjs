const {test}=require('node:test');const assert=require('node:assert/strict');global.LDDomain=require('../assets/ld-domain.js');require('../assets/ld-sync.js');
function setup(){let state={sessions:[]};const data=new Map();const storage={getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};let remote={sessions:[]},fail=false,puts=0;const statuses=[];const settings={enabled:false,token:'test-only',repo:'test/repo',path:'data.json'};
 const controller=createLDSync({storage,key:'fixture',getState:()=>state,applyState:s=>state=structuredClone(s),getSettings:()=>settings,onChange:s=>statuses.push(s.status),fetcher:async(url,opts)=>{
  if(fail)throw new Error('离线');if(opts.method==='PUT'){puts++;remote=JSON.parse(Buffer.from(JSON.parse(opts.body).content,'base64').toString());return {ok:true};}
  return {ok:true,json:async()=>({sha:'fixture-sha',content:Buffer.from(JSON.stringify(remote)).toString('base64')})};
 },delay:100000});
 return {controller,statuses,settings,state:()=>state,setRemote:s=>remote=s,remote:()=>remote,setFail:v=>fail=v,puts:()=>puts};}
test('read hydration and unchanged rendering do not enqueue writes; failed save retains pending data',async()=>{
 const s=setup();s.controller.acceptRemote({sessions:[]});s.controller.save();assert.equal(s.puts(),0);assert.equal(s.controller.hasPending(),false);
 s.state().sessions.push({id:'a',people:1});s.controller.save();assert.equal(s.controller.getStatus().status,'local');s.settings.enabled=true;s.setFail(true);
 await assert.rejects(s.controller.push());assert.equal(s.controller.getStatus().status,'error');assert.equal(s.controller.hasPending(),true);assert.equal(s.state().sessions.length,1);
 s.setFail(false);await s.controller.push();assert.equal(s.controller.getStatus().status,'synced');assert.equal(s.controller.hasPending(),false);assert.equal(s.remote().sessions.length,1);
});
test('sync stops instead of overwriting a conflicting remote record',async()=>{
 const s=setup();s.controller.acceptRemote({sessions:[{id:'a',people:1}]});s.state().sessions[0].people=2;s.controller.save();s.setRemote({sessions:[{id:'a',people:3}]});s.settings.enabled=true;
 await assert.rejects(s.controller.push(),e=>e.code==='CONFLICT');assert.equal(s.puts(),0);assert.equal(s.state().sessions[0].people,2);
});
test('local storage failure never claims a successful local save',()=>{
 const store={getItem:()=>null,setItem:()=>{throw Error('quota exceeded');}};let status;
 const controller=createLDSync({storage:store,key:'quota',getState:()=>({sessions:[]}),applyState:()=>{},getSettings:()=>({enabled:false}),onChange:s=>status=s.status});
 assert.throws(()=>controller.save(),/本机保存失败/);assert.equal(status,'save-error');
});
