const test = require('node:test');
const assert = require('node:assert/strict');
const { isVerboseLoggingEnabled, shouldEmitLog } = require('../../out/core/logging/logPolicy.js');

test('verbose logging is always enabled in development mode', () => {
    assert.equal(isVerboseLoggingEnabled('development', false), true);
    assert.equal(isVerboseLoggingEnabled('development', true), true);
});

test('verbose logging in production depends on the setting', () => {
    assert.equal(isVerboseLoggingEnabled('production', false), false);
    assert.equal(isVerboseLoggingEnabled('production', true), true);
});

test('warn and error logs are emitted even when verbose logging is disabled', () => {
    assert.equal(shouldEmitLog('warn', false), true);
    assert.equal(shouldEmitLog('error', false), true);
});

test('debug and info logs require verbose logging', () => {
    assert.equal(shouldEmitLog('debug', false), false);
    assert.equal(shouldEmitLog('info', false), false);
    assert.equal(shouldEmitLog('debug', true), true);
    assert.equal(shouldEmitLog('info', true), true);
});
