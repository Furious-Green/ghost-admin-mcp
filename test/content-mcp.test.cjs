const {test,after} = require('node:test');
const assert = require('node:assert/strict');
const {assertToolError}=require('./helpers/toolError.cjs');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const {makeRecordingClient} = require('./helpers/recordingClient.cjs');
const {families,config,timestamp} = require('./helpers/fixtures.cjs');
async function setup(t) {
  const r = makeRecordingClient();
  const m = await require('./helpers/mcpHarness.cjs').openMcpHarness(r.client);
  t.after(m.close);
  return {...r,...m,call:(name,args)=>m.mcpClient.callTool({name,arguments:structuredClone(args)})};
}
for (const resource of ['posts','pages','tags']) {
  test(`MCP ${resource} forwards browse/read options without putting them in content`, async t => {
    const r = await setup(t);
    const include = resource==='tags'?'count.posts':'authors,tags';
    const query = {page:2,limit:'all',filter:'slug:example',order:'name asc',fields:'id,slug',include,...(resource==='tags'?{}:{formats:'html,plaintext,mobiledoc'})};
    const output = await r.call(`${resource}_browse`,query);
    assert.notEqual(output.isError,true);
    assert.deepEqual(r.requests[0].params,query);
    assert.equal(r.requests[0].data,'');
    const readQuery = {fields:'id,slug',include,...(resource==='tags'?{filter:'visibility:internal'}:{formats:'lexical'})};
    assert.notEqual((await r.call(`${resource}_read`,{slug:'café space',...readQuery})).isError,true);
    assert.deepEqual(r.requests[1].params,readQuery);
    assert.equal(r.requests[1].url,`${config.url}/ghost/api/admin/${resource}/slug/caf%C3%A9%20space/`);
    assert.equal(r.requests.length,2);
  });
}
for (const resource of ['posts','pages']) {
  test(`MCP ${resource} revision/null/relations writes separate response controls from body`, async t => {
    const r = await setup(t);
    const content = {updated_at:timestamp,custom_template:null,feature_image:null,published_at:null,tags:[],authors:[],tiers:[],locale:null,...(resource==='pages'?{show_title_and_feature_image:false}:{email_only:false})};
    const output = await r.call(`${resource}_edit`,{id:'one',...content,include:'authors',formats:'html,plaintext',save_revision:false});
    assert.notEqual(output.isError,true);
    assert.deepEqual(r.requests[0].params,{include:'authors',formats:'html,plaintext',save_revision:false});
    assert.deepEqual(r.requests[0].data,{[resource]:[content]});
    assert.equal(r.requests[0].method,'PUT');
    await r.call(`${resource}_add`,{title:'A',html:'<p>A</p>',lexical:'{}',include:'tags',formats:'lexical'});
    assert.deepEqual(r.requests[1].params,{include:'tags',formats:'lexical',source:'html'});
    assert.deepEqual(r.requests[1].data,{[resource]:[{title:'A',html:'<p>A</p>',lexical:'{}'}]});
    await r.call(`${resource}_add`,{title:'B',mobiledoc:'{}'});
    assert.deepEqual(r.requests[2].params,{});
    assert.deepEqual(r.requests[2].data,{[resource]:[{title:'B',mobiledoc:'{}'}]});
    assert.equal(r.requests.length,3);
  });
}
test('MCP tags write supported metadata and nullable clears without query leakage',async t=>{
  const r=await setup(t);
  const fields={name:'Tag',slug:null,description:null,visibility:'internal',feature_image:'/content/images/a.png',meta_title:'SEO',meta_description:null,og_title:'OG',og_description:null,og_image:null,twitter_title:'Social',twitter_description:null,twitter_image:null,codeinjection_head:'<style></style>',codeinjection_foot:null,canonical_url:null,accent_color:'#aabbcc'};
  assert.notEqual((await r.call('tags_add',{...fields,include:'count.posts'})).isError,true);
  assert.deepEqual(r.requests[0].data,{tags:[fields]});
  assert.deepEqual(r.requests[0].params,{include:'count.posts'});
  assert.notEqual((await r.call('tags_edit',{id:'one',...fields,include:'count.posts'})).isError,true);
  assert.deepEqual(r.requests[1].data,{tags:[fields]});
  assert.deepEqual(r.requests[1].params,{include:'count.posts'});
  assert.equal(r.requests.length,2);
});

test('all 17 repaired MCP tools reject unknown keys rather than strip them',async t=>{
  const r=await setup(t);
  const all={posts:{...families.posts,copy:{id:'one'}},pages:{...families.posts,copy:{id:'one'}},tags:families.tags};
  let count=0;
  for(const [resource,ops]of Object.entries(all))for(const [op,args]of Object.entries(ops)){
    await assertToolError(r.call(`${resource}_${op}`,{...args,unknown:'SECRET'}),/Invalid arguments/);
    count++;
  }
  assert.equal(count,17);
  assert.equal(r.requests.length,0);
});

test('MCP invalid content is rejected before any HTTP request',async t=>{
  const r=await setup(t);
  for(const [name,args]of [
    ['posts_browse',{page:0}],['posts_browse',{limit:1.5}],['tags_browse',{limit:'1'}],
    ['posts_browse',{include:'unknown'}],['tags_browse',{formats:'html'}],
    ['pages_read',{id:'one',include:'email'}],['posts_add',{title:'A',save_revision:true}],
    ['posts_edit',{id:'one',updated_at:timestamp,fields:'id'}],
    ['pages_add',{title:'A',email_only:true}],['pages_add',{title:'A',status:'sent'}],
    ['posts_add',{title:'A',visibility:'anybody'}],['posts_add',{title:'A',featured:null}],
    ['posts_add',{title:'A',tags:[{id:'one',meta_title:'not a ref'}]}],
    ['posts_add',{title:'A',authors:[{}]}],['posts_edit',{id:'one',updated_at:'bad'}],
    ['posts_copy',{id:'one',formats:'html,'}],['tags_delete',{id:'../posts/one'}],
  ]) await assertToolError(r.call(name,args),/Invalid arguments/,`${name}: ${JSON.stringify(args)}`);
  for(const name of ['posts_read','pages_read','tags_read'])for(const args of [{},{id:'one',slug:'one'}]) {
    const result=await r.call(name,args);
    assert.equal(result.isError,true);
    assert.match(result.content[0].text,/exactly one/);
  }
  assert.equal(r.requests.length,0);
});

test('direct clients cannot bypass strict content preparation or mutate caller data',async()=>{
  const r=makeRecordingClient();
  for(const resource of ['posts','pages','tags']) {
    await assert.rejects(r.client[resource].read({id:'one',slug:'two'}),/exactly one/);
    await assert.rejects(r.client[resource].browse({unknown:1}));
    await assert.rejects(r.client[resource].read({id:'../one'}));
    await assert.rejects(r.client[resource].read({id:'one',fields:'id'},{fields:'id'}),/Duplicate/);
  }
  assert.equal(r.requests.length,0);
  const args={id:'one',updated_at:timestamp,slug:'café space',custom_template:null,tags:[{id:'tag',name:'Tag'}]};
  const original=structuredClone(args),query={save_revision:false,formats:'lexical'};
  await r.client.posts.edit(args,query);
  assert.deepEqual(args,original);
  assert.deepEqual(query,{save_revision:false,formats:'lexical'});
  assert.deepEqual(r.requests[0].data,{posts:[{updated_at:timestamp,slug:'café space',custom_template:null,tags:[{id:'tag',name:'Tag'}]}]});
  assert.deepEqual(r.requests[0].params,{save_revision:false,formats:'lexical'});
});

test('copy rejects direct unknown properties and supports baseline response formats',async()=>{
  const r=makeRecordingClient();
  for(const resource of ['posts','pages']) {
    await assert.rejects(r.client[resource].copy({id:'one',title:'ignored'}));
    r.enqueueResponse({[resource]:[{id:'copy'}]});
    assert.deepEqual(await r.client[resource].copy({id:'one',formats:'plaintext,mobiledoc'}),{data:{id:'copy'}});
  }
  assert.equal(r.requests.length,2);
  for(const request of r.requests)assert.deepEqual(request.params,{formats:'plaintext,mobiledoc'});
});

test('MCP rejects impossible timestamp offsets before scheduling or editing HTTP',async t=>{
  const r=await setup(t);
  for(const resource of ['posts','pages'])for(const offset of ['+99:99','+24:00','-24:00','+01:99','-0160','+2400']) {
    const value='2026-10-21T00:00:00'+offset;
    await assertToolError(r.call(`${resource}_edit`,{id:'one',updated_at:value}),/Invalid arguments/);
    await assertToolError(r.call(`${resource}_add`,{title:'A',published_at:value}),/Invalid arguments/);
  }
  assert.equal(r.requests.length,0);
  const value='2026-10-21T00:00:00-01:30';
  const result=await r.call('posts_edit',{id:'one',updated_at:value,published_at:value});
  assert.notEqual(result.isError,true);
  assert.deepEqual(r.requests[0].data,{posts:[{updated_at:value,published_at:value}]});
  assert.equal(r.requests.length,1);
});
