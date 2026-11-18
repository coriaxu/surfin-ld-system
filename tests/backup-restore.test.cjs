const {test}=require('node:test');
const assert=require('node:assert/strict'), fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const fixture=()=>({sessions:[{id:'training'}],budgets:[],expenses:[{id:'cost'}],aiStations:[],aiShares:[],aiStationTasks:[{id:'task',episode:2}],aiShareTasks:[],financeWiki:[{id:'wiki'}],aiStationTitles:{2:'标题'},aiShareTitles:{},currentStationEpisode:2,currentShareEpisode:null});
function harness(){
 const state=fixture(), input={}, notices=[], prompts=[], saves=[];
 const context={window:{LDLoadInfo:{status:'cloud'}},state,DATA_VERSION:3,syncSettings:{enabled:false},document:{getElementById:()=>input},FileReader:class{readAsText(text){this.onload({target:{result:text}});}},showConfirm:(message,accept)=>prompts.push({message,accept}),showToast:message=>notices.push(message),persist:()=>saves.push(structuredClone(state)),renderAll:()=>{},renderAIKnowledge:()=>{},atob,btoa};
 input.addEventListener=(type,handler)=>{input.change=handler;};
 vm.runInNewContext(html.slice(html.indexOf('    const BACKUP_PREFIX'),html.indexOf('    window.forceClearCache')),context);
 function open(data,mode){
   if(mode==='json')input.change({target:{files:[JSON.stringify(data)]}});
   else {input.value='S-LD:'+Buffer.from(JSON.stringify(data)).toString('base64');context.window.restoreBackupCode();}
 }
 return {state,saves,notices,prompts,open};
}
for(const mode of ['json','code']){
 test(mode+' refuses incomplete or malformed backups before confirmation',()=>{
   for(const invalid of [{sessions:[]},{...fixture(),aiShareTitles:[]},{...fixture(),expenses:[null]},{...fixture(),financeWiki:{}},{...fixture(),currentStationEpisode:undefined},{version:9,data:fixture()}]){
     const app=harness();app.open(invalid,mode);assert.equal(app.prompts.length,0);assert.equal(app.saves.length,0);assert.deepEqual(app.state,fixture());assert.match(app.notices[0],/导入失败/);
   }
 });
 test(mode+' previews all affected categories, only saves once on confirmation',()=>{
   const app=harness(),next={...fixture(),aiStationTasks:[],aiStationTitles:{},currentStationEpisode:null};
   app.open(mode==='code'?{version:3,data:next}:next,mode);
   assert.deepEqual(app.state,fixture());assert.equal(app.saves.length,0);
   assert.match(app.prompts[0].message,/广播站任务：1 → 0/);assert.match(app.prompts[0].message,/广播站标题：1 → 0/);
   app.prompts[0].accept();assert.equal(app.saves.length,1);assert.deepEqual(JSON.parse(JSON.stringify(app.state)),next);
 });
 test(mode+' restores a version 2 envelope without clearing modern expenses',()=>{
   const app=harness(),data=fixture();delete data.expenses;
   app.open({version:2,data},mode);assert.match(app.prompts[0].message,/保留当前记录/);app.prompts[0].accept();assert.deepEqual(app.saves[0].expenses,fixture().expenses);
 });
}
test('an edit after preview invalidates confirmation',()=>{
 const app=harness();app.open(fixture(),'json');app.state.expenses.push({id:'new'});app.prompts[0].accept();assert.equal(app.saves.length,0);assert.equal(app.state.expenses.length,2);
});
