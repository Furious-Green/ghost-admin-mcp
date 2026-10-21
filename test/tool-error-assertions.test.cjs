const {test,after}=require('node:test');
const assert=require('node:assert/strict');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const {makeRecordingClient}=require('./helpers/recordingClient.cjs');
const {openMcpHarness}=require('./helpers/mcpHarness.cjs');
const {assertToolError}=require('./helpers/toolError.cjs');

test('tool error assertion rejects protocol failures and successful tool results',async t=>{
  const r=makeRecordingClient(),m=await openMcpHarness(r.client);t.after(m.close);
  await assert.rejects(assertToolError(m.mcpClient.callTool({name:'missing-tool',arguments:{}})),error=>error.code===-32602);
  await assert.rejects(assertToolError(m.mcpClient.callTool({name:'posts_read',arguments:{id:'one'}})),{name:'AssertionError'});
});

test('tool error assertion matches actual execution diagnostics and refuses the wrong message',async t=>{
  const r=makeRecordingClient(),m=await openMcpHarness({...r.client,posts:{...r.client.posts,read:async()=>{throw new Error('Expected failure')}}});t.after(m.close);
  const call=()=>m.mcpClient.callTool({name:'posts_read',arguments:{id:'one'}});
  const result=await assertToolError(call(),/Expected failure/);assert.equal(result.isError,true);
  await assertToolError(call(),diagnostic=>diagnostic.message==='Expected failure');
  await assert.rejects(assertToolError(call(),/different failure/),{name:'AssertionError'});
  assert.equal(r.requests.length,0);
});
