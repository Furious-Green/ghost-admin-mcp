const assert=require('node:assert/strict');

// Never catch/recast protocol exceptions: callers must get a resolved tool result.
exports.assertToolError=async function assertToolError(promise,matcher,message){
  const result=await promise;
  assert.equal(result.isError,true,message);
  assert.equal(result.content.length,1,message);
  assert.equal(result.content[0].type,'text',message);
  const text=result.content[0].text;
  assert.equal(typeof text,'string',message);
  if(matcher instanceof RegExp)assert.match(text,matcher,message);
  else if(typeof matcher==='function')assert.ok(matcher({message:text}),message);
  return result;
};
