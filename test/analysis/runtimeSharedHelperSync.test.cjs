/**
 * collectConfiguredIds and uniqueElements exist three times: once in each of the
 * analysis-mode, dependency-graph and historical-comparison XR runtimes.
 *
 * They cannot move into templates/components/common yet. An exported scene gets
 * its runtime copies re-assembled from templates/components/codexr only
 * (refreshRuntimeCopies never touches common/), so a shared provider could be
 * left stale next to a refreshed consumer that calls into it. Until that is
 * solved the three copies stay, and this suite is what stops three copies from
 * turning into three behaviours: it compares their text AND runs each of them
 * against the same inputs.
 *
 * When it goes red, port the edit to all three runtimes. When the helpers do
 * move to a single provider, retarget this suite at it: the input tables below
 * are the specification the shared helper has to meet.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { inspect, isDeepStrictEqual } = require('node:util');

const projectRoot = path.resolve(__dirname, '..', '..');
const { readAssembledRuntime } = require(path.join(projectRoot, 'test', 'helpers', 'runtimeAssembly.cjs'));
const { collectFiles, normalizeEol, readSource } = require(path.join(projectRoot, 'test', 'helpers', 'sourceText.cjs'));

const SUITE = 'test/analysis/runtimeSharedHelperSync.test.cjs';

const RUNTIMES = [
    { component: 'analysis-mode', output: 'analysisModeRuntime.js' },
    { component: 'dependency-graph', output: 'dependencyGraphRuntime.js' },
    { component: 'historical-comparison', output: 'historicalComparisonRuntime.js' },
];

const HELPERS = [
    {
        name: 'collectConfiguredIds',
        // dependency-graph spells the config parameter differently from the other
        // two. That is the one spelling difference that exists today, so it is the
        // only one tolerated; every other identifier has to match.
        freeParameterPositions: [0],
        tolerated: 'indentation and the spelling of the config parameter',
        table: collectConfiguredIdsTable,
    },
    {
        name: 'uniqueElements',
        freeParameterPositions: [],
        tolerated: 'indentation',
        table: uniqueElementsTable,
    },
];

// --- shared input tables -------------------------------------------------

function collectConfiguredIdsTable() {
    return [
        { title: 'a scalar id', args: [{ chartId: 'chart-1' }, ['chartId']], expected: ['chart-1'] },
        { title: 'an array of ids', args: [{ chartEntityIds: ['a', 'b'] }, ['chartEntityIds']], expected: ['a', 'b'] },
        {
            title: 'the key list, not the config, sets the order',
            args: [{ chartId: 'c', normalEntityIds: ['a', 'b'] }, ['normalEntityIds', 'chartId']],
            expected: ['a', 'b', 'c'],
        },
        {
            title: 'keys the config does not have are skipped',
            args: [{ chartId: 'c' }, ['normalRootId', 'chartId', 'dataEntityId']],
            expected: ['c'],
        },
        { title: 'no keys, no ids', args: [{ chartId: 'c' }, []], expected: [] },
        {
            // Callers that need distinct ids de-duplicate afterwards; the helper
            // itself reports every configured occurrence.
            title: 'an id repeated within and across keys is reported every time',
            args: [{ chartEntityIds: ['a', 'a'], chartEntityId: 'a' }, ['chartEntityIds', 'chartEntityId']],
            expected: ['a', 'a', 'a'],
        },
        {
            title: 'falsy entries of an array are dropped',
            args: [{ ids: ['', null, undefined, 0, false, NaN, 'x'] }, ['ids']],
            expected: ['x'],
        },
        {
            title: 'falsy scalars are dropped',
            args: [{ a: '', b: 0, c: null, d: false, e: undefined, f: NaN, g: 'kept' }, ['a', 'b', 'c', 'd', 'e', 'f', 'g']],
            expected: ['kept'],
        },
        { title: 'an empty array contributes nothing', args: [{ ids: [], id: 'x' }, ['ids', 'id']], expected: ['x'] },
        {
            title: 'ids that are not strings are stringified',
            args: [{ ids: [7, true, 1.5], id: 42 }, ['ids', 'id']],
            expected: ['7', 'true', '1.5', '42'],
        },
        {
            title: 'a nested object is stringified whole, never traversed',
            args: [{ chart: { id: 'inner' } }, ['chart']],
            expected: ['[object Object]'],
        },
        {
            title: 'a nested array is stringified whole, never flattened',
            args: [{ ids: [['a', 'b'], 'c'] }, ['ids']],
            expected: ['a,b', 'c'],
        },
        { title: 'a null config yields nothing', args: [null, ['chartId']], expected: [] },
        { title: 'an undefined config yields nothing', args: [undefined, ['chartId']], expected: [] },
        { title: 'a config that is not an object yields nothing', args: ['chart-1', ['chartId']], expected: [] },
    ];
}

function uniqueElementsTable() {
    // Stand-ins for DOM elements: identity is what the helper compares.
    const chart = { id: 'chart' };
    const legend = { id: 'legend' };
    const chartTwin = { id: 'chart' };
    return [
        {
            title: 'repeats collapse onto their first occurrence and order is kept',
            args: [[legend, chart, legend, chart]],
            expected: [legend, chart],
        },
        { title: 'identity decides, not structure', args: [[chart, chartTwin, chart]], expected: [chart, chartTwin] },
        {
            title: 'null, undefined and every other falsy entry are dropped',
            args: [[null, chart, undefined, 0, '', false, NaN, legend]],
            expected: [chart, legend],
        },
        { title: 'scalars are compared strictly', args: [['a', 'a', 1, '1', 1]], expected: ['a', 1, '1'] },
        { title: 'a list with nothing to drop comes back whole', args: [[chart, legend]], expected: [chart, legend] },
        { title: 'an empty list', args: [[]], expected: [] },
    ];
}

function sameSequence(actual, expected) {
    return Array.isArray(actual)
        && actual.length === expected.length
        && actual.every((value, index) => value === expected[index]);
}

/** Runs one implementation over a table and returns what it got wrong. */
function tableFailures(implementation, rows) {
    const failures = [];
    for (const row of rows) {
        const argumentsBefore = structuredClone(row.args);
        let actual;
        try {
            actual = implementation(...row.args);
        } catch (error) {
            failures.push(`${row.title}: threw ${error}`);
            continue;
        }
        if (!sameSequence(actual, row.expected)) {
            failures.push(`${row.title}: expected ${inspect(row.expected)}, got ${inspect(actual)}`);
        }
        // The config is parsed once and shared, and the key lists are literals
        // in the callers: a helper that edits either one corrupts the next call.
        if (!isDeepStrictEqual(row.args, argumentsBefore)) {
            failures.push(`${row.title}: the arguments were modified`);
        }
    }
    return failures;
}

// --- extraction ----------------------------------------------------------

function escapeRegExp(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Matches `name` as a whole identifier, and not as a property access. */
function identifierPattern(name) {
    return new RegExp(`(?<![\\w$.])${escapeRegExp(name)}(?![\\w$])`, 'g');
}

function declarationAnchorSource(name) {
    return `(?<![\\w$.])function\\s+${escapeRegExp(name)}\\s*\\(`;
}

/**
 * Every spelling that gives `name` a function body: a declaration, or a function
 * or arrow assigned to a variable, a property or an object key. Wider than the
 * extractor's anchor on purpose: a fourth copy does not have to be spelled like
 * the first three to drift away from them.
 */
function definitionAnchorSource(name) {
    const assigned = `(?<![\\w$])${escapeRegExp(name)}\\s*[:=]\\s*(?:async\\s+)?(?:function\\b|\\(|[A-Za-z_$][\\w$]*\\s*=>)`;
    return `${declarationAnchorSource(name)}|${assigned}`;
}

/** The directories holding a file that defines `name`, out of `[{ file, text }]`. */
function ownerDirectories(name, texts) {
    const definition = new RegExp(definitionAnchorSource(name));
    const owners = texts.filter(({ text }) => definition.test(text)).map(({ file }) => path.posix.dirname(file));
    return [...new Set(owners)].sort();
}

function skipQuoted(source, start, label) {
    const quote = source[start];
    for (let index = start + 1; index < source.length; index += 1) {
        if (source[index] === '\\') {
            index += 1;
        } else if (source[index] === quote) {
            return index + 1;
        }
    }
    throw new Error(`${label}: unterminated ${quote} literal while scanning a declaration`);
}

/**
 * Index of the bracket that closes the one at `openIndex`, skipping brackets
 * inside strings, template literals and comments. Regex literals are not
 * tokenized: a bracket or quote inside one derails the scan, and that surfaces
 * as a syntax error when the extracted text is compiled, never as a silent
 * wrong cut.
 */
function findClosing(source, openIndex, label) {
    const open = source[openIndex];
    const close = open === '(' ? ')' : '}';
    let depth = 0;
    let index = openIndex;
    while (index < source.length) {
        const char = source[index];
        if (char === '/' && source[index + 1] === '/') {
            const lineEnd = source.indexOf('\n', index);
            index = lineEnd === -1 ? source.length : lineEnd;
        } else if (char === '/' && source[index + 1] === '*') {
            const commentEnd = source.indexOf('*/', index + 2);
            if (commentEnd === -1) {
                throw new Error(`${label}: unterminated block comment while scanning a declaration`);
            }
            index = commentEnd + 2;
        } else if (char === '\'' || char === '"' || char === '`') {
            index = skipQuoted(source, index, label);
        } else {
            if (char === open) {
                depth += 1;
            } else if (char === close) {
                depth -= 1;
                if (depth === 0) {
                    return index;
                }
            }
            index += 1;
        }
    }
    throw new Error(`${label}: no matching "${close}" for the "${open}" at offset ${openIndex}`);
}

/** Cuts `function <name>(...) { ... }` out of a runtime, from the keyword to its closing brace. */
function extractDeclaration(source, name, label) {
    const anchors = [...source.matchAll(new RegExp(declarationAnchorSource(name), 'g'))];
    assert.equal(
        anchors.length,
        1,
        `${label}: expected exactly one "function ${name}(" declaration, found ${anchors.length}. `
        + `The helper was renamed, removed or declared twice: update ${SUITE} in the same commit.`,
    );

    const start = anchors[0].index;
    const parametersOpen = start + anchors[0][0].length - 1;
    const parametersClose = findClosing(source, parametersOpen, label);
    const bodyOpen = source.indexOf('{', parametersClose);
    assert.ok(
        bodyOpen !== -1 && source.slice(parametersClose + 1, bodyOpen).trim() === '',
        `${label}: "function ${name}(...)" is not followed by a body`,
    );
    const end = findClosing(source, bodyOpen, label) + 1;

    const parameters = source.slice(parametersOpen + 1, parametersClose)
        .split(',')
        .map((parameter) => parameter.trim())
        .filter((parameter) => parameter.length > 0);
    for (const parameter of parameters) {
        // Renaming a parameter is only a sound normalization for plain names.
        assert.match(
            parameter,
            /^[A-Za-z_$][\w$]*$/,
            `${label}: ${name} no longer takes plain identifiers as parameters (${parameter}); rework the comparison in ${SUITE}`,
        );
    }

    return { label, name, start, end, bodyOpen: bodyOpen - start, parameters, text: source.slice(start, end) };
}

/**
 * Compiles one copy ALONE, in strict mode like the runtime IIFEs it comes from.
 * A copy that starts reading runtime state (root, refs, state...) is no longer
 * the same pure helper as its siblings, and fails here with a ReferenceError.
 */
function instantiate(declaration) {
    const compiled = vm.runInThisContext(
        `'use strict';\n(${declaration.text}\n)`,
        { filename: `${declaration.label}#${declaration.name}` },
    );
    assert.equal(typeof compiled, 'function', `${declaration.label}: the extracted text is not a function`);
    assert.equal(compiled.name, declaration.name, `${declaration.label}: the extractor cut the wrong function`);
    return compiled;
}

// --- comparison ----------------------------------------------------------

let cachedSources = null;

function loadRuntimeSources() {
    if (!cachedSources) {
        cachedSources = {};
        for (const runtime of RUNTIMES) {
            // Assembled, not per part file: what ships is the concatenation, and a
            // helper that moves to another part of the same runtime is still in sync.
            cachedSources[runtime.output] = normalizeEol(readAssembledRuntime(runtime.component, runtime.output));
        }
    }
    return cachedSources;
}

/** Removes only what may legitimately differ between copies. */
function normalizeCopy(helper, declaration) {
    let text = declaration.text;
    for (const position of helper.freeParameterPositions) {
        assert.ok(
            position < declaration.parameters.length,
            `${declaration.label}: ${helper.name} has no parameter ${position} any more; rework freeParameterPositions in ${SUITE}`,
        );
        text = text.replace(identifierPattern(declaration.parameters[position]), `<parameter ${position}>`);
    }
    return text.split('\n').map((line) => line.trim()).join('\n');
}

function describeFirstDifference(reference, copy) {
    const referenceLines = reference.normalized.split('\n');
    const copyLines = copy.normalized.split('\n');
    const index = referenceLines.findIndex((line, position) => line !== copyLines[position]);
    const position = index === -1 ? referenceLines.length : index;
    return [
        `${copy.output} and ${reference.output} part ways at line ${position + 1} of the helper:`,
        `    ${reference.output}: ${inspect(referenceLines[position])}`,
        `    ${copy.output}: ${inspect(copyLines[position])}`,
    ].join('\n');
}

function findDivergences(helper, sources) {
    const [reference, ...others] = RUNTIMES.map((runtime) => ({
        output: runtime.output,
        normalized: normalizeCopy(helper, extractDeclaration(sources[runtime.output], helper.name, runtime.output)),
    }));
    return others
        .filter((copy) => copy.normalized !== reference.normalized)
        .map((copy) => describeFirstDifference(reference, copy));
}

/** The runtime sources with one copy of one helper rewritten, in memory only. */
function withEditedCopy(sources, runtime, helper, edit) {
    const source = sources[runtime.output];
    const declaration = extractDeclaration(source, helper.name, runtime.output);
    return {
        ...sources,
        [runtime.output]: source.slice(0, declaration.start) + edit(declaration) + source.slice(declaration.end),
    };
}

// --- the contract --------------------------------------------------------

function expectedOwnerDirectories() {
    return RUNTIMES
        .map((runtime) => `templates/components/codexr/${runtime.component}/${runtime.output.replace(/\.js$/, '')}`)
        .sort();
}

test('collectConfiguredIds and uniqueElements are defined in the three synced runtimes and nowhere else under templates/', () => {
    const texts = collectFiles('templates', { extensions: ['.js', '.html'] })
        .map((file) => ({ file, text: readSource(file) }));

    for (const helper of HELPERS) {
        const owners = ownerDirectories(helper.name, texts);

        // A fourth copy that this suite does not know about would diverge in
        // silence, which is exactly what the suite exists to prevent.
        assert.deepEqual(
            owners,
            expectedOwnerDirectories(),
            `${helper.name} is defined under [${owners.join(', ')}]. It gained or lost a copy: add the new runtime to `
            + `RUNTIMES in ${SUITE}, or retarget the suite if the helper moved to a shared provider`,
        );
    }
});

for (const helper of HELPERS) {
    test(`the three copies of ${helper.name} are identical apart from ${helper.tolerated}`, () => {
        const divergences = findDivergences(helper, loadRuntimeSources());

        assert.equal(
            divergences.length,
            0,
            [`${helper.name} is kept in three runtimes on purpose; an edit to one copy has to be ported to the other two.`]
                .concat(divergences)
                .join('\n'),
        );
    });

    test(`every copy of ${helper.name} runs on its own and returns today's results for the shared input table`, () => {
        const sources = loadRuntimeSources();

        for (const runtime of RUNTIMES) {
            const copy = instantiate(extractDeclaration(sources[runtime.output], helper.name, runtime.output));
            const failures = tableFailures(copy, helper.table());

            assert.equal(failures.length, 0, `${runtime.output} ${helper.name}:\n${failures.join('\n')}`);
        }
    });
}

// --- proof that the suite can fail ---------------------------------------

test('the declaration extractor follows nested braces, ignores braces in strings and comments, and refuses a missing or repeated anchor', () => {
    const tricky = [
        '  function target(first, second) {',
        '    var text = \'}\' + "{{" + `}${first}`; // }}}',
        '    /* { */',
        '    if (first) { return { nested: { deep: second } }; }',
        '    return null;',
        '  }',
        '  function after() { return 1; }',
    ].join('\n');

    const declaration = extractDeclaration(tricky, 'target', 'synthetic');

    assert.deepEqual(declaration.parameters, ['first', 'second']);
    assert.ok(declaration.text.startsWith('function target(first, second) {'));
    assert.ok(declaration.text.endsWith('return null;\n  }'), 'the cut stops at the brace that closes the declaration');
    assert.equal(instantiate(declaration)(1, 2).nested.deep, 2);
    assert.equal(instantiate(declaration)(0, 2), null);

    assert.throws(() => extractDeclaration(tricky, 'missing', 'synthetic'), /exactly one "function missing\(" declaration, found 0/);
    assert.throws(() => extractDeclaration(`${tricky}\n${tricky}`, 'target', 'synthetic'), /found 2/);
    assert.throws(() => extractDeclaration('function target(first) { if (first) { return 1; }', 'target', 'synthetic'), /no matching "}"/);
    assert.throws(() => extractDeclaration('function target({ first }) { return first; }', 'target', 'synthetic'), /plain identifiers/);
});

test('the ownership scan sees a copy however it is spelled, and takes neither a call nor a re-export for one', () => {
    const synced = expectedOwnerDirectories().map((directory) => ({
        file: `${directory}/part.js`,
        text: '  function uniqueElements(elements) {\n    return elements;\n  }\n  return uniqueElements(roots);',
    }));
    const bystanders = [
        'return uniqueElements(roots);',
        'refs.originalCharts = uniqueElements(roots);',
        'var api = { uniqueElements: uniqueElements };',
        'if (uniqueElements === (other)) { return; }',
        'function uniqueElementsByKey(elements) {}',
        'function myuniqueElements(elements) {}',
    ].map((text, index) => ({ file: `templates/components/bystander-${index}/runtime.js`, text }));

    assert.deepEqual(ownerDirectories('uniqueElements', synced.concat(bystanders)), expectedOwnerDirectories());

    const spellings = [
        'function uniqueElements(elements) {}',
        'function  uniqueElements (elements) {}',
        'var uniqueElements = function (elements) {};',
        'const uniqueElements = (elements) => elements;',
        'const uniqueElements = elements => elements;',
        'const uniqueElements = async (elements) => elements;',
        'CodeXRCommon.uniqueElements = function (elements) {};',
        'var api = { uniqueElements: function (elements) {} };',
    ];
    for (const spelling of spellings) {
        const fourth = { file: 'templates/components/common/shared.js', text: spelling };

        assert.deepEqual(
            ownerDirectories('uniqueElements', synced.concat(bystanders, [fourth])),
            expectedOwnerDirectories().concat('templates/components/common').sort(),
            `a fourth copy spelled "${spelling}" went unnoticed`,
        );
    }

    // A copy that disappears from one runtime is a lost owner, not a smaller set that still passes.
    assert.notDeepEqual(ownerDirectories('uniqueElements', synced.slice(1).concat(bystanders)), expectedOwnerDirectories());
});

test('an edit to any single copy is reported, and so is a renamed parameter unless that parameter is the tolerated one', () => {
    // Three stand-ins cut from ONE real runtime: this proof is about the
    // comparison, so it must not turn red as well on the day the real copies drift.
    const [origin] = RUNTIMES;
    const originSource = loadRuntimeSources()[origin.output];
    const standIn = HELPERS
        .map((helper) => extractDeclaration(originSource, helper.name, origin.output).text)
        .join('\n\n');
    const sources = Object.fromEntries(RUNTIMES.map((runtime) => [runtime.output, standIn]));

    for (const helper of HELPERS) {
        assert.deepEqual(findDivergences(helper, sources), []);

        for (const runtime of RUNTIMES) {
            const label = `${helper.name} in ${runtime.output}`;

            const withExtraStatement = withEditedCopy(sources, runtime, helper, (declaration) => (
                `${declaration.text.slice(0, declaration.bodyOpen + 1)} void 0;${declaration.text.slice(declaration.bodyOpen + 1)}`
            ));
            assert.notEqual(findDivergences(helper, withExtraStatement).length, 0, `${label}: an extra statement went unnoticed`);

            const { parameters } = extractDeclaration(sources[runtime.output], helper.name, runtime.output);
            assert.notEqual(parameters.length, 0, `${label}: there is no parameter to rename, so the loop below would prove nothing`);
            parameters.forEach((parameter, position) => {
                const withRenamedParameter = withEditedCopy(sources, runtime, helper, (declaration) => (
                    declaration.text.replace(identifierPattern(parameter), 'renamedForThisTest')
                ));
                const divergences = findDivergences(helper, withRenamedParameter);

                if (helper.freeParameterPositions.includes(position)) {
                    assert.deepEqual(divergences, [], `${label}: parameter ${position} may be spelled freely`);
                } else {
                    assert.notEqual(divergences.length, 0, `${label}: renaming parameter ${position} (${parameter}) went unnoticed`);
                }
            });
        }
    }
});

test('the shared input tables accept a faithful rewrite of each helper and reject the plausible wrong ones', () => {
    const configuredValues = (config, key) => [].concat(config?.[key] ?? []);
    const rewrites = {
        collectConfiguredIds: {
            faithful: (config, keys) => keys.flatMap((key) => configuredValues(config, key).filter(Boolean).map(String)),
            wrong: {
                'de-duplicates': (config, keys) => [...new Set(keys.flatMap((key) => configuredValues(config, key).filter(Boolean).map(String)))],
                'does not stringify': (config, keys) => keys.flatMap((key) => configuredValues(config, key).filter(Boolean)),
                'only drops null and undefined': (config, keys) => keys.flatMap((key) => configuredValues(config, key).filter((id) => id !== null && id !== undefined).map(String)),
                'flattens nested arrays': (config, keys) => keys.flatMap((key) => configuredValues(config, key).flat(Infinity).filter(Boolean).map(String)),
                'follows the config key order': (config, keys) => Object.keys(config || {})
                    .filter((key) => keys.includes(key))
                    .flatMap((key) => configuredValues(config, key).filter(Boolean).map(String)),
                'requires a config object': (config, keys) => keys.flatMap((key) => [].concat(config[key] ?? []).filter(Boolean).map(String)),
                'consumes the key list': (config, keys) => {
                    const ids = [];
                    while (keys.length > 0) {
                        ids.push(...configuredValues(config, keys.shift()).filter(Boolean).map(String));
                    }
                    return ids;
                },
            },
        },
        uniqueElements: {
            faithful: (elements) => [...new Set(elements)].filter(Boolean),
            wrong: {
                'keeps falsy entries': (elements) => elements.filter((element, index) => elements.indexOf(element) === index),
                'compares by structure': (elements) => {
                    const seen = new Set();
                    return elements.filter((element) => {
                        const key = JSON.stringify(element);
                        return !!element && !seen.has(key) && !!seen.add(key);
                    });
                },
                'keeps the last occurrence': (elements) => elements.filter((element, index) => !!element && elements.lastIndexOf(element) === index),
                'de-duplicates in place': (elements) => {
                    for (let index = elements.length - 1; index >= 0; index -= 1) {
                        if (!elements[index] || elements.indexOf(elements[index]) !== index) {
                            elements.splice(index, 1);
                        }
                    }
                    return elements;
                },
            },
        },
    };

    for (const helper of HELPERS) {
        const { faithful, wrong } = rewrites[helper.name];

        // The tables pin results, not the shape of the implementation.
        assert.deepEqual(tableFailures(faithful, helper.table()), []);
        for (const [flaw, implementation] of Object.entries(wrong)) {
            assert.notEqual(
                tableFailures(implementation, helper.table()).length,
                0,
                `no row of the ${helper.name} table notices an implementation that ${flaw}`,
            );
        }
    }
});
