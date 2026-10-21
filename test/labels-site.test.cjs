const {test,after}=require('node:test');
const assert=require('node:assert/strict');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const {makeRecordingClient}=require('./helpers/recordingClient.cjs');
const {openMcpHarness}=require('./helpers/mcpHarness.cjs');
const {config}=require('./helpers/fixtures.cjs');
async function setup(t){const r=makeRecordingClient();const m=await openMcpHarness(r.client);t.after(m.close);return {...r,...m,call:(name,args)=>m.mcpClient.callTool({name,arguments:structuredClone(args)})};}

test('label tools use exact selectors, query/body separation, pagination and delete text',async t=>{
  const r=await setup(t),meta={pagination:{page:2,next:null},unknown:{zero:0}};
  r.enqueueResponse({labels:[{id:'one',name:'VIP',count:{members:0}}],meta});
  const browse=await r.call('labels_browse',{page:2,limit:10,filter:'name:VIP',order:'name asc',fields:'id,name',include:'count.members'});
  assert.deepEqual(JSON.parse(browse.content[0].text),{data:[{id:'one',name:'VIP',count:{members:0}}],meta});
  await r.call('labels_read',{slug:'café vip',include:'count.members',fields:'id,name',filter:'name:VIP'});
  await r.call('labels_read',{id:'one'});
  await r.call('labels_add',{name:'VIP',slug:'vip',include:'count.members'});
  await r.call('labels_edit',{id:'one',name:'Changed',slug:'changed',include:'count.members'});
  assert.deepEqual((await r.call('labels_delete',{id:'one'})).content,[{type:'text',text:'Label with id one deleted.'}]);
  assert.deepEqual(r.requests.map(x=>[x.method,x.url]),[
    ['GET',`${config.url}/ghost/api/admin/labels/`],['GET',`${config.url}/ghost/api/admin/labels/slug/caf%C3%A9%20vip/`],
    ['GET',`${config.url}/ghost/api/admin/labels/one/`],['POST',`${config.url}/ghost/api/admin/labels/`],
    ['PUT',`${config.url}/ghost/api/admin/labels/one/`],['DELETE',`${config.url}/ghost/api/admin/labels/one/`],
  ]);
  assert.deepEqual(r.requests[0].params,{page:2,limit:10,filter:'name:VIP',order:'name asc',fields:'id,name',include:'count.members'});
  assert.deepEqual(r.requests[1].params,{include:'count.members',fields:'id,name',filter:'name:VIP'});
  assert.deepEqual(r.requests[3].data,{labels:[{name:'VIP',slug:'vip'}]});
  assert.deepEqual(r.requests[4].data,{labels:[{name:'Changed',slug:'changed'}]});
  assert.deepEqual(r.requests[3].params,{include:'count.members'});
  assert.equal(r.requests[5].data,undefined);
});

test('label MCP schemas reject unknown, malformed and ambiguous inputs before injected clients',async t=>{
  const r=makeRecordingClient();let called=0;
  const fn=async()=>{called++;return {data:{id:'bad'}}};
  const m=await openMcpHarness({...r.client,labels:{browse:fn,read:fn,add:fn,edit:fn,delete:fn}});t.after(m.close);
  for(const [op,args] of [
    ['browse',{page:0}],['browse',{limit:1.2}],['browse',{limit:'10'}],['browse',{include:'members'}],
    ['browse',{fields:'id,'}],['browse',{filter:' '}],['browse',{arbitrary:true}],
    ['read',{}],['read',{id:'one',slug:'vip'}],['read',{slug:'../vip'}],['read',{id:'%2e'}],['read',{id:'one/two'}],
    ['add',{name:' '}],['add',{name:'a'.repeat(192)}],['add',{name:'A',slug:null}],['add',{name:'A',created_at:'now'}],
    ['edit',{id:'one',name:null}],['edit',{slug:'vip',name:'A'}],['delete',{id:'one',include:'count.members'}],
  ])await assert.rejects(m.mcpClient.callTool({name:`labels_${op}`,arguments:args}),/Invalid arguments/);
  assert.equal(called,0);assert.equal(r.requests.length,0);
});

test('direct labels reject malformed options and preserve caller inputs',async()=>{
  const r=makeRecordingClient();
  for(const options of [{include:'count.members'},null,[],{unknown:true}])await assert.rejects(r.client.labels.add({name:'A'},options));
  for(const input of [{},{id:'one',slug:'vip'},{slug:'..'},{slug:'a?b'},{id:'a#b'}])await assert.rejects(r.client.labels.read(input));
  assert.equal(r.requests.length,0);
  const input={name:'A',slug:'a',include:'count.members'},original=structuredClone(input);
  await r.client.labels.add(input,{});assert.deepEqual(input,original);
  assert.deepEqual(r.requests[0].params,{include:'count.members'});
  assert.deepEqual(r.requests[0].data,{labels:[{name:'A',slug:'a'}]});
});

test('site read returns real singleton data and metadata without authentication or invented fields',async t=>{
  const r=await setup(t);
  const site={title:'Publication',description:'News',logo:null,url:'https://front.example.invalid/',version:'5.130',icon:'/relative/icon.png',unknown:{zero:0}};
  for(const meta of [undefined,{}, {unknown:{value:null}}]){
    r.enqueueResponse({site,...(meta!==undefined?{meta}:{})});
    const result=await r.call('site_read',{});
    assert.notEqual(result.isError,true,result.content[0].text);
    assert.deepEqual(JSON.parse(result.content[0].text),{data:site,...(meta!==undefined?{meta}:{})});
  }
  assert.equal(r.requests.length,3);
  for(const req of r.requests){
    assert.equal(req.method,'GET');assert.equal(req.url,`${config.url}/ghost/api/admin/site/`);
    assert.equal(Object.keys(req.headers).some(key=>key.toLowerCase()==='authorization'),false);
    assert.deepEqual(req.params,{});assert.equal(req.data,undefined);
  }
  const input={},options={};r.enqueueResponse({site});
  assert.deepEqual(await r.client.site.read(input,options),{data:site});
  assert.deepEqual(input,{});assert.deepEqual(options,{});
});

test('site rejects malformed singleton and metadata responses instead of returning fake success',async t=>{
  const r=await setup(t);
  for(const body of [{},{site:null},{site:[]},{site:[{title:'Wrong'}]},{site:'Wrong'},{site:{},meta:null},{site:{},meta:[]},{site:{},meta:'wrong'}]){
    r.enqueueResponse(body);const result=await r.call('site_read',{});
    assert.equal(result.isError,true,JSON.stringify(body));assert.match(result.content[0].text,/Unexpected Ghost site response/);
  }
  assert.equal(r.requests.length,8);
});

test('site empty-input validation protects both direct and injected clients',async t=>{
  const r=makeRecordingClient();let called=0;
  const m=await openMcpHarness({...r.client,site:{read:async()=>{called++;return {data:{}}}}});t.after(m.close);
  for(const input of [{url:'https://other.invalid/'},{fields:'title'},{settings:true},{key:'secret'}]){
    await assert.rejects(m.mcpClient.callTool({name:'site_read',arguments:input}),/Invalid arguments/);
    await assert.rejects(r.client.site.read(input));
  }
  for(const options of [null,[],{url:'https://other.invalid/'},{fields:'title'}])await assert.rejects(r.client.site.read({},options));
  for(const input of [undefined,null,[],42])await assert.rejects(r.client.site.read(input));
  assert.equal(called,0);assert.equal(r.requests.length,0);
});

test('member label and newsletter assignment bodies stay compatible with standalone label tools',async t=>{
  const r=await setup(t);
  const relationships={labels:[{name:'VIP',slug:'vip'},{name:'Trial',slug:null}],newsletters:[{id:'newsletter1'}]};
  await r.call('members_edit',{id:'member1',...relationships});
  assert.deepEqual(r.requests[0].data,{members:[relationships]});
  await r.call('members_edit',{id:'member1',labels:[],newsletters:[]});
  assert.deepEqual(r.requests[1].data,{members:[{labels:[],newsletters:[]}]});
  assert.equal(r.requests.length,2);
});
