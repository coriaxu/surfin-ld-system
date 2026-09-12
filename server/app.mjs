import http from 'node:http';
import {readFile,writeFile,rename,realpath,mkdir} from 'node:fs/promises';
import {createHash,randomBytes,scrypt as scryptCallback,timingSafeEqual} from 'node:crypto';
import {promisify} from 'node:util';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const scrypt=promisify(scryptCallback);
const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=value=>createHash('sha256').update(value).digest('hex');
const jsonScript=value=>JSON.stringify(value).replace(/</g,'\\u003c');
const fail=(status,message)=>Object.assign(new Error(message),{status});
const FIELDS=['sessions','budgets','expenses','aiStations','aiShares','financeWiki','aiStationTasks','aiShareTasks','financeTasks'];
export async function hashPassword(password){
  const salt=randomBytes(16).toString('hex');
  const digest=await scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024});
  return `scrypt:${salt}:${digest.toString('hex')}`;
}
async function verifyPassword(password,encoded){
  const [,salt,expected]=String(encoded).split(':');
  if(!salt||!expected||! /^[a-f0-9]{128}$/.test(expected))return false;
  const actual=await scrypt(password,salt,64,{N:32768,r:8,p:3,maxmem:64*1024*1024});
  return timingSafeEqual(actual,Buffer.from(expected,'hex'));
}
export function validateData(data){
  if(!data||typeof data!=='object'||Array.isArray(data))throw fail(400,'数据格式错误');
  for(const field of FIELDS){
    if(!Array.isArray(data[field])||data[field].length>20000)throw fail(400,`${field} 记录格式错误`);
    const ids=new Set();
    for(const item of data[field]){
      if(!item||typeof item!=='object'||typeof item.id!=='string'||! /^[a-zA-Z0-9_-]{1,100}$/.test(item.id)||ids.has(item.id))throw fail(400,`${field} 记录标识无效或重复`);
      ids.add(item.id);
      for(const key of ['people','duration','amount','total','attendees','views','read','unread','downloads']){
        if(item[key]!==undefined&&item[key]!==null&&(typeof item[key]!=='number'||!Number.isFinite(item[key])||item[key]<0))throw fail(400,`${field} 数值无效`);
      }
      // Current UI renders some workflow labels inline; never accept active markup as record metadata.
      for(const [key,value] of Object.entries(item))if(typeof value==='string'&&(value.length>20000||/[<>]/.test(value)))throw fail(400,`${field} ${key} 不接受 HTML 标记`);
    }
  }
  if(JSON.stringify(data).length>5*1024*1024)throw fail(413,'数据过大');
  return data;
}
function replaceAssessment(html){
  const start=html.indexOf('<div class="page" id="page-assessment">');
  if(start<0)throw Error('找不到报告模块');
  const tags=/<\/?div\b[^>]*>/g;tags.lastIndex=start;let depth=0,match;
  while((match=tags.exec(html))){depth+=match[0].startsWith('</')?-1:1;if(depth===0)return html.slice(0,start)+'<div class="page" id="page-assessment"><div id="assess-home"></div></div>'+html.slice(tags.lastIndex);}
  throw Error('报告模块结构异常');
}
const loginPage=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Surfin L&D · 登录</title><style>body{margin:0;background:#eeede9;color:#30372f;font:16px system-ui;display:grid;place-items:center;min-height:100vh}main{background:white;border:1px solid #d3d5ce;border-radius:12px;padding:36px;width:min(350px,75vw);box-shadow:0 12px 35px #30372f12}h1{font-size:24px;font-weight:600}p{line-height:1.7;color:#71776e}label{display:block;margin:20px 0 8px}input,button{box-sizing:border-box;width:100%;padding:12px;font:inherit;border-radius:6px;border:1px solid #cbd1c8}button{margin-top:24px;background:#4f7263;color:white;cursor:pointer}#message{color:#9a463e}</style><main><h1>Surfin L&D</h1><p>使用获准的账号登录工作台。</p><form id="login"><label for="email">邮箱</label><input id="email" name="email" type="email" autocomplete="username" required><label for="password">密码</label><input id="password" name="password" type="password" autocomplete="current-password" required><button>登录</button><p id="message" role="alert"></p></form></main><script>document.querySelector('form').onsubmit=async e=>{e.preventDefault();const button=document.querySelector('button');button.disabled=true;try{const r=await fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:document.querySelector('#email').value,password:document.querySelector('#password').value})});if(!r.ok)throw Error((await r.json()).error);location.replace('/');}catch(err){document.querySelector('#message').textContent=err.message;}finally{button.disabled=false;}};</script></html>`;
async function readJson(request,limit=5*1024*1024){
  if(!String(request.headers['content-type']||'').startsWith('application/json'))throw fail(415,'需要 JSON 请求');
  const chunks=[];let size=0;
  for await(const chunk of request){size+=chunk.length;if(size>limit)throw fail(413,'请求过大');chunks.push(chunk);}
  try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw fail(400,'JSON 无效');}
}
export async function createApp(config){
  if(!Array.isArray(config.users)||!config.users.length)throw Error('请先配置获准账号，服务默认拒绝开放');
  const origin=new URL(config.publicOrigin).origin;
  const local=['localhost','127.0.0.1','[::1]'].includes(new URL(origin).hostname);
  if(!origin.startsWith('https:')&&!local)throw Error('正式访问必须使用 HTTPS');
  const root=await realpath(config.webRoot||ROOT),dataFile=path.resolve(config.dataFile);
  if(dataFile.startsWith(root+path.sep))throw Error('私有数据必须放在网站目录之外');
  const users=new Map(config.users.map(u=>[u.email.toLowerCase(),u]));
  if(users.size!==config.users.length||[...users.values()].some(u=>!['editor','reader'].includes(u.role)||!/^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/.test(u.passwordHash)))throw Error('账号配置无效');
  const reports=config.reports||[];
  for(const report of reports){if(!/^[a-zA-Z0-9_-]{1,100}$/.test(report.id)||!['personal','team'].includes(report.kind))throw Error('报告配置无效');if(path.resolve(report.file).startsWith(root+path.sep))throw Error('报告文件必须放在网站目录之外');}
  const canReadReport=(user,report)=>report.kind==='team'||(user.canViewPersonal===true&&(report.allowedEmails||[]).map(e=>e.toLowerCase()).includes(user.email.toLowerCase()));
  let data=validateData(JSON.parse(await readFile(dataFile,'utf8'))),version=hash(JSON.stringify(data)),writeQueue=Promise.resolve();
  const sessions=new Map(),attempts=new Map(),dummy=await hashPassword(randomBytes(32).toString('hex'));
  const cookieName=origin.startsWith('https:')?'__Host-surfin_session':'surfin_session';
  const cookie=value=>`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict${origin.startsWith('https:')?'; Secure':''}`;
  function auth(request){
    const token=String(request.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith(cookieName+'='))?.slice(cookieName.length+1);
    const session=token?sessions.get(hash(token)):null;
    if(!session||Date.now()>session.expires||Date.now()-session.last>30*60*1000){if(token)sessions.delete(hash(token));return null;}
    session.last=Date.now();return {user:users.get(session.email),tokenHash:hash(token)};
  }
  const server=http.createServer(async(request,response)=>{
    const send=(status,value,type='application/json',headers={})=>{response.writeHead(status,{'Content-Type':type,...headers});response.end(type==='application/json'?JSON.stringify(value):value);};
    response.setHeader('Cache-Control','no-store');response.setHeader('X-Content-Type-Options','nosniff');response.setHeader('Referrer-Policy','no-referrer');response.setHeader('X-Frame-Options','DENY');
    response.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
    try{
      const url=new URL(request.url,origin),route=decodeURIComponent(url.pathname),method=request.method;
      if(!['GET','HEAD','POST','PUT'].includes(method))throw fail(405,'不支持的操作');
      if(!['GET','HEAD'].includes(method)&&request.headers.origin!==origin)throw fail(403,'请求来源无效');
      if(route==='/api/login'&&method==='POST'){
        const body=await readJson(request,4096),email=String(body.email||'').trim().toLowerCase(),password=String(body.password||'');
        if(password.length>1024)throw fail(400,'登录信息无效');
        const now=Date.now();for(const [key,a] of attempts)if(now>a.until)attempts.delete(key);
        const key=request.socket.remoteAddress+'|'+email,attempt=attempts.get(key)||{count:0,until:now+15*60*1000};
        if(attempt.count>=8||attempts.size>5000)throw fail(429,'尝试次数过多，请稍后再试');
        attempt.count++;attempts.set(key,attempt);
        const user=users.get(email),valid=await verifyPassword(password,user?.passwordHash||dummy);
        if(!user||!valid)throw fail(401,'邮箱或密码不正确');
        attempts.delete(key);for(const [id,session]of sessions)if(now>session.expires)sessions.delete(id);
        const token=randomBytes(32).toString('base64url');sessions.set(hash(token),{email,last:now,expires:now+8*60*60*1000});
        return send(200,{ok:true},'application/json',{'Set-Cookie':cookie(token)});
      }
      const session=auth(request);
      if(!session){if((route==='/'||route==='/login')&&method==='GET')return send(200,loginPage,'text/html; charset=utf-8');throw fail(401,'请重新登录');}
      const {user}=session;
      if(route==='/api/logout'&&method==='POST'){sessions.delete(session.tokenHash);return send(200,{ok:true},'application/json',{'Set-Cookie':cookie('')+'; Max-Age=0','Clear-Site-Data':'"cache", "storage"'});}
      if(route==='/api/me'&&method==='GET')return send(200,{email:user.email,role:user.role});
      if(route==='/api/data'){
        if(method==='GET')return send(200,data,'application/json',{ETag:'"'+version+'"'});
        if(method!=='PUT')throw fail(405,'不支持的操作');
        if(user.role!=='editor')throw fail(403,'当前账号为只读权限');
        const next=validateData(await readJson(request)),expected=request.headers['if-match'];
        const operation=writeQueue.then(async()=>{if(expected!=='"'+version+'"')throw fail(409,'云端已有更新，请合并后重试');const body=JSON.stringify(next,null,2),temp=dataFile+'.'+randomBytes(8).toString('hex')+'.tmp';await writeFile(temp,body,{mode:0o600,flag:'wx'});await rename(temp,dataFile);data=next;version=hash(JSON.stringify(next));return version;});
        writeQueue=operation.catch(()=>{});const savedVersion=await operation;return send(200,{ok:true},'application/json',{ETag:'"'+savedVersion+'"'});
      }
      if(route.startsWith('/reports/')){
        if(method!=='GET'&&method!=='HEAD')throw fail(405,'不支持的操作');
        const report=reports.find(r=>r.id===route.slice('/reports/'.length));
        if(!report||!canReadReport(user,report))throw fail(404,'该报告尚未接入或未向当前账号开放');
        const file=await realpath(report.file);if(file.startsWith(root+path.sep))throw fail(404,'报告不可用');
        const ext=path.extname(file).toLowerCase();if(!['.pdf','.html'].includes(ext))throw fail(404,'报告格式未支持');
        response.setHeader('Content-Security-Policy',"sandbox allow-scripts; default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'");
        return send(200,method==='HEAD'?'':await readFile(file),ext==='.pdf'?'application/pdf':'text/html; charset=utf-8');
      }
      if(method!=='GET'&&method!=='HEAD')throw fail(405,'不支持的操作');
      if(route==='/'||route==='/index.html'){
        let html=replaceAssessment(await readFile(path.join(root,'index.html'),'utf8'));
        const info={email:user.email,role:user.role,reports:reports.filter(r=>canReadReport(user,r)).map(({id,title,year,department,kind})=>({id,title,year,department,kind}))};
        html=html.replace('<head>','<head><script>window.LD_SERVER='+jsonScript(info)+'</script>').replace('</body>','<script src="assets/secure-client.js"></script></body>');
        return send(200,method==='HEAD'?'':html,'text/html; charset=utf-8');
      }
      if(route.startsWith('/assets/')&&/^\/assets\/[a-zA-Z0-9_./-]+$/.test(route)){
        const file=await realpath(path.join(root,route));const assets=await realpath(path.join(root,'assets'));
        if(!file.startsWith(assets+path.sep))throw fail(404,'文件不存在');
        const types={'.js':'text/javascript','.css':'text/css','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.woff2':'font/woff2'};
        const type=types[path.extname(file)];if(!type)throw fail(404,'文件不存在');
        return send(200,method==='HEAD'?'':await readFile(file),type);
      }
      throw fail(404,'文件不存在');
    }catch(error){if(!response.headersSent)send(error.status|| (error.code==='ENOENT'?404:500),{error:error.status?error.message:'请求未完成'});else response.end();}
  });
  server.requestTimeout=15000;server.headersTimeout=10000;
  return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  if(!process.env.LD_CONFIG)throw Error('设置 LD_CONFIG 指向网站目录之外的私有配置文件');
  const config=JSON.parse(await readFile(process.env.LD_CONFIG,'utf8'));
  const server=await createApp(config);server.listen(config.port||8893,config.host||'127.0.0.1',()=>console.log('Surfin 私有服务已启动'));
}
