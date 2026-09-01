import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { logger, withLogging } from '../lib/logger';

describe('Logger', () => {
  let logCalls: string[] = [];
  let errorCalls: string[] = [];
  let warnCalls: string[] = [];
  let originalLog: typeof console.log;
  let originalError: typeof console.error;
  let originalWarn: typeof console.warn;

  beforeEach(() => {
    logCalls = [];
    errorCalls = [];
    warnCalls = [];
    originalLog = console.log;
    originalError = console.error;
    originalWarn = console.warn;
    console.log = (msg: string) => { logCalls.push(msg); };
    console.error = (msg: string) => { errorCalls.push(msg); };
    console.warn = (msg: string) => { warnCalls.push(msg); };
  });

  afterEach(() => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
  });

  it('logger.info writes to console.log with info level', () => {
    logger.info('Test message');

    assert.equal(logCalls.length, 1);
    assert.match(logCalls[0], /Test message/);
    // JSON output uses lowercase "info", dev uses uppercase "INFO"
    assert.match(logCalls[0], /info/i);
  });

  it('logger.error writes to console.error', () => {
    logger.error('Something broke');

    assert.equal(errorCalls.length, 1);
    assert.match(errorCalls[0], /Something broke/);
    assert.match(errorCalls[0], /error/i);
  });

  it('logger.warn writes to console.warn', () => {
    logger.warn('Warning message');

    assert.equal(warnCalls.length, 1);
    assert.match(warnCalls[0], /Warning message/);
    assert.match(warnCalls[0], /warn/i);
  });

  it('includes context in output', () => {
    logger.info('User action', { userId: '123', action: 'login' });

    assert.match(logCalls[0], /123/);
    assert.match(logCalls[0], /login/);
  });

  it('withLogging logs start and completion', async () => {
    await withLogging('test-op', async () => 42);

    assert.equal(logCalls.length, 2);
    assert.match(logCalls[0], /test-op started/);
    assert.match(logCalls[1], /test-op completed/);
  });

  it('withLogging logs error on failure and re-throws', async () => {
    const error = new Error('Test failure');

    await assert.rejects(
      withLogging('failing-op', async () => { throw error; }),
      /Test failure/
    );

    assert.match(logCalls[0], /failing-op started/);
    assert.match(errorCalls[0], /failing-op failed/);
    assert.match(errorCalls[0], /Test failure/);
  });
});
