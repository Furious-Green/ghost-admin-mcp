const {test,after}=require('node:test');
const assert=require('node:assert/strict');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const prepare=(...args)=>require('../build/client/accountRequest.js').prepareAccountRequest(...args);

test('account queries are per operation and selectors encode once without encoding body email',()=>{
  assert.deepEqual(prepare('members','browse',{page:2,limit:'all',fields:'id,email',include:'tiers',search:'Ada'}),{input:{page:2,limit:'all',fields:'id,email',include:'tiers',search:'Ada'},query:{}});
  assert.deepEqual(prepare('members','read',{email:'name+tag%box@example.invalid',include:'tiers'}),{input:{email:'name%2Btag%25box%40example.invalid'},query:{include:'tiers'}});
  assert.deepEqual(prepare('users','read',{slug:'café space',fields:'id,slug',filter:'status:active',include:'roles.permissions'}),{input:{slug:'caf%C3%A9%20space'},query:{fields:'id,slug',filter:'status:active',include:'roles.permissions'}});
  assert.deepEqual(prepare('users','edit',{id:'me',email:'name+tag%box@example.invalid',include:'roles'}),{input:{id:'me',email:'name+tag%box@example.invalid'},query:{include:'roles'}});
  assert.deepEqual(prepare('newsletters','edit',{id:'one',status:'archived',include:'count.members'}),{input:{id:'one',status:'archived'},query:{include:'count.members'}});
  for(const [resource,op,input]of [
    ['members','read',{id:'one',fields:'id'}],['members','edit',{id:'one',include:'tiers'}],
    ['members','add',{email:'a@example.invalid',send_email:true}],['members','delete',{id:'one',cancel:true}],
    ['users','browse',{formats:'html'}],['users','read',{role:'Author'}],
    ['newsletters','read',{id:'one',filter:'status:active'}],['newsletters','add',{name:'A',opt_in_existing:true}],
    ['webhooks','add',{event:'post.published',target_url:'https://example.invalid',fields:'id'}],
  ])assert.throws(()=>prepare(resource,op,input));
});

test('account validation rejects ambiguous unsafe selectors and wrong nested keys',()=>{
  for(const resource of ['members','users','newsletters']){
    for(const input of [{},{id:'one',...(resource==='members'?{email:'a@example.invalid'}:{slug:'one'})},{id:''},{id:'../one'},{id:'%2e'},{id:'a?b'},{id:'a\n'},{id:'\ud800'}])assert.throws(()=>prepare(resource,'read',input));
    for(const key of ['page','limit'])for(const value of [0,-1,1.5,'1',Number.MAX_SAFE_INTEGER+1,null])assert.throws(()=>prepare(resource,'browse',{[key]:value}));
    for(const input of [{include:'unknown'},{include:''},{fields:'id,,email'},{filter:' '},{order:''}])assert.throws(()=>prepare(resource,'browse',input));
  }
  for(const input of [{labels:[{name:'VIP',unknown:1}]},{labels:[{}]},{newsletters:[{id:'one',name:'A'}]},{newsletters:[{id:'../one'}]},{email:null},{name:null},{note:null}])assert.throws(()=>prepare('members','edit',{id:'one',...input}));
});

test('account option validation preserves null false arrays and caller ownership',()=>{
  const input={id:'one',sender_name:null,sender_email:null,header_image:null,footer_content:null,show_badge:false};
  const original=structuredClone(input),options={include:'count.posts'};
  assert.deepEqual(prepare('newsletters','edit',input,options),{input:original,query:{include:'count.posts'}});
  assert.deepEqual(input,original);assert.deepEqual(options,{include:'count.posts'});
  assert.deepEqual(prepare('members','edit',{id:'one',labels:[],newsletters:[]}),{input:{id:'one',labels:[],newsletters:[]},query:{}});
  for(const options of [null,[],true,'include=tiers',1,{unknown:1}])assert.throws(()=>prepare('members','browse',{},options));
  assert.throws(()=>prepare('users','read',{id:'one',include:'roles'},{include:'roles'}));
  assert.deepEqual(prepare('users','edit',{id:'one',bio:null,website:null,location:null,facebook:null,twitter:null}),{input:{id:'one',bio:null,website:null,location:null,facebook:null,twitter:null},query:{}});
});

test('account writes validate existing enums nullable fields email and URL inputs',()=>{
  for(const input of [{status:'inactive'},{title_alignment:'right'},{title_font_category:'comic'},{body_font_category:'comic'},{sort_order:-1},{sort_order:1.5},{sort_order:Number.MAX_SAFE_INTEGER+1},{show_badge:null},{sender_reply_to:null},{sender_reply_to:'invalid'},{sender_email:'invalid'},{name:' '},{description:'x'.repeat(2001)}])assert.throws(()=>prepare('newsletters','edit',{id:'one',...input}));
  for(const sender_reply_to of ['newsletter','support','reply+tag@example.invalid'])assert.deepEqual(prepare('newsletters','add',{name:'A',sender_reply_to}),{input:{name:'A',sender_reply_to},query:{}});
  for(const resource of ['members','users'])assert.throws(()=>prepare(resource,resource==='members'?'add':'edit',{id:'one',email:'not an email'}));
  for(const target_url of ['javascript:alert(1)','/relative','ftp://example.invalid'])assert.throws(()=>prepare('webhooks','add',{event:'post.published',target_url}));
  assert.deepEqual(prepare('webhooks','edit',{id:'one',name:null,secret:null}),{input:{id:'one',name:null,secret:null},query:{}});
});

test('native schemas reject unsupported includes bad ranges and malformed options without HTTP',async()=>{
  const {makeRecordingClient}=require('./helpers/recordingClient.cjs');const r=makeRecordingClient();
  for(const [resource,op,input]of [
    ['tiers','browse',{include:'benefits'}],['tiers','read',{id:'one',include:'benefits'}],
    ['tiers','browse',{page:Number.MAX_SAFE_INTEGER+1}],['invites','browse',{limit:Number.MAX_SAFE_INTEGER+1}],
    ['tiers','browse',{filter:' '}],['invites','browse',{fields:'id,,email'}],
    ['tiers','add',{name:'A',visibility:'private'}],
    ['offers','add',{name:'A',code:'a',cadence:'weekly',duration:'once',amount:10,tier_id:'one',type:'percent'}],
    ['offers','add',{name:'A',code:'a',cadence:'month',duration:'once',amount:101,tier_id:'one',type:'percent'}],
  ])await assert.rejects(r.client[resource][op](input));
  for(const resource of ['tiers','offers','invites','roles'])for(const options of [null,[],false,'',1])await assert.rejects(r.client[resource].browse({},options));
  assert.equal(r.requests.length,0);
});
