const LOG_LEVELS = ['debug', 'notify', 'warn', 'error', 'fatal'] as const;
type LogLevel = (typeof LOG_LEVELS)[number];

export type LogConfig = Record<string, string[]>;

export interface LoggerStats {
  readonly [scope: string]: Record<LogLevel, number>;
}

type LogMethod = (scopeOrMessage: unknown, ...args: unknown[]) => void;

export interface Logger extends Record<LogLevel, LogMethod> {
  getConfig: () => LogConfig;
  resetConfig: () => void;
  listContext: () => LoggerStats;
}

const DEFAULT_LOG_CONFIG: LogConfig = Object.freeze({
  global: ['error', 'fatal'],
  '*': ['error', 'fatal'],
});

type ConsoleMethodName = 'debug' | 'info' | 'warn' | 'error' | 'log';

const CONSOLE_METHODS: Record<LogLevel, ConsoleMethodName> = {
  debug: 'debug',
  notify: 'info',
  warn: 'warn',
  error: 'error',
  fatal: 'error',
};

const CONFIG_KEY = '__superlogger_config__';
const LOGGER_KEY = '__superlogger_instance__';

interface SuperLoggerGlobal extends Record<string, unknown> {
  [CONFIG_KEY]?: LogConfig;
  [LOGGER_KEY]?: Logger;
  __SUPERLOGGER_ENABLE__?: boolean;
  __SUPERLOGGER_QUERY__?: string;
  location?: Location;
}

const root: SuperLoggerGlobal | undefined = typeof globalThis !== 'undefined'
  ? (globalThis as SuperLoggerGlobal)
  : undefined;

const LOG_LEVEL_SET = new Set<LogLevel>(LOG_LEVELS);
const matcherCache = new Map<string, RegExp>();

const cloneConfig = (config: LogConfig): LogConfig => JSON.parse(JSON.stringify(config));
const cloneDefaultConfig = (): LogConfig => cloneConfig(DEFAULT_LOG_CONFIG);

const escapeForRegex = (value: string): string => value.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');

const readImportMetaEnv = (): Record<string, unknown> | undefined => {
  try {
    const meta = (0, eval)('import.meta') as { env?: Record<string, unknown> } | undefined;
    if (meta && typeof meta.env === 'object' && meta.env) {
      return meta.env as Record<string, unknown>;
    }
  } catch {
    // environments without native ESM support will hit this path
  }

  return undefined;
};

const getMatcherForPattern = (pattern: string): RegExp => {
  if (!matcherCache.has(pattern)) {
    const escaped = escapeForRegex(pattern).replace(/\\\*/g, '.*');
    matcherCache.set(pattern, new RegExp(`^${escaped}$`));
  }

  return matcherCache.get(pattern)!;
};

const isLogLevel = (value: string): value is LogLevel => LOG_LEVEL_SET.has(value as LogLevel);

const normalizeLevels = (levels: unknown): LogLevel[] => {
  if (!Array.isArray(levels)) {
    return [];
  }

  return levels.reduce<LogLevel[]>((acc, level) => {
    if (typeof level === 'string') {
      const normalized = level.toLowerCase();
      if (isLogLevel(normalized)) {
        acc.push(normalized);
      }
    }

    return acc;
  }, []);
};

const resolveLoggingFeatureFlag = (): boolean => {
  if (typeof root?.__SUPERLOGGER_ENABLE__ === 'boolean') {
    return root.__SUPERLOGGER_ENABLE__;
  }

  const importMetaEnv = readImportMetaEnv();

  const importMetaValue = (importMetaEnv?.VITE_ENABLE_LOGGING ?? importMetaEnv?.ENABLE_LOGGING);
  if (typeof importMetaValue === 'string') {
    return importMetaValue.toLowerCase() === 'true';
  }

  const processEnv = (() => {
    if (typeof globalThis === 'undefined') {
      return undefined;
    }

    const candidate = (globalThis as { process?: { env?: Record<string, unknown> } }).process;

    if (candidate && typeof candidate.env === 'object') {
      return candidate.env as Record<string, unknown>;
    }

    return undefined;
  })();

  const envValue = processEnv?.SUPERLOGGER_ENABLE_LOGGING
    ?? processEnv?.ENABLE_LOGGING
    ?? processEnv?.LOGGING_ENABLED;

  if (typeof envValue === 'string') {
    return envValue.toLowerCase() === 'true';
  }

  return false;
};

const loggingFeatureEnabled = resolveLoggingFeatureFlag();
let queryOverrideApplied = false;

const getSearchString = (): string => {
  if (!root) {
    return '';
  }

  const fromLocation = typeof root.location?.search === 'string' ? root.location.search : '';
  if (fromLocation) {
    return fromLocation;
  }

  const fromFallback = typeof root.__SUPERLOGGER_QUERY__ === 'string' ? root.__SUPERLOGGER_QUERY__ : '';
  if (fromFallback) {
    return fromFallback.startsWith('?') ? fromFallback : `?${fromFallback}`;
  }

  return '';
};

const scopeMatches = (pattern: string, scope: string | undefined): boolean => {
  if (!scope || typeof pattern !== 'string' || pattern === 'global') {
    return false;
  }

  if (pattern === '*') {
    return true;
  }

  return getMatcherForPattern(pattern).test(scope);
};

const applyQueryOverride = (config: LogConfig): LogConfig => {
  if (!loggingFeatureEnabled || queryOverrideApplied || !root) {
    return config;
  }

  queryOverrideApplied = true;

  try {
    const search = getSearchString();
    if (!search) {
      return config;
    }

    const params = new URLSearchParams(search);
    const overrideRaw = params.get('loglevel');
    if (!overrideRaw) {
      return config;
    }

    const parsed = JSON.parse(overrideRaw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      Object.entries(parsed as Record<string, unknown>).forEach(([pattern, levels]) => {
        if (Array.isArray(levels)) {
          config[pattern] = levels.filter((value): value is string => typeof value === 'string');
        }
      });
    }
  } catch {
    // ignore malformed overrides or JSON parsing errors
  }

  return config;
};

const ensureConfig = (): LogConfig => {
  const source = root?.[CONFIG_KEY] && typeof root[CONFIG_KEY] === 'object'
    ? (root[CONFIG_KEY] as LogConfig)
    : cloneDefaultConfig();

  const updated = applyQueryOverride(cloneConfig(source));

  if (root) {
    root[CONFIG_KEY] = updated;
  }

  return updated;
};

const getLevelsForScope = (scope: string | undefined): Set<LogLevel> => {
  const config = ensureConfig();
  const aggregated = new Set<LogLevel>();

  normalizeLevels(config.global ?? DEFAULT_LOG_CONFIG.global).forEach((level) => aggregated.add(level));

  Object.entries(config).forEach(([pattern, levels]) => {
    if (pattern === 'global') {
      return;
    }

    if (scopeMatches(pattern, scope)) {
      normalizeLevels(levels).forEach((level) => aggregated.add(level));
    }
  });

  return aggregated;
};

const shouldLog = (scope: string | undefined, level: LogLevel): boolean => getLevelsForScope(scope).has(level);

const formatTimestamp = (): string => new Date().toLocaleString();

const noop = (): void => undefined;

const resolveConsoleMethod = (method: ConsoleMethodName): ((...args: unknown[]) => void) => {
  if (typeof console === 'undefined') {
    return noop;
  }

  return (...data: unknown[]) => {
    const candidate = console[method];
    if (typeof candidate === 'function') {
      candidate.apply(console, data as []);
      return;
    }

    if (typeof console.log === 'function') {
      console.log.apply(console, data as []);
    }
  };
};

const createLevelAccumulator = (): Record<LogLevel, number> => LOG_LEVELS.reduce<Record<LogLevel, number>>((acc, level) => {
  acc[level] = 0;
  return acc;
}, {} as Record<LogLevel, number>);

const contextStats: Record<string, Record<LogLevel, number>> = Object.create(null);

const recordContext = (scope: string, level: LogLevel): void => {
  const key = scope || 'global';
  if (!contextStats[key]) {
    contextStats[key] = createLevelAccumulator();
  }

  contextStats[key][level] += 1;
};

const logAtLevel = (level: LogLevel): LogMethod => {
  const consoleMethod = CONSOLE_METHODS[level];
  const label = level.toUpperCase();
  const emit = resolveConsoleMethod(consoleMethod);

  return (scopeOrMessage: unknown, ...args: unknown[]) => {
    const payload: unknown[] = [...args];
    let resolvedScope: string | undefined = 'global';

    if (typeof scopeOrMessage === 'string' && scopeOrMessage.trim()) {
      resolvedScope = scopeOrMessage.trim();
    } else if (scopeOrMessage !== undefined) {
      payload.unshift(scopeOrMessage);
    }

    const scopeKey = resolvedScope ?? 'global';
    recordContext(scopeKey, level);

    if (!shouldLog(scopeKey, level)) {
      return;
    }

    const timestamp = formatTimestamp();
    emit(`[${timestamp}] [${scopeKey}] [${label}] -`, ...payload);
  };
};

const createLogger = (): Logger => {
  const base = LOG_LEVELS.reduce<Partial<Record<LogLevel, LogMethod>>>((acc, level) => {
    acc[level] = logAtLevel(level);
    return acc;
  }, {});

  const logger = base as Logger;

  logger.getConfig = () => cloneConfig(ensureConfig());
  logger.resetConfig = () => {
    if (root) {
      root[CONFIG_KEY] = cloneDefaultConfig();
    }

    queryOverrideApplied = false;
    if (root) {
      root[CONFIG_KEY] = applyQueryOverride(cloneDefaultConfig());
    }
  };

  logger.listContext = () => JSON.parse(JSON.stringify(contextStats)) as LoggerStats;

  return logger;
};

const logger = createLogger();

if (root && !root[LOGGER_KEY]) {
  root[LOGGER_KEY] = logger;
  (root as Record<string, unknown>).log = logger;
}

export { logger };
export default logger;
export type { LogLevel };
