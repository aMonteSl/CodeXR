const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { projectRoot, readSource } = require('../helpers/sourceText.cjs');
// The asset family never imports `vscode`, so the compiled barrel loads as it is.
const components = require('../../out/code_analysis/engine/components/customComponents/index.js');

/*
 * fileXRParser.ts copies a run of runtime assets into the scene folder and then
 * refuses to go on ('XR file bootstrap did not generate the required files.')
 * unless a second, hand-written list of files is there. The two lists look like
 * one list typed twice, and the v1.2.1 audit proposed folding them into a single
 * manifest (hotspots-ts/CPLX-03). That was REFUTED: the guard is a strict subset
 * of what is copied - the git ref picker is copied and never verified - so one
 * shared list would add a throw path that does not exist today.
 * directoryXRParser.ts has no guard at all, and it does ship the picker.
 *
 * This suite turns that asymmetry into a visible decision. The planned refactors
 * (roadmap W4 T07-T09: the copy steps become a loop, the guard becomes an array,
 * the directory parser gets an asset loop) must keep membership identical, and
 * whoever does want to change it has to edit the sets below on purpose.
 *
 * The sets are FILE NAMES, not identifiers: both parsers feed the same scene
 * template, which loads these files by name, while the functions and constants
 * that produce them are free to be renamed.
 *
 * Not a copy step, so not in the copied set: main.js (the SSE client). The file
 * parser writes it with a bare copyFile behind an existsSync and never verifies
 * it, while the directory parser fails without it. The exact guard set below is
 * what keeps it out of the file guard.
 *
 * The directory parser does not copy files: it pairs each output name with a
 * reader and ships the text. T08 retypes those 22 pairs by hand into one list,
 * and a swapped pair still yields the right SET of names with the wrong script
 * under one of them. The last test closes that hole without a pairing table: a
 * name must carry the very text the file parser's copy step writes under it.
 *
 * Limit of a source-text pin: membership is read, the control flow is not run.
 * A loop that never walks its list, or a `.some` with the wrong polarity, needs
 * the F5 flow (open a file analysis and a directory analysis in XR).
 */

const FILE_XR_PARSER = 'src/code_analysis/engine/parsers/fileXRParser.ts';
const DIRECTORY_XR_PARSER = 'src/code_analysis/engine/parsers/directoryXRParser.ts';

const RUNTIME_ASSETS_COPIED_BY_FILE_XR = [
    'analysisModeRuntime.js',
    'analysisTableRuntime.js',
    'codexrAvatarRuntime.js',
    'codexrCollaborationRuntime.js',
    'codexrCommonRuntime.js',
    'codexrDebugRuntime.js',
    'codexrGitRefPickerRuntime.js',
    'codexrImmersiveRigRuntime.js',
    'codexrLogoRuntime.js',
    'codexrMultiScreenManagerRuntime.js',
    'codexrPointerPolicyRuntime.js',
    'codexrRoomRuntime.js',
    'dependencyGraphRuntime.js',
    'dependencyVisualBudgetRuntime.js',
    'guide.html',
    'guideScreenRuntime.js',
    'historicalComparisonRuntime.js',
    'projectEvolutionRuntime.js',
    'renderBudgetRuntime.js',
    'virtualScreenRuntime.js',
    'xrChartDebugRuntime.js',
    'xrChartMappingUiRuntime.js',
];

// The whole asymmetry. Adding the picker to the guard is a behaviour change (a
// scene that opens today would fail to open), not a tidy-up.
const COPIED_BUT_NEVER_VERIFIED = ['codexrGitRefPickerRuntime.js'];

// Named by the guard or the shipped map without being runtime assets: each
// parser produces the scene page, its data and (directory only) main.js itself.
const WRITTEN_BY_THE_FILE_PARSER_ITSELF = ['data.json', 'index.html'];
const WRITTEN_BY_THE_DIRECTORY_PARSER_ITSELF = ['data.json', 'index.html', 'main.js'];

// A list of names is only a guard while a missing one still stops the analysis. The message reaches the user
// ('XR Analysis Configuration Error: ...'), so it is behaviour, not a log line.
const FILE_XR_GUARD_REFUSAL = /\.has\([\s\S]*\bthrow new Error\(\s*'XR file bootstrap did not generate the required files\.'/;

const DECISION = 'If this membership change is deliberate, update the set in this suite in the same commit and say why; '
    + 'if only the shape of the code changed, retarget the extract*() helpers of this suite instead of loosening the set.';

function unique(values) {
    return [...new Set(values)];
}

function sorted(values) {
    return values.slice().sort();
}

function retarget(posixPath, problem) {
    return new Error(
        `${posixPath}: ${problem}.\n`
        + 'This suite reads the asset lists out of the parser source and understands two shapes: a run of '
        + '`await copyXToOutput(...)` / `.has(NAME)` / `.set(NAME, ...)` statements (today), and array literals of copy '
        + 'functions, of output names or of [name, reader] pairs walked by a loop (roadmap W4 T07-T09). If the lists moved '
        + 'to another file or took another shape WITHOUT changing membership, retarget executableBody(), extractCopySteps(), '
        + 'extractOutputNames() and extractReaderPairs() in test/analysis/xrRuntimeManifestAsymmetry.test.cjs. '
        + 'Do not loosen the expected sets.',
    );
}

/**
 * The source without comments and without import statements. An identifier that
 * is only imported, or only talked about in a comment (the asymmetry is due to
 * be documented next to the guard), is neither copied nor required.
 * Heuristic on purpose: neither parser holds a string containing a comment opener.
 */
function executableBody(source, posixPath) {
    const body = source
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|[^:'"`])\/\/.*$/gm, '$1')
        .replace(/^import\s[\s\S]*?\sfrom\s+'[^']+';$/gm, '');
    if (/^import\s/m.test(body)) {
        throw retarget(posixPath, 'an import statement survived the stripping, so imported names would count as used');
    }
    return body;
}

/** Matches a call and a bare function reference alike, so the loop refactor reads the same. */
function extractCopySteps(body, posixPath) {
    const steps = unique(body.match(/\bcopy[A-Z]\w*ToOutput\b/g) || []);
    if (steps.length === 0) {
        throw retarget(posixPath, 'no copy...ToOutput step is referenced outside the import block');
    }
    return steps;
}

const OUTPUT_NAME_CONSTANT = /\b[A-Z][A-Z0-9_]*_OUTPUT_NAME\b/g;

/**
 * The names handed to `<map>.<accessor>(`, as source tokens: a quoted literal or
 * an *_OUTPUT_NAME constant. A constant that appears in the body without being
 * reached by either shape means the list took a form this cannot read, and that
 * has to stop the suite rather than shrink the set in silence.
 */
function extractOutputNames(body, accessor, posixPath) {
    const tokens = [];
    const direct = new RegExp(String.raw`\.${accessor}\(\s*('[^'\n]*'|[A-Z][A-Z0-9_]*)\s*[,)]`, 'g');
    for (const match of body.matchAll(direct)) {
        tokens.push(match[1]);
    }
    // Innermost array literals: a flat list of names, or [name, reader] pairs.
    for (const match of body.matchAll(/\[([^[\]]*)\]/g)) {
        const constants = match[1].match(OUTPUT_NAME_CONSTANT);
        if (constants) {
            tokens.push(...constants, ...(match[1].match(/'[^'\n]*'/g) || []));
        }
    }

    const reached = unique(tokens);
    const stranded = unique(body.match(OUTPUT_NAME_CONSTANT) || []).filter((name) => !reached.includes(name));
    if (reached.length === 0) {
        throw retarget(posixPath, `no output name is handed to .${accessor}( directly or through an array literal`);
    }
    if (stranded.length > 0) {
        throw retarget(posixPath, `${stranded.join(', ')} is used outside .${accessor}( and outside any array literal`);
    }
    return reached;
}

/**
 * [output-name constant, reader] for every runtime asset of a parser that ships
 * text instead of copying files. Today the two meet through a local
 * (`const x = await readX(...)`, then `.set(NAME, x)`); the T08 asset loop puts
 * them side by side (`[NAME, readX]`, `{ outputName: NAME, read: readX }`,
 * `[NAME]: readX` or `.set(NAME, await readX(...))`). A constant left without
 * exactly one reader stops the suite: a pairing this cannot read must not pass
 * as "nothing to check".
 */
function extractReaderPairs(body, posixPath) {
    const readerOfLocal = new Map(
        [...body.matchAll(/\bconst\s+(\w+)\s*=\s*await\s+(read[A-Z]\w*)\(/g)].map((match) => [match[1], match[2]]),
    );
    const readersOfName = new Map();
    const pair = (name, reader) => readersOfName.set(name, unique([...(readersOfName.get(name) || []), reader]));

    for (const match of body.matchAll(/\.set\(\s*([A-Z][A-Z0-9_]*_OUTPUT_NAME)\s*,\s*(\w+)\s*\)/g)) {
        if (readerOfLocal.has(match[2])) {
            pair(match[1], readerOfLocal.get(match[2]));
        }
    }
    for (const match of body.matchAll(/\b([A-Z][A-Z0-9_]*_OUTPUT_NAME)\s*\]?\s*[,:]\s*(?:\w+\s*:\s*|await\s+)?(read[A-Z]\w*)\b/g)) {
        pair(match[1], match[2]);
    }

    const unreadable = unique(body.match(OUTPUT_NAME_CONSTANT) || [])
        .filter((name) => (readersOfName.get(name) || []).length !== 1);
    if (readersOfName.size === 0 || unreadable.length > 0) {
        throw retarget(posixPath, `cannot tell which single read...Content reader feeds ${unreadable.join(', ') || 'any output name'}`);
    }
    return [...readersOfName].map(([name, readers]) => [name, readers[0]]);
}

function toFileNames(tokens, posixPath) {
    return sorted(tokens.map((token) => {
        if (token.startsWith('\'')) {
            return token.slice(1, -1);
        }
        if (typeof components[token] !== 'string') {
            throw retarget(posixPath, `${token} is not a string exported by the compiled customComponents barrel`);
        }
        return components[token];
    }));
}

/**
 * Runs every copy step into its own empty folder and lists what it left at the
 * top level: the same view `loadGeneratedFiles` gives the guard, which never
 * descends into assets/. Executing the step is what ties a function name to the
 * file it ships without a hand-kept pairing table. Returns [file name, text]
 * entries, one per file and per step, so a name written twice stays visible.
 */
async function topLevelFilesWrittenBy(steps, posixPath) {
    const scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-xr-manifest-'));
    const written = [];
    try {
        for (const step of steps) {
            if (typeof components[step] !== 'function') {
                throw retarget(posixPath, `${step} is not a function exported by the compiled customComponents barrel`);
            }
            const folder = fs.mkdtempSync(path.join(scratch, 'step-'));
            await components[step](projectRoot, folder);
            const files = fs.readdirSync(folder, { withFileTypes: true })
                .filter((entry) => entry.isFile())
                .map((entry) => [entry.name, fs.readFileSync(path.join(folder, entry.name), 'utf8')]);
            assert.ok(files.length > 0, `${step} left no file at the top level of the output folder`);
            written.push(...files);
        }
    } finally {
        fs.rmSync(scratch, { recursive: true, force: true });
    }
    return written;
}

// Read separately, so a list this suite can no longer read only fails the tests that are about that list.
let writtenByFileXrCopySteps;
function readWrittenByFileXrCopySteps() {
    if (!writtenByFileXrCopySteps) {
        const body = executableBody(readSource(FILE_XR_PARSER), FILE_XR_PARSER);
        writtenByFileXrCopySteps = topLevelFilesWrittenBy(extractCopySteps(body, FILE_XR_PARSER), FILE_XR_PARSER);
    }
    return writtenByFileXrCopySteps;
}

async function readFilesCopiedByFileXr() {
    return sorted((await readWrittenByFileXrCopySteps()).map(([name]) => name));
}

function readReaderPairsOfDirectoryXr() {
    const body = executableBody(readSource(DIRECTORY_XR_PARSER), DIRECTORY_XR_PARSER);
    return extractReaderPairs(body, DIRECTORY_XR_PARSER);
}

function readFilesRequiredByFileXr() {
    const body = executableBody(readSource(FILE_XR_PARSER), FILE_XR_PARSER);
    return toFileNames(extractOutputNames(body, 'has', FILE_XR_PARSER), FILE_XR_PARSER);
}

function readFilesShippedByDirectoryXr() {
    const body = executableBody(readSource(DIRECTORY_XR_PARSER), DIRECTORY_XR_PARSER);
    return toFileNames(extractOutputNames(body, 'set', DIRECTORY_XR_PARSER), DIRECTORY_XR_PARSER);
}

test('the list extraction reads today\'s shape and the planned loop shape alike, and refuses a shape it cannot read', () => {
    const imports = 'import {\n    A_OUTPUT_NAME,\n    B_OUTPUT_NAME,\n    copyAToOutput,\n    copyBToOutput,\n    copyOnlyImportedToOutput,\n'
        + '    readAContent,\n} from \'../components/customComponents\';';
    const today = [
        imports,
        '// copyOnlyMentionedToOutput and B_OUTPUT_NAME are talked about, not used',
        'await copyAToOutput(this.context.extensionPath, session.outputPath);',
        'await copyBToOutput(this.context.extensionPath, session.outputPath);',
        'if (',
        '    !loadedFiles.has(\'index.html\')',
        '    || !loadedFiles.has(A_OUTPUT_NAME)',
        ') {',
        '    throw new Error(\'XR file bootstrap did not generate the required files.\');',
        '}',
        'const aContent = await readAContent(context.extensionPath);',
        'generatedFiles.set(\'index.html\', htmlContent);',
        'generatedFiles.set(A_OUTPUT_NAME, aContent);',
    ].join('\n');
    const planned = [
        imports,
        '/* B_OUTPUT_NAME stays out of the guard on purpose */',
        'const FILE_XR_COPY_STEPS = [',
        '    copyAToOutput,',
        '    copyBToOutput,',
        '];',
        'const REQUIRED_OUTPUTS = [\'index.html\', A_OUTPUT_NAME];',
        'for (const copy of FILE_XR_COPY_STEPS) {',
        '    await copy(this.context.extensionPath, session.outputPath);',
        '}',
        'if (REQUIRED_OUTPUTS.some((name) => !loadedFiles.has(name))) {',
        '    throw new Error(\'XR file bootstrap did not generate the required files.\');',
        '}',
    ].join('\n');
    const plannedDirectory = [
        imports,
        'const DIRECTORY_XR_ASSETS = [',
        '    [A_OUTPUT_NAME, readAContent],',
        '];',
        'generatedFiles.set(\'index.html\', htmlContent);',
        'for (const [outputName, read] of DIRECTORY_XR_ASSETS) {',
        '    generatedFiles.set(outputName, await read(context.extensionPath));',
        '}',
    ].join('\n');

    for (const shape of [today, planned]) {
        const body = executableBody(shape, 'fixture');
        assert.deepEqual(extractCopySteps(body, 'fixture'), ['copyAToOutput', 'copyBToOutput']);
        assert.deepEqual(sorted(extractOutputNames(body, 'has', 'fixture')), ['\'index.html\'', 'A_OUTPUT_NAME']);
        assert.match(body, FILE_XR_GUARD_REFUSAL);
        // A guard that only warns has stopped being one, whatever it still lists.
        assert.doesNotMatch(body.replace('throw new Error(', 'logger.warn('), FILE_XR_GUARD_REFUSAL);
    }
    for (const shape of [today, plannedDirectory]) {
        const body = executableBody(shape, 'fixture');
        assert.deepEqual(sorted(extractOutputNames(body, 'set', 'fixture')), ['\'index.html\'', 'A_OUTPUT_NAME']);
        assert.deepEqual(extractReaderPairs(body, 'fixture'), [['A_OUTPUT_NAME', 'readAContent']]);
    }

    // The guard delegates to a list kept elsewhere: nothing to read here, and saying so beats passing on an empty set.
    const delegated = executableBody(`${imports}\nif (REQUIRED.some((name) => !loadedFiles.has(name))) {\n}`, 'fixture');
    assert.throws(() => extractOutputNames(delegated, 'has', 'fixture'), /no output name is handed to \.has\([\s\S]*retarget/);
    assert.throws(() => extractCopySteps(delegated, 'fixture'), /no copy\.\.\.ToOutput step[\s\S]*retarget/);

    // A constant in a position neither shape covers must not drop out of the set unnoticed.
    const stranded = executableBody(`${today}\nconst manifest = { required: B_OUTPUT_NAME };`, 'fixture');
    assert.throws(() => extractOutputNames(stranded, 'has', 'fixture'), /B_OUTPUT_NAME is used outside \.has\([\s\S]*retarget/);

    // A name shipped from something that is not a reader, or fed by two readers, is a pairing this cannot vouch for.
    const unpaired = executableBody(`${today}\ngeneratedFiles.set(B_OUTPUT_NAME, somethingElse);`, 'fixture');
    assert.throws(() => extractReaderPairs(unpaired, 'fixture'), /which single read\.\.\.Content reader feeds B_OUTPUT_NAME[\s\S]*retarget/);
    const fedTwice = executableBody(`${plannedDirectory}\nconst OTHER_ASSETS = [[A_OUTPUT_NAME, readBContent]];`, 'fixture');
    assert.throws(() => extractReaderPairs(fedTwice, 'fixture'), /which single read\.\.\.Content reader feeds A_OUTPUT_NAME[\s\S]*retarget/);
});

test('the file XR parser copies exactly this set of runtime assets into the scene folder', async () => {
    const copied = await readFilesCopiedByFileXr();

    assert.deepEqual(copied, sorted(RUNTIME_ASSETS_COPIED_BY_FILE_XR), `The scene template loads these files by name. ${DECISION}`);
});

test('the file XR parser refuses to continue unless exactly this set of files was generated', () => {
    const expected = sorted([
        ...WRITTEN_BY_THE_FILE_PARSER_ITSELF,
        ...RUNTIME_ASSETS_COPIED_BY_FILE_XR.filter((name) => !COPIED_BUT_NEVER_VERIFIED.includes(name)),
    ]);

    assert.deepEqual(
        readFilesRequiredByFileXr(),
        expected,
        `Every name added here is a new way for a file analysis to fail to open. ${DECISION}`,
    );
    // Not assert.match: on failure it would print the whole parser.
    assert.ok(
        FILE_XR_GUARD_REFUSAL.test(executableBody(readSource(FILE_XR_PARSER), FILE_XR_PARSER)),
        'the .has( checks no longer end in the required-files throw: a scene with a missing runtime would be served '
        + 'instead of refused, or the message the user sees changed. If the throw only moved, retarget FILE_XR_GUARD_REFUSAL.',
    );
});

test('every runtime asset the file XR guard requires is one the parser copies, and the guard stays strictly smaller', async () => {
    const copied = await readFilesCopiedByFileXr();
    const requiredAssets = readFilesRequiredByFileXr().filter((name) => !WRITTEN_BY_THE_FILE_PARSER_ITSELF.includes(name));

    assert.deepEqual(
        requiredAssets.filter((name) => !copied.includes(name)),
        [],
        'the guard requires a runtime asset that no copy step produces: every file analysis would throw',
    );
    assert.ok(
        requiredAssets.length < copied.length,
        `the guard now covers everything that is copied: the two lists are no longer deliberately different. ${DECISION}`,
    );
});

test('the git ref picker is the only runtime asset the file XR parser copies without verifying it', async () => {
    const copied = await readFilesCopiedByFileXr();
    const required = readFilesRequiredByFileXr();

    assert.deepEqual(copied.filter((name) => !required.includes(name)), COPIED_BUT_NEVER_VERIFIED, DECISION);
});

test('the directory XR parser ships exactly the runtime assets the file XR parser copies, the unverified git ref picker included', async () => {
    const shipped = readFilesShippedByDirectoryXr();

    assert.deepEqual(
        shipped,
        sorted([...WRITTEN_BY_THE_DIRECTORY_PARSER_ITSELF, ...RUNTIME_ASSETS_COPIED_BY_FILE_XR]),
        `The directory parser has no guard: this map IS what the scene gets. ${DECISION}`,
    );
    assert.deepEqual(
        shipped.filter((name) => !WRITTEN_BY_THE_DIRECTORY_PARSER_ITSELF.includes(name)),
        await readFilesCopiedByFileXr(),
        'both parsers feed the same scene template, so an asset shipped by one and not by the other is a broken scene in one mode',
    );
});

test('the directory XR parser ships, under every runtime asset name, the very text the file XR parser copies under that name', async () => {
    const textCopiedByFileXr = new Map(await readWrittenByFileXrCopySteps());
    const pairs = readReaderPairsOfDirectoryXr();

    // Without this the loop below could walk fewer assets than the parser ships and still pass.
    assert.deepEqual(
        toFileNames(pairs.map(([name]) => name), DIRECTORY_XR_PARSER),
        sorted(RUNTIME_ASSETS_COPIED_BY_FILE_XR),
        `every runtime asset the directory parser ships has to be paired with its reader here. ${DECISION}`,
    );

    for (const [name, reader] of pairs) {
        if (typeof components[reader] !== 'function') {
            throw retarget(DIRECTORY_XR_PARSER, `${reader} is not a function exported by the compiled customComponents barrel`);
        }
        assert.ok(
            textCopiedByFileXr.has(components[name]),
            `the file parser copies no ${components[name]} to compare with: the membership tests above say which list changed`,
        );
        const shipped = await components[reader](projectRoot);
        // Not deepEqual: a mismatch would print two whole runtimes.
        assert.ok(
            shipped === textCopiedByFileXr.get(components[name]),
            `${DIRECTORY_XR_PARSER} ships the text of ${reader} as ${components[name]}, which is not what the file parser `
            + `copies under that name: ${name} is paired with the wrong reader, or the two asset functions drifted apart.`,
        );
    }
});
