const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {assertToolError}=require('./helpers/toolError.cjs');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const {makeRecordingClient}=require('./helpers/recordingClient.cjs');
const {openMcpHarness}=require('./helpers/mcpHarness.cjs');
const {timestamp,config,permissionError}=require('./helpers/fixtures.cjs');
async function setup(t){const r=makeRecordingClient();const m=await openMcpHarness(r.client);t.after(m.close);return {...r,...m,call:(name,args)=>m.mcpClient.callTool({name,arguments:structuredClone(args)})};}

for(const status of ['published','scheduled'])for(const email_only of [false,true]){
  test(`MCP explicit ${status} delivery email_only=${email_only} keeps routing query separate`,async t=>{
    const r=await setup(t);
    const date='2027-01-15T12:00:00+01:00';
    const input={id:'one',updated_at:timestamp,status,email_only,email_subject:'Weekly news',newsletter:'weekly',email_segment:'status:free',...(status==='scheduled'?{published_at:date}:{}),html:'<p>Hello</p>',formats:'html,lexical',include:'email,newsletter',save_revision:false};
    r.enqueueResponse({posts:[{id:'one',status:email_only&&status==='published'?'sent':status,email:{status:'pending'}}]});
    const result=await r.call('posts_edit',input);
    assert.notEqual(result.isError,true,result.content[0].text);
    assert.deepEqual(JSON.parse(result.content[0].text),{data:{id:'one',status:email_only&&status==='published'?'sent':status,email:{status:'pending'}}});
    assert.equal(r.requests.length,1);
    assert.equal(r.requests[0].method,'PUT');
    assert.equal(r.requests[0].url,`${config.url}/ghost/api/admin/posts/one/`);
    assert.deepEqual(r.requests[0].params,{newsletter:'weekly',email_segment:'status:free',formats:'html,lexical',include:'email,newsletter',save_revision:false,source:'html'});
    assert.deepEqual(r.requests[0].data,{posts:[{updated_at:timestamp,status,email_only,email_subject:'Weekly news',...(status==='scheduled'?{published_at:date}:{}),html:'<p>Hello</p>'}]});
  });
}

test('MCP delivery does not select defaults or treat email-only configuration as a send',async t=>{
  const r=await setup(t);
  await r.call('posts_add',{title:'Draft',email_only:true,email_subject:null});
  assert.deepEqual(r.requests[0].data,{posts:[{title:'Draft',email_only:true,email_subject:null}]});
  assert.deepEqual(r.requests[0].params,{});
  await r.call('posts_edit',{id:'one',updated_at:timestamp,email_only:true,email_subject:'Later'});
  assert.deepEqual(r.requests[1].params,{});
  await r.call('posts_edit',{id:'one',updated_at:timestamp,status:'published',newsletter:'weekly'});
  assert.deepEqual(r.requests[2].params,{newsletter:'weekly'});
  assert.equal(r.requests.length,3);
});

test('MCP malformed delivery controls fail before transport and cannot become body fields',async t=>{
  const r=await setup(t);
  for(const extra of [{newsletter:''},{newsletter:' '},{newsletter:'../weekly'},{newsletter:'a'.repeat(192)},{newsletter:'weekly',email_segment:''},{newsletter:'weekly',email_segment:' '},{newsletter:42},{email_segment:[]},{email_subject:'a'.repeat(301)}]){
    await assertToolError(r.call('posts_edit',{id:'one',updated_at:timestamp,status:'published',...extra}),/Invalid arguments/);
  }
  for(const [name,args]of [
    ['posts_add',{title:'A',newsletter:'weekly',status:'published'}],['posts_read',{id:'one',newsletter:'weekly'}],
    ['posts_browse',{email_segment:'all'}],['posts_copy',{id:'one',newsletter:'weekly'}],
    ['pages_edit',{id:'one',updated_at:timestamp,status:'published',newsletter:'weekly'}],
    ['pages_add',{title:'A',email_subject:'Subject'}],
  ])await assertToolError(r.call(name,args),/Invalid arguments/);
  for(const args of [
    {status:'published',email_segment:'status:free'}, {newsletter:'weekly'}, {newsletter:'weekly',status:'draft'},
    {newsletter:'weekly',status:'sent'}, {newsletter:'weekly',status:'scheduled'},
    {newsletter:'weekly',status:'scheduled',published_at:null}, {email_only:true,status:'published'},
  ]){
    const output=await r.call('posts_edit',{id:'one',updated_at:timestamp,...args});
    assert.equal(output.isError,true,JSON.stringify(args));
  }
  const add=await r.call('posts_add',{title:'A',email_only:true,status:'scheduled',published_at:'2027-01-15T12:00:00Z'});
  assert.equal(add.isError,true);
  assert.equal(r.requests.length,0);
});

test('delivery guards protect direct split options and injected clients without mutating input',async t=>{
  const r=makeRecordingClient();
  for(const [input,options]of [
    [{id:'one',updated_at:timestamp},{newsletter:'weekly'}],
    [{id:'one',updated_at:timestamp,status:'published'},{email_segment:'all'}],
    [{id:'one',updated_at:timestamp,status:'scheduled'},{newsletter:'weekly'}],
    [{id:'one',updated_at:timestamp,status:'published',newsletter:'weekly'},{newsletter:'weekly'}],
  ])await assert.rejects(r.client.posts.edit(input,options));
  assert.equal(r.requests.length,0);
  const input={id:'one',updated_at:timestamp,status:'published',email_only:true,email_subject:null},original=structuredClone(input),options={newsletter:'weekly',email_segment:'all'};
  await r.client.posts.edit(input,options);
  assert.deepEqual(input,original);assert.deepEqual(options,{newsletter:'weekly',email_segment:'all'});
  assert.deepEqual(r.requests[0].params,{newsletter:'weekly',email_segment:'all'});
  let called=0;
  const m=await openMcpHarness({...r.client,posts:{...r.client.posts,edit:async()=>{called++;return {data:{id:'unexpected'}}}}});t.after(m.close);
  const bad=await m.mcpClient.callTool({name:'posts_edit',arguments:{id:'one',updated_at:timestamp,status:'published',email_segment:'all'}});
  assert.equal(bad.isError,true);assert.equal(called,0);
});

test('delivery errors dispatch once and returned failed email is not rewritten as delivered',async t=>{
  const r=await setup(t);
  for(const message of ['Permission denied','Update collision','Email service unavailable']){
    const error=permissionError();error.response.data.errors[0].message=message;r.enqueueError(error);
    const output=await r.call('posts_edit',{id:'one',updated_at:timestamp,status:'published',newsletter:'weekly'});
    assert.equal(output.isError,true);assert.equal(output.content[0].text,message);
  }
  assert.equal(r.requests.length,3);
  r.enqueueResponse({posts:[{id:'one',status:'sent',email:{status:'failed',error:'Unavailable'}}]});
  const output=await r.call('posts_edit',{id:'one',updated_at:timestamp,status:'published',email_only:true,newsletter:'weekly'});
  assert.deepEqual(JSON.parse(output.content[0].text),{data:{id:'one',status:'sent',email:{status:'failed',error:'Unavailable'}}});
  assert.equal(r.requests.length,4);
});
