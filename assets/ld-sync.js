(function(root) {
  root.createLDSync = function({storage,key,getState,applyState,getSettings,onChange,fetcher=fetch,delay=3000}) {
    const metaKey=key+'_sync_meta', baseKey=key+'_sync_base';
    const parse=(k,fallback)=>{try{return JSON.parse(storage.getItem(k)) ?? fallback;}catch{return fallback;}};
    let meta=parse(metaKey,{dirty:false,lastLocal:null,lastCloud:null}), base=parse(baseKey,null);
    let timer=null, running=null, lastSnapshot=storage.getItem(key), status=meta.dirty ? 'local' : 'ready', error='';
    const emit=()=>onChange?.({status,error,...meta,configured:!!(getSettings().enabled && (getSettings().token || getSettings().server))});
    const persistMeta=()=>storage.setItem(metaKey,JSON.stringify(meta));
    function acceptRemote(payload) {
      applyState(payload); lastSnapshot=JSON.stringify(getState()); storage.setItem(key,lastSnapshot);
      base=structuredClone(payload); storage.setItem(baseKey,JSON.stringify(base));
      meta={dirty:false,lastLocal:meta.lastLocal,lastCloud:new Date().toISOString()}; persistMeta(); status='synced'; error=''; emit();
    }
    function save() {
      const snapshot=JSON.stringify(getState());
      if (snapshot === lastSnapshot) {emit();return;}
      try{storage.setItem(key,snapshot);meta.dirty=true;meta.lastLocal=new Date().toISOString();persistMeta();lastSnapshot=snapshot;}catch(err){status='save-error';error='本机保存失败，请导出备份并检查浏览器存储空间';emit();throw new Error(error,{cause:err});}
      status='local';error='';emit();schedule();
    }
    function schedule() {
      clearTimeout(timer);
      const settings=getSettings();
      if(settings.enabled && (settings.token || settings.server) && meta.dirty) timer=setTimeout(()=>push().catch(()=>{}),delay);
    }
    async function push() {
      if(running) return running;
      clearTimeout(timer);
      const settings={...getSettings()};
      if(!settings.enabled || (!settings.token&&!settings.server)) throw new Error('当前账号未启用编辑同步');
      running=(async()=>{
        status='syncing';error='';emit();
        const local=structuredClone(getState());
        const url=settings.server?'/api/data':`https://api.github.com/repos/${settings.repo}/contents/${settings.path}`;
        const headers=settings.server?{Accept:'application/json'}:{Authorization:`token ${settings.token}`,Accept:'application/vnd.github+json'};
        try {
          const response=await fetcher(url,{headers,cache:'no-store'});
          if(!response.ok) throw new Error(response.status === 401 ? '登录凭证已失效，请更新同步设置' : `读取云端失败（${response.status}）`);
          const file=await response.json();
          const remote=settings.server?file:JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(file.content.replace(/\s/g,'')),c=>c.charCodeAt(0))));
          if(!base) throw new Error('尚未建立同步基线，请先导出本机副本，再从云端拉取');
          const merged=LDDomain.mergeThreeWay(base,local,remote);
          const bytes=new TextEncoder().encode(JSON.stringify(merged,null,2));
          let binary='';for(const byte of bytes)binary+=String.fromCharCode(byte);
          const result=await fetcher(url,{method:'PUT',headers:{...headers,'Content-Type':'application/json',...(settings.server?{'If-Match':response.headers.get('etag')}: {})},body:settings.server?JSON.stringify(merged):JSON.stringify({message:`Sync data - ${new Date().toISOString()}`,content:btoa(binary),sha:file.sha,branch:'main'})});
          if(!result.ok) throw new Error(result.status===403 ? '当前账号为只读权限，无法提交更改' : result.status===401 ? '登录已过期，请重新登录后重试' : result.status===409 ? '同步期间云端有新修改，请重试' : `同步失败（${result.status}）`);
          // Preserve edits made while this request was in flight.
          const current=structuredClone(getState());
          const next=LDDomain.mergeThreeWay(local,current,merged);
          applyState(next);base=merged;storage.setItem(baseKey,JSON.stringify(base));
          lastSnapshot=JSON.stringify(getState());storage.setItem(key,lastSnapshot);
          meta.lastCloud=new Date().toISOString();meta.dirty=JSON.stringify(next)!==JSON.stringify(merged);
          persistMeta();status=meta.dirty?'local':'synced';emit();
          return true;
        } catch(err) {status='error';error=err.message;meta.dirty=true;persistMeta();emit();throw err;}
      })();
      try{return await running;}finally{running=null;if(meta.dirty && status!=='error')schedule();}
    }
    return {save,push,acceptRemote,schedule,emit,hasPending:()=>meta.dirty,getStatus:()=>({status,error,...meta})};
  };
})(globalThis);
