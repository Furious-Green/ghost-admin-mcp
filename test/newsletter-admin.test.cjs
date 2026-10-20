const {test,after}=require('node:test');
const assert=require('node:assert/strict');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const {makeRecordingClient}=require('./helpers/recordingClient.cjs');
const {openMcpHarness}=require('./helpers/mcpHarness.cjs');
async function setup(t){const r=makeRecordingClient();const m=await openMcpHarness(r.client);t.after(m.close);return {...r,...m,call:(name,args)=>m.mcpClient.callTool({name,arguments:structuredClone(args)})};}

for(const opt_in_existing of [true,false,undefined]){
  test(`newsletter creation opt-in=${opt_in_existing} separates subscriber controls from documented fields`,async t=>{
    const r=await setup(t);
    const fields={name:'Weekly',slug:'weekly',description:null,sender_name:'Editor',sender_email:'editor@example.invalid',sender_reply_to:'newsletter',status:'active',subscribe_on_signup:false,header_image:null,footer_content:'<p>Footer</p>',show_header_icon:false,show_header_title:false,show_header_name:false,title_font_category:'serif',title_alignment:'left',show_feature_image:false,body_font_category:'sans_serif',show_badge:false};
    const meta={sent_email_verification:['sender_email'],opted_in_member_count:0,unknown:{nested:null}};
    r.enqueueResponse({newsletters:[{id:'one',name:'Weekly',sender_email:null}],meta});
    const result=await r.call('newsletters_add',{...fields,include:'count.members',...(opt_in_existing!==undefined?{opt_in_existing}:{})});
    assert.notEqual(result.isError,true,result.content[0].text);
    assert.deepEqual(JSON.parse(result.content[0].text),{data:{id:'one',name:'Weekly',sender_email:null},meta});
    assert.deepEqual(r.requests[0].params,{include:'count.members',...(opt_in_existing!==undefined?{opt_in_existing}:{})});
    assert.deepEqual(r.requests[0].data,{newsletters:[fields]});
    assert.equal(r.requests.length,1);
  });
}

test('newsletter settings edit and direct create preserve caller data and returned pending/absent state',async t=>{
  const r=await setup(t);
  const edit={id:'one',slug:'renamed',sender_name:null,sender_email:null,header_image:null,footer_content:null,sort_order:0,status:'archived'};
  r.enqueueResponse({newsletters:[{id:'one',slug:'renamed',status:'archived'}]});
  const result=await r.call('newsletters_edit',edit);
  assert.deepEqual(JSON.parse(result.content[0].text),{data:{id:'one',slug:'renamed',status:'archived'}});
  assert.deepEqual(r.requests[0].data,{newsletters:[{slug:'renamed',sender_name:null,sender_email:null,header_image:null,footer_content:null,sort_order:0,status:'archived'}]});
  const input={name:'Weekly',sender_email:'editor@example.invalid'},copy=structuredClone(input),options={opt_in_existing:false};
  r.enqueueResponse({newsletters:[{id:'one',sender_email:null}],meta:{sent_email_verification:['sender_email'],opted_in_member_count:0}});
  assert.deepEqual(await r.client.newsletters.add(input,options),{data:{id:'one',sender_email:null},meta:{sent_email_verification:['sender_email'],opted_in_member_count:0}});
  assert.deepEqual(input,copy);assert.deepEqual(options,{opt_in_existing:false});
  assert.deepEqual(r.requests[1].params,{opt_in_existing:false});assert.deepEqual(r.requests[1].data,{newsletters:[input]});
});

test('newsletter opt-in is creation-only strict boolean and never passed in unsupported requests',async t=>{
  const r=await setup(t);
  for(const [name,args]of [
    ['newsletters_add',{name:'A',opt_in_existing:'true'}],['newsletters_add',{name:'A',opt_in_existing:null}],
    ['newsletters_edit',{id:'one',opt_in_existing:true}],['newsletters_read',{id:'one',opt_in_existing:false}],
    ['newsletters_browse',{opt_in_existing:true}],['newsletters_add',{name:'A',sort_order:0}],
    ['newsletters_add',{name:'A',slug:' '}],['newsletters_add',{name:'A',sender_email:'invalid'}],
    ['newsletters_add',{name:'A',header_image:42}],['newsletters_edit',{id:'one',footer_content:{html:'bad'}}],
  ])await assert.rejects(r.call(name,args),/Invalid arguments/);
  await assert.rejects(r.client.newsletters.edit({id:'one'},{opt_in_existing:true}));
  await assert.rejects(r.client.newsletters.add({name:'A',opt_in_existing:false},{opt_in_existing:true}));
  assert.equal(r.requests.length,0);
});

test('removed newsletter deletion is unknown and never silently archives or issues HTTP',async t=>{
  const r=await setup(t);
  await assert.rejects(r.call('newsletters_delete',{id:'one'}),/not found|Unknown tool/i);
  assert.equal(r.client.newsletters.delete,undefined);
  const tools=[];let cursor;
  do{const page=await r.mcpClient.listTools(cursor?{cursor}:{});tools.push(...page.tools);cursor=page.nextCursor}while(cursor);
  assert.equal(tools.length,45);assert.equal(tools.some(t=>t.name==='newsletters_delete'),false);
  assert.match(tools.find(t=>t.name==='newsletters_add').description,/existing members/i);
  assert.match(tools.find(t=>t.name==='newsletters_add').description,/verification/i);
  assert.match(tools.find(t=>t.name==='newsletters_edit').description,/verification/i);
  assert.match(tools.find(t=>t.name==='posts_edit').description,/real subscriber emails/i);
  assert.equal(r.requests.length,0);
});
