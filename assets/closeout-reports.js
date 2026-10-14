/* 结项报告：每个项目一条。摘要由负责人手写；系统记录按项目名 + 起止日期从培训记录自动汇总。
   公开站点上只放可公开的汇总结论，不放学员姓名、个人案例或原文全文；原文用有权限控制的链接。 */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./ld-report.js'):root.LDReport);
  if(typeof module==='object'&&module.exports)module.exports=api;else root.LDCloseout=api;
})(globalThis,R=>{
  const reports=[
    {
      id:'ai-s3',
      name:'AI 赋能第三期',
      project:'AI 赋能训练营',       // 培训记录里的项目名
      start:'2026-04-28',            // 宣讲会
      end:'2026-09-30',
      status:'已结项',
      reportDate:'2026-09-05',
      conclusion:'本期已结项，形成了进入真实工作的成果，成熟度分层。培养方法和日常使用已经站住；全面提效、同岗位接手和毕业评审三项目标未达成。',
      results:[
        ['11 / 9','正式学员 / 覆盖部门或业务单元'],
        ['36 项','正式登记 Skill，26 项已在实际工作中使用'],
        ['8 / 10','几乎每天用桌面端 AI 处理真实工作'],
        ['9 / 11','匿名反馈回收，投入价值均为 4—5 分']
      ],
      resultsNote:'报告口径，截至 2026-09-05；行为与时间主要为学员自述。',
      verdict:[
        ['已达成','真实任务进入工作流；课程、台账、双问卷方法沉淀为可复用资产。'],
        ['未达成','30% 提效、30 分钟同岗位上手、毕业评审。'],
        ['后续建议','如再开期，从已使用、会重复、业务负责人愿意验收的任务切入，先验证完整交付和同事接手。']
      ],
      lessons:[
        '质检要跟上：多数学员遇到过 AI 出错或漏做，对外交付和专业判断必须有人复核。',
        '投入要记账：学习与调试有相当部分发生在工作时间外，维护成本尚未计入。',
        '接手未实测：同事能否脱离作者独立运行，还没有统一记录。'
      ],
      links:[]                       // 例：{label:'完整报告',url:'https://...（钉钉文档，按人授权）'}
    }
  ];
  // 与月度/年度总结同一口径：人次按场次累加，人时 = 人次 × 时长，缺值单独计数不补零。
  function records(state,r){
    const sessions=(state.sessions||[]).filter(s=>s.project===r.project&&s.date>=r.start&&s.date<=r.end);
    const known=get=>sessions.map(get).filter(v=>v!==null);
    const people=known(s=>R.hours({people:s.people,duration:1})),hours=known(R.hours);
    const sum=a=>Math.round(a.reduce((x,y)=>x+y,0)*100)/100;
    return {sessions:sessions.length,people:sum(people),hours:sum(hours),pending:sessions.length-hours.length};
  }
  return {reports,records};
});
