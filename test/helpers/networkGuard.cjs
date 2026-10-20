const http = require('node:http');
const https = require('node:https');

// Install before importing dependencies, so captured request functions also fail closed.
exports.blockNetwork = function blockNetwork() {
  const originals = [];
  for (const [target, names] of [[http, ['request', 'get']], [https, ['request', 'get']], [globalThis, ['fetch']]]) {
    for (const name of names) {
      originals.push([target, name, target[name]]);
      target[name] = () => { throw new Error('Unexpected network request in offline contract test'); };
    }
  }
  return () => { for (const [target, name, original] of originals) target[name] = original; };
};
