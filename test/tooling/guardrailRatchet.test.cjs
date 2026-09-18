const test = require('node:test');
const assert = require('node:assert/strict');

const { measure, readBaseline, compareRatcheted, describeChange } = require('./measureGuardrails.cjs');

const bulletList = (changes) => changes.map((change) => `  - ${describeChange(change)}`).join('\n');

test('no cleanup metric got worse than the committed baseline', () => {
    // console.* calls, console-only catch blocks, any-escapes, suppressions,
    // oversized files and functions, cyclomatic complexity, modules unreachable
    // from the entry point, unreachable commands: v1.2.1 exists to bring these
    // down, so none of them may quietly grow back.
    const { worse } = compareRatcheted(measure().ratcheted, readBaseline().ratcheted);

    assert.equal(
        worse.length,
        0,
        `These metrics are worse than test/tooling/guardrail-baseline.json:\n${bulletList(worse)}\n`
        + 'Fix the regression. If it is deliberate (a new lint rule raising the warning ceiling), record it with:\n'
        + '  node test/tooling/measureGuardrails.cjs --write --allow-regression "<reason>"',
    );
});

test('the committed baseline is the current measurement', () => {
    // The ratchet is tight on purpose: a metric that IMPROVED must be written
    // down too. That makes the baseline diff the recorded before/after of every
    // cleanup commit, and stops a later regression from hiding inside slack.
    const { worse, moved } = compareRatcheted(measure().ratcheted, readBaseline().ratcheted);

    assert.equal(
        moved.length,
        0,
        `These metrics moved but the baseline was not regenerated:\n${bulletList(moved)}\n`
        + 'Run `npm run guardrails:update` and commit test/tooling/guardrail-baseline.json in the same commit.',
    );
    assert.equal(worse.length, 0, 'see the previous test');
});

test('the comparison tells a regression from an improvement', () => {
    const baseline = {
        'console.total': 10,
        'console.byModule': { servers: 6, views: 4 },
        'size.filesOver500': ['src/a.ts', 'src/b.ts'],
        'eslint.maxWarnings': null,
        'commands.internalByKind': { 'pending-removal': 2, 'tree-item': 5 },
    };

    assert.deepEqual(compareRatcheted(baseline, baseline), { worse: [], moved: [] });

    const regressed = compareRatcheted({
        ...baseline,
        'console.total': 11,
        'console.byModule': { servers: 6, views: 4, utils: 1 },
        'size.filesOver500': ['src/a.ts', 'src/b.ts', 'src/c.ts'],
        'commands.internalByKind': { 'pending-removal': 3, 'tree-item': 5 },
    }, baseline);
    assert.deepEqual(regressed.worse.map((change) => change.metric), [
        'commands.internalByKind.pending-removal',
        'console.byModule.utils',
        'console.total',
        'size.filesOver500',
    ]);
    assert.equal(regressed.worse.find((change) => change.metric === 'size.filesOver500').detail, 'new: src/c.ts');
    assert.deepEqual(regressed.moved, []);

    const improved = compareRatcheted({
        ...baseline,
        'console.total': 4,
        'console.byModule': { servers: 4 },
        'size.filesOver500': ['src/a.ts'],
        'eslint.maxWarnings': 120,
        'commands.internalByKind': { 'pending-removal': 0, 'tree-item': 6 },
    }, baseline);
    assert.deepEqual(improved.worse, []);
    assert.deepEqual(improved.moved.map((change) => change.metric), [
        'commands.internalByKind.pending-removal',
        'commands.internalByKind.tree-item',
        'console.byModule.servers',
        'console.byModule.views',
        'console.total',
        'eslint.maxWarnings',
        'size.filesOver500',
    ]);

    // A lint ceiling may only come down once it exists, and may not disappear.
    assert.deepEqual(compareRatcheted({ 'eslint.maxWarnings': 130 }, { 'eslint.maxWarnings': 120 }).worse.length, 1);
    assert.deepEqual(compareRatcheted({ 'eslint.maxWarnings': null }, { 'eslint.maxWarnings': 120 }).worse.length, 1);
});
