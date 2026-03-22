const test = require('node:test');
const assert = require('node:assert/strict');
const { assertUniqueCommandIds } = require('../../out/commands/shared/commandRegistry.js');

test('assertUniqueCommandIds accepts unique command identifiers', () => {
    assert.doesNotThrow(() => {
        assertUniqueCommandIds([
            {
                id: 'codexr.test.one',
                module: 'TEST_MODULE_A',
                description: 'First test command',
                handler: () => {},
            },
            {
                id: 'codexr.test.two',
                module: 'TEST_MODULE_B',
                description: 'Second test command',
                handler: () => {},
            },
        ]);
    });
});

test('assertUniqueCommandIds rejects duplicate command identifiers', () => {
    assert.throws(
        () => {
            assertUniqueCommandIds([
                {
                    id: 'codexr.test.duplicate',
                    module: 'TEST_MODULE_A',
                    description: 'First duplicate registration',
                    handler: () => {},
                },
                {
                    id: 'codexr.test.duplicate',
                    module: 'TEST_MODULE_B',
                    description: 'Second duplicate registration',
                    handler: () => {},
                },
            ]);
        },
        /Duplicate command registration detected.*TEST_MODULE_A.*TEST_MODULE_B/,
    );
});
