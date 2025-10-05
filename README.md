# superlogger

Browser-first logging utility with scoped levels, runtime overrides, and zero external dependencies.

## Features
- Scoped logging with wildcard pattern matching (`auth:*`, `*`, etc.)
- Level-based filtering (`debug`, `notify`, `warn`, `error`, `fatal`)
- Browser-friendly defaults that require no configuration
- Opt-in runtime overrides via query string (`?loglevel=...`)
- Works with Vite, Webpack, Next.js, or any bundler that supports ESM
- Fully typed TypeScript API with tree-shakeable export

## Installation
```bash
npm install superlogger
# or
pnpm add superlogger
yarn add superlogger
```

## Usage
```ts
import log from 'superlogger';

log.debug('checkout:cart', 'Cart value', cart);
log.error('checkout:payment', new Error('Card declined'));

// Attach to window for debugging helpers
if (typeof window !== 'undefined') {
  window.superLogger = log;
}
```

### Configuring Log Levels
The logger reads configuration from a global `LogConfig` object where keys are patterns and values are arrays of levels that should be emitted. All patterns are case-insensitive, and `*` matches any scope.

```ts
import log, { logger } from 'superlogger';

const config = logger.getConfig();
config['checkout:*'] = ['error', 'fatal'];
config['checkout:payment'] = ['debug', 'notify', 'error'];

if (typeof window !== 'undefined') {
  window.__superlogger_config__ = config;
}
```

After updating the config, call `logger.resetConfig()` to re-read it, or simply reload your app if you are mutating the global before bootstrapping.

### Enabling Overrides Outside Vite
Runtime overrides are gated behind an explicit environment opt-in so you can safely ship the library to production. The flag is detected in several environments:

| Platform            | Flag                                  |
|---------------------|----------------------------------------|
| Vite / import.meta  | `VITE_ENABLE_LOGGING=true`             |
| Webpack / Next.js   | `process.env.ENABLE_LOGGING=true`      |
| Node (SSR helpers)  | `process.env.SUPERLOGGER_ENABLE_LOGGING=true` |
| Global toggle       | `globalThis.__SUPERLOGGER_ENABLE__ = true` |

Once enabled, you can append `?loglevel={"pattern":["debug"]}` to the browser URL to adjust scopes without redeploying.

In environments without a real `window.location` (for example, server-side rendering or unit tests), you can set `globalThis.__SUPERLOGGER_QUERY__ = '?loglevel={"pattern":["debug"]}'` before importing the logger to simulate the same override.

## Query String Override
When the feature flag is enabled, Superlogger will look for a `loglevel` query parameter on page load. The parameter expects a JSON object where each key is a pattern and the value is an array of levels:

```
?loglevel={"checkout:payment":["debug","notify"]}
```

Invalid JSON is ignored gracefully, so your application remains stable.

## API

### Default Export
`log.debug(scopeOrMessage, ...args)` and friends. If the first argument is a string it is treated as the scope; otherwise, the scope defaults to `global` and the value is logged as part of the payload.

### `logger.getConfig()`
Returns a clone of the current configuration (after overrides).

### `logger.resetConfig()`
Reverts to the default configuration and re-applies any query string override.

### `logger.listContext()`
Returns counters of how many times each scope emitted each level during the current session.

## Development
```bash
npm install
npm test
npm run build
```

## License
[MIT](./LICENSE)
