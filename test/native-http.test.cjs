const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {once} = require('node:events');
const {config} = require('./helpers/fixtures.cjs');
const ports = new Set();
after(require('./helpers/loopbackGuard.cjs').allowLoopback(ports));

async function fixture(t, handler) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const chunk of req) body += chunk;
    requests.push({url: req.url, method: req.method, headers: req.headers, body});
    handler(req, res);
  });
  t.after(() => new Promise(resolve => {
    server.closeAllConnections();
    server.close(resolve);
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  ports.add(server.address().port);
  const url = `http://127.0.0.1:${server.address().port}`;
  return {url, requests};
}
function client(url, executor) {
  return require('../build/client/sdkAdapter.js').createGhostClient({...config, url}, executor ? {makeRequest: executor} : {});
}

test('real resource and prompt reads use fixed authenticated routes and public site without credentials',async t=>{
  const f=await fixture(t,(req,res)=>{
    res.setHeader('Content-Type','application/json');
    if(req.url.includes('/denied/')){res.statusCode=req.url.includes('/users/')?403:404;return res.end(JSON.stringify({errors:[{message:config.key+'PRIVATE_RESOURCE_PATH',type:'NoPermissionError'}]}))}
    const family=req.url.split('/')[5],entity={id:'actual',title:'Title',excerpt:'Excerpt',html:'Complete '.repeat(100),url:'https://frontend.invalid'};
    res.end(JSON.stringify({[family]:family==='site'?entity:[entity],meta:{unknown:{zero:0}}}));
  });
  const m=await require('./helpers/mcpHarness.cjs').openMcpHarness(client(f.url+'/blog'));t.after(m.close);
  for(const scheme of ['user','member','tier','offer','newsletter','post']){
    const output=await m.mcpClient.readResource({uri:`${scheme}://caf%C3%A9%20ID`});assert.equal(output.contents[0].mimeType,'application/json');
    assert.equal(JSON.parse(output.contents[0].text).meta.unknown.zero,0);
  }
  const site=await m.mcpClient.readResource({uri:'blog://info'});assert.equal(JSON.parse(site.contents[0].text).data.url,'https://frontend.invalid');
  const prompt=await m.mcpClient.getPrompt({name:'summarize-post',arguments:{postId:'one'}});assert.ok(prompt.messages[0].content.text.includes('Complete '.repeat(100)));
  assert.deepEqual(f.requests.map(r=>r.url),[
    '/blog/ghost/api/admin/users/caf%C3%A9%20ID/','/blog/ghost/api/admin/members/caf%C3%A9%20ID/',
    '/blog/ghost/api/admin/tiers/caf%C3%A9%20ID/','/blog/ghost/api/admin/offers/caf%C3%A9%20ID/',
    '/blog/ghost/api/admin/newsletters/caf%C3%A9%20ID/','/blog/ghost/api/admin/posts/caf%C3%A9%20ID/?formats=html',
    '/blog/ghost/api/admin/site/','/blog/ghost/api/admin/posts/one/?formats=html',
  ]);
  for(const r of f.requests){assert.equal(r.method,'GET');if(r.url.includes('/site/'))assert.equal(r.headers.authorization,undefined);else assert.match(r.headers.authorization,/^Ghost /)}
  for(const uri of ['user://denied','tier://denied']){
    const before=f.requests.length;await assert.rejects(m.mcpClient.readResource({uri}),error=>{
      assert.match(error.message,/Ghost resource read failed/);assert.ok(!error.message.includes(config.key));assert.ok(!error.message.includes('PRIVATE_RESOURCE_PATH'));return true;
    });assert.equal(f.requests.length,before+1);
  }
});

test('labels and public site preserve configured prefix, literal HTTP shapes and authentication boundaries',async t=>{
  const site={title:'Publication',description:'News',logo:'/relative.png',url:'https://front.example.invalid/',version:'5.130',extra:null};
  const replies=[{labels:[{id:'one'}],meta:{pagination:{next:null}}},{labels:[{id:'one',name:'VIP'}]},
    {labels:[{id:'one',name:'Changed'}]},null,{site,meta:{unknown:{zero:0}}},
    ...[403,404,409].map(status=>({errors:[{message:`secret ${config.key}`,type:'ValidationError'}]}))];
  const f=await fixture(t,(req,res)=>{
    const n=f.requests.length-1;res.statusCode=n===3?204:n<5?200:[403,404,409][n-5]??500;
    res.setHeader('Content-Type','application/json').end(n===3?'':JSON.stringify(replies[n]));
  });
  const m=await require('./helpers/mcpHarness.cjs').openMcpHarness(client(f.url+'/blog'));t.after(m.close);
  const call=(name,args)=>m.mcpClient.callTool({name,arguments:args});
  assert.deepEqual(JSON.parse((await call('labels_browse',{page:2,limit:1,include:'count.members'})).content[0].text),{data:[{id:'one'}],meta:{pagination:{next:null}}});
  await call('labels_read',{slug:'café vip',fields:'id,name',include:'count.members'});
  await call('labels_edit',{id:'one',name:'Changed',slug:'changed',include:'count.members'});
  assert.equal((await call('labels_delete',{id:'one'})).content[0].text,'Label with id one deleted.');
  assert.deepEqual(JSON.parse((await call('site_read',{})).content[0].text),{data:site,meta:{unknown:{zero:0}}});
  for(const status of [403,404,409]){
    const before=f.requests.length;const output=await call('labels_edit',{id:'one',name:'Changed'});
    assert.equal(output.isError,true);assert.match(output.content[0].text,new RegExp(`HTTP ${status}`));
    assert.ok(!JSON.stringify(output).includes(config.key));assert.equal(f.requests.length,before+1);
  }
  assert.deepEqual(f.requests.slice(0,5).map(r=>[r.method,r.url]),[
    ['GET','/blog/ghost/api/admin/labels/?page=2&limit=1&include=count.members'],
    ['GET','/blog/ghost/api/admin/labels/slug/caf%C3%A9%20vip/?fields=id,name&include=count.members'],
    ['PUT','/blog/ghost/api/admin/labels/one/?include=count.members'],
    ['DELETE','/blog/ghost/api/admin/labels/one/'],['GET','/blog/ghost/api/admin/site/'],
  ]);
  assert.deepEqual(JSON.parse(f.requests[2].body),{labels:[{name:'Changed',slug:'changed'}]});
  assert.equal(f.requests[3].body,'');assert.equal(f.requests[4].body,'');
  for(const r of f.requests){
    assert.equal(r.headers['accept-version'],'v5.0');
    if(r.url.endsWith('/site/'))assert.equal(r.headers.authorization,undefined);
    else assert.match(r.headers.authorization,/^Ghost /);
  }
});

test('public site refuses redirects without following external response URLs or sending credentials',async t=>{
  let redirected=0;
  const destination=await fixture(t,(req,res)=>{redirected++;res.end('{}')});
  const f=await fixture(t,(req,res)=>res.writeHead(302,{Location:destination.url+'/unexpected'}).end());
  await assert.rejects(client(f.url).site.read({}),/HTTP 302/);
  assert.equal(f.requests.length,1);assert.equal(redirected,0);
  assert.equal(f.requests[0].headers.authorization,undefined);
});

test('explicit delivery and opt-in use literal HTTP query/body contracts and never retry errors',async t=>{
  const replies=[
    {posts:[{id:'one',status:'sent',email:{status:'failed',error:'Unavailable'}}]},
    {posts:[{id:'one',status:'scheduled'}]},
    {newsletters:[{id:'n1',sender_email:null}],meta:{sent_email_verification:['sender_email'],opted_in_member_count:0,nested:{unknown:null}}},
    {newsletters:[{id:'n2',sender_email:null}]},
    {newsletters:[{id:'n3'}]},
    {errors:[{message:'Permission denied',type:'NoPermissionError'}]},
    {errors:[{message:'Update collision',type:'UpdateCollisionError'}]},
    {errors:[{message:'Email unavailable',type:'EmailError'}]},
  ];
  const f=await fixture(t,(req,res)=>{
    const index=f.requests.length-1;
    res.statusCode=index<5?200:[403,409,503][index-5]??500;
    res.setHeader('Content-Type','application/json').end(JSON.stringify(replies[index]??{errors:[{message:'Unexpected retry'}]}));
  });
  const m=await require('./helpers/mcpHarness.cjs').openMcpHarness(client(f.url+'/blog'));t.after(m.close);
  const updated_at='2026-10-21T01:00:00+01:00',published_at='2027-01-15T12:00:00+01:00';
  const calls=[
    ['posts_edit',{id:'one',updated_at,status:'published',email_only:true,email_subject:'Hello',newsletter:'café-news',email_segment:'status:-free+label:vip',html:'<p>Hello</p>',save_revision:false}],
    ['posts_edit',{id:'one',updated_at,status:'scheduled',published_at,email_only:true,newsletter:'weekly'}],
    ['newsletters_add',{name:'Weekly',sender_email:'editor@example.invalid',opt_in_existing:true}],
    ['newsletters_add',{name:'Other',header_image:null,opt_in_existing:false}],
    ['newsletters_add',{name:'No default'}],
  ];
  for(let i=0;i<calls.length;i++){
    const [name,args]=calls[i];const result=await m.mcpClient.callTool({name,arguments:args});assert.notEqual(result.isError,true);
    assert.deepEqual(JSON.parse(result.content[0].text),{data:replies[i][name.startsWith('posts')?'posts':'newsletters'][0],...(replies[i].meta?{meta:replies[i].meta}:{})});
  }
  for(const message of ['Permission denied','Update collision','Email unavailable']){
    const before=f.requests.length;
    const result=await m.mcpClient.callTool({name:'posts_edit',arguments:{id:'one',updated_at,status:'published',newsletter:'weekly'}});
    assert.equal(result.isError,true);assert.equal(result.content[0].text,message);assert.equal(f.requests.length,before+1);
  }
  assert.deepEqual(f.requests.map(r=>r.url),[
    '/blog/ghost/api/admin/posts/one/?newsletter=caf%C3%A9-news&email_segment=status%3A-free%2Blabel%3Avip&save_revision=false&source=html',
    '/blog/ghost/api/admin/posts/one/?newsletter=weekly',
    '/blog/ghost/api/admin/newsletters/?opt_in_existing=true',
    '/blog/ghost/api/admin/newsletters/?opt_in_existing=false',
    '/blog/ghost/api/admin/newsletters/',
    '/blog/ghost/api/admin/posts/one/?newsletter=weekly',
    '/blog/ghost/api/admin/posts/one/?newsletter=weekly',
    '/blog/ghost/api/admin/posts/one/?newsletter=weekly',
  ]);
  assert.deepEqual(JSON.parse(f.requests[0].body),{posts:[{updated_at,status:'published',email_only:true,email_subject:'Hello',html:'<p>Hello</p>'}]});
  assert.deepEqual(JSON.parse(f.requests[1].body),{posts:[{updated_at,status:'scheduled',email_only:true,published_at}]});
  assert.deepEqual(JSON.parse(f.requests[2].body),{newsletters:[{name:'Weekly',sender_email:'editor@example.invalid'}]});
  assert.deepEqual(JSON.parse(f.requests[3].body),{newsletters:[{name:'Other',header_image:null}]});
  assert.deepEqual(f.requests.map(r=>r.method),['PUT','PUT','POST','POST','POST','PUT','PUT','PUT']);
  for(const r of f.requests){assert.equal(r.headers['accept-version'],'v5.0');assert.match(r.headers.authorization,/^Ghost /)}
});

test('remaining account MCP encodes email once and separates query controls on real HTTP',async t=>{
  const f=await fixture(t,(req,res)=>{
    const resource=req.url.split('/')[5];
    res.setHeader('Content-Type','application/json').end(JSON.stringify({[resource]:[{id:'one'}],meta:{retained:true}}));
  });
  const m=await require('./helpers/mcpHarness.cjs').openMcpHarness(client(f.url+'/blog'));t.after(m.close);
  for(const [name,args]of [
    ['members_read',{email:'name+tag%box@example.invalid',include:'tiers'}],
    ['users_read',{email:'name+tag%box@example.invalid',fields:'id,name',include:'roles'}],
    ['newsletters_read',{slug:'café space',fields:'id,name',include:'count.members'}],
    ['users_edit',{id:'me',email:'name+tag%box@example.invalid',bio:null,include:'roles'}],
    ['newsletters_edit',{id:'one',sender_email:null,show_badge:false,include:'count.members'}],
    ['invites_browse',{limit:'all',fields:'id,email'}],
    ['webhooks_edit',{id:'one',name:null,secret:null}],
  ]){
    const result=await m.mcpClient.callTool({name,arguments:args});assert.notEqual(result.isError,true);
    assert.deepEqual(JSON.parse(result.content[0].text),{data:name.endsWith('_browse')?[{id:'one'}]:{id:'one'},meta:{retained:true}});
  }
  assert.deepEqual(f.requests.map(r=>r.url),[
    '/blog/ghost/api/admin/members/email/name%2Btag%25box%40example.invalid/?include=tiers',
    '/blog/ghost/api/admin/users/email/name%2Btag%25box%40example.invalid/?fields=id%2Cname&include=roles',
    '/blog/ghost/api/admin/newsletters/slug/caf%C3%A9%20space/?fields=id%2Cname&include=count.members',
    '/blog/ghost/api/admin/users/me/?include=roles',
    '/blog/ghost/api/admin/newsletters/one/?include=count.members',
    '/blog/ghost/api/admin/invites/?limit=all&fields=id,email',
    '/blog/ghost/api/admin/webhooks/one/',
  ]);
  assert.deepEqual(JSON.parse(f.requests[3].body),{users:[{email:'name+tag%box@example.invalid',bio:null}]});
  assert.deepEqual(JSON.parse(f.requests[4].body),{newsletters:[{sender_email:null,show_badge:false}]});
  assert.deepEqual(JSON.parse(f.requests[6].body),{webhooks:[{name:null,secret:null}]});
  assert.deepEqual(f.requests.map(r=>r.method),['GET','GET','GET','PUT','PUT','GET','PUT']);
  for(const r of f.requests){assert.equal(r.headers['accept-version'],'v5.0');assert.match(r.headers.authorization,/^Ghost /)}
  await assert.rejects(m.mcpClient.callTool({name:'members_read',arguments:{id:'one',fields:'id'}}),/Invalid arguments/);
  await assert.rejects(m.mcpClient.callTool({name:'tiers_read',arguments:{id:'one',include:'benefits'}}),/Invalid arguments/);
  assert.equal(f.requests.length,7);
});

test('strict content MCP uses one encoded selector and forwards revision options apart from nullable bodies over HTTP', async t => {
  const f = await fixture(t, (req,res) => {
    const resource=req.url.split('/')[5];
    res.setHeader('Content-Type','application/json').end(JSON.stringify({[resource]:[{id:'one'}],meta:{retained:true}}));
  });
  const m=await require('./helpers/mcpHarness.cjs').openMcpHarness(client(f.url+'/blog'));
  t.after(m.close);
  for(const [name,args]of [
    ['posts_read',{slug:'café space',formats:'html,plaintext'}],
    ['pages_read',{id:'über uns',include:'tags'}],
    ['posts_edit',{id:'café space',updated_at:'2026-10-21T01:00:00+01:00',custom_template:null,save_revision:false,formats:'lexical'}],
    ['pages_edit',{id:'one',updated_at:'2026-10-21T00:00:00Z',feature_image:null,save_revision:true}],
    ['tags_read',{slug:'café space',include:'count.posts',fields:'id,name',filter:'visibility:internal'}],
    ['pages_copy',{id:'one',formats:'plaintext,mobiledoc'}],
  ]) {
    const response=await m.mcpClient.callTool({name,arguments:args});
    assert.notEqual(response.isError,true);
    assert.deepEqual(JSON.parse(response.content[0].text),{data:{id:'one'},meta:{retained:true}});
  }
  assert.deepEqual(f.requests.map(r=>r.url),[
    '/blog/ghost/api/admin/posts/slug/caf%C3%A9%20space/?formats=html%2Cplaintext',
    '/blog/ghost/api/admin/pages/%C3%BCber%20uns/?include=tags',
    '/blog/ghost/api/admin/posts/caf%C3%A9%20space/?formats=lexical&save_revision=false',
    '/blog/ghost/api/admin/pages/one/?save_revision=true',
    '/blog/ghost/api/admin/tags/slug/caf%C3%A9%20space/?fields=id%2Cname&filter=visibility%3Ainternal&include=count.posts',
    '/blog/ghost/api/admin/pages/one/copy/?formats=plaintext,mobiledoc',
  ]);
  assert.deepEqual(JSON.parse(f.requests[2].body),{posts:[{updated_at:'2026-10-21T01:00:00+01:00',custom_template:null}]});
  assert.deepEqual(JSON.parse(f.requests[3].body),{pages:[{updated_at:'2026-10-21T00:00:00Z',feature_image:null}]});
  assert.equal(f.requests[5].body,'');
  assert.deepEqual(f.requests.map(r=>r.method),['GET','GET','PUT','PUT','GET','POST']);
  for(const r of f.requests) {
    assert.match(r.headers.authorization,/^Ghost /);
    assert.equal(r.headers['accept-version'],'v5.0');
  }
  await assert.rejects(m.mcpClient.callTool({name:'posts_edit',arguments:{id:'one',updated_at:'2026-10-21T00:00:00Z',save_revison:true}}),/Invalid arguments/);
  const ambiguous=await m.mcpClient.callTool({name:'tags_read',arguments:{id:'one',slug:'two'}});
  assert.equal(ambiguous.isError,true);
  assert.equal(f.requests.length,6);
});

test('SDK and native metadata survive decoded HTTP bodies through actual MCP calls', async t => {
  const f = await fixture(t, (req, res) => {
    const resource = req.url.split('/')[5];
    const meta = resource === 'members' ? {pagination:{page:2,pages:2,limit:1,total:2,prev:1,next:null}}
      : resource === 'newsletters' ? {sent_email_verification:['sender_email']} : {retained:{nested:null}};
    res.setHeader('Content-Type','application/json').end(JSON.stringify({[resource]:[{id:'one',...(resource === 'newsletters' ? {sender_email:null} : {})}],meta}));
  });
  const m = await require('./helpers/mcpHarness.cjs').openMcpHarness(client(f.url + '/blog'));
  t.after(m.close);
  for (const [name, args, expected] of [
    ['members_browse',{page:2,limit:1},{data:[{id:'one'}],meta:{pagination:{page:2,pages:2,limit:1,total:2,prev:1,next:null}}}],
    ['newsletters_edit',{id:'one',sender_email:'new@example.invalid'},{data:{id:'one',sender_email:null},meta:{sent_email_verification:['sender_email']}}],
    ['tiers_edit',{id:'one',active:false},{data:{id:'one'},meta:{retained:{nested:null}}}],
    ['pages_copy',{id:'one'},{data:{id:'one'},meta:{retained:{nested:null}}}],
  ]) {
    const response = await m.mcpClient.callTool({name,arguments:args});
    assert.notEqual(response.isError,true);
    assert.deepEqual(JSON.parse(response.content[0].text),expected);
  }
  assert.equal(f.requests.length,4);
  assert.equal(f.requests[0].url,'/blog/ghost/api/admin/members/?page=2&limit=1');
  assert.equal(f.requests[1].url,'/blog/ghost/api/admin/newsletters/one/');
  assert.deepEqual(JSON.parse(f.requests[1].body),{newsletters:[{sender_email:'new@example.invalid'}]});
  assert.equal(f.requests[2].url,'/blog/ghost/api/admin/tiers/one/');
  assert.equal(f.requests[2].body,'{"tiers":[{"active":false}]}');
  assert.equal(f.requests[3].url,'/blog/ghost/api/admin/pages/one/copy/');
  assert.equal(f.requests[3].body,'');
  for (const request of f.requests) {
    assert.match(request.headers.authorization,/^Ghost /);
    assert.equal(request.headers['accept-version'],'v5.0');
  }
});

test('explicit SDK executor preserves pinned default HTTP encoding body headers and redirect policy', async t => {
  const f = await fixture(t, (_req,res) => res.setHeader('Content-Type','application/json').end('{"posts":[{"id":"one"}],"meta":{"example":true}}'));
  const original = require('@tryghost/admin-api')({...config,url:f.url});
  const migrated = client(f.url);
  for (const c of [original,migrated]) {
    await c.posts.browse({fields:'id,title',filter:'name:A B'});
    await c.posts.edit({id:'one',title:'Changed',updated_at:'2026-10-20T00:00:00.000Z'});
  }
  assert.equal(f.requests[0].url,'/ghost/api/admin/posts/?fields=id%2Ctitle&filter=name%3AA%20B');
  for (const [a,b] of [[f.requests[0],f.requests[2]],[f.requests[1],f.requests[3]]]) {
    assert.equal(a.url,b.url);
    assert.equal(a.method,b.method);
    assert.equal(a.body,b.body);
    const withoutToken = ({authorization,...headers}) => headers;
    assert.deepEqual(withoutToken(a.headers),withoutToken(b.headers));
    assert.match(b.headers.authorization,/^Ghost /);
  }
  assert.deepEqual(JSON.parse(f.requests[3].body),{posts:[{title:'Changed',updated_at:'2026-10-20T00:00:00.000Z'}]});

  // SDK policy is characterized, not hardened in this metadata-only change.
  const target = await fixture(t, (_req,res) => res.setHeader('Content-Type','application/json').end('{"posts":[{"id":"redirected"}]}'));
  const source = await fixture(t, (_req,res) => res.writeHead(302,{Location:target.url+'/ghost/api/admin/posts/'}).end());
  await require('@tryghost/admin-api')({...config,url:source.url}).posts.browse({});
  assert.deepEqual(await client(source.url).posts.browse({}),{data:[{id:'redirected'}]});
  assert.equal(source.requests.length,2);
  assert.equal(target.requests.length,2);
  for (const pair of [[source.requests[0],source.requests[1]],[target.requests[0],target.requests[1]]]) {
    assert.equal(pair[0].url,pair[1].url);
    assert.equal(pair[0].headers['user-agent'],pair[1].headers['user-agent']);
    assert.equal(pair[0].headers['accept-version'],pair[1].headers['accept-version']);
    assert.equal(Boolean(pair[0].headers.authorization),Boolean(pair[1].headers.authorization));
  }
});

test('SDK HTTP failure retains SDK error conversion and never repeats a failed mutation', async t => {
  const f = await fixture(t, (_req,res) => res.writeHead(403,{'Content-Type':'application/json'}).end('{"errors":[{"type":"NoPermissionError","message":"Permission denied"}]}'));
  await assert.rejects(client(f.url).posts.add({title:'Example'}),e => {
    assert.equal(e.message,'Permission denied');
    assert.equal(e.name,'NoPermissionError');
    assert.equal(e.request,undefined);
    assert.equal(e.config,undefined);
    assert.equal(e.response,undefined);
    return true;
  });
  assert.equal(f.requests.length,1);
});

test('shared native core serializes JSON PUT and bodyless DELETE over actual HTTP', async t => {
  const f = await fixture(t, (req, res) => req.method === 'DELETE' ? res.writeHead(204).end() : res.setHeader('Content-Type', 'application/json').end('{"tiers":[{"id":"one"}]}'));
  const send = require('../build/client/nativeAdmin.js').createNativeAdminRequest({...config, url: f.url});
  assert.deepEqual(await send('tiers.edit', {id: 'one', body: {tiers: [{active: false}]}}), {tiers: [{id: 'one'}]});
  await send('invites.delete', {id: 'one'});
  assert.equal(f.requests[0].body, '{"tiers":[{"active":false}]}');
  assert.equal(f.requests[0].headers['content-type'], 'application/json');
  assert.equal(f.requests[1].body, '');
  assert.equal(f.requests[1].method, 'DELETE');
});

test('commerce HTTP serializes nested tier, confines Unicode edit IDs and never retries mutation failures', async t => {
  const f = await fixture(t, (req, res) => {
    if (req.method === 'POST') res.setHeader('Content-Type', 'application/json').end('{"offers":[{"id":"sale"}]}');
    else res.writeHead(409, {'Content-Type': 'application/json'}).end(JSON.stringify({errors: [{type: 'ConflictError', message: config.key}]}));
  });
  const c = client(f.url + '/blog');
  assert.deepEqual(await c.offers.add({name: 'Sale', code: 'sale', cadence: 'month', duration: 'once', amount: 10, tier_id: 'tier1', type: 'percent'}), {data: {id: 'sale'}});
  assert.deepEqual(JSON.parse(f.requests[0].body).offers[0].tier, {id: 'tier1'});
  assert.equal(JSON.parse(f.requests[0].body).offers[0].tier_id, undefined);
  await assert.rejects(c.tiers.edit({id: 'café space', active: false}), {message: 'Ghost tiers edit failed (HTTP 409).'});
  assert.equal(f.requests[1].url, '/blog/ghost/api/admin/tiers/caf%C3%A9%20space/');
  assert.equal(f.requests[1].body, '{"tiers":[{"active":false}]}');
  assert.equal(f.requests.length, 2);
  await assert.rejects(c.tiers.edit({id: '../posts/x', active: false}), /Invalid Ghost/);
  assert.equal(f.requests.length, 2);
});

test('staff HTTP sends only native invite JSON, deletes without body and forwards assignable-role query', async t => {
  const f = await fixture(t, (req, res) => {
    if (req.method === 'DELETE') res.writeHead(204).end();
    else res.setHeader('Content-Type', 'application/json').end(req.url.startsWith('/ghost/api/admin/roles/') ? '{"roles":[{"id":"role1"}]}' : '{"invites":[{"id":"invite1"}]}');
  });
  const c = client(f.url);
  assert.deepEqual(await c.invites.add({role_id: 'role1', email: 'staff@example.invalid'}), {data: {id: 'invite1'}});
  assert.equal(await c.invites.delete({id: 'invite1'}), undefined);
  assert.deepEqual(await c.roles.browse({permissions: 'assign'}), {data: [{id: 'role1'}]});
  assert.deepEqual(JSON.parse(f.requests[0].body), {invites: [{role_id: 'role1', email: 'staff@example.invalid'}]});
  assert.equal(f.requests[0].headers['content-type'], 'application/json');
  assert.equal(f.requests[1].url, '/ghost/api/admin/invites/invite1/');
  assert.equal(f.requests[1].body, '');
  assert.equal(f.requests[1].method, 'DELETE');
  assert.equal(f.requests[2].url, '/ghost/api/admin/roles/?permissions=assign');
  assert.equal(f.requests.length, 3);
});

test('staff HTTP permission failures discard echoed credentials and explain staff permissions', async t => {
  const f = await fixture(t, (_req, res) => res.writeHead(403, {'Content-Type': 'application/json'}).end(JSON.stringify({errors: [{type: 'NoPermissionError', message: config.key}]})));
  await assert.rejects(client(f.url).invites.add({role_id: 'role1', email: 'staff@example.invalid'}), e => {
    assert.match(e.message, /staff access token with sufficient permissions/);
    assert.equal(e.stack.includes(config.key), false);
    assert.equal(e.config, undefined);
    assert.equal(e.response, undefined);
    return true;
  });
  assert.equal(f.requests.length, 1);
});

test('staff HTTP refuses redirects and does not repeat a timed-out invitation', async t => {
  const target = await fixture(t, (_req, res) => res.end('{}'));
  const source = await fixture(t, (_req, res) => res.writeHead(307, {Location: target.url}).end());
  await assert.rejects(client(source.url).invites.add({role_id: 'role1', email: 'staff@example.invalid'}), /HTTP 307/);
  assert.equal(source.requests.length, 1);
  assert.equal(target.requests.length, 0);
  const slow = await fixture(t, () => {});
  const executor = require('../build/client/nativeRequest.js').createNativeRequestExecutor({timeoutMs: 50});
  await assert.rejects(client(slow.url, executor).invites.add({role_id: 'role1', email: 'staff@example.invalid'}), /request failed/);
  assert.equal(slow.requests.length, 1);
});

test('default HTTP copy sends authenticated POST with no body and preserves query/subdirectory', {timeout: 10000}, async t => {
  const f = await fixture(t, (_req, res) => res.setHeader('Content-Type', 'application/json').end(JSON.stringify({pages: [{id: 'copy1'}]})));
  assert.deepEqual(await client(f.url + '/blog').pages.copy({id: 'abc123', formats: 'html,lexical'}), {data: {id: 'copy1'}});
  assert.equal(f.requests.length, 1);
  const request = f.requests[0];
  assert.equal(request.method, 'POST');
  const parsed = new URL(request.url, f.url);
  assert.equal(parsed.pathname, '/blog/ghost/api/admin/pages/abc123/copy/');
  assert.equal(parsed.searchParams.get('formats'), 'html,lexical');
  assert.equal(request.body, '');
  assert.equal(request.headers['accept-version'], 'v5.0');
  assert.match(request.headers.authorization, /^Ghost /);
});

for (const status of [302, 307]) {
  test(`copy refuses HTTP ${status} redirects without forwarding authentication`, {timeout: 10000}, async t => {
    const target = await fixture(t, (_req, res) => res.end('{}'));
    const source = await fixture(t, (_req, res) => res.writeHead(status, {Location: target.url}).end());
    await assert.rejects(client(source.url).posts.copy({id: 'abc123'}), {message: `Ghost posts copy failed (HTTP ${status}).`});
    assert.equal(source.requests.length, 1);
    assert.equal(target.requests.length, 0);
  });
}
for (const [status, body] of [[403, JSON.stringify({errors: [{type: 'NoPermissionError', message: config.key}]})], [200, '<html>not JSON</html>'], [201, '{malformed'], [201, JSON.stringify({posts: []})]]) {
  test(`default transport safely rejects status/body ${status} ${body.slice(0, 12)}`, {timeout: 10000}, async t => {
    const f = await fixture(t, (_req, res) => res.writeHead(status, {'Content-Type': 'application/json'}).end(body));
    await assert.rejects(client(f.url).posts.copy({id: 'abc123'}), error => {
      assert.ok(!error.message.includes(config.key));
      assert.equal(error.response, undefined);
      assert.equal(error.config, undefined);
      return true;
    });
    assert.equal(f.requests.length, 1);
  });
}
test('default transport socket failure does not retry or expose diagnostics', {timeout: 10000}, async t => {
  const f = await fixture(t, (req) => req.socket.destroy());
  await assert.rejects(client(f.url).posts.copy({id: 'abc123'}), {message: 'Ghost posts copy request failed.'});
  assert.equal(f.requests.length, 1);
});
test('native timeout fails a possibly accepted mutation exactly once', {timeout: 10000}, async t => {
  const f = await fixture(t, () => {});
  const {createNativeRequestExecutor, NATIVE_REQUEST_TIMEOUT_MS} = require('../build/client/nativeRequest.js');
  assert.equal(NATIVE_REQUEST_TIMEOUT_MS, 30000);
  const start = Date.now();
  await assert.rejects(client(f.url, createNativeRequestExecutor({timeoutMs: 50})).pages.copy({id: 'abc123'}), {message: 'Ghost pages copy request failed.'});
  assert.ok(Date.now() - start < 3000);
  assert.equal(f.requests.length, 1);
  for (const timeoutMs of [0, -1, NaN, Infinity]) assert.throws(() => createNativeRequestExecutor({timeoutMs}), /Invalid native request timeout/);
});
test('loopback guard refuses nonfixture destinations before HTTP', () => {
  assert.throws(() => http.request('http://example.invalid/'), /Unexpected destination/);
  assert.throws(() => http.get('http://127.0.0.1:1/'), /Unexpected destination/);
  assert.throws(() => fetch('http://example.invalid/'), /Unexpected fetch/);
});

test('SDK-backed page tools confine actual HTTP routes and reject traversal before transport', {timeout: 10000}, async t => {
  const f = await fixture(t, (req, res) => {
    if (req.method === 'DELETE') res.writeHead(204).end();
    else res.setHeader('Content-Type', 'application/json').end(JSON.stringify({pages: [{id: 'abc123'}]}));
  });
  const {openMcpHarness} = require('./helpers/mcpHarness.cjs');
  const mcp = await openMcpHarness(client(f.url));
  t.after(mcp.close);
  for (const [name, args] of [
    ['pages_delete', {id: '../posts/victim'}], ['pages_edit', {id: '../posts/victim', updated_at: '2026-10-20T00:00:00.000Z'}],
    ['pages_read', {slug: '%2e%2e/posts/victim'}],
  ]) await assert.rejects(mcp.mcpClient.callTool({name, arguments: args}), /Invalid arguments/);
  assert.equal(f.requests.length, 0);
  await mcp.mcpClient.callTool({name: 'pages_read', arguments: {slug: 'über uns'}});
  await mcp.mcpClient.callTool({name: 'pages_delete', arguments: {id: 'abc123'}});
  assert.equal(f.requests.length, 2);
  assert.equal(f.requests[0].url, '/ghost/api/admin/pages/slug/%C3%BCber%20uns/');
  assert.equal(f.requests[1].url, '/ghost/api/admin/pages/abc123/');
  assert.equal(f.requests[1].method, 'DELETE');
});
