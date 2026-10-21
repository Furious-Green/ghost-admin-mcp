const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const {assertToolError}=require('./helpers/toolError.cjs');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const {makeRecordingClient}=require('./helpers/recordingClient.cjs');
const {openMcpHarness}=require('./helpers/mcpHarness.cjs');
const {config,families}=require('./helpers/fixtures.cjs');
async function setup(t){const r=makeRecordingClient();const m=await openMcpHarness(r.client);t.after(m.close);return {...r,...m,call:(name,args)=>m.mcpClient.callTool({name,arguments:structuredClone(args)})};}

for(const [resource,include]of [['members','tiers,email_recipients'],['users','roles,roles.permissions'],['newsletters','count.posts,count.members']]){
  test(`MCP ${resource} forwards resource-specific browse/read queries and safe selectors`,async t=>{
    const r=await setup(t);
    const browse={page:2,limit:'all',fields:'id,name',filter:'name:Ada',order:'name asc',include,...(resource==='members'?{search:'Ada'}:{})};
    assert.notEqual((await r.call(`${resource}_browse`,browse)).isError,true);
    assert.deepEqual(r.requests[0].params,browse);
    assert.equal(r.requests[0].data,'');
    const selector=resource==='newsletters'?{slug:'café space'}:{email:'name+tag%box@example.invalid'};
    const query={include,...(resource==='members'?{}:{fields:'id,name'}),...(resource==='users'?{filter:'status:active'}:{})};
    assert.notEqual((await r.call(`${resource}_read`,{...selector,...query})).isError,true);
    assert.deepEqual(r.requests[1].params,query);
    assert.equal(r.requests[1].url,`${config.url}/ghost/api/admin/${resource}/${resource==='newsletters'?'slug/caf%C3%A9%20space':'email/name%2Btag%25box%40example.invalid'}/`);
    assert.equal(r.requests.length,2);
  });
}
test('MCP account writes retain null false arrays and split include away from body',async t=>{
  const r=await setup(t);
  for(const [name,args,body,query]of [
    ['members_edit',{id:'one',labels:[],newsletters:[]},{members:[{labels:[],newsletters:[]}]},{}],
    ['users_edit',{id:'one',email:'name+tag%box@example.invalid',bio:null,include:'roles'},{users:[{email:'name+tag%box@example.invalid',bio:null}]},{include:'roles'}],
    ['newsletters_edit',{id:'one',sender_email:null,sender_name:null,header_image:null,footer_content:null,show_badge:false,include:'count.members'},{newsletters:[{sender_email:null,sender_name:null,header_image:null,footer_content:null,show_badge:false}]},{include:'count.members'}],
    ['newsletters_add',{name:'A',subscribe_on_signup:false,include:'count.posts'},{newsletters:[{name:'A',subscribe_on_signup:false}]},{include:'count.posts'}],
    ['webhooks_edit',{id:'one',secret:null,name:null},{webhooks:[{secret:null,name:null}]},{}],
  ]){
    const output=await r.call(name,args);assert.notEqual(output.isError,true,output.content[0].text);
    assert.deepEqual(r.requests.at(-1).data,body);assert.deepEqual(r.requests.at(-1).params,query);
  }
  assert.equal(r.requests.length,5);
});

test('all remaining SDK tool schemas reject unknown keys and invalid operation-specific fields',async t=>{
  const r=await setup(t);let count=0;
  for(const resource of ['members','users','newsletters','webhooks'])for(const [op,input]of Object.entries(families[resource])){
    await assertToolError(r.call(`${resource}_${op}`,{...input,unknown:'SECRET'}),/Invalid arguments/);count++;
  }
  assert.equal(count,16);
  for(const [name,args]of [
    ['members_read',{id:'one',fields:'id'}],['members_edit',{id:'one',labels:[{name:'VIP',unknown:1}]}],
    ['members_edit',{id:'one',newsletters:[{id:'one',unknown:1}]}],['members_browse',{page:0}],
    ['users_browse',{include:'tags'}],['newsletters_edit',{id:'one',status:'inactive'}],
    ['newsletters_edit',{id:'one',title_alignment:'right'}],['newsletters_edit',{id:'one',opt_in_existing:true}],
    ['webhooks_edit',{id:'one',target_url:'file:///secret'}],['users_read',{id:'../one'}],
    ['newsletters_read',{id:'one',filter:'status:active'}],
  ])await assertToolError(r.call(name,args),/Invalid arguments/);
  assert.equal(r.requests.length,0);
});

test('MCP cross-field selectors fail even with an injected client that would accept anything',async t=>{
  const r=makeRecordingClient();let dispatched=0;
  const override={...r.client};
  for(const resource of ['members','users','newsletters'])override[resource]={...r.client[resource],read:async()=>{dispatched++;return {data:{id:'wrong'}}}};
  const m=await openMcpHarness(override);t.after(m.close);
  for(const resource of ['members','users','newsletters'])for(const input of [{},{id:'one',...(resource==='members'?{email:'a@example.invalid'}:{slug:'two'})}]){
    const result=await m.mcpClient.callTool({name:`${resource}_read`,arguments:input});
    assert.equal(result.isError,true);assert.match(result.content[0].text,/exactly one/);
  }
  assert.equal(dispatched,0);assert.equal(r.requests.length,0);
});

test('direct SDK callers cannot bypass strict account validation or mutate owned data',async()=>{
  const r=makeRecordingClient();
  for(const resource of ['members','users','newsletters']){
    await assert.rejects(r.client[resource].read({}));
    await assert.rejects(r.client[resource].browse({unknown:1}));
    for(const options of [null,[],false,'',1,{unknown:1}])await assert.rejects(r.client[resource].browse({},options));
    await assert.rejects(r.client[resource].read({id:'one',include:resource==='members'?'tiers':resource==='users'?'roles':'count.posts'},{include:resource==='members'?'tiers':resource==='users'?'roles':'count.posts'}));
  }
  await assert.rejects(r.client.members.edit({id:'one',labels:[{name:'VIP',unknown:1}]}));
  assert.equal(r.requests.length,0);
  const input={id:'one',sender_email:null,show_badge:false},copy=structuredClone(input),options={include:'count.members'};
  await r.client.newsletters.edit(input,options);
  assert.deepEqual(r.requests[0].params,{include:'count.members'});
  assert.deepEqual(r.requests[0].data,{newsletters:[{sender_email:null,show_badge:false}]});
  assert.deepEqual(input,copy);assert.deepEqual(options,{include:'count.members'});
});

test('MCP native audit rejects unsupported tier includes unsafe integers and offer enum ranges',async t=>{
  const r=await setup(t);
  for(const [name,args]of [
    ['tiers_browse',{include:'benefits'}],['tiers_read',{id:'one',include:'monthly_price'}],
    ['tiers_browse',{page:Number.MAX_SAFE_INTEGER+1}],['invites_browse',{limit:Number.MAX_SAFE_INTEGER+1}],
    ['tiers_add',{name:'A',visibility:'private'}],
    ['offers_add',{name:'A',code:'a',cadence:'week',duration:'once',amount:10,tier_id:'one',type:'percent'}],
  ])await assertToolError(r.call(name,args),/Invalid arguments/);
  const range=await r.call('offers_add',{name:'A',code:'a',cadence:'month',duration:'once',amount:101,tier_id:'one',type:'percent'});
  assert.equal(range.isError,true);assert.equal(r.requests.length,0);
});

test('shared account registration preserves the receiver of injected resource methods',async t=>{
  const r=makeRecordingClient();
  const members={...r.client.members,async read(input){
    const response=await this.browse({filter:`id:${input.id}`});
    return {data:response.data[0]};
  }};
  r.enqueueResponse({members:[{id:'one',name:'Ada'}]});
  const m=await openMcpHarness({...r.client,members});t.after(m.close);
  const output=await m.mcpClient.callTool({name:'members_read',arguments:{id:'one'}});
  assert.notEqual(output.isError,true);
  assert.deepEqual(JSON.parse(output.content[0].text),{data:{id:'one',name:'Ada'}});
  assert.deepEqual(r.requests[0].params,{filter:'id:one'});
});
