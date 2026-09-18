/**
 * The historical comparison computes its Added / Removed / Modified / Unchanged
 * summary in two places:
 *
 *  - in the extension, HistoricalComparisonService.buildDelta (TypeScript), for
 *    a live scene that has git and the analyzer behind it;
 *  - in the browser, buildOfflineDelta (historicalComparisonRuntime), for a
 *    self-contained export, where there is no extension left to ask.
 *
 * The second is a hand-written port of the first, and both results ride the
 * same applySharedState path into the same dashboard cells. If the two drift,
 * an exported scene reports a different summary than the live scene did for
 * the same two revisions - and nothing would notice, because every other suite
 * exercises one side alone. This suite loads BOTH and feeds them the same
 * inputs, like the sampler parity test in gitRefPickerRuntime.test.cjs.
 *
 * What is NOT mirrored is pinned as well, so that it cannot widen silently:
 *  - delta.metrics: the extension sums the mapped metrics (the LivePanel reads
 *    them); the browser port always answers [].
 *  - evolutionKey: only the browser port ignores it. Exported payloads carry
 *    both identity keys, live comparison payloads carry comparisonKey alone.
 *  - field names that Object.prototype also has: only the browser port ignores
 *    them, by accident. No analyzer field is named like that.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const util = require('node:util');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const { readAssembledRuntime } = require(path.join(projectRoot, 'test', 'helpers', 'runtimeAssembly.cjs'));
const { createFakeVscode, withFakeVscode } = require(path.join(projectRoot, 'test', 'helpers', 'fakeVscode.cjs'));
const { readSource } = require(path.join(projectRoot, 'test', 'helpers', 'sourceText.cjs'));

// == Where the two implementations live ==
// A refactor that moves either side retargets THIS block and nothing below it.

const EXTENSION_MODULE = 'code_analysis/historical/historicalComparisonService.js';
const EXTENSION_SOURCE = 'src/code_analysis/historical/historicalComparisonService.ts';
const runtimeSource = readAssembledRuntime('historical-comparison', 'historicalComparisonRuntime.js');

function loadExtensionDelta(requireOut) {
    const { HistoricalComparisonService } = requireOut(EXTENSION_MODULE);
    // buildDelta is private, but it only reads its arguments and two sibling
    // helpers, so a bare prototype instance runs the real code without a
    // session registry, git or Python behind it.
    const service = Object.create(HistoricalComparisonService.prototype);
    assert.equal(
        typeof service.buildDelta,
        'function',
        'the extension-side delta moved: retarget loadExtensionDelta() to its new home, do not drop the parity',
    );
    return (left, right, targetType, selectedMetrics = []) =>
        service.buildDelta(left, right, { targetType }, selectedMetrics);
}

function loadBrowserDelta() {
    const sandbox = {
        window: null,
        document: { readyState: 'loading', addEventListener() {} },
        console,
        setTimeout,
        clearTimeout,
    };
    sandbox.window = sandbox;
    vm.runInNewContext(runtimeSource, sandbox, { filename: 'historicalComparisonRuntime.js' });
    const browserDelta = sandbox.CodeXRHistoricalComparisonRuntime.__testing.buildOfflineDelta;
    assert.equal(typeof browserDelta, 'function', 'the browser-side delta is no longer exposed for testing');
    return browserDelta;
}

// Each side declares its ignored fields as a literal. Reading the two literals
// is the only way to notice a field NAME that one side learned and the other
// did not; the test below then proves by execution that each literal is the
// list its side really applies, so neither can turn into dead text.
//
// A literal is found by what it says, not by what it is called: the one Set
// (extension) and the one flag map (browser) that name comparisonKey. Both
// identifiers are private, and renaming or hoisting them changes nothing.
function readDeclaredIgnoredFields() {
    const extensionLiterals = [...readSource(EXTENSION_SOURCE).matchAll(/new Set\(\[([^\]]*)\]\)/g)]
        .map((match) => match[1])
        .filter((body) => /'comparisonKey'/.test(body));
    const browserLiterals = [...runtimeSource.matchAll(/=\s*\{([^{}]*)\}/g)]
        .map((match) => match[1])
        .filter((body) => /\bcomparisonKey\s*:\s*true\b/.test(body));
    assert.equal(
        extensionLiterals.length,
        1,
        'expected exactly one extension-side ignored-field list: retarget readDeclaredIgnoredFields()',
    );
    assert.equal(
        browserLiterals.length,
        1,
        'expected exactly one browser-side ignored-field list: retarget readDeclaredIgnoredFields()',
    );
    return {
        extension: [...extensionLiterals[0].matchAll(/'([^']+)'/g)].map((match) => match[1]),
        browser: [...browserLiterals[0].matchAll(/(\w+)\s*:\s*true/g)].map((match) => match[1]),
    };
}

// == Shared plumbing ==

function withBothDeltas(run) {
    const browserDelta = loadBrowserDelta();
    return withFakeVscode(createFakeVscode(), ({ requireOut }) => run({
        extensionDelta: loadExtensionDelta(requireOut),
        browserDelta,
    }));
}

// The browser result comes from another vm realm, so it is compared through a
// plain projection instead of by prototype.
function counters(delta) {
    return {
        added: delta.added,
        removed: delta.removed,
        modified: delta.modified,
        unchanged: delta.unchanged,
    };
}

// One entry per side under the same key: it is either modified or unchanged.
function classify(delta, left, right, targetType) {
    const result = counters(delta(
        [{ comparisonKey: 'same', ...left }],
        [{ comparisonKey: 'same', ...right }],
        targetType,
    ));
    assert.equal(result.added + result.removed, 0);
    assert.equal(result.modified + result.unchanged, 1);
    return result.modified === 1 ? 'modified' : 'unchanged';
}

// How one side reacts when ONLY this field changes, as a number and as text.
function changeSignature(delta, field) {
    return {
        numberInDirectory: classify(delta, { [field]: 1 }, { [field]: 2 }, 'directory'),
        numberInFile: classify(delta, { [field]: 1 }, { [field]: 2 }, 'file'),
        textInDirectory: classify(delta, { [field]: 'before' }, { [field]: 'after' }, 'directory'),
        textInFile: classify(delta, { [field]: 'before' }, { [field]: 'after' }, 'file'),
    };
}

const IGNORED = {
    numberInDirectory: 'unchanged',
    numberInFile: 'unchanged',
    textInDirectory: 'unchanged',
    textInFile: 'unchanged',
};
// Numbers always count; text counts only for a single-file target, where the
// entries are functions and a changed label is a real change.
const COMPARED = {
    numberInDirectory: 'modified',
    numberInFile: 'modified',
    textInDirectory: 'unchanged',
    textInFile: 'modified',
};

// The single field the two sides are known to treat differently.
const BROWSER_ONLY_IGNORED_FIELDS = ['evolutionKey'];
// Real analyzer fields that neither side ignores: they prove the probe can
// tell a compared field from an ignored one.
const COMPARED_CONTROL_FIELDS = ['totalLines', 'complexity', 'parameters', 'language', 'complexityBand'];

// == The ignored-field lists ==

test('the two ignored-field lists differ by exactly evolutionKey, and each side really applies its own list', () => {
    const declared = readDeclaredIgnoredFields();
    // Canary: both literals were really found and parsed.
    for (const list of [declared.extension, declared.browser]) {
        assert.ok(list.includes('comparisonKey') && list.includes('filePath') && list.length >= 5, list.join(', '));
    }

    assert.deepEqual(
        declared.browser.filter((field) => !declared.extension.includes(field)),
        BROWSER_ONLY_IGNORED_FIELDS,
        'a field is ignored offline only: an exported scene would hide a change the live scene reports',
    );
    assert.deepEqual(
        declared.extension.filter((field) => !declared.browser.includes(field)),
        [],
        'a field is ignored by the extension only: an exported scene would report a change the live scene hides',
    );

    withBothDeltas(({ extensionDelta, browserDelta }) => {
        // comparisonKey is the identity itself: two entries under one key
        // cannot differ in it, so whether it is ignored is not observable.
        const universe = [...new Set([...declared.extension, ...declared.browser, ...COMPARED_CONTROL_FIELDS])]
            .filter((field) => field !== 'comparisonKey');
        const observable = (list) => list.filter((field) => field !== 'comparisonKey').sort();

        for (const [side, delta, declaredList] of [
            ['extension', extensionDelta, declared.extension],
            ['browser', browserDelta, declared.browser],
        ]) {
            const ignored = [];
            for (const field of universe) {
                const signature = changeSignature(delta, field);
                if (util.isDeepStrictEqual(signature, IGNORED)) {
                    ignored.push(field);
                } else {
                    // Nothing in between: a field ignored in one mode only
                    // would be a third behaviour this suite does not know.
                    assert.deepEqual(signature, COMPARED, `${side}: ${field}`);
                }
            }
            assert.deepEqual(ignored.sort(), observable(declaredList), `${side}: declared list versus real behaviour`);
        }

        for (const field of universe.filter((name) => !BROWSER_ONLY_IGNORED_FIELDS.includes(name))) {
            assert.deepEqual(changeSignature(browserDelta, field), changeSignature(extensionDelta, field), field);
        }
    });
});

test('DIVERGENCE: a differing evolutionKey is a modification for the extension and invisible to the browser port', () => {
    // Reachable only with hand-made input. The export decorator derives both
    // keys from the same function name, so two exported entries that share a
    // comparisonKey share their evolutionKey too (see the exported-shape test
    // below), and live comparison payloads carry no evolutionKey at all.
    // If this turns red because the extension now ignores the field as well,
    // the divergence is closed: empty BROWSER_ONLY_IGNORED_FIELDS and delete
    // this test.
    const left = [{ comparisonKey: 'function:module.py:parse#2:1', evolutionKey: 'function:parse', complexity: 3 }];
    const right = [{ comparisonKey: 'function:module.py:parse#2:1', evolutionKey: 'function:parser', complexity: 3 }];

    withBothDeltas(({ extensionDelta, browserDelta }) => {
        assert.deepEqual(counters(extensionDelta(left, right, 'file')), { added: 0, removed: 0, modified: 1, unchanged: 0 });
        assert.deepEqual(counters(browserDelta(left, right, 'file')), { added: 0, removed: 0, modified: 0, unchanged: 1 });

        // Text never counts for a directory target, so the two agree there.
        assert.deepEqual(counters(extensionDelta(left, right, 'directory')), { added: 0, removed: 0, modified: 0, unchanged: 1 });
        assert.deepEqual(counters(browserDelta(left, right, 'directory')), { added: 0, removed: 0, modified: 0, unchanged: 1 });
    });
});

test('DIVERGENCE: a field named like an Object.prototype member is invisible to the browser port only', () => {
    // The browser port keeps its ignored fields in a plain object literal, so
    // every name that object inherits (constructor, toString, ...) reads as
    // ignored too, and __proto__ never reaches its map of field names. The
    // extension uses a Set and compares all of them.
    // Reachable only with hand-made input: the analyzer's field names are a
    // fixed schema (xr_field_schema.py) and none of them collides.
    // If this turns red because the port now looks at own properties only,
    // the divergence is closed: delete this test.
    withBothDeltas(({ extensionDelta, browserDelta }) => {
        for (const name of ['constructor', 'toString', '__proto__']) {
            // Parsed, as a payload arrives: that makes __proto__ an own field.
            const left = JSON.parse(`{ "${name}": 1 }`);
            const right = JSON.parse(`{ "${name}": 2 }`);
            for (const targetType of ['directory', 'file']) {
                const label = `${name} (${targetType} target)`;
                assert.equal(classify(extensionDelta, left, right, targetType), 'modified', label);
                assert.equal(classify(browserDelta, left, right, targetType), 'unchanged', label);
            }
        }
    });
});

// == What counts as a change ==

const VALUE_CASES = [
    {
        name: 'a number that changed',
        left: { totalLines: 10 }, right: { totalLines: 11 },
        directory: 'modified', file: 'modified',
    },
    {
        name: 'a number that did not change',
        left: { totalLines: 10 }, right: { totalLines: 10 },
        directory: 'unchanged', file: 'unchanged',
    },
    {
        name: 'a fractional change',
        left: { commentRatio: 0.25 }, right: { commentRatio: 0.26 },
        directory: 'modified', file: 'modified',
    },
    {
        name: 'a metric that only one revision reports',
        left: {}, right: { classCount: 3 },
        directory: 'modified', file: 'modified',
    },
    {
        name: 'a metric that is missing on one side and zero on the other',
        left: {}, right: { classCount: 0 },
        directory: 'unchanged', file: 'unchanged',
    },
    {
        name: 'a metric that is null on one side and zero on the other',
        left: { maxNestingDepth: null }, right: { maxNestingDepth: 0 },
        directory: 'unchanged', file: 'unchanged',
    },
    {
        name: 'a metric that goes from null to a value',
        left: { maxNestingDepth: null }, right: { maxNestingDepth: 4 },
        directory: 'modified', file: 'modified',
    },
    {
        name: 'a text field that changed',
        left: { language: 'Python' }, right: { language: 'JavaScript' },
        directory: 'unchanged', file: 'modified',
    },
    {
        name: 'a text field that only one revision carries',
        left: { complexityBand: 'low' }, right: {},
        directory: 'unchanged', file: 'unchanged',
    },
    {
        name: 'a text field that changed in letter case only',
        left: { language: 'python' }, right: { language: 'Python' },
        directory: 'unchanged', file: 'modified',
    },
    {
        // A quirk the two sides share: a number written as text is text. It
        // is never a metric change, and it counts only where text counts.
        name: 'two different numbers that are both written as text',
        left: { totalLines: '10' }, right: { totalLines: '12' },
        directory: 'unchanged', file: 'modified',
    },
    {
        name: 'a number against the same number written as text',
        left: { totalLines: 10 }, right: { totalLines: '10' },
        directory: 'unchanged', file: 'unchanged',
    },
    {
        // A port that stopped at the first compared field would miss this one.
        name: 'a change that comes after several equal fields',
        left: { totalLines: 10, codeLines: 8, language: 'Python', functionCount: 2 },
        right: { totalLines: 10, codeLines: 8, language: 'Python', functionCount: 3 },
        directory: 'modified', file: 'modified',
    },
    {
        name: 'a change confined to ignored fields, around equal metrics',
        left: { filePath: '/old/a.py', timestamp: 1, lineStart: 3, lineEnd: 9, status: 'ok', totalLines: 10 },
        right: { filePath: '/new/a.py', timestamp: 2, lineStart: 30, lineEnd: 36, status: 'stale', totalLines: 10 },
        directory: 'unchanged', file: 'unchanged',
    },
];

test('both sides agree on what counts as a modification, for directory and for file targets', () => {
    withBothDeltas(({ extensionDelta, browserDelta }) => {
        for (const valueCase of VALUE_CASES) {
            for (const targetType of ['directory', 'file']) {
                const label = `${valueCase.name} (${targetType} target)`;
                const fromExtension = classify(extensionDelta, valueCase.left, valueCase.right, targetType);
                const fromBrowser = classify(browserDelta, valueCase.left, valueCase.right, targetType);
                assert.equal(fromBrowser, fromExtension, `the port drifted: ${label}`);
                assert.equal(fromExtension, valueCase[targetType], label);
            }
        }
    });
});

// Every JSON type, each in at least two distinct values: a side that started
// to compare booleans, lists, objects or numeric text on its own can only be
// caught by a pair that differs in exactly that type.
const JSON_VALUES = [
    undefined, null, 0, 1, 2.5, '', '2.5', '3', 'low', 'Low', 'high',
    true, false, [1], [2], { nested: 1 }, { nested: 2 },
];

test('both sides agree on every pairing of JSON value types, under a compared field and under an ignored one', () => {
    const entryWith = (field, value) => (value === undefined ? {} : { [field]: value });
    // The ignored-field test proves by execution that both sides compare the
    // first and ignore the second.
    const comparedField = 'totalLines';
    const ignoredField = 'status';

    withBothDeltas(({ extensionDelta, browserDelta }) => {
        const seen = { directory: new Set(), file: new Set() };
        let modeSensitivePairings = 0;

        for (const leftValue of JSON_VALUES) {
            for (const rightValue of JSON_VALUES) {
                const label = `${util.inspect(leftValue)} -> ${util.inspect(rightValue)}`;
                const perMode = {};
                for (const targetType of ['directory', 'file']) {
                    const left = entryWith(comparedField, leftValue);
                    const right = entryWith(comparedField, rightValue);
                    perMode[targetType] = classify(extensionDelta, left, right, targetType);
                    assert.equal(
                        classify(browserDelta, left, right, targetType),
                        perMode[targetType],
                        `the port drifted: ${comparedField} ${label} (${targetType} target)`,
                    );
                    seen[targetType].add(perMode[targetType]);

                    const ignoredLeft = entryWith(ignoredField, leftValue);
                    const ignoredRight = entryWith(ignoredField, rightValue);
                    assert.equal(classify(extensionDelta, ignoredLeft, ignoredRight, targetType), 'unchanged', label);
                    assert.equal(classify(browserDelta, ignoredLeft, ignoredRight, targetType), 'unchanged', label);
                }
                if (perMode.directory !== perMode.file) {
                    modeSensitivePairings += 1;
                }
            }
        }

        // The table must reach both answers and the target type, otherwise
        // the equalities above prove nothing.
        assert.deepEqual([...seen.directory].sort(), ['modified', 'unchanged']);
        assert.deepEqual([...seen.file].sort(), ['modified', 'unchanged']);
        assert.ok(modeSensitivePairings > 0, 'no pairing depends on the target type');
    });
});

// == Exported-shape payloads ==

test('payload pairs shaped by the export decorator get the same counters on both sides, renames included', () => {
    // The decorator that writes the per-revision payloads of an export: the
    // browser port only ever sees entries shaped by it.
    const { decorateRevisionPayload } = require(path.join(
        projectRoot, 'out', 'code_analysis', 'export', 'gitRevisionExportCore.js',
    ));
    // Pure path arithmetic, nothing is created on disk. Each revision is
    // analyzed in its own snapshot folder, as a materialized commit is.
    const base = path.join(os.tmpdir(), 'codexr-delta-parity');
    const project = path.join(base, 'project');
    const snapshotA = path.join(base, 'revision-a');
    const snapshotB = path.join(base, 'revision-b');

    const file = (snapshot, relativePath, metrics) => ({
        fileName: path.basename(relativePath),
        filePath: path.join(snapshot, ...relativePath.split('/')),
        language: 'Python',
        timestamp: snapshot === snapshotA ? '2026-01-01T00:00:00Z' : '2026-02-01T00:00:00Z',
        ...metrics,
    });
    const directoryLeft = decorateRevisionPayload([
        file(snapshotA, 'src/kept.py', { totalLines: 40, functionCount: 3, commentRatio: 0.1 }),
        file(snapshotA, 'src/grown.py', { totalLines: 20, functionCount: 1 }),
        file(snapshotA, 'src/old_name.py', { totalLines: 12, functionCount: 1 }),
        file(snapshotA, 'src/deleted.py', { totalLines: 5, functionCount: 0 }),
        file(snapshotA, 'docs/notes.md', { totalLines: 9, language: 'Markdown' }),
    ], 'directory', project, snapshotA);
    const directoryRight = decorateRevisionPayload([
        file(snapshotB, 'src/kept.py', { totalLines: 40, functionCount: 3, commentRatio: 0.1 }),
        file(snapshotB, 'src/grown.py', { totalLines: 26, functionCount: 2 }),
        file(snapshotB, 'src/new_name.py', { totalLines: 12, functionCount: 1 }),
        file(snapshotB, 'src/created.py', { totalLines: 1, functionCount: 0 }),
        file(snapshotB, 'docs/notes.md', { totalLines: 9, language: 'Text' }),
    ], 'directory', project, snapshotB);

    const fn = (snapshot, functionName, parameters, lineStart, metrics) => ({
        functionName,
        parameters,
        fileName: 'module.py',
        filePath: path.join(snapshot, 'module.py'),
        lineStart,
        lineEnd: lineStart + metrics.lineCount - 1,
        complexityBand: metrics.complexity > 5 ? 'medium' : 'low',
        ...metrics,
    });
    const moduleTarget = path.join(project, 'module.py');
    const fileLeft = decorateRevisionPayload([
        fn(snapshotA, 'parse', 2, 1, { complexity: 3, lineCount: 10 }),
        fn(snapshotA, 'render', 1, 12, { complexity: 5, lineCount: 20 }),
        fn(snapshotA, 'render', 1, 33, { complexity: 2, lineCount: 6 }),
        fn(snapshotA, 'legacy', 0, 40, { complexity: 1, lineCount: 3 }),
        fn(snapshotA, 'helper', 0, 44, { complexity: 1, lineCount: 4 }),
    ], 'file', moduleTarget, path.join(snapshotA, 'module.py'));
    const fileRight = decorateRevisionPayload([
        fn(snapshotB, 'parse', 2, 1, { complexity: 8, lineCount: 18 }),
        fn(snapshotB, 'render', 1, 20, { complexity: 5, lineCount: 20 }),
        fn(snapshotB, 'render', 1, 41, { complexity: 2, lineCount: 9 }),
        fn(snapshotB, 'modern', 0, 51, { complexity: 1, lineCount: 3 }),
        fn(snapshotB, 'helper', 0, 55, { complexity: 1, lineCount: 4 }),
        fn(snapshotB, 'fresh', 3, 60, { complexity: 1, lineCount: 2 }),
    ], 'file', moduleTarget, path.join(snapshotB, 'module.py'));

    // Canary: this really is the exported shape, with BOTH identity keys - the
    // one input on which the evolutionKey divergence could have mattered.
    for (const payload of [directoryLeft, directoryRight, fileLeft, fileRight]) {
        assert.ok(payload.every((entry) => entry.comparisonKey && typeof entry.evolutionKey === 'string'));
    }
    // What keeps that divergence out of real exports: two exported entries
    // that share a comparisonKey share their evolutionKey too. A decorator
    // that breaks this makes the browser port hide a change the extension
    // would report, and the DIVERGENCE test stops being a curiosity.
    for (const [left, right] of [[directoryLeft, directoryRight], [fileLeft, fileRight]]) {
        const evolutionKeyByComparisonKey = new Map(left.map((entry) => [entry.comparisonKey, entry.evolutionKey]));
        const shared = right.filter((entry) => evolutionKeyByComparisonKey.has(entry.comparisonKey));
        assert.ok(shared.length >= 3, 'the fixture pair no longer shares entries');
        for (const entry of shared) {
            assert.equal(entry.evolutionKey, evolutionKeyByComparisonKey.get(entry.comparisonKey), entry.comparisonKey);
        }
    }

    withBothDeltas(({ extensionDelta, browserDelta }) => {
        // Identity is the relative path (or the function signature), so a
        // rename is one removal plus one addition on BOTH sides: neither
        // implementation follows renames. The moved functions and the file
        // whose only change is a text label stay unchanged.
        const expected = {
            directory: { added: 2, removed: 2, modified: 1, unchanged: 2 },
            file: { added: 2, removed: 1, modified: 2, unchanged: 2 },
        };
        const pairs = { directory: [directoryLeft, directoryRight], file: [fileLeft, fileRight] };

        for (const targetType of ['directory', 'file']) {
            const [left, right] = pairs[targetType];
            const fromExtension = counters(extensionDelta(left, right, targetType));
            const fromBrowser = counters(browserDelta(left, right, targetType));
            assert.deepEqual(fromBrowser, fromExtension, `the port drifted on a ${targetType} target`);
            assert.deepEqual(fromExtension, expected[targetType], `${targetType} target`);

            // Swapping the sides swaps added and removed and nothing else.
            const reversed = counters(browserDelta(right, left, targetType));
            assert.deepEqual(reversed, counters(extensionDelta(right, left, targetType)));
            assert.deepEqual(reversed, {
                added: fromExtension.removed,
                removed: fromExtension.added,
                modified: fromExtension.modified,
                unchanged: fromExtension.unchanged,
            });
        }
    });
});

// == Generated spread ==

test('the counters stay equal over a generated spread of payload pairs', () => {
    // Hand-picked cases only cover what their author thought of, one field at
    // a time. This spread mixes what they leave out: duplicate keys, entries
    // without a key, empty sides, and several compared and ignored fields
    // changing at once. evolutionKey is left out on purpose (see the
    // DIVERGENCE test).
    const KEYS = ['file:a.py', 'file:b.py', 'file:c.py', 'file:d.py', 'file:e.py', undefined];
    const FIELDS = ['totalLines', 'complexity', 'language', 'complexityBand', 'filePath', 'timestamp', 'lineStart', 'status'];
    const VALUES = JSON_VALUES;

    // A fixed seed keeps the spread identical on every run. The draw uses the
    // high bits: the low bits of this generator repeat after a few steps.
    let seed = 20260918;
    const next = (bound) => {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
        return Math.floor((seed / 0x100000000) * bound);
    };
    const makeSide = () => Array.from({ length: next(7) }, () => {
        const entry = {};
        const key = KEYS[next(KEYS.length)];
        if (key !== undefined) {
            entry.comparisonKey = key;
        }
        for (const field of FIELDS) {
            const value = VALUES[next(VALUES.length)];
            if (value !== undefined) {
                entry[field] = value;
            }
        }
        return entry;
    });

    withBothDeltas(({ extensionDelta, browserDelta }) => {
        const totals = {
            directory: { added: 0, removed: 0, modified: 0, unchanged: 0 },
            file: { added: 0, removed: 0, modified: 0, unchanged: 0 },
        };
        let modeSensitivePairs = 0;

        for (let index = 0; index < 150; index += 1) {
            const left = makeSide();
            const right = makeSide();
            const perMode = {};
            for (const targetType of ['directory', 'file']) {
                const fromExtension = counters(extensionDelta(left, right, targetType));
                const fromBrowser = counters(browserDelta(left, right, targetType));
                assert.deepEqual(
                    fromBrowser,
                    fromExtension,
                    `pair ${index} (${targetType} target): ${JSON.stringify({ left, right })}`,
                );
                for (const name of Object.keys(fromExtension)) {
                    totals[targetType][name] += fromExtension[name];
                }
                perMode[targetType] = fromExtension;
            }
            if (!util.isDeepStrictEqual(perMode.directory, perMode.file)) {
                modeSensitivePairs += 1;
            }
        }

        // The spread must really exercise every counter and the target type,
        // otherwise the equality above proves nothing.
        for (const targetType of ['directory', 'file']) {
            for (const [name, total] of Object.entries(totals[targetType])) {
                assert.ok(total > 0, `the spread never produced "${name}" for a ${targetType} target`);
            }
        }
        assert.ok(modeSensitivePairs > 0, 'the spread never produced a pair whose result depends on the target type');
    });
});

// == delta.metrics ==

test('only the extension fills delta.metrics: one summed row per distinct selected metric, none offline', () => {
    const left = [
        { comparisonKey: 'file:a.py', totalLines: 10, functionCount: 2 },
        { comparisonKey: 'file:b.py', totalLines: 5, functionCount: 'n/a' },
    ];
    const right = [
        { comparisonKey: 'file:a.py', totalLines: 12.5, functionCount: 2 },
        { comparisonKey: 'file:c.py', totalLines: 1 },
    ];
    // A dimension mapping can name one metric for several dimensions, and can
    // name a field that no entry reports.
    const selectedMetrics = ['totalLines', 'functionCount', 'totalLines', 'neverReported'];

    withBothDeltas(({ extensionDelta, browserDelta }) => {
        const fromExtension = extensionDelta(left, right, 'directory', selectedMetrics);
        assert.deepEqual(fromExtension.metrics, [
            { metric: 'totalLines', left: 15, right: 13.5, delta: -1.5 },
            // A value that is not a finite number adds nothing to the sum.
            { metric: 'functionCount', left: 2, right: 2, delta: 0 },
            { metric: 'neverReported', left: 0, right: 0, delta: 0 },
        ]);

        // The XR companion derives its metric table from the payloads, so the
        // port carries an empty list rather than a second copy of the sums.
        const fromBrowser = browserDelta(left, right, 'directory');
        assert.ok(Array.isArray(fromBrowser.metrics));
        assert.equal(fromBrowser.metrics.length, 0);

        // The selection feeds the metric rows only, never the four counters.
        assert.deepEqual(counters(fromExtension), counters(fromBrowser));
        assert.deepEqual(counters(fromExtension), counters(extensionDelta(left, right, 'directory')));
    });
});
