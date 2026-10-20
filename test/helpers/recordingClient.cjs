const {config, entity, pagination} = require('./fixtures.cjs');

exports.makeRecordingClient = function makeRecordingClient() {
  const {createGhostClient} = require('../../build/client/sdkAdapter.js');
  const requests = [];
  const queue = [];
  const client = createGhostClient(config, {
    makeRequest: async request => {
      requests.push(structuredClone(request));
      if (queue.length) {
        const next = queue.shift();
        if (next.error) throw next.error;
        return structuredClone(next.response);
      }
      const resource = new URL(request.url).pathname.split('/')[4];
      return request.method === 'GET' && !new URL(request.url).pathname.slice(1).split('/')[4]
        ? {[resource]: [structuredClone(entity)], meta: {pagination: structuredClone(pagination)}}
        : {[resource]: [structuredClone(entity)]};
    },
  });
  return {client, requests, enqueueResponse: response => queue.push({response}), enqueueError: error => queue.push({error})};
};
