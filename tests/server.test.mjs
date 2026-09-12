import {test} from 'node:test';import assert from 'node:assert/strict';import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';import path from 'node:path';import os from 'node:os';import {createApp,hashPassword} from '../server/app.mjs';
const blank=()=>Object.fromEntries(['sessions','budgets','expenses','aiStations','aiShares','financeWiki','aiStationTasks','aiShareTasks','financeTasks'].map(k=>[k,[]]));
test('server guards shell, writes and personal files; concurrent writes cannot clobber data',async t=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'ld-auth-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const dataFile=path.join(dir,'private.json'),reportFile=path.join(dir,'report.html');await writeFile(dataFile,JSON.stringify(blank()));await writeFile(reportFile,'<h1>private test report</h1>');
 const password='test-only-not-a-real-account',passwordHash=await hashPassword(password);
 const config={publicOrigin:'http://127.0.0.1:8893',dataFile,users:[{email:'owner@example.test',role:'editor',canViewPersonal:true,passwordHash},{email:'reader@example.test',role:'reader',passwordHash}],reports:[{id:'personal-1',title:'private test report',kind:'personal',year:2025,file:reportFile,allowedEmails:['owner@example.test']},{id:'team-1',title:'team test report',kind:'team',year:2025,file:reportFile}]};
 const server=await createApp(config);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));t.after(()=>new Promise(resolve=>server.close(resolve)));
 const base='http://127.0.0.1:'+server.address().port;
 const req=(url,options={})=>fetch(base+url,{...options,headers:{Origin:config.publicOrigin,...options.headers}});
 assert.equal((await req('/api/data')).status,401);assert.equal((await req('/index.html')).status,401);assert.equal((await req('/')).status,200);assert(!(await (await req('/')).text()).includes('page-assessment'));
 assert.equal((await req('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'owner@example.test',password:'wrong'})})).status,401);
 async function login(email){const response=await req('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password})});assert.equal(response.status,200);const cookie=response.headers.get('set-cookie');assert.match(cookie,/HttpOnly/);assert.match(cookie,/SameSite=Strict/);return cookie.split(';')[0];}
 const editor=await login('owner@example.test'),reader=await login('reader@example.test');
 const readerShell=await (await req('/',{headers:{Cookie:reader}})).text();assert(!readerShell.includes('private test report'));assert(readerShell.includes('team test report'));assert(!readerShell.includes('assess-manager-card" onclick'));
 assert.equal((await req('/reports/personal-1',{headers:{Cookie:reader}})).status,404);assert.equal((await req('/reports/personal-1',{headers:{Cookie:editor}})).status,200);assert.equal((await req('/reports/team-1',{headers:{Cookie:reader}})).status,200);
 for(const route of ['/user-data.json','/data.json','/.git/config','/server/app.mjs','/assets/../user-data.json'])assert.equal((await req(route,{headers:{Cookie:reader}})).status,404);
 const dataResponse=await req('/api/data',{headers:{Cookie:editor}}),etag=dataResponse.headers.get('etag');const next=blank();next.sessions=[{id:'s1',people:2,duration:1}];
 const put={method:'PUT',headers:{Cookie:reader,'Content-Type':'application/json','If-Match':etag},body:JSON.stringify(next)};
 assert.equal((await req('/api/data',put)).status,403);
 put.headers.Cookie=editor;
 const results=await Promise.all([req('/api/data',put),req('/api/data',put)]);assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(JSON.parse(await readFile(dataFile,'utf8')).sessions.length,1);
 assert.equal((await req('/api/data',{...put,headers:{...put.headers,Origin:'https://untrusted.test'}})).status,403);
 assert.equal((await req('/api/logout',{method:'POST',headers:{Cookie:editor}})).status,200);assert.equal((await req('/api/data',{headers:{Cookie:editor}})).status,401);
});
