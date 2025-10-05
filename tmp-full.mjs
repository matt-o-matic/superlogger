import assert from 'node:assert/strict';
const MutableGlobal = globalThis;

const resetGlobals = () => {
  delete MutableGlobal.__superlogger_config__;
  delete MutableGlobal.__superlogger_instance__;
  delete MutableGlobal.__SUPERLOGGER_ENABLE__;
  delete MutableGlobal.__SUPERLOGGER_QUERY__;
  delete MutableGlobal.log;
};

const isolate = async (fn) => {
  resetGlobals();
  const modulePath = './dist/index.js';
  // delete from import cache
  const absolute = new URL(modulePath, import.meta.url).href;
  const cache = await import('node:module');
  // can't easily clear ESM cache; use dynamic import with query
  await fn(async () => {
    resetGlobals();
    const mod = await import(`${modulePath}?${Math.random()}`);
    return mod;
  });
};

await isolate(async (load) => {
  const errorCalls = [];
  const debugCalls = [];
  const originalError = console.error;
  const originalDebug = console.debug;
  console.error = (...args) => { errorCalls.push(args); };
  console.debug = (...args) => { debugCalls.push(args); };
  const mod = await load();
  const log = mod.default;
  log.debug('auth:session', 'debug message');
  log.error('auth:session', 'error message');
  console.error = originalError;
  console.debug = originalDebug;
  assert.equal(debugCalls.length, 0);
  assert.equal(errorCalls.length, 1);
});

await isolate(async (load) => {
  const debugCalls = [];
  const originalDebug = console.debug;
  globalThis.__SUPERLOGGER_ENABLE__ = true;
  globalThis.__SUPERLOGGER_QUERY__ = '?loglevel={"checkout:payment":["debug"]}';
  console.debug = (...args) => { debugCalls.push(args); };
  const mod = await load();
  const log = mod.default;
  log.debug('checkout:payment', 'debug enabled');
  console.debug = originalDebug;
  assert.equal(debugCalls.length, 1);
});

await isolate(async (load) => {
  const mod = await load();
  const log = mod.default;
  const { logger } = mod;
  log.warn('auth:user', 'warn suppressed');
  const stats = logger.listContext();
  assert.equal(stats['auth:user'].warn, 1);
});

await isolate(async (load) => {
  const mod = await load();
  const { logger } = mod;
  const config = logger.getConfig();
  config['custom:*'] = ['debug'];
  globalThis.__superlogger_config__ = config;
  logger.resetConfig();
  const refreshed = logger.getConfig();
  assert.ok(!('custom:*' in refreshed));
});

console.log('all good');
