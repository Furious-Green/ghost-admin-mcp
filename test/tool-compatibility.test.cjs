const {test,after}=require('node:test');
const assert=require('node:assert/strict');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const {makeRecordingClient}=require('./helpers/recordingClient.cjs'),{openMcpHarness}=require('./helpers/mcpHarness.cjs');

test('tool argument and unknown-name failures remain protocol InvalidParams, not tool-result errors',async t=>{
  const r=makeRecordingClient(),m=await openMcpHarness(r.client);t.after(m.close);
  for(const input of [{name:'posts_edit',arguments:{id:'one'}},{name:'not-a-tool',arguments:{}}]){
    await assert.rejects(m.mcpClient.callTool(input),error=>{assert.equal(error.code,-32602);return true});
  }
  assert.equal(r.requests.length,0);
});

test('callback failures still return isError text rather than protocol failure',async t=>{
  const r=makeRecordingClient(),m=await openMcpHarness({...r.client,posts:{...r.client.posts,read:async()=>{throw new Error('Expected callback failure')}}});t.after(m.close);
  const output=await m.mcpClient.callTool({name:'posts_read',arguments:{id:'one'}});
  assert.equal(output.isError,true);assert.deepEqual(output.content,[{type:'text',text:'Expected callback failure'}]);assert.equal(r.requests.length,0);
});

test('registered tools respect disable, schema/callback updates, rename and removal',async t=>{
  const r=makeRecordingClient(),m=await openMcpHarness(r.client);t.after(m.close);
  const {z}=require('zod'),{registerStrictTool}=require('../build/tools/registerStrictTool.js');
  const tool=registerStrictTool(m.server,'compat_tool','test',{value:z.string()},async args=>({content:[{type:'text',text:args.value}]}));
  assert.equal((await m.mcpClient.callTool({name:'compat_tool',arguments:{value:'before'}})).content[0].text,'before');
  tool.disable();await assert.rejects(m.mcpClient.callTool({name:'compat_tool',arguments:{value:'no'}}),error=>error.code===-32602);
  tool.enable();tool.update({name:'renamed_tool',paramsSchema:{count:z.number()},callback:async args=>({content:[{type:'text',text:String(args.count)}]})});
  await assert.rejects(m.mcpClient.callTool({name:'compat_tool',arguments:{value:'old'}}),error=>error.code===-32602);
  await assert.rejects(m.mcpClient.callTool({name:'renamed_tool',arguments:{count:2,unknown:true}}),error=>error.code===-32602);
  assert.equal((await m.mcpClient.callTool({name:'renamed_tool',arguments:{count:2}})).content[0].text,'2');
  tool.remove();await assert.rejects(m.mcpClient.callTool({name:'renamed_tool',arguments:{count:2}}),error=>error.code===-32602);
  assert.equal(r.requests.length,0);
});

test('tool registries remain isolated across servers with the same registered name',async t=>{
  const {z}=require('zod'),{registerStrictTool}=require('../build/tools/registerStrictTool.js');
  const first=await openMcpHarness(makeRecordingClient().client),second=await openMcpHarness(makeRecordingClient().client);t.after(first.close);t.after(second.close);
  for(const [m,label]of [[first,'first'],[second,'second']])registerStrictTool(m.server,'isolated','test',{value:z.string()},async()=>({content:[{type:'text',text:label}]}));
  for(const [m,label]of [[first,'first'],[second,'second']])assert.equal((await m.mcpClient.callTool({name:'isolated',arguments:{value:'input'}})).content[0].text,label);
});

test('tool input budget rejects deep wide cyclic and task-augmented inputs without invoking callbacks', {timeout:5000},async t=>{
  const r=makeRecordingClient(),m=await openMcpHarness(r.client);t.after(m.close);
  const {z}=require('zod'),{registerStrictTool}=require('../build/tools/registerStrictTool.js');let called=0;
  registerStrictTool(m.server,'budget_tool','test',{payload:z.unknown()},async()=>{called++;return {content:[{type:'text',text:'accepted'}]}});
  const wide=Object.fromEntries(Array.from({length:10001},(_,i)=>[`key${i}`,i]));
  let deep={};for(let i=0;i<20000;i++)deep={child:deep};const cyclic={};cyclic.self=cyclic;
  const shared={value:1};
  for(const payload of [wide,deep,cyclic,[shared,shared],Array(10001),Array(4999).fill('x')])await assert.rejects(m.mcpClient.callTool({name:'budget_tool',arguments:{payload}}),error=>{
    assert.equal(error.code,-32602);assert.ok(error.message.length<512);return true;
  });
  await assert.rejects(m.mcpClient.callTool({name:'budget_tool',arguments:{payload:'ok'},task:{ttl:1000}}));
  assert.equal(called,0);
  assert.equal((await m.mcpClient.callTool({name:'budget_tool',arguments:{payload:'x'.repeat(14000000)}})).content[0].text,'accepted');
  assert.equal((await m.mcpClient.callTool({name:'budget_tool',arguments:{payload:Array(4998).fill('x')}})).content[0].text,'accepted');
  assert.equal(called,2);assert.equal(r.requests.length,0);
});

test('schema updates preserve opted-in bounded error diagnostics',async t=>{
  const r=makeRecordingClient(),m=await openMcpHarness(r.client);t.after(m.close);
  const {z}=require('zod'),{registerStrictTool}=require('../build/tools/registerStrictTool.js');
  const tool=registerStrictTool(m.server,'bounded_update','test',{value:z.string()},async()=>({content:[{type:'text',text:'ok'}]}),'Bounded validation failure.');
  tool.update({paramsSchema:{value:z.enum(['allowed'])}});
  const marker='PRIVATE_INPUT_MARKER'+'x'.repeat(10000);
  for(const args of [{value:marker},{value:'allowed',[marker]:true}])await assert.rejects(m.mcpClient.callTool({name:'bounded_update',arguments:args}),error=>{
    assert.ok(error.message.length<512);assert.ok(!error.message.includes('PRIVATE_INPUT_MARKER'));assert.match(error.message,/Bounded validation failure/);return true;
  });assert.equal(r.requests.length,0);
});

test('repeated tool renames stay synchronized with discovery removal and name reuse',async t=>{
  const r=makeRecordingClient(),m=await openMcpHarness(r.client);t.after(m.close);
  const {z}=require('zod'),{registerStrictTool}=require('../build/tools/registerStrictTool.js');
  const tool=registerStrictTool(m.server,'rename_original','test',{value:z.string()},async args=>({content:[{type:'text',text:args.value}]}));
  const names=async()=>{const tools=[];let cursor;do{const page=await m.mcpClient.listTools(cursor?{cursor}:{});tools.push(...page.tools.map(t=>t.name));cursor=page.nextCursor}while(cursor);return tools.filter(n=>n.startsWith('rename_')).sort()};
  tool.update({name:'rename_second'});tool.update({name:'rename_third'});
  assert.deepEqual(await names(),['rename_third']);
  assert.equal((await m.mcpClient.callTool({name:'rename_third',arguments:{value:'ok'}})).content[0].text,'ok');
  tool.disable();assert.deepEqual(await names(),[]);tool.enable();assert.deepEqual(await names(),['rename_third']);
  tool.update({paramsSchema:{count:z.number()},callback:async args=>({content:[{type:'text',text:String(args.count)}]})});
  assert.equal((await m.mcpClient.callTool({name:'rename_third',arguments:{count:3}})).content[0].text,'3');
  tool.remove();assert.deepEqual(await names(),[]);
  const replacement=registerStrictTool(m.server,'rename_third','replacement',{},async()=>({content:[{type:'text',text:'replacement'}]}));
  tool.remove();assert.deepEqual(await names(),['rename_third']);
  assert.equal((await m.mcpClient.callTool({name:'rename_third',arguments:{}})).content[0].text,'replacement');
  replacement.remove();tool.update({name:'rename_readded'});assert.deepEqual(await names(),['rename_readded']);
  assert.equal((await m.mcpClient.callTool({name:'rename_readded',arguments:{count:4}})).content[0].text,'4');
  assert.equal(r.requests.length,0);
});
