const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { createRequire } = require('node:module');
const os = require('node:os');
const path = require('node:path');

/**
 * Parity between the two assemblers of multi-part browser runtimes.
 *
 * The extension ships what src/.../customComponents/runtimeAssembly.ts joins
 * together. The runtime suites, however, read their subject through a separate,
 * hand-maintained copy of that logic: test/helpers/runtimeAssembly.cjs. If the
 * two drift (a different separator, a normalised line ending, a skipped or an
 * extra part), those suites keep passing while they vouch for a runtime that no
 * user ever receives. Nothing else compares the two, so this suite does.
 */

const projectRoot = path.resolve(__dirname, '..', '..');
const { collectFiles } = require(path.join(projectRoot, 'test', 'helpers', 'sourceText.cjs'));

const helperPath = path.join(projectRoot, 'test', 'helpers', 'runtimeAssembly.cjs');
const helper = require(helperPath);
// The production assembler depends on fs and path only (no vscode), so its
// compiled module loads as is.
const production = require(path.join(
    projectRoot, 'out', 'code_analysis', 'engine', 'components', 'customComponents', 'runtimeAssembly.js',
));

// A floor, not a list: runtimes are discovered from disk, and the floor only
// stops a discovery that silently finds nothing from passing every loop below.
const KNOWN_MULTI_PART_RUNTIMES = 11;

// Both assemblers hard-code this layout and address a runtime by
// (component folder, output name); neither one can reach a manifest elsewhere.
const ADDRESSABLE_MANIFEST = /^templates\/components\/codexr\/([^/]+)\/([^/]+)\/manifest\.json$/;

const manifestPaths = collectFiles('templates/components', { extensions: ['.json'] })
    .filter((posixPath) => path.posix.basename(posixPath) === 'manifest.json');

const runtimes = manifestPaths
    .map((manifestPath) => ADDRESSABLE_MANIFEST.exec(manifestPath))
    .filter(Boolean)
    .map(([manifestPath, componentFolder, runtimeBase]) => ({
        manifestPath,
        componentFolder,
        outputName: `${runtimeBase}.js`,
        label: `${componentFolder}/${runtimeBase}.js`,
    }));

function firstDifference(left, right) {
    const limit = Math.min(left.length, right.length);
    let index = 0;
    while (index < limit && left[index] === right[index]) {
        index += 1;
    }
    return index;
}

// assert.equal would print a diff of two runtimes of several hundred kilobytes;
// the first differing offset and a short excerpt are what a reader needs.
function assertSameAssembly(tested, shipped, label) {
    const same = Buffer.isBuffer(tested) ? tested.equals(shipped) : tested === shipped;
    if (same) {
        return;
    }
    const offset = firstDifference(tested, shipped);
    const excerpt = (value) => JSON.stringify(value.slice(offset, offset + 60).toString());
    assert.fail(
        `${label}: test/helpers/runtimeAssembly.cjs and the production assembler disagree at offset ${offset} `
        + `(helper length ${tested.length}, production length ${shipped.length}).\n`
        + `    helper:     ${excerpt(tested)}\n`
        + `    production: ${excerpt(shipped)}\n`
        + 'The runtime suites would be testing a runtime that users never get: bring the helper back in line with '
        + 'src/code_analysis/engine/components/customComponents/runtimeAssembly.ts.',
    );
}

/**
 * The helper derives its root from its own location, so it cannot be pointed
 * at another tree. Evaluating its source with a substitute __dirname runs the
 * very same code against a temporary tree, which is the only way to compare
 * both assemblers on inputs that must never be written into templates/.
 * Its require() still resolves from the helper's real location, so the helper
 * may grow a sibling import without breaking the relocation.
 */
function loadHelperRootedAt(root) {
    const helperDirectory = path.join(root, 'test', 'helpers');
    const moduleShim = { exports: {} };
    new Function('exports', 'require', 'module', '__filename', '__dirname', fs.readFileSync(helperPath, 'utf8'))(
        moduleShim.exports, createRequire(helperPath), moduleShim,
        path.join(helperDirectory, 'runtimeAssembly.cjs'), helperDirectory,
    );
    return moduleShim.exports;
}

const FIXTURE_FOLDER = 'parity-fixture';
const FIXTURE_OUTPUT = 'parityFixtureRuntime.js';

// Bytes on which two independent implementations plausibly disagree: a BOM,
// CRLF, multi-byte characters, trailing blank lines, an empty part and a last
// part without a final newline. The manifest order is deliberately not the
// alphabetical one, so reading the directory instead of the manifest shows up.
// The non-ASCII characters are spelled as code points: an invisible BOM typed
// into this file would not survive an editor, and the fixture would go blunt.
const BOM = String.fromCharCode(0xFEFF);
const MULTI_BYTE_TEXT = String.fromCharCode(0xE9, 0x20, 0x4E2D, 0x6587);
const FIXTURE_PARTS = [
    { name: 'wrapperOpen.js', content: BOM + '(function () {\r\n    var opened = "PARITY-OPEN";\r\n' },
    { name: 'body.js', content: '    var label = "caf' + MULTI_BYTE_TEXT + ' PARITY-BODY";   \n\n\n' },
    { name: 'empty.js', content: '' },
    { name: 'close.js', content: '    return "PARITY-CLOSE";\n}());' },
];

function createFixtureTree(t) {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-runtime-parity-'));
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));

    const partsDir = path.join(
        root, 'templates', 'components', 'codexr', FIXTURE_FOLDER, FIXTURE_OUTPUT.replace(/\.js$/, ''),
    );
    fs.mkdirSync(partsDir, { recursive: true });
    fs.writeFileSync(
        path.join(partsDir, 'manifest.json'),
        JSON.stringify({ output: FIXTURE_OUTPUT, parts: FIXTURE_PARTS.map((part) => part.name) }),
    );
    for (const part of FIXTURE_PARTS) {
        fs.writeFileSync(path.join(partsDir, part.name), part.content, 'utf8');
    }
    // Only a stray .js file is an orphan; documentation next to the parts is not.
    fs.writeFileSync(path.join(partsDir, 'NOTES.md'), 'Not a runtime part.\n');

    return { root, partsDir, relocatedHelper: loadHelperRootedAt(root) };
}

// Doubles as the positive control of the rejection tests below: it proves that
// the relocated helper really reads the temporary tree and that both
// assemblers accept the fixture, so a later "both throw" cannot be a mere
// "file not found" on either side.
async function assertFixtureAssemblesIdentically(fixture) {
    const shipped = await production.assembleRuntimeContent(fixture.root, FIXTURE_FOLDER, FIXTURE_OUTPUT);
    let tested;
    try {
        tested = fixture.relocatedHelper.readAssembledRuntime(FIXTURE_FOLDER, FIXTURE_OUTPUT);
    } catch (error) {
        assert.fail(
            `the helper, re-rooted at a temporary tree, could not assemble the intact fixture (${error.message}). `
            + 'If it no longer derives its root from __dirname, teach loadHelperRootedAt the new way to relocate it.',
        );
    }

    assertSameAssembly(tested, shipped, `${FIXTURE_FOLDER}/${FIXTURE_OUTPUT}`);
    // Parity cannot see a change made to both assemblers at once, and it goes
    // blind the day the helper delegates to production, because both sides
    // then come from one source. The fixture is small enough to state outright
    // what ships: every part verbatim, in manifest order, one line feed between
    // two parts.
    assert.equal(shipped, FIXTURE_PARTS.map((part) => part.content).join('\n'));
}

test('Every multi-part runtime is found through its manifest.json, where both assemblers can address it', () => {
    assert.ok(
        manifestPaths.length >= KNOWN_MULTI_PART_RUNTIMES,
        `expected at least ${KNOWN_MULTI_PART_RUNTIMES} runtime manifests under templates/components, found ${manifestPaths.length}: `
        + 'either the discovery broke (and the parity loops below compare nothing) or a runtime was merged back into a flat file',
    );
    assert.deepEqual(
        manifestPaths.filter((manifestPath) => !ADDRESSABLE_MANIFEST.test(manifestPath)),
        [],
        'a manifest.json outside templates/components/codexr/<component>/<runtimeBase>/ is reachable by neither assembler',
    );

    for (const runtime of runtimes) {
        // Neither assembler reads "output": both derive the parts directory
        // from the output name. The field is the documented name of the flat
        // file, so it must not contradict the address this suite used.
        const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, ...runtime.manifestPath.split('/')), 'utf8'));
        assert.equal(manifest.output, runtime.outputName, `${runtime.manifestPath} declares another output than its directory name`);
    }
});

for (const runtime of runtimes) {
    test(`The test helper assembles ${runtime.label} exactly as the production assembler does`, async () => {
        const shipped = await production.assembleRuntimeContent(projectRoot, runtime.componentFolder, runtime.outputName);
        const tested = helper.readAssembledRuntime(runtime.componentFolder, runtime.outputName);

        assert.ok(shipped.length > 0, `${runtime.label} assembles to nothing, so comparing it proves nothing`);
        assertSameAssembly(tested, shipped, runtime.label);
    });
}

test('The runtime file written into an analysis output folder holds exactly the bytes the test helper returns', async (t) => {
    // assembleRuntimeContent feeds the inlined scenes; this is the other
    // production path, the flat <runtime>.js that lands next to a generated
    // scene. A banner, a minifier or another encoding added there would drift
    // from the suites just as silently.
    const outputDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-runtime-parity-'));
    t.after(() => fs.rmSync(outputDirectory, { recursive: true, force: true }));

    assert.ok(runtimes.length > 0, 'no runtime was discovered, so the loop below would compare nothing');
    for (const runtime of runtimes) {
        const writtenPath = await production.writeAssembledRuntimeToOutput(
            projectRoot, runtime.componentFolder, runtime.outputName, outputDirectory,
        );
        const tested = Buffer.from(helper.readAssembledRuntime(runtime.componentFolder, runtime.outputName), 'utf8');

        // A generated scene loads the runtime by its flat name from its own
        // folder, so the file must land directly in it, not merely be named so.
        assert.equal(path.resolve(writtenPath), path.resolve(outputDirectory, runtime.outputName));
        assertSameAssembly(tested, fs.readFileSync(writtenPath), runtime.label);
    }
});

test('Both assemblers join awkward part contents (BOM, CRLF, multi-byte text, an empty part, no final newline) verbatim, in manifest order, one line feed apart', async (t) => {
    await assertFixtureAssemblesIdentically(createFixtureTree(t));
});

test('Both assemblers refuse a .js file that sits next to the manifest without being listed in it', async (t) => {
    const fixture = createFixtureTree(t);
    await assertFixtureAssemblesIdentically(fixture);

    // In production an orphan would silently not ship. If only the helper
    // tolerated it, the suites would still be green for a runtime that cannot
    // be injected at all - so both must fail, and both must name the file.
    fs.writeFileSync(path.join(fixture.partsDir, 'strayPart.js'), '// not listed in manifest.json\n');

    assert.throws(() => fixture.relocatedHelper.readAssembledRuntime(FIXTURE_FOLDER, FIXTURE_OUTPUT), /strayPart\.js/);
    await assert.rejects(production.assembleRuntimeContent(fixture.root, FIXTURE_FOLDER, FIXTURE_OUTPUT), /strayPart\.js/);
});

test('Both assemblers refuse a manifest that lists a part missing from disk', async (t) => {
    const fixture = createFixtureTree(t);
    await assertFixtureAssemblesIdentically(fixture);

    // The mirror case of the orphan: a helper that skipped the missing part
    // would hand the suites a truncated runtime while production throws.
    fs.rmSync(path.join(fixture.partsDir, 'body.js'));

    assert.throws(() => fixture.relocatedHelper.readAssembledRuntime(FIXTURE_FOLDER, FIXTURE_OUTPUT), /body\.js/);
    await assert.rejects(production.assembleRuntimeContent(fixture.root, FIXTURE_FOLDER, FIXTURE_OUTPUT), /body\.js/);
});
