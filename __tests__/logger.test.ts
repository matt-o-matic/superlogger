import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

type MutableGlobal = Record<string, unknown>;

type CallRecord = unknown[];

type ConsoleCapture = {
  restore: () => void;
  calls: CallRecord[];
};

const captureConsole = (method: 'debug' | 'error' | 'warn'): ConsoleCapture => {
  const original = console[method];
  const calls: CallRecord[] = [];
  console[method] = (...args: CallRecord) => {
    calls.push(args);
  };

  return {
    restore: () => {
      console[method] = original;
    },
    get calls() {
      return calls;
    }
  };
};

const setQueryString = (search: string): void => {
  const normalized = search ? (search.startsWith('?') ? search : `?${search}`) : '';
  (globalThis as MutableGlobal).__SUPERLOGGER_QUERY__ = normalized;
};

const resetGlobals = (): void => {
  const globalRecord = globalThis as MutableGlobal;
  delete globalRecord.__superlogger_config__;
  delete globalRecord.__superlogger_instance__;
  delete globalRecord.__SUPERLOGGER_ENABLE__;
  delete globalRecord.__SUPERLOGGER_QUERY__;
  delete globalRecord.log;
  setQueryString('');
};

beforeEach(() => {
  jest.resetModules();
  resetGlobals();
});

afterEach(() => {
  resetGlobals();
});

describe('superlogger', () => {
  it('emits error logs but skips debug by default', async () => {
    const errorCapture = captureConsole('error');
    const debugCapture = captureConsole('debug');

    await jest.isolateModulesAsync(async () => {
      const mod = await import('../src/index');
      const log = mod.default;
      log.debug('auth:session', 'debug message');
      log.error('auth:session', 'error message');
    });

    errorCapture.restore();
    debugCapture.restore();

    expect(debugCapture.calls).toHaveLength(0);
    expect(errorCapture.calls).toHaveLength(1);
  });

  it('applies query string overrides when enabled globally', async () => {
    const debugCapture = captureConsole('debug');

    await jest.isolateModulesAsync(async () => {
      (globalThis as MutableGlobal).__SUPERLOGGER_ENABLE__ = true;
      setQueryString('?loglevel={"checkout:payment":["debug"]}');
      const mod = await import('../src/index');
      const log = mod.default;
      log.debug('checkout:payment', 'debug enabled');
    });

    debugCapture.restore();
    expect(debugCapture.calls).toHaveLength(1);
  });

  it('tracks context counts even when output is suppressed', async () => {
    const warnCapture = captureConsole('warn');

    await jest.isolateModulesAsync(async () => {
      const mod = await import('../src/index');
      const log = mod.default;
      const { logger } = mod;
      log.warn('auth:user', 'warn suppressed');
      const stats = logger.listContext();
      expect(stats['auth:user'].warn).toBe(1);
    });

    warnCapture.restore();
  });

  it('resets to default configuration and removes custom patterns', async () => {
    await jest.isolateModulesAsync(async () => {
      const mod = await import('../src/index');
      const { logger } = mod;
      const config = logger.getConfig();
      config['custom:*'] = ['debug'];
      (globalThis as MutableGlobal).__superlogger_config__ = config;
      logger.resetConfig();
      const refreshed = logger.getConfig();
      expect(refreshed['custom:*']).toBeUndefined();
    });
  });
});
