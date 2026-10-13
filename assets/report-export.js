/* Both file formats consume the exact same report model; neither reads live state. */
(() => {
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function workbook(model){
    const wb=XLSX.utils.book_new();
    for(const s of [{name:'概览',header:[model.title,model.range],rows:model.overview},...model.sections]){
      const ws=XLSX.utils.aoa_to_sheet([s.header,...s.rows]);
      ws['!cols']=s.header.map((_,i)=>({wch:i===1?40:20}));XLSX.utils.book_append_sheet(wb,ws,s.name);
    }
    return wb;
  }
  function pdfPages(model){
    const host=document.createElement('div');host.id='pdf-render-container';host.style.cssText='position:fixed;left:-10000px;top:0;width:794px;';document.body.append(host);
    const pages=[];let body;
    function addPage(){
      const page=document.createElement('div');page.style.cssText='width:794px;height:1123px;box-sizing:border-box;padding:36px;color:#fff;background:#112940;font:13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
      page.innerHTML=`<header style="height:90px"><div style="letter-spacing:3px;color:#a6bdcd;font-size:11px">SURFIN L&D SYSTEM</div><h1 style="font-size:25px;margin:12px 0 8px;color:#7dd3fc">${esc(model.title)}</h1><div>${esc(model.range)}</div></header><main style="height:928px;overflow:hidden"></main><footer style="padding-top:16px;font-size:11px;color:#a6bdcd">学习发展工作总结 · 第 ${pages.length+1} 页</footer>`;
      host.append(page);pages.push(page);body=page.querySelector('main');
    }
    const rowHTML=(cells,tag='td')=>'<tr>'+cells.map(v=>`<${tag} style="padding:8px 6px;border-bottom:1px solid #ffffff25;text-align:left;vertical-align:top;overflow-wrap:anywhere;line-height:1.55;color:#ffffff;background:${tag==='th'?'#23435b':'transparent'}">${esc(v)}</${tag}>`).join('')+'</tr>';
    try{
      addPage();
      for(const section of [{name:'工作概览',header:['指标','数值与说明'],rows:model.overview},...model.sections]){
        let table;
        function startTable(continued=false){
          const title=document.createElement('h2');title.style.cssText='font-size:16px;color:#7dd3fc;margin:18px 0 8px';title.textContent=section.name+(continued?'（续）':'');body.append(title);
          table=document.createElement('table');table.style.cssText='border-collapse:collapse;width:100%;table-layout:fixed;font-size:12px';table.innerHTML='<thead style="background:#ffffff12">'+rowHTML(section.header,'th')+'</thead><tbody></tbody>';body.append(table);
          return title;
        }
        let title=startTable();
        // Split unusually long cells into continuation rows before pagination, retaining every character.
        const rows=section.rows.length?section.rows:[section.header.map((_,i)=>i===0?'暂无记录':'')];
        for(const row of rows){
          const chunks=row.map(v=>Array.from(String(v??'')).reduce((a,c,i)=>{const n=Math.floor(i/120);a[n]=(a[n]||'')+c;return a;},[]));
          for(let part=0;part<Math.max(1,...chunks.map(c=>c.length));part++){
            const tr=document.createElement('tr');tr.innerHTML=rowHTML(chunks.map(c=>c[part]||'')).replace(/^<tr>|<\/tr>$/g,'');table.tBodies[0].append(tr);
            if(body.scrollHeight>body.clientHeight){
              tr.remove();if(!table.tBodies[0].rows.length){title.remove();table.remove();}
              addPage();title=startTable(true);table.tBodies[0].append(tr);
              if(body.scrollHeight>body.clientHeight)throw new Error('报告明细超出单页高度，请缩短单条记录的文本');
            }
          }
        }
      }
      return {host,pages};
    }catch(error){host.remove();throw error;}
  }
  async function pdf(model,{save=true}={}){
    const {host,pages}=pdfPages(model);
    try{
      await document.fonts.ready;const doc=new jspdf.jsPDF('p','mm','a4');
      for(let i=0;i<pages.length;i++){
        const canvas=await html2canvas(pages[i],{scale:1.5,useCORS:true,backgroundColor:'#112940'});
        if(i)doc.addPage();doc.addImage(canvas.toDataURL('image/jpeg',0.92),'JPEG',0,0,210,297);
      }
      if(save)doc.save(model.filename+'.pdf');return doc;
    }finally{host.remove();}
  }
  window.LDReportExport={workbook,pdfPages,pdf,excel(model){XLSX.writeFile(workbook(model),model.filename+'.xlsx');}};
})();
