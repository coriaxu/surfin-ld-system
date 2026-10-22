// 用法：node --test tests/assessment-links.test.cjs
// 示例：在项目根目录运行上述命令；读取相邻项目源码，不联网或写入业务数据。
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

test('2024个人报告20个入口使用HTML，2025个人及团队PDF链接保持原规则',()=>{
  const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
  const hub=html.match(/const ASSESSMENT_HUB_URL = '[^']+';/);
  assert.ok(hub,'测评中心地址定义必须存在');
  const functions=['openAssessReport','openAssessReport2024'].map(name=>{
    const match=html.match(new RegExp('function '+name+'\\([^)]*\\) \\{[\\s\\S]*?\\n    \\}'));
    assert.ok(match,`${name}函数必须存在`);
    return match[0];
  });
  const opened=[];
  const context=vm.createContext({window:{open:(url,target)=>opened.push({url,target})}});
  vm.runInContext([hub[0],...functions].join('\n'),context);
  const calls=[...html.matchAll(/onclick="(openAssessReport2024\('([^']*)'\))"/g)];
  assert.equal(calls.length,20,'2024入口数量不能被本次修改改变');
  calls.forEach((call,index)=>{
    vm.runInContext(call[1],context);
    assert.equal(opened[index].url,'https://coriaxu.github.io/surfin-assessment-hub/reports/2024/'+encodeURIComponent(call[2])+'.html',`2024入口${index+1}应保持原文件名并改为HTML`);
    assert.equal(opened[index].target,'_blank');
  });
  context.openAssessReport2024('匿名 测试#%');
  assert.equal(opened.at(-1).url,'https://coriaxu.github.io/surfin-assessment-hub/reports/2024/'+encodeURIComponent('匿名 测试#%')+'.html');
  context.openAssessReport('匿名2025');
  assert.equal(opened.at(-1).url,'https://coriaxu.github.io/surfin-assessment-hub/reports/2025/'+encodeURIComponent('匿名2025')+'.html');
  const team=html.match(/class="assess-team-banner-inner" onclick="([^"]+)"/);
  assert.ok(team,'团队报告入口必须保留');
  assert.equal(team[1],"openAssessReport('团队反馈报告', 'pdf')");
  vm.runInContext(team[1],context);
  assert.equal(opened.at(-1).url,'https://coriaxu.github.io/surfin-assessment-hub/reports/2025/'+encodeURIComponent('团队反馈报告')+'.pdf');
  assert.equal(opened.at(-1).target,'_blank');
});
