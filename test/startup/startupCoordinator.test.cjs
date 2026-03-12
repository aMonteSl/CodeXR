const test = require('node:test');
const assert = require('node:assert/strict');
const { StartupCoordinator } = require('../../out/core/startup/startupCoordinator.js');

function wait(ms = 5) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

test('startup coordinator defers execution until started', async () => {
    const calls = [];
    const coordinator = new StartupCoordinator();

    coordinator.schedule({
        id: 'first',
        run: () => {
            calls.push('first');
        },
    });

    assert.deepEqual(calls, []);
    coordinator.start();
    await wait();
    assert.deepEqual(calls, ['first']);
    coordinator.dispose();
});

test('startup coordinator runs deferred tasks sequentially by default', async () => {
    const calls = [];
    const coordinator = new StartupCoordinator();

    coordinator.schedule({
        id: 'first',
        run: async () => {
            calls.push('first:start');
            await wait(10);
            calls.push('first:end');
        },
    });

    coordinator.schedule({
        id: 'second',
        run: () => {
            calls.push('second');
        },
    });

    coordinator.start();
    await wait(40);

    assert.deepEqual(calls, ['first:start', 'first:end', 'second']);
    coordinator.dispose();
});

test('startup coordinator supports bounded parallelism for independent tasks', async () => {
    const calls = [];
    const coordinator = new StartupCoordinator(undefined, undefined, { maxConcurrent: 2 });

    coordinator.schedule({
        id: 'first',
        run: async () => {
            calls.push('first:start');
            await wait(20);
            calls.push('first:end');
        },
    });

    coordinator.schedule({
        id: 'second',
        run: async () => {
            calls.push('second:start');
            await wait(5);
            calls.push('second:end');
        },
    });

    coordinator.start();
    await wait(50);

    assert.equal(calls[0], 'first:start');
    assert.equal(calls[1], 'second:start');
    assert.ok(calls.indexOf('second:end') < calls.indexOf('first:end'));
    coordinator.dispose();
});

test('startup coordinator stops scheduling work after dispose', async () => {
    const calls = [];
    const coordinator = new StartupCoordinator();

    coordinator.schedule({
        id: 'first',
        run: () => {
            calls.push('first');
        },
    });

    coordinator.dispose();
    coordinator.start();
    await wait();

    assert.deepEqual(calls, []);
});
