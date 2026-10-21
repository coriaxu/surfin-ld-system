const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');const path=require('node:path');const vm=require('node:vm');
const L=require('../assets/ld-data-load.js');
const payload=()=>({sessions:[{id:'fixture',date:'2026-10-20',people:2,duration:1}],budgets:[],expenses:[],aiStations:[],aiShares:[]});
const ok=data=>({ok:true,json:async()=>data});
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const workflow=fs.readFileSync(path.join(__dirname,'../assets/workflow.js'),'utf8');
test('raw success uses latest data without requesting site snapshot',async()=>{
 const calls=[];const p=payload();const r=await L.load({fetcher:async(u,o)=>{calls.push(u);assert.equal(o.cache,'no-store');assert.ok(o.signal);return ok(p);}});
 assert.equal(r.source,'cloud');assert.deepEqual(r.payload,p);assert.equal(calls.length,1);assert.match(calls[0],/^https:\/\/raw.githubusercontent.com\//);
});
test('raw timeout aborts and falls back to same-origin user-data.json',async()=>{
 const calls=[];let signal;const p=payload();
 const r=await L.load({timeoutMs:20,fetcher:(u,o)=>{calls.push(u);if(calls.length===1){signal=o.signal;return new Promise(()=>{});}return Promise.resolve(ok(p));}});
 assert.equal(signal.aborted,true);assert.equal(r.source,'snapshot');assert.deepEqual(r.payload,p);assert.match(calls[1],/^\.\/user-data.json\?/);assert.equal(calls.length,2);
});
test('both sources fail explicitly, never request data.json or fabricate a payload',async()=>{
 const calls=[];const r=await L.load({fetcher:async u=>{calls.push(u);throw Error('offline');}});
 assert.deepEqual(r,{source:'failed',payload:null});assert.equal(calls.length,2);assert.ok(calls.every(u=>!/(^|\/)data.json\?/.test(u)));
});
test('HTTP or invalid JSON shape triggers the next source',async()=>{
 for(const response of [{ok:false},ok({}),{ok:true,json:async()=>{throw Error('bad json');}}]){
  let n=0;const r=await L.load({fetcher:async()=>++n===1?response:ok(payload())});assert.equal(r.source,'snapshot');assert.equal(n,2);
 }
});
test('a real empty user-data payload remains a valid zero rather than loading failure',async()=>{
 const p=payload();p.sessions=[];const r=await L.load({fetcher:async()=>ok(p)});assert.equal(r.source,'cloud');assert.equal(L.metric(0,r.source),0);
});
test('timeout includes stalled JSON body and also bounds the fallback',async()=>{
 let calls=0;const r=await L.load({timeoutMs:15,fetcher:async()=>{calls++;return {ok:true,json:()=>new Promise(()=>{})};}});
 assert.equal(calls,2);assert.equal(r.source,'failed');
});
test('read labels do not hide pending writes, sync errors or a newer successful sync',()=>{
 const snapshot={status:'snapshot',cloudTimestamp:'old'},info={status:'synced',lastCloud:'old'};
 assert.equal(L.presentation(snapshot,info).status,'snapshot');assert.equal(L.presentation(snapshot,info).lastCloud,null);
 assert.equal(L.presentation(snapshot,{status:'synced',lastCloud:'new'}).status,'synced');
 for(const status of ['local','syncing','error','save-error'])assert.equal(L.presentation(snapshot,{status}).status,status);
 assert.equal(L.presentation({status:'failed'},{status:'ready'}).status,'failed');
});
function bootContext({result={source:'failed',payload:null},pending=false}={}){
 const accepted=[],writes=[],scheduled=[];const context={PRIVATE_MODE:false,window:{LDLoadInfo:{}},LDDataLoad:{...L,load:async()=>result},document:{documentElement:{dataset:{}},dispatchEvent:()=>{}},Event:class{},dataStorage:{getItem:()=>JSON.stringify(payload()),setItem:(...a)=>writes.push(a)},STORAGE_KEY:'test',DATA_VERSION:3,applyImportedState:()=>{},state:{},syncController:{getStatus:()=>({lastCloud:null}),acceptRemote:p=>accepted.push(p),hasPending:()=>pending,emit:()=>{},schedule:()=>scheduled.push(true)}};
 const source=html.slice(html.indexOf('    function setDataLoadState('),html.indexOf('    const SYNC_SETTINGS_KEY'));
 vm.createContext(context);vm.runInContext(source,context);return {context,accepted,writes,scheduled};
}
test('failed initial load neither accepts defaults nor overwrites the existing browser cache',async()=>{
 const {context,accepted,writes}=bootContext();await context.initData();assert.equal(context.window.LDLoadInfo.status,'failed');assert.equal(accepted.length,0);assert.equal(writes.length,0);
});
test('site snapshot uses existing acceptRemote and version path; pending edits keep original priority',async()=>{
 const p=payload();const a=bootContext({result:{source:'snapshot',payload:p}});await a.context.initData();assert.deepEqual(a.accepted,[p]);assert.deepEqual(a.writes,[['test_version','3']]);assert.equal(a.context.window.LDLoadInfo.status,'snapshot');
 const b=bootContext({pending:true});await b.context.initData();assert.equal(b.accepted.length,0);assert.equal(b.scheduled.length,1);assert.equal(b.context.window.LDLoadInfo.status,'local');
});
test('actual dashboard stat renderer replaces 0 and currency zero with unloaded placeholders',()=>{
 const source=workflow.split('\n').find(line=>line.startsWith('  function stat('));assert.ok(source);
 const desc={},label={},node={closest:()=>({querySelector:s=>s==='.stat-desc'?desc:label})};
 const ctx={LDDataLoad:L,window:{LDLoadInfo:{status:'failed'}},$:()=>node,loadUnavailable:()=>L.unavailable(ctx.window.LDLoadInfo.status)};vm.createContext(ctx);vm.runInContext(source,ctx);
 for(const value of [0,'0','¥0']){ctx.stat('statSessions',value,'指标','说明');assert.equal(node.textContent,'—');assert.equal(desc.textContent,'未加载');}
 ctx.window.LDLoadInfo.status='cloud';ctx.stat('statSessions',0,'指标','说明');assert.equal(node.textContent,0);
 assert.match(workflow,/if\(loadUnavailable\(\)\)\{\s+reportSnapshot=null/);
});
