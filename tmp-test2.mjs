globalThis.__SUPERLOGGER_ENABLE__ = true;
globalThis.__SUPERLOGGER_QUERY__ = '?loglevel={"checkout:payment":["debug"]}';
const { default: log } = await import('./dist/index.js');
const debug = [];
console.debug = (...args) => debug.push(args);
log.debug('checkout:payment', 'debug message');
console.log('debug', debug.length);
