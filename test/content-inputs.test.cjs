const {test} = require('node:test');
const assert = require('node:assert/strict');
const {timestamp} = require('./helpers/fixtures.cjs');
const prepare = (...args) => require('../build/client/contentRequest.js').prepareContentRequest(...args);

test('content preparation rejects unknown and wrong-operation inputs', () => {
  for (const resource of ['posts','pages','tags']) {
    for (const [op,input,query] of [
      ['browse',{typo:1}], ['read',{}], ['read',{id:'one',slug:'one'}],
      ['read',{id:''}], ['read',{slug:' '}], ['delete',{id:'one',include:'tags'}],
      ['add',resource==='tags'?{name:'A',save_revision:true}:{title:'A',save_revision:true}],
      ['edit',{id:'one',updated_at:timestamp,fields:'id'}],
      ['browse',{}, {typo:true}], ['read',{id:'one'},{page:1}],
    ]) assert.throws(() => prepare(resource,op,input,query), `${resource}.${op}: ${JSON.stringify(input)}`);
  }
  for (const input of [{tags:[{}]}, {tags:[{id:'tag',unknown:1}]}, {authors:[{}]}, {authors:[{email:'a@b.invalid',bio:'x'}]}, {tiers:[{id:'tier',extra:1}]}]) {
    assert.throws(() => prepare('posts','add',{title:'A',...input}));
  }
  assert.throws(() => prepare('tags','browse',{formats:'html'}));
  assert.throws(() => prepare('pages','add',{title:'A',email_only:true}));
  assert.throws(() => prepare('tags','add',{name:'A'},{source:'html'}));
  for (const input of [{tags:['a'.repeat(192)]}, {authors:[{id:'a'.repeat(25)}]}, {tiers:[{name:'a'.repeat(192)}]}]) assert.throws(() => prepare('posts','add',{title:'A',...input}));
});

test('content preparation preserves null false replacement arrays and caller ownership', () => {
  const input = {id:'one',updated_at:timestamp,custom_template:null,tags:[],authors:[],tiers:[],save_revision:false,formats:'html,plaintext'};
  const original = structuredClone(input);
  assert.deepEqual(prepare('posts','edit',input), {input:{id:'one',updated_at:timestamp,custom_template:null,tags:[],authors:[],tiers:[]},query:{save_revision:false,formats:'html,plaintext'}});
  assert.deepEqual(input,original);
  assert.throws(() => prepare('posts','edit',input,{save_revision:false}));
  const query = {include:'tags',save_revision:false};
  assert.deepEqual(prepare('pages','edit',{id:'one',updated_at:timestamp,published_at:null},query),{input:{id:'one',updated_at:timestamp,published_at:null},query:{include:'tags',save_revision:false}});
  assert.deepEqual(query,{include:'tags',save_revision:false});
  assert.deepEqual(prepare('tags','edit',{id:'one',slug:null,feature_image:null,meta_title:null,accent_color:null}),{input:{id:'one',slug:null,feature_image:null,meta_title:null,accent_color:null},query:{}});
  for (const [field,value] of Object.entries({title:null,visibility:null,status:null,featured:null,email_only:null,tags:null,authors:null,tiers:null,updated_at:null})) {
    assert.throws(() => prepare('posts','edit',{id:'one',updated_at:timestamp,[field]:value}),field);
  }
});

test('content paging and token lists are explicit and resource-specific', () => {
  for (const resource of ['posts','pages','tags']) {
    for (const key of ['page','limit']) for (const value of [0,-1,1.5,'1',Number.MAX_SAFE_INTEGER+1,null]) assert.throws(() => prepare(resource,'browse',{[key]:value}));
    assert.deepEqual(prepare(resource,'browse',{limit:'all',page:2}),{input:{limit:'all',page:2},query:{}});
    for (const value of ['', ' ', 'id,,title', 'id, ']) assert.throws(() => prepare(resource,'browse',{fields:value}));
  }
  for (const formats of ['html','lexical,plaintext','mobiledoc,html,lexical,plaintext']) assert.deepEqual(prepare('posts','read',{id:'one',formats}),{input:{id:'one'},query:{formats}});
  for (const formats of ['', ' ', 'html,', 'html,unknown','HTML']) assert.throws(() => prepare('pages','browse',{formats}));
  assert.deepEqual(prepare('tags','read',{slug:'tag',include:'count.posts',fields:'id,name',filter:'visibility:internal'}),{input:{slug:'tag'},query:{include:'count.posts',fields:'id,name',filter:'visibility:internal'}});
  for (const [resource,include] of [['tags','authors'],['pages','email'],['posts','unknown']]) assert.throws(() => prepare(resource,'browse',{include}));
});

test('content enums timestamps and JSON sources are validated without rewriting values', () => {
  assert.deepEqual(prepare('posts','add',{title:'A',status:'sent',visibility:'tiers'}),{input:{title:'A',status:'sent',visibility:'tiers'},query:{}});
  for (const input of [{status:'bogus'},{visibility:'status:-free'},{lexical:'bad json'},{mobiledoc:'bad json'}]) assert.throws(() => prepare('posts','add',{title:'A',...input}));
  assert.throws(() => prepare('pages','add',{title:'A',status:'sent'}));
  assert.throws(() => prepare('tags','add',{name:'A',visibility:'members'}));
  for (const updated_at of ['', 'yesterday','2026-02-30T00:00:00Z']) assert.throws(() => prepare('posts','edit',{id:'one',updated_at}));
  const offset = '2026-10-21T01:00:00+01:00';
  assert.deepEqual(prepare('posts','edit',{id:'one',updated_at:offset}),{input:{id:'one',updated_at:offset},query:{}});
  assert.throws(() => prepare('posts','add',{title:'A',lexical:'{}',mobiledoc:'{}'}));
  assert.deepEqual(prepare('posts','add',{title:'A',html:'<p>A</p>',lexical:'{}',mobiledoc:'{}'}),{input:{title:'A',html:'<p>A</p>',lexical:'{}',mobiledoc:'{}'},query:{source:'html'}});
  assert.deepEqual(prepare('pages','add',{title:'A',mobiledoc:'{}'}),{input:{title:'A',mobiledoc:'{}'},query:{}});
  assert.throws(() => prepare('tags','add',{name:'A'.repeat(192)}));
  assert.throws(() => prepare('posts','add',{title:'A',feature_image_alt:'A'.repeat(192)}));
});

test('SDK selectors are safe single segments and never encode content slugs', () => {
  for (const resource of ['posts','pages','tags']) {
    assert.deepEqual(prepare(resource,'read',{slug:'café space'}),{input:{slug:'caf%C3%A9%20space'},query:{}});
    assert.deepEqual(prepare(resource,'delete',{id:'some id'}),{input:{id:'some%20id'},query:{}});
    for (const value of ['..','.','../victim','a/b','a\\b','a?x=y','a#fragment','%2e%2e','x\n','x\x7f','\ud800']) assert.throws(() => prepare(resource,'read',{id:value}));
  }
  assert.deepEqual(prepare('posts','edit',{id:'one',updated_at:timestamp,slug:'café space',tags:[{id:'tag',slug:'tag-slug',name:'Tag'}],authors:[{id:'author',email:'author@example.invalid'}]}),{input:{id:'one',updated_at:timestamp,slug:'café space',tags:[{id:'tag',slug:'tag-slug',name:'Tag'}],authors:[{id:'author',email:'author@example.invalid'}]},query:{}});
});
