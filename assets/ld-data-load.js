/* 只负责启动读取与呈现，不负责保存、同步或版本合并。 */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.LDDataLoad=api;
})(globalThis,()=>{
  const FAILURE='数据未能加载，当前数字不完整，请刷新';
  const LABELS={loading:'正在加载数据…',cloud:'云端已同步',snapshot:'站点快照 · 可能延迟几分钟',failed:'加载失败'};
  const SNAPSHOT_TITLE='已从站点快照载入（可能延迟几分钟）';
  const unavailable=status=>status==='loading'||status==='failed';
  const metric=(value,status)=>unavailable(status)?'—':value;
  async function load({fetcher=fetch,timeoutMs=5000,now=Date.now}={}){
    async function read(url){
      const controller=new AbortController();let timer;
      try{
        // 包含正文解析；即使某个 fetch 实现不响应 abort，也能按时进入备用来源。
        return await Promise.race([
          (async()=>{
            const response=await fetcher(url,{cache:'no-store',signal:controller.signal});
            if(!response.ok)throw new Error('数据源响应失败');
            const data=await response.json();
            if(!data||typeof data!=='object'||!['sessions','budgets','expenses','aiStations','aiShares'].every(k=>Array.isArray(data[k])))throw new Error('数据结构无效');
            return data;
          })(),
          new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Error('数据源读取超时'));},timeoutMs);})
        ]);
      }finally{clearTimeout(timer);}
    }
    for(const [source,url] of [
      ['cloud','https://raw.githubusercontent.com/coriaxu/surfin-ld-system/main/user-data.json?t='+now()],
      ['snapshot','./user-data.json?t='+now()]
    ]){
      try{return {source,payload:await read(url)};}catch(_){/* 继续读取下一来源，不请求空的 data.json。 */}
    }
    return {source:'failed',payload:null};
  }
  function presentation(loadInfo,info){
    // 本机待同步、写入失败、同步中的原有状态不被启动来源提示遮盖。
    if(!['ready','synced'].includes(info.status))return info;
    if(loadInfo.status==='snapshot'&&info.lastCloud!==loadInfo.cloudTimestamp)return info;
    if(!['loading','snapshot','failed'].includes(loadInfo.status))return info;
    return {...info,status:loadInfo.status,lastCloud:null,error:loadInfo.status==='failed'?FAILURE:''};
  }
  return {load,FAILURE,LABELS,SNAPSHOT_TITLE,unavailable,metric,presentation};
});
