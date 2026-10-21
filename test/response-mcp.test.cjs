const {test, after} = require('node:test');
const assert = require('node:assert/strict');
after(require('./helpers/networkGuard.cjs').blockNetwork());
const {makeRecordingClient} = require('./helpers/recordingClient.cjs');
const {families, timestamp, toolNames, additionalToolNames} = require('./helpers/fixtures.cjs');
async function harness(t) {
  const r = makeRecordingClient();
  const m = await require('./helpers/mcpHarness.cjs').openMcpHarness(r.client);
  t.after(m.close);
  return {...r, ...m};
}

test('every data tool serializes one envelope while deletes keep their confirmation', async t => {
  const r = await harness(t);
  const tools = []; let cursor;
  do {const page = await r.mcpClient.listTools(cursor ? {cursor} : {}); tools.push(...page.tools); cursor = page.nextCursor;} while (cursor);
  assert.equal(tools.length, 52);
  assert.deepEqual(tools.map(t => t.name).sort(), [...toolNames, ...additionalToolNames].sort());
  assert.equal(r.requests.length, 0);
  for (const tool of tools) {
    assert.equal(tool.outputSchema, undefined);
    assert.equal(tool.inputSchema.properties.data, undefined);
    assert.equal(tool.inputSchema.properties.meta, undefined);
  }
  const all = {...families, pages: {browse: {}, read: {id: 'abc123'}, add: {title: 'Page'}, edit: {id: 'abc123', updated_at: timestamp}, delete: {id: 'abc123'}, copy: {id: 'abc123'}}, posts: {...families.posts, copy: {id: 'abc123'}}};
  const singular = {posts:'Post',pages:'Page',members:'Member',users:'User',tags:'Tag',newsletters:'Newsletter',webhooks:'Webhook',invites:'Invite',labels:'Label'};
  let dataCount = 0, deleteCount = 0;
  for (const [family, operations] of Object.entries(all)) for (const [op, args] of Object.entries(operations)) {
    const returned={id:'one',meta:{entity:true},data:'entity field',...(family==='images'?{url:'/returned.png'}:{})};
    r.enqueueResponse(op === 'delete' ? '' : {[family]: family === 'site' ? returned : [returned],meta:{example:{retained:true}}});
    const before = r.requests.length;
    const response = await r.mcpClient.callTool({name:`${family}_${op}`,arguments:structuredClone(args)});
    assert.notEqual(response.isError, true);
    assert.equal(response.structuredContent, undefined);
    assert.equal(r.requests.length, before + 1);
    if (op === 'delete') {
      deleteCount++;
      assert.deepEqual(response.content, [{type:'text',text:`${singular[family]} with id abc123 deleted.`}]);
    } else {
      dataCount++;
      assert.deepEqual(JSON.parse(response.content[0].text), {data: op === 'browse' ? [returned] : returned,meta:{example:{retained:true}}});
    }
  }
  assert.equal(dataCount, 44);
  assert.equal(deleteCount, 8);
  assert.equal(r.requests.length, 52);
});

test('MCP callers manually walk first middle final and empty pages without hidden requests', async t => {
  const r = await harness(t);
  const pages = [
    {items:[{id:'one'}],pagination:{page:1,pages:3,limit:1,total:3,prev:null,next:2}},
    {items:[{id:'two'}],pagination:{page:2,pages:3,limit:1,total:3,prev:1,next:3}},
    {items:[{id:'three'}],pagination:{page:3,pages:3,limit:1,total:3,prev:2,next:null}},
  ];
  for (const family of ['members','pages']) {
    let pageNumber = 1;
    for (const page of pages) {
      assert.equal(pageNumber, page.pagination.page);
      r.enqueueResponse({[family]:page.items,meta:{pagination:page.pagination}});
      const before = r.requests.length;
      const response = await r.mcpClient.callTool({name:`${family}_browse`,arguments:{page:pageNumber,limit:1}});
      const result = JSON.parse(response.content[0].text);
      assert.deepEqual(result, {data:page.items,meta:{pagination:page.pagination}});
      assert.equal(r.requests.length, before + 1);
      assert.deepEqual(r.requests.at(-1).params, {page:pageNumber,limit:1});
      pageNumber = result.meta.pagination.next;
    }
    assert.equal(pageNumber, null);
    r.enqueueResponse({[family]:[],meta:{pagination:{page:4,pages:3,limit:1,total:3,prev:3,next:null}}});
    const empty = await r.mcpClient.callTool({name:`${family}_browse`,arguments:{page:4,limit:1}});
    assert.deepEqual(JSON.parse(empty.content[0].text), {data:[],meta:{pagination:{page:4,pages:3,limit:1,total:3,prev:3,next:null}}});
  }
  for (const family of ['offers','roles']) {
    r.enqueueResponse({[family]:[{id:'one'}]});
    const response = await r.mcpClient.callTool({name:`${family}_browse`,arguments:{}});
    assert.deepEqual(JSON.parse(response.content[0].text), {data:[{id:'one'}]});
  }
  assert.equal(r.requests.length, 10);
});

test('MCP newsletter metadata describes returned state not requested state and malformed replies stay errors', async t => {
  const r = await harness(t);
  r.enqueueResponse({newsletters:[{id:'one',sender_email:null}],meta:{sent_email_verification:['sender_email']}});
  const pending = await r.mcpClient.callTool({name:'newsletters_edit',arguments:{id:'one',sender_email:'new@example.invalid'}});
  assert.deepEqual(JSON.parse(pending.content[0].text), {data:{id:'one',sender_email:null},meta:{sent_email_verification:['sender_email']}});
  assert.deepEqual(r.requests[0].data, {newsletters:[{sender_email:'new@example.invalid'}]});
  r.enqueueResponse({newsletters:[{id:'two'}],meta:{opted_in_member_count:7}});
  const created = await r.mcpClient.callTool({name:'newsletters_add',arguments:{name:'Second'}});
  assert.deepEqual(JSON.parse(created.content[0].text), {data:{id:'two'},meta:{opted_in_member_count:7}});
  assert.deepEqual(r.requests[1].params, {});
  r.enqueueResponse({newsletters:[{id:'one'}],meta:'SECRET'});
  const failed = await r.mcpClient.callTool({name:'newsletters_edit',arguments:{id:'one',name:'Changed'}});
  assert.equal(failed.isError, true);
  assert.equal(failed.content[0].text, 'Unexpected Ghost SDK response');
  assert.equal(JSON.stringify(failed).includes('SECRET'), false);
  assert.equal(r.requests.length, 3);
});
