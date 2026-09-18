const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const { createRequire } = require('node:module');

const { projectRoot, readSource, assertAbsent } = require('../helpers/sourceText.cjs');
const { getAllSupportedExtensions } = require('../../out/utils/supportedLanguages.js');
const { scanDirectoryScope } = require('../../out/code_analysis/engine/watchers/directorySnapshot.js');

// The directory watcher and the metric contract disagree on which files are
// source code, and users' data depends on the disagreement.
//
// A full directory analysis lets Python choose the files, so it only ever sees
// the metric contract (metric_language_contract.py, mirrored on the TypeScript
// side by supportedLanguages.ts). The incremental path chooses them in
// TypeScript: the directory scan and the fs-event filter gate on
// DIRECTORY_ANALYSIS_EXTENSIONS, which is wider, and every file they admit is
// handed to the Python re-analysis coordinator, which does not filter by
// extension. That is the only road by which a .rs, .jsx or .r file reaches the
// analyzers, so their Rust, JSX and R arms look dead from the contract and are
// not.
//
// Narrowing the watcher to the contract changes which files show up in the
// data.json of a session that already exists. That is a 1.3.0 decision. Until
// then this suite pins the difference, in both directions and against both
// copies of the contract, so that neither a cleanup of analysisFilePolicy.ts nor
// an "unreachable branch" deletion in the Python tools can move it silently.

const POLICY_MODULE = path.join(projectRoot, 'out', 'code_analysis', 'engine', 'watchers', 'analysisFilePolicy.js');
const PYTHON_CONTRACT_SOURCE = 'src/code_analysis/python/utils/metric_language_contract.py';

// This list IS the contract, so it is written out instead of derived: the
// extensions a live directory session re-analyses although no copy of the metric
// contract lists them. Python labels such a file "Unknown" and still measures
// it, and three analyzer arms exist only for them: '.rs' and '.jsx' in
// class_counter_analyzer.py, '.r' in python_comment_analyzer.py.
const OUTSIDE_THE_CONTRACT = [
    '.bash', '.clj', '.cljs', '.css', '.dart', '.hs', '.jsx', '.less',
    '.ml', '.mli', '.pas', '.ps1', '.r', '.rs', '.scss', '.sh',
];

// HTML is rendered by the DOM visualization and never measured, so it is the one
// family the TypeScript language table lists and the watcher must not pick up.
const DOM_ONLY = ['.htm', '.html', '.xhtml'];

// An extension no artefact lists, for the self-checks at the end of the suite.
const SENTINEL = '.codexr-sentinel';

function uniqueSorted(extensions) {
    return Array.from(new Set(extensions)).sort();
}

function difference(left, right) {
    const excluded = new Set(right);
    return left.filter((extension) => !excluded.has(extension));
}

/**
 * DIRECTORY_ANALYSIS_EXTENSIONS is module-private and no exported predicate can
 * enumerate it. The compiled module is therefore evaluated as a script in its
 * own context: the top-level `const` bindings of a script stay readable by later
 * scripts of the same context, so the real Set is read after it was built. A
 * regex over the TypeScript literal would turn red on a reformat and would
 * under-read a set that is one day assembled from spreads.
 * The module requires `path` and supportedLanguages only, so no fake vscode.
 */
function loadWatcherPolicy(compiledSource = fs.readFileSync(POLICY_MODULE, 'utf8')) {
    const sandbox = vm.createContext({ exports: {}, require: createRequire(POLICY_MODULE) });
    vm.runInContext(compiledSource, sandbox, { filename: POLICY_MODULE });

    let extensions;
    try {
        extensions = vm.runInContext('DIRECTORY_ANALYSIS_EXTENSIONS', sandbox);
    } catch (error) {
        throw new Error(
            'analysisFilePolicy no longer declares DIRECTORY_ANALYSIS_EXTENSIONS at module scope. This suite reads '
            + 'that binding to enumerate what the watcher admits: retarget loadWatcherPolicy in the same commit '
            + `(${error.message}).`,
        );
    }

    return {
        policy: sandbox.exports,
        // Copied into this realm, because deepEqual also compares prototypes.
        extensions: uniqueSorted(Array.from(extensions, String)),
    };
}

// The three links of the Python chain, and the in-place edits that would grow or
// shrink one of them without a row being written into the literal.
const PYTHON_CHAIN = ['_LANGUAGE_SPECS', 'EXTENSION_LANGUAGE_MAP', 'SUPPORTED_METRIC_EXTENSIONS'];
const PYTHON_SIDE_ROUTE = new RegExp(
    `\\b(?:${PYTHON_CHAIN.join('|')})\\s*`
    + '(?:\\.\\s*(?:append|extend|insert|update|setdefault|pop|popitem|clear|remove)\\s*\\(|[-+|*]=)'
    + `|\\bdel\\s+(?:${PYTHON_CHAIN.join('|')})\\b`,
);

/**
 * SUPPORTED_METRIC_EXTENSIONS is computed, not written out: it is the keys of
 * EXTENSION_LANGUAGE_MAP, which a single loop fills from the _LANGUAGE_SPECS
 * literal. Reading the literal is only valid while that chain holds, so the
 * chain is checked first. A contract that starts taking extensions from anywhere
 * else has to fail here instead of being half-read: a reader that kept
 * answering with the literal would hold every pin below green over a contract
 * that had moved.
 */
function parsePythonMetricExtensions(pythonSource) {
    const reshaped = `${PYTHON_CONTRACT_SOURCE} no longer builds SUPPORTED_METRIC_EXTENSIONS from the _LANGUAGE_SPECS `
        + 'literal alone. This suite parses that literal instead of spawning Python: teach parsePythonMetricExtensions '
        + 'the new shape in the same commit.';

    // The public list is a plain view of the map's keys, the map is born empty,
    // and its only subscript writer sits in the loop over the literal.
    assert.match(
        pythonSource,
        /^SUPPORTED_METRIC_EXTENSIONS\b[^=\n]*=\s*(?:sorted|list)\(EXTENSION_LANGUAGE_MAP(?:\.keys\(\))?\)[ \t]*$/m,
        reshaped,
    );
    assert.match(pythonSource, /^EXTENSION_LANGUAGE_MAP\b[^=\n]*=\s*\{\}[ \t]*$/m, reshaped);
    assert.match(
        pythonSource,
        /^for [^\n]+ in _LANGUAGE_SPECS:\n(?:[ \t]+[^\n]*\n)*?[ \t]+EXTENSION_LANGUAGE_MAP\[\w+\]\s*=/m,
        reshaped,
    );
    assert.equal((pythonSource.match(/\bEXTENSION_LANGUAGE_MAP\[[^\]\n]+\]\s*=(?!=)/g) || []).length, 1, reshaped);

    // No link is bound twice, and none is edited in place.
    for (const name of PYTHON_CHAIN) {
        const bindings = pythonSource.match(new RegExp(`^[ \\t]*${name}\\b(?!\\s*\\[)[^=\\n]*=(?!=)`, 'gm')) || [];
        assert.equal(bindings.length, 1, reshaped);
    }
    assertAbsent(pythonSource, PYTHON_SIDE_ROUTE, { canary: /^_LANGUAGE_SPECS\b/m, message: reshaped });

    const literal = /^_LANGUAGE_SPECS\b[^=\n]*=\s*\[\n([\s\S]*?)\n\]/m.exec(pythonSource);
    assert.ok(literal, reshaped);

    // Language names ("C++", "C#") never start with a dot, extensions always do.
    const extensions = Array.from(literal[1].matchAll(/(['"])(\.[^'"\s]+)\1/g), (match) => match[2]);
    assert.ok(extensions.length > 0, reshaped);
    return uniqueSorted(extensions);
}

let loadedContracts = null;

// Loaded on first use, inside a test, so that a failure to read either artefact
// is reported as a failing test and not as a suite that could not be required.
function loadContracts() {
    if (!loadedContracts) {
        const watcher = loadWatcherPolicy();
        const typescript = uniqueSorted(getAllSupportedExtensions());
        const python = parsePythonMetricExtensions(readSource(PYTHON_CONTRACT_SOURCE));
        loadedContracts = {
            policy: watcher.policy,
            watcher: watcher.extensions,
            typescript,
            python,
            everyKnownExtension: uniqueSorted([...watcher.extensions, ...typescript, ...python]),
        };
    }
    return loadedContracts;
}

function assertSameExtensions(actual, expected, consequence) {
    // A custom message replaces the diff node would print, so the message carries it.
    assert.deepEqual(
        actual,
        uniqueSorted(expected),
        `${consequence} No longer there: ${JSON.stringify(difference(expected, actual))}. `
        + `New: ${JSON.stringify(difference(actual, expected))}.`,
    );
}

/**
 * The extensions a gate lets through, asked in both spellings. Every gate
 * lower-cases the extension before it looks, and so do the Python analyzers:
 * 'analysis.R' is the usual name of an R script, and it has to keep reaching
 * the '.r' arm exactly as 'analysis.r' does.
 */
function admittedBy(gate, extensions) {
    const admitted = extensions.filter((extension) => gate(`sample${extension}`));
    assert.deepEqual(
        extensions.filter((extension) => gate(`SAMPLE${extension.toUpperCase()}`)),
        admitted,
        'A gate must admit an upper-case extension exactly when it admits the lower-case one.',
    );
    return admitted;
}

const DATA_CHANGE = 'Changing what the watcher admits beyond the metric contract changes which files appear in the '
    + 'data.json of existing sessions: that is a 1.3.0 decision, not a cleanup.';

test('the directory watcher admits exactly sixteen extensions that the TypeScript language table does not list', () => {
    const { watcher, typescript } = loadContracts();

    // Sixteen is the number the audit and the roadmap quote, so the list above
    // cannot be edited without this title and those documents being revisited.
    assert.equal(new Set(OUTSIDE_THE_CONTRACT).size, 16);
    assertSameExtensions(difference(watcher, typescript), OUTSIDE_THE_CONTRACT, DATA_CHANGE);
});

test('the directory watcher admits exactly the same sixteen extensions that the Python metric contract does not list', () => {
    const { watcher, python } = loadContracts();

    // Python is the side that measures the file. An extension moving INTO its
    // contract is as visible to users as one leaving the watcher: the file stops
    // being labelled "Unknown" and the full analysis starts picking it up too.
    assertSameExtensions(difference(watcher, python), OUTSIDE_THE_CONTRACT, DATA_CHANGE);
});

test('the only contract extensions the directory watcher ignores are the DOM-only HTML ones', () => {
    const { watcher, typescript, python } = loadContracts();

    // A metric extension the watcher ignored would be measured by the full
    // analysis and then never re-measured when the file is saved: a live session
    // showing stale numbers for one language. So a language added to the contract
    // has to reach the watcher in the same commit.
    const staleLanguage = 'A metric extension the watcher ignores is analysed once and never refreshed on save.';
    assertSameExtensions(difference(python, watcher), [], staleLanguage);
    assertSameExtensions(difference(typescript, watcher), DOM_ONLY, staleLanguage);
});

test('isMetricAnalysisFile stays the contract-sized gate, equal to the Python metric contract', () => {
    const { policy, python, everyKnownExtension } = loadContracts();

    // The git-history export deduplicates blobs with this predicate precisely
    // because it must NOT follow the wider watcher set. It is the TypeScript
    // statement of "inside the contract", so it is what the sixteen are outside of.
    assertSameExtensions(
        admittedBy(policy.isMetricAnalysisFile, everyKnownExtension),
        python,
        'isMetricAnalysisFile and the Python metric contract must describe the same files.',
    );
});

test('isDirectoryAnalysisFile and the fs-event filter admit the whole watcher set, not the contract-sized one', () => {
    const { policy, watcher, everyKnownExtension } = loadContracts();

    // The Set is only a declaration. These two exports are what the directory
    // scan, the fs-event handler and the git materializer actually call, so
    // swapping one of them for the narrower predicate is the realistic way to
    // lose the sixteen while the declaration stays untouched.
    assertSameExtensions(admittedBy(policy.isDirectoryAnalysisFile, everyKnownExtension), watcher, DATA_CHANGE);

    // No tracked paths: a path the tracker already knows is relevant whatever
    // its extension, which would hide the gate this assertion is about.
    const untrackedEvent = (fileName) => policy.isRelevantDirectoryEvent(path.join('workspace', fileName), new Set());
    assertSameExtensions(admittedBy(untrackedEvent, everyKnownExtension), watcher, DATA_CHANGE);
});

test('a directory scan hands the files outside the metric contract to the incremental re-analysis, and no HTML', async () => {
    // scanDirectoryScope is loaded the way production loads it. Whatever it lists
    // and the hash tracker does not know yet is sent to Python as an added file.
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-watcher-contract-'));

    try {
        for (const extension of [...OUTSIDE_THE_CONTRACT, ...DOM_ONLY, '.ts']) {
            fs.writeFileSync(path.join(root, `sample${extension}`), '\n');
        }

        const snapshot = await scanDirectoryScope(root, false);

        assert.deepEqual(
            snapshot.files.map((entry) => path.basename(entry.filePath)).sort(),
            [...OUTSIDE_THE_CONTRACT, '.ts'].map((extension) => `sample${extension}`).sort(),
        );
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('both readers see a change made to either artefact, so the pins above cannot pass by reading nothing', () => {
    const { watcher, python } = loadContracts();

    // Deliberately not tied to today's sixteen: it drops whichever extension
    // comes first and adds one that exists nowhere, so this test only fails when
    // a reader stops reading, never because the contract legitimately moved.
    const [dropped] = watcher;
    const invented = SENTINEL;
    assert.equal(watcher.includes(invented) || python.includes(invented), false);

    // The watcher side, narrowed and widened in memory. The edit is appended to
    // the compiled script, so it does not depend on how the literal is formatted.
    const edited = loadWatcherPolicy(
        `${fs.readFileSync(POLICY_MODULE, 'utf8')}\n`
        + `DIRECTORY_ANALYSIS_EXTENSIONS.delete(${JSON.stringify(dropped)});\n`
        + `DIRECTORY_ANALYSIS_EXTENSIONS.add(${JSON.stringify(invented)});\n`,
    );
    assert.deepEqual(difference(watcher, edited.extensions), [dropped]);
    assert.deepEqual(difference(edited.extensions, watcher), [invented]);
    assert.throws(
        () => assertSameExtensions(edited.extensions, watcher, DATA_CHANGE),
        (error) => error.message.includes(
            `${DATA_CHANGE} No longer there: ${JSON.stringify([dropped])}. New: ${JSON.stringify([invented])}.`,
        ),
    );

    // The Python side, with one more language written into the literal.
    const pythonSource = readSource(PYTHON_CONTRACT_SOURCE);
    const extended = parsePythonMetricExtensions(
        pythonSource.replace(/^(_LANGUAGE_SPECS\b[^\n]*\n)/m, `$1    ("Sentinel", ["${invented}"]),\n`),
    );
    assert.deepEqual(difference(extended, python), [invented]);
    assert.deepEqual(difference(python, extended), []);
});

test('the Python contract reader refuses a contract that is fed from anywhere but the _LANGUAGE_SPECS literal', () => {
    // Python is never spawned, so the literal is the whole contract only while
    // nothing else feeds the map or the public list. Each edit below is a way of
    // adding a language without writing it into the literal. A reader that kept
    // answering with the unchanged literal would leave every pin above green
    // while '.rs' had in fact moved into the contract.
    const pythonSource = readSource(PYTHON_CONTRACT_SOURCE);
    const sideRoutes = [
        (source) => `${source}\nEXTENSION_LANGUAGE_MAP["${SENTINEL}"] = "Sentinel"\n`,
        (source) => `${source}\nEXTENSION_LANGUAGE_MAP.update({"${SENTINEL}": "Sentinel"})\n`,
        (source) => `${source}\nEXTENSION_LANGUAGE_MAP |= {"${SENTINEL}": "Sentinel"}\n`,
        (source) => `${source}\n_LANGUAGE_SPECS.append(("Sentinel", ["${SENTINEL}"]))\n`,
        (source) => `${source}\n_LANGUAGE_SPECS += [("Sentinel", ["${SENTINEL}"])]\n`,
        (source) => `${source}\nSUPPORTED_METRIC_EXTENSIONS = SUPPORTED_METRIC_EXTENSIONS + ["${SENTINEL}"]\n`,
        (source) => source.replace(/^(EXTENSION_LANGUAGE_MAP\b[^=\n]*=\s*)\{\}/m, `$1{"${SENTINEL}": "Sentinel"}`),
        (source) => source.replace(/^(SUPPORTED_METRIC_EXTENSIONS\b[^=\n]*=\s*)([^\n]+)$/m, `$1$2 + ["${SENTINEL}"]`),
    ];

    for (const sideRoute of sideRoutes) {
        const edited = sideRoute(pythonSource);

        assert.ok(edited.includes(SENTINEL), `${sideRoute} did not edit the contract source`);
        assert.throws(
            () => parsePythonMetricExtensions(edited),
            /no longer builds SUPPORTED_METRIC_EXTENSIONS from the _LANGUAGE_SPECS literal alone/,
            `${sideRoute} must be refused`,
        );
    }
});
