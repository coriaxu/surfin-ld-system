/* Both file formats consume the exact same report model; neither reads live state.
 * Excel keeps every detail; PDF is a one-page editorial brief built from model.brief. */
(() => {
  // 导出库只在导出时加载：xlsx、jsPDF、html2canvas 合计约 1.4MB，不再拖慢首屏。版本与原先页头引用一致。
  const LIBS={
    xlsx:['https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js',()=>window.XLSX],
    jspdf:['https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js',()=>window.jspdf],
    html2canvas:['https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js',()=>window.html2canvas]
  };
  const loading={};
  function need(...names){
    return Promise.all(names.map(name=>{
      const [src,ready]=LIBS[name];
      if(ready())return null;
      return loading[name]||=new Promise((resolve,reject)=>{
        const tag=document.createElement('script');tag.src=src;tag.async=true;
        tag.onload=()=>ready()?resolve():reject(new Error('导出组件加载不完整，请刷新后重试'));
        tag.onerror=()=>{delete loading[name];tag.remove();reject(new Error('导出组件加载失败，请检查网络后重试'));};
        document.head.append(tag);
      });
    }));
  }
  window.LDExportLibs={need};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  function workbook(model){
    const wb=XLSX.utils.book_new();
    for(const s of [{name:'概览',header:[model.title,model.range],rows:model.overview},...model.sections]){
      const ws=XLSX.utils.aoa_to_sheet([s.header,...s.rows]);
      ws['!cols']=s.header.map((_,i)=>({wch:i===1?40:20}));XLSX.utils.book_append_sheet(wb,ws,s.name);
    }
    return wb;
  }

  /* Design system for the brief.
   * Type scale (px): 10 meta · 11 label · 12 body · 16 lead · 34 figure · 76 masthead. Spacing on an 8px rhythm.
   * Colour carries meaning only: accent = structure, amber = needs checking. Palette follows 晴山蓝 (tools/tokens.py, hue 245). */
  const C={ink:'#14191e',ink2:'#434d56',ink3:'#69737d',line:'#e3e7ea',rule:'#14191e',accent:'#2c5877',bar:'#9dbbcf',barBg:'#edf1f4',
    warn:'#c9973f',warnBg:'#fbf6ec',warnInk:'#7a520f',warnLine:'#ecdcb8'};
  const FONT='-apple-system,BlinkMacSystemFont,"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans SC","Helvetica Neue",Arial,sans-serif';
  const TAB='font-variant-numeric:tabular-nums;font-feature-settings:"tnum"';
  const num=v=>v===null||v===undefined?'待补':Number(v).toLocaleString('zh-CN',{maximumFractionDigits:1});
  const money=v=>v===null||v===undefined?'待补':'¥'+Math.round(Number(v)).toLocaleString('zh-CN');
  const dot=d=>d.replace(/-/g,'.');
  const UNFILLED='未填项目';

  function comparison(k){
    if(k.prev===undefined)return '';
    const isMoney=k.label==='实际支出',fmt=isMoney?money:num;
    if(k.prev===null||k.value===null)return `上月 ${fmt(k.prev)}`;
    const diff=Math.round((k.value-k.prev)*10)/10;
    const mark=diff===0?'持平':`${diff>0?'▲':'▼'} ${isMoney?money(Math.abs(diff)):num(Math.abs(diff))}`;
    return `上月 ${fmt(k.prev)}<span style="color:${C.ink2};margin-left:8px">${mark}</span>`;
  }
  const head=(no,title,note='')=>`<div style="display:flex;align-items:baseline;gap:8px;padding-bottom:8px;border-bottom:1px solid ${C.line};margin-bottom:12px">
      <span style="font-size:10px;font-weight:600;color:${C.accent};letter-spacing:.06em;${TAB}">${no}</span>
      <span style="font-size:12px;font-weight:600;color:${C.ink};letter-spacing:.04em">${esc(title)}</span>
      ${note?`<span style="margin-left:auto;font-size:10px;color:${C.ink3}">${esc(note)}</span>`:''}</div>`;
  const more=(n,cap,what)=>n>cap?`<div style="font-size:10px;color:${C.ink3};margin-top:8px">另有 ${n-cap} ${what}，见 Excel 明细</div>`:'';
  const tailKeep=(t,fn)=>{const s=String(t);let cut=s.length-Math.min(5,Math.max(0,s.length-1));const p=s.lastIndexOf('（');if(p>0&&s.indexOf('）',p)>p&&s.length-p<=28)cut=Math.min(cut,p);return fn(s.slice(0,cut))+`<span style="white-space:nowrap">${fn(s.slice(cut))}</span>`;};
  const keep=h=>h.replace(/(¥?\d[\d,.]*%?\s?(?:人次|人时|小时|场|门|期|条|项)?)/g,'<span style="white-space:nowrap">$1</span>');
  const emphasise=t=>esc(t).replace(/(（[^）]{1,24}）)/g,'<span style="white-space:nowrap">$1</span>').replace(/(¥?\d[\d,.]*%?)(\s?(?:人次|人时|小时|场|门|期|条|项)?)/g,`<span style="white-space:nowrap"><b style="color:${C.ink};font-weight:600">$1</b>$2</span>`);
  const tag=t=>`<span style="display:inline-block;margin-left:6px;padding:0 5px;border:1px solid ${C.warnLine};background:${C.warnBg};color:${C.warnInk};font-size:9.5px;font-weight:500;line-height:15px;border-radius:3px;vertical-align:1px">${t}</span>`;

  function masthead(model){
    const p=model.period||{},ytd=p.mode==='ytd',m=Number(String(p.month||'').slice(5))||'';
    const numeral=ytd?`1–${m}`:String(m),unit=ytd?'月累计':'月';
    return `<header>
      <div style="display:flex;justify-content:space-between;align-items:flex-end">
        <div style="display:flex;align-items:flex-end;gap:12px">
          <span style="font-size:68px;font-weight:200;line-height:.82;letter-spacing:-.045em;color:${C.ink};${TAB}">${numeral}</span>
          <span style="display:flex;flex-direction:column;padding-bottom:3px"><span style="font-size:16px;font-weight:600;color:${C.ink};line-height:1.2">${unit}</span><span style="font-size:11px;color:${C.ink3};letter-spacing:.08em;${TAB}">${esc(p.year||'')}</span></span></div>
        <div style="text-align:right;font-size:10px;color:${C.ink3};line-height:1.8;${TAB}"><span style="color:${C.accent};font-weight:600;letter-spacing:.2em">SURFIN · 学习发展${ytd?'年度':'月度'}简报</span><br>统计 ${esc(dot(p.start||''))} — ${esc(dot(String(p.end||'').slice(5)))} · 生成于 ${esc(dot(model.asOf||''))}</div></div>
      <div style="height:1.5px;background:${C.rule};margin-top:14px"></div></header>`;
  }

  function pageHTML(model,cap){
    const b=model.brief,show=b.show||{},flagged=new Set(b.flaggedCourses||[]);

    const kpis=`<div style="display:flex;border-bottom:1px solid ${C.line}">${b.kpis.map((k,i)=>`<div style="flex:1;padding:12px 0 12px ${i?16:0}px;${i?`border-left:1px solid ${C.line};`:''}">
        <div style="font-size:11px;color:${C.ink3};letter-spacing:.04em">${esc(k.label)}</div>
        <div style="margin-top:6px;white-space:nowrap;line-height:1"><span style="font-size:34px;font-weight:500;letter-spacing:-.02em;color:${C.ink};${TAB}">${k.label==='实际支出'?esc(money(k.value)):esc(num(k.value))}</span>${k.label==='实际支出'?'':`<span style="font-size:11px;color:${C.ink3};margin-left:4px">${esc(k.unit)}</span>`}</div>
        <div style="font-size:10.5px;color:${C.ink3};margin-top:8px;min-height:14px;white-space:nowrap;${TAB}">${comparison(k)}${k.pending?`<span style="color:${C.warnInk};margin-left:8px">${k.pending} 条待补</span>`:''}</div></div>`).join('')}</div>`;

    const maxH=Math.max(1,...b.projects.map(p=>p.hours||0));
    const projects=b.projects.slice(0,cap.list).map(p=>{const bad=p.name===UNFILLED;return `<div style="margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:baseline;gap:12px">
          <span style="font-size:12px;font-weight:500;color:${bad?C.warnInk:C.ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0">${esc(p.name)}${bad?tag('待核对'):''}</span>
          <span style="white-space:nowrap;${TAB}"><span style="font-size:10px;color:${C.ink3}">${p.sessions} 场 · ${esc(num(p.people))} 人次 · ${esc(num(p.hours))} 人时</span><span style="display:inline-block;min-width:34px;text-align:right;font-size:12px;font-weight:600;color:${bad?C.warnInk:C.ink}">${p.share===null?'—':p.share+'%'}</span></span></div>
        <div style="height:4px;background:${C.barBg};border-radius:2px;margin-top:6px"><div style="height:4px;width:${Math.max(1.5,Math.round((p.hours||0)/maxH*1000)/10)}%;background:${bad?C.warn:C.bar};border-radius:2px"></div></div></div>`;}).join('')||`<div style="font-size:12px;color:${C.ink3}">暂无记录</div>`;

    const cell=(v,align,extra='')=>`<td style="padding:5px 0;border-bottom:1px solid ${C.line};text-align:${align};${TAB};${extra}">${v}</td>`;
    const courses=b.courses.length?`<table style="width:100%;border-collapse:collapse;table-layout:fixed;font-size:12px;color:${C.ink2}">
        <colgroup><col><col style="width:38px"><col style="width:44px"><col style="width:48px"></colgroup>
        <thead><tr style="font-size:10px;color:${C.ink3}">${cell('课程 / 活动','left','padding-top:0')}${cell('场次','right','padding-top:0')}${cell('人次','right','padding-top:0')}${cell('人时','right','padding-top:0')}</tr></thead>
        <tbody>${b.courses.slice(0,cap.list).map(c=>`<tr>${cell(`${flagged.has(c.name)?`<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${C.warn};margin-right:6px;vertical-align:1px"></span>`:''}${esc(c.name)}`,'left',`color:${C.ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap`)}${cell(c.sessions,'right')}${cell(esc(num(c.people)),'right')}${cell(esc(num(c.hours)),'right',flagged.has(c.name)?`color:${C.warnInk};font-weight:600`:'')}</tr>`).join('')}</tbody></table>
        ${more(b.courses.length,cap.list,'类课程')}`:`<div style="font-size:12px;color:${C.ink3}">暂无记录</div>`;

    const aiBits=[show.ai===false||!b.shares.count?'':`AI 分享月 ${b.shares.count} 场${b.shares.people?` · ${num(b.shares.people)} 人次`:''}`,show.finance===false||!b.finance.count?'':`金融小百科 ${b.finance.count} 期`].filter(Boolean).join('　');
    const aiBlock=show.ai===false&&show.finance===false?'':`<div style="flex:1.2;min-width:0">${head('03','内容传播',show.ai===false?'':`AI 广播站 ${b.stations.length} 期${b.stationAvg!==null?` · 均回收 ${b.stationAvg}%`:''}`)}
        ${show.ai===false?'':b.stations.slice(0,cap.stations).map((s,i)=>`<div style="display:flex;gap:12px;align-items:baseline;font-size:12px;padding:5px 0;${i?`border-top:1px solid ${C.line}`:''}"><span style="font-size:10px;color:${C.ink3};white-space:nowrap;width:44px;${TAB}">${esc(s.episode.replace('第 ','No.').replace(' 期',''))}</span><span style="flex:1;color:${C.ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(s.title)}</span><span style="color:${C.ink2};white-space:nowrap;${TAB}">${esc(s.label)}</span></div>`).join('')}
        ${show.ai===false?'':more(b.stations.length,cap.stations,'期')}
        ${aiBits?`<div style="font-size:10.5px;color:${C.ink3};margin-top:8px;padding-top:8px;border-top:1px solid ${C.line};${TAB}">${esc(aiBits)}</div>`:''}</div>`;

    const costBlock=show.budget===false?'':`<div style="flex:1;min-width:0">${head('04','费用',b.budgetNote)}
        ${b.expenses.slice(0,cap.expenses).map((e,i)=>`<div style="display:flex;gap:12px;font-size:12px;padding:5px 0;${i?`border-top:1px solid ${C.line}`:''}"><span style="flex:1;color:${C.ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.desc)}</span><span style="color:${C.ink2};white-space:nowrap;${TAB}">${esc(money(e.amount))}</span></div>`).join('')||`<div style="font-size:12px;color:${C.ink3}">本期无开销</div>`}
        ${more(b.expenses.length,cap.expenses,'笔')}
        ${b.expenses.length?`<div style="display:flex;justify-content:space-between;font-size:12px;padding-top:6px;margin-top:2px;border-top:1px solid ${C.ink3}"><span style="color:${C.ink3}">合计</span><span style="color:${C.ink};font-weight:600;${TAB}">${esc(money(b.spend))}</span></div>`:''}</div>`;

    const checks=b.checks.length?`<div style="margin-top:${cap.gap}px;background:${C.warnBg};border-left:2px solid ${C.warn};padding:10px 16px">
        <div style="display:flex;align-items:baseline;gap:8px;margin-bottom:6px"><span style="font-size:12px;font-weight:600;color:${C.warnInk};letter-spacing:.04em">需要核对</span><span style="font-size:10px;color:${C.warnInk};${TAB}">${b.checks.length} 项</span></div>
        ${b.checks.slice(0,cap.checks).map(t=>`<div style="font-size:11.5px;line-height:1.7;color:${C.ink2}">${tailKeep(t,emphasise)}</div>`).join('')}
        ${b.checks.length>cap.checks?`<div style="font-size:10px;color:${C.ink3};margin-top:4px">另有 ${b.checks.length-cap.checks} 项，见系统总览</div>`:''}</div>`:'';

    const outcomeList=(o=>{const tail=b.outcomeTail||0;return o.length<=cap.outcomes?o:[...o.slice(0,Math.max(1,cap.outcomes-tail)),...o.slice(o.length-tail)];})(b.outcomes||[]);
    const outcomeItem=t=>{const m=/^「(.+?)」：(.*)$/.exec(t);return m?`<span style="color:${C.ink};font-weight:600">${esc(m[1])}</span><span style="color:${C.ink3};margin:0 6px">/</span>${tailKeep(m[2],x=>keep(esc(x)))}`:tailKeep(t,x=>keep(esc(x)));};
    const outcomes=outcomeList.length?`<div style="margin-top:${cap.gap}px">${head('05',(model.period||{}).mode==='ytd'?'本年做成了什么':'本月做成了什么','依据本期记录自动整理')}
        ${outcomeList.map((t,i)=>`<div style="display:flex;gap:12px;font-size:12px;line-height:1.7;color:${C.ink2};padding:2px 0">
          <span style="flex:none;width:16px;font-size:10px;font-weight:600;color:${C.accent};line-height:20px;${TAB}">${String(i+1).padStart(2,'0')}</span><span style="flex:1">${outcomeItem(t)}</span></div>`).join('')}</div>`:'';

    const training=show.training===false?'':`<div style="display:flex;gap:32px;margin-top:${cap.gap}px">
        <div style="flex:1.2;min-width:0">${head('01','投入去向','按项目 · 人时占比')}${projects}${more(b.projects.length,cap.list,'个项目')}</div>
        <div style="flex:1;min-width:0">${head('02','课程与活动')}${courses}</div></div>`;

    return `${masthead(model)}
      <p style="margin:${cap.gap-4}px 0 ${cap.gap-4}px;font-size:15px;line-height:1.75;color:${C.ink2};letter-spacing:.01em">${tailKeep(b.headline,emphasise)}</p>
      ${kpis}
      ${training}
      ${aiBlock||costBlock?`<div style="display:flex;gap:32px;margin-top:${cap.gap}px">${aiBlock}${costBlock}</div>`:''}
      ${checks}
      ${outcomes}`;
  }

  // Build one A4 page; shrink list caps until everything fits, so the brief never spills onto page 2.
  function onePage(model){
    if(!model.brief)throw new Error('缺少简报数据');
    const host=document.createElement('div');host.id='pdf-render-container';host.style.cssText='position:fixed;left:-10000px;top:0;width:794px;';document.body.append(host);
    const page=document.createElement('div');
    page.style.cssText=`width:794px;height:1123px;box-sizing:border-box;padding:44px 56px 0;position:relative;background:#ffffff;color:${C.ink};font:12px/1.5 ${FONT};-webkit-font-smoothing:antialiased;`;
    page.innerHTML=`<main style="height:1013px;overflow:hidden"></main><footer style="position:absolute;left:56px;right:56px;bottom:24px;display:flex;justify-content:space-between;gap:16px;font-size:9.5px;color:${C.ink3};border-top:1px solid ${C.line};padding-top:10px;${TAB}"><span>口径：参训人次按场次累加；人时 = 每场人数 × 时长；缺失值不计入合计。完整明细见同期 Excel。</span><span style="white-space:nowrap;letter-spacing:.06em">SURFIN L&amp;D · 1 / 1</span></footer>`;
    host.append(page);
    const main=page.querySelector('main');
    // Try generous spacing first, then tighten spacing, then trim lists.
    const full={list:6,stations:5,expenses:4,checks:4,outcomes:4};
    const steps=[{...full,gap:36},{...full,gap:32},{...full,gap:28},{...full,gap:24},{...full,gap:20},{list:5,stations:4,expenses:3,checks:3,outcomes:4,gap:20},{list:4,stations:3,expenses:3,checks:3,outcomes:3,gap:18},{list:3,stations:2,expenses:2,checks:2,outcomes:3,gap:16}];
    for(const [i,cap] of steps.entries()){main.innerHTML=pageHTML(model,cap);page.dataset.step=String(i);if(main.scrollHeight<=main.clientHeight)break;}
    return {host,pages:[page]};
  }

  async function pdf(model,{save=true}={}){
    await need('jspdf','html2canvas');
    const {host,pages}=onePage(model);
    try{
      await document.fonts.ready;const doc=new jspdf.jsPDF('p','mm','a4');
      // 3x raster keeps 9.5px type crisp when zoomed or printed.
      const canvas=await html2canvas(pages[0],{scale:3,useCORS:true,backgroundColor:'#ffffff'});
      doc.addImage(canvas.toDataURL('image/jpeg',0.92),'JPEG',0,0,210,297,undefined,'FAST');
      doc.setProperties({title:`Surfin 学习发展简报 ${model.title}`,subject:model.range,creator:'Surfin L&D System'});
      if(save)doc.save(model.filename+'.pdf');return doc;
    }finally{host.remove();}
  }
  window.LDReportExport={workbook,onePage,pdfPages:onePage,pdf,async excel(model){await need('xlsx');XLSX.writeFile(workbook(model),model.filename+'.xlsx');}};
})();
