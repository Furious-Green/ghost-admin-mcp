const http = require('node:http');
const https = require('node:https');

exports.allowLoopback = function allowLoopback(ports) {
  const originals = [];
  for (const target of [http, https]) {
    for (const name of ['request', 'get']) {
      const original = target[name];
      originals.push([target, name, original]);
      target[name] = function(...args) {
        const first = args[0];
        let options;
        if (typeof first === 'string' || first instanceof URL) {
          const url = new URL(first);
          options = {protocol: url.protocol, hostname: url.hostname, port: url.port, ...((args[1] && typeof args[1] === 'object') ? args[1] : {})};
        } else options = first;
        if (!options || options.protocol !== 'http:' || options.hostname !== '127.0.0.1' || !ports.has(Number(options.port)) || options.socketPath) {
          throw new Error('Unexpected destination in loopback-only test');
        }
        return Reflect.apply(original, this, args);
      };
    }
  }
  originals.push([globalThis, 'fetch', globalThis.fetch]);
  globalThis.fetch = () => { throw new Error('Unexpected fetch in loopback-only test'); };
  return () => { for (const [target, name, original] of originals) target[name] = original; };
};
