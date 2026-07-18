/**
 * Structured Logger
 * Uses pino in production, console in development.
 * Correlates request IDs with socket connection IDs.
 */

let pino = null;
try { pino = require('pino'); } catch (e) { /* pino not installed */ }

const isProduction = process.env.NODE_ENV === 'production';

function createLogger(name = 'anonchat') {
  if (pino && isProduction) {
    return pino({
      name,
      level: process.env.LOG_LEVEL || 'info',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'HH:MM:ss Z' }
      }
    });
  }

  // Development console logger with correlation IDs
  const colors = {
    info: '\x1b[36m',
    warn: '\x1b[33m',
    error: '\x1b[31m',
    debug: '\x1b[90m',
    reset: '\x1b[0m'
  };

  const formatMsg = (level, msg, meta) => {
    const ts = new Date().toISOString().substring(11, 19);
    const prefix = meta?.correlationId ? `[${meta.correlationId}] ` : '';
    const extra = meta ? Object.entries(meta)
      .filter(([k]) => k !== 'correlationId')
      .map(([k, v]) => `${k}=${v}`)
      .join(' ') : '';
    return `${ts} ${colors[level]}[${name}]${colors.reset} ${prefix}${msg} ${extra}`.trim();
  };

  return {
    info: (msg, meta) => console.log(formatMsg('info', msg, meta)),
    warn: (msg, meta) => console.warn(formatMsg('warn', msg, meta)),
    error: (msg, meta) => console.error(formatMsg('error', msg, meta)),
    debug: (msg, meta) => console.debug(formatMsg('debug', msg, meta)),
    child: (bindings) => createLogger(`${name}:${bindings.module || 'child'}`)
  };
}

module.exports = { createLogger };
