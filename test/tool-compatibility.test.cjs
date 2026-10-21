const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {assertToolError}=require('./helpers/toolError.cjs');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const {makeRecordingClient}=require('./helpers/recordingClient.cjs'),{openMcpHarness}=require('./helpers/mcpHarness.cjs');

test('tool arguments fail as tool results while unknown names remain protocol errors',async t=>{
  const r=makeRecordingClient(),m=await openMcpHarness(r.client);t.after(m.close);
  await assertToolError(m.mcpClient.callTool({name:'posts_edit',arguments:{id:'one'}}),/updated_at/);
  await assert.rejects(m.mcpClient.callTool({name:'not-a-tool',arguments:{}}),error=>error.code===-32602);
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
  await assertToolError(m.mcpClient.callTool({name:'renamed_tool',arguments:{count:2,unknown:true}}),/Invalid arguments/);
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
  for(const payload of [wide,deep,cyclic,[shared,shared],Array(10001),Array(4999).fill('x')])await assertToolError(m.mcpClient.callTool({name:'budget_tool',arguments:{payload}}),error=>{
    assert.match(error.message,/input element budget|JSON tree/);assert.ok(error.message.length<512);return true;
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
  for(const args of [{value:marker},{value:'allowed',[marker]:true}])await assertToolError(m.mcpClient.callTool({name:'bounded_update',arguments:args}),error=>{
    assert.ok(error.message.length<512);assert.ok(!error.message.includes('PRIVATE_INPUT_MARKER'));assert.match(error.message,/Bounded validation failure/);return true;
  });assert.equal(r.requests.length,0);
});

test('omitted tool arguments mean an empty object but do not bypass required inputs',async t=>{
  const r=makeRecordingClient(),m=await openMcpHarness(r.client);t.after(m.close);
  const {registerStrictTool}=require('../build/tools/registerStrictTool.js');let called=0;
  registerStrictTool(m.server,'empty_tool','test',{},async args=>{called++;assert.deepEqual(args,{});return {content:[{type:'text',text:'empty'}]}});
  assert.equal((await m.mcpClient.callTool({name:'empty_tool'})).content[0].text,'empty');
  await assertToolError(m.mcpClient.callTool({name:'posts_delete'}),/Invalid arguments/);
  assert.equal(called,1);assert.equal(r.requests.length,0);
});

test('unexpected schema parser exceptions are sanitized internal protocol errors',async t=>{
  const r=makeRecordingClient(),m=await openMcpHarness(r.client);t.after(m.close);
  const {registerStrictTool}=require('../build/tools/registerStrictTool.js');let called=0;
  const tool=registerStrictTool(m.server,'parser_failure','test',{},async()=>{called++;return {content:[]}});
  tool.inputSchema.safeParseAsync=async()=>{throw new Error('PRIVATE_PARSER_MARKER')};
  await assert.rejects(m.mcpClient.callTool({name:'parser_failure',arguments:{}}),error=>{
    assert.equal(error.code,-32603);assert.ok(!error.message.includes('PRIVATE_PARSER_MARKER'));return true;
  });
  assert.equal(called,0);assert.equal(r.requests.length,0);
});

test('unsupported registered handlers are internal server errors, not invalid caller arguments',async t=>{
  const r=makeRecordingClient(),m=await openMcpHarness(r.client);t.after(m.close);
  const {registerStrictTool}=require('../build/tools/registerStrictTool.js');let called=0;
  const tool=registerStrictTool(m.server,'bad_handler','test',{},async()=>({content:[]}));
  tool.handler={createTask:async()=>{called++;throw new Error('PRIVATE_HANDLER_MARKER')}};
  await assert.rejects(m.mcpClient.callTool({name:'bad_handler',arguments:{}}),error=>{
    assert.equal(error.code,-32603);assert.ok(!error.message.includes('PRIVATE_HANDLER_MARKER'));return true;
  });assert.equal(called,0);assert.equal(r.requests.length,0);
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
