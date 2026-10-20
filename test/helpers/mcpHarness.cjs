const {Client} = require('@modelcontextprotocol/sdk/client/index.js');
const {InMemoryTransport} = require('@modelcontextprotocol/sdk/inMemory.js');
const {createServer} = require('../../build/createServer.js');

exports.openMcpHarness = async function openMcpHarness(client) {
  const server = createServer(client);
  const mcpClient = new Client({name: 'offline-contract-test', version: '1.0.0'});
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  let closed = false;
  const close = async () => {
    if (closed) return;
    closed = true;
    await Promise.allSettled([mcpClient.close(), server.close(), clientTransport.close(), serverTransport.close()]);
  };
  try {
    await server.connect(serverTransport);
    await mcpClient.connect(clientTransport);
    return {mcpClient, server, close};
  } catch (error) {
    await close();
    throw error;
  }
};
