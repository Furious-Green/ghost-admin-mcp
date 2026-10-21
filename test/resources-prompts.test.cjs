const {test,after}=require('node:test');
const assert=require('node:assert/strict');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const {makeRecordingClient}=require('./helpers/recordingClient.cjs'),{openMcpHarness}=require('./helpers/mcpHarness.cjs');
async function setup(t,client){const r=makeRecordingClient();const m=await openMcpHarness(client??r.client);t.after(m.close);return {...r,...m}}

test('all seven real resources return JSON entity envelopes and exact client routes with metadata',async t=>{
  const r=await setup(t),meta={unknown:{zero:0}};
  for(const [uri,family]of [['user://AbC','users'],['member://AbC','members'],['tier://AbC','tiers'],['offer://AbC','offers'],['newsletter://AbC','newsletters'],['post://AbC','posts'],['blog://info','site']]){
    const entity={id:'returned',nullable:null,extra:false};r.enqueueResponse({[family]:family==='site'?entity:[entity],meta});
    const before=r.requests.length,output=await r.mcpClient.readResource({uri});
    assert.deepEqual(output.contents,[{uri,mimeType:'application/json',text:JSON.stringify({data:entity,meta},null,2)}]);
    assert.equal(r.requests.length,before+1);const req=r.requests.at(-1);
    assert.equal(req.method,'GET');assert.match(req.url,new RegExp(`/ghost/api/admin/${family}/${family==='site'?'':'AbC/'}$`));
    assert.deepEqual(req.params,family==='posts'?{formats:'html'}:{});
  }
});

test('resource IDs decode once, preserve case and reject dangerous URI structures before injected reads',async t=>{
  const r=makeRecordingClient();const calls=[];
  const posts={read:async function(input,options){assert.equal(this,posts);calls.push([input,options]);return {data:{id:'actual',html:'source'}}}};
  const m=await openMcpHarness({...r.client,posts});t.after(m.close);
  await m.mcpClient.readResource({uri:'post://caf%C3%A9%20ID'});
  assert.deepEqual(calls,[[{id:'café ID'},{formats:'html'}]]);
  for(const uri of ['post://%2e%2e','post://%252e%252e','post://a%2fb','post://a%3fb','post://one?x','post://one#x',
    'post://user@one','post://one:123','post://one/','post://%00','post://%ZZ','post://'+'a'.repeat(192)])await assert.rejects(m.mcpClient.readResource({uri}));
  assert.equal(calls.length,1);assert.equal(r.requests.length,0);
});

test('resource read failures malformed replies and serialization errors are protocol errors without diagnostics or logs',async t=>{
  const r=makeRecordingClient();const methods=[
    async()=>{throw new Error('PRIVATE_KEY_MARKER request stack /server/path')},
    async()=>({data:null}),async()=>({data:[]}),async()=>({data:{},meta:null}),
    async()=>({data:{large:1n}}),
  ];
  const saved=console.error,logs=[];console.error=(...args)=>logs.push(args);
  try{
    for(const read of methods){
      const m=await openMcpHarness({...r.client,users:{...r.client.users,read}});t.after(m.close);
      await assert.rejects(m.mcpClient.readResource({uri:'user://one'}),error=>{
        assert.match(error.message,/Ghost resource read failed/);assert.ok(!error.message.includes('PRIVATE_KEY_MARKER'));assert.ok(error.message.length<512);return true;
      });
    }
  }finally{console.error=saved}
  assert.deepEqual(logs,[]);assert.equal(r.requests.length,0);
});

test('resource ID helper rejects absent array or unrelated variables and retains valid decoded selector',()=>{
  const {resourceId}=require('../build/protocolReads.js');
  const uri=new URL('post://AbC');
  assert.equal(resourceId(uri,{post_id:'AbC'},'post','post_id'),'AbC');
  for(const vars of [{},{post_id:['AbC']},{post_id:'AbC',other:'x'},{post_id:'different'}])assert.throws(()=>resourceId(uri,vars,'post','post_id'));
});
