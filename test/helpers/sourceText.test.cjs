const test = require('node:test');
const assert = require('node:assert/strict');

const {
    readSource,
    readConcatenated,
    collectFiles,
    readSourceTree,
    assertAbsent,
    assertOrdered,
} = require('./sourceText.cjs');

test('readSource returns LF text whatever the checkout looks like', () => {
    const text = readSource('src/extension.ts');

    assert.ok(text.length > 0);
    assert.equal(text.includes('\r'), false, 'CRLF is normalized so patterns never depend on the platform');
});

test('readSource names the fix when a pinned file is gone', () => {
    assert.throws(
        () => readSource('src/__never_existed__.ts'),
        /was deleted or moved\. A test reads it as text: update this test in the same commit/,
    );
});

test('readConcatenated follows code across several files', () => {
    const haystack = readConcatenated(['src/extension.ts', 'src/commands/index.ts']);

    assert.match(haystack, /export (async )?function activate/);
    assert.match(haystack, /assertUniqueCommandIds/);
    assert.throws(() => readConcatenated([]), /at least one path/);
});

test('collectFiles and readSourceTree walk a directory in a stable order', () => {
    const files = collectFiles('src/core', { extensions: ['.ts'] });

    assert.ok(files.includes('src/core/logging/logger.ts'));
    assert.deepEqual(files, files.slice().sort());
    assert.equal(
        collectFiles('src/core', { extensions: ['.ts'], exclude: (file) => file.includes('/logging/') })
            .some((file) => file.includes('/logging/')),
        false,
    );
    assert.match(readSourceTree('src/core/logging', { extensions: ['.ts'] }), /class CodeXRLogger/);
});

test('assertAbsent refuses to pass against the wrong haystack', () => {
    const haystack = 'function startServer() { return listen(port); }';

    assertAbsent(haystack, /legacyStart/, { canary: /function startServer/ });

    assert.throws(
        () => assertAbsent(haystack, /listen\(port\)/, { canary: /function startServer/ }),
        /The input was expected to not match/,
    );
    // The guarded code moved away: without a canary this would pass forever.
    assert.throws(
        () => assertAbsent('// nothing relevant here', /legacyStart/, { canary: /function startServer/ }),
        /canary not found/,
    );
    assert.throws(() => assertAbsent(haystack, /legacyStart/), /needs a canary/);
});

test('assertOrdered checks sequence, not just presence', () => {
    const haystack = 'first(); second(); third();';

    assertOrdered(haystack, ['first()', /second\(\)/, 'third()']);
    assert.throws(() => assertOrdered(haystack, ['second()', 'first()']), /not found after offset/);
});
