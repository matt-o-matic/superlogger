globalThis.__SUPERLOGGER_QUERY__ = '';
const { default: log, logger } = await import('./dist/index.js');
const debugSpy = [];
const errorSpy = [];
const originalDebug = console.debug;
const originalError = console.error;
console.debug = (...args) => { debugSpy.push(args); };
console.error = (...args) => { errorSpy.push(args); };
log.debug('auth:session', 'debug message');
log.error('auth:session', 'error message');
console.debug = originalDebug;
console.error = originalError;
if (debugSpy.length !== 0) {
  throw new Error('debug called');
}
if (errorSpy.length !== 1) {
  throw new Error(`error called ${errorSpy.length} times`);
}
console.log('ok');
