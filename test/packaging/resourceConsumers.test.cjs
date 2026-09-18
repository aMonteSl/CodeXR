'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { projectRoot, collectFiles, readSource, assertAbsent } = require('../helpers/sourceText.cjs');
const { createFakeVscode, fakeExtensionContext, withFakeVscode } = require('../helpers/fakeVscode.cjs');

/**
 * resources/ holds the binary assets of the extension, and three artefacts have
 * to agree about it: the `files` allowlist in package.json (the whole gate for
 * what reaches the VSIX - there is no .vscodeignore), the working tree, and the
 * code that loads the assets.
 *
 * Nothing else checks that agreement, because every consumer degrades in
 * SILENCE when its asset is missing: the avatar falls back to the procedural
 * model, the favicon copy logs a warning and carries on, a tree icon that
 * points nowhere renders as nothing. An asset lost in a cleanup passes the type
 * checker and a smoke run. The other direction is just as quiet: an asset whose
 * last consumer was deleted keeps shipping in every install.
 */

const packageJson = JSON.parse(readSource('package.json'));

// The compiled consumers this suite EXECUTES. When one of them moves, retarget
// the constant; do not fall back to reading its source, which cannot tell a
// live lookup from a table that nobody calls.
const PROFILE_MANAGER_MODULE = 'collaboration/services/collaborationProfileManager.js';
const LANGUAGE_TABLE_MODULE = 'utils/languageMetadata.js';
const LANGUAGE_ICON_MODULE = 'code_analysis/utils/workspaceFileScanner.js';
const SAVE_FILES_MODULE = 'code_analysis/engine/utils/saveFiles.js';

/**
 * Ships, but nothing reaches it. Every entry is debt and carries its reason.
 * The suite fails when a listed file gains a consumer (delete the entry then)
 * and stays quiet when a listed file is deleted or stops shipping.
 */
const SHIPPED_WITHOUT_CONSUMER = new Map([
    [
        'resources/languages_icons/color/rust.svg',
        'the table that classifies workspace files has no Rust entry, so the live icon lookup is never '
        + 'asked for it. A file name sitting in an icon table is not a consumer: only a full path or the '
        + 'executed lookup is',
    ],
]);

/**
 * Working-tree weight that was never part of the package. It is about to be
 * deleted, so nothing here may depend on it being on disk.
 */
const UNSHIPPED_DIRECTORY = 'resources/languages_icons/no_color';

/**
 * The folder named as a path SEGMENT: quoted on its own ('no_color'), or
 * between separators (/no_color/). The bare word is left alone because it is
 * also an everyday identifier (the NO_COLOR convention, a `no_color` keyword
 * argument in the Python backend), and a guard that goes red for those gets
 * deleted instead of read.
 */
const UNSHIPPED_DIRECTORY_MENTION = new RegExp(
    String.raw`(?:^|['"\x60/\\])${path.posix.basename(UNSHIPPED_DIRECTORY)}(?:$|['"\x60/\\])`,
    'm',
);

// Everything under src/ and templates/ is read except prose (.md) and drawings
// (.svg): a sentence that mentions an asset does not load it. It is a list of
// what to SKIP on purpose. With a list of what to read, the first source file
// of a type nobody listed (.tsx, .mts) would be invisible to every "nothing
// references this" verdict below, and those verdicts would keep passing.
const NOT_CODE_EXTENSIONS = ['.md', '.svg'];

// ---------------------------------------------------------------- the allowlist

const PLAIN_PATH = String.raw`[\w.-]+(?:/[\w.-]+)*`;
const LITERAL_ENTRY = new RegExp(`^${PLAIN_PATH}$`);
const SUBTREE_ENTRY = new RegExp(String.raw`^(${PLAIN_PATH})/\*\*/\*$`);

/**
 * vsce turns every `files` entry into a minimatch include ({ dot: true }) and,
 * for an entry whose last segment has no `*`, adds `<entry>/**` so that a bare
 * directory name ships its whole subtree. The manifest only uses two shapes, so
 * only those are implemented. Any other shape throws instead of being read as
 * "matches nothing": that reading would turn every "does not ship" assertion
 * below into a pass.
 */
function compileAllowlist(entries) {
    const roots = entries.map((entry) => {
        const subtree = SUBTREE_ENTRY.exec(entry);
        if (subtree) {
            return { exact: null, prefix: `${subtree[1]}/` };
        }
        if (LITERAL_ENTRY.test(entry)) {
            return { exact: entry, prefix: `${entry}/` };
        }
        throw new Error(
            `package.json files entry "${entry}" is a glob shape this suite does not evaluate. `
            + 'It knows a literal path and "<directory>/**/*"; teach compileAllowlist the new shape '
            + '(the way vsce/minimatch reads it) before relying on any verdict below.',
        );
    });

    return (posixPath) => roots.some((root) => posixPath === root.exact || posixPath.startsWith(root.prefix));
}

function isResourcesEntry(entry) {
    return entry === 'resources' || entry.startsWith('resources/');
}

// ---------------------------------------------------------------- the working tree

/**
 * Walks resources/ itself instead of using sourceText.collectFiles, which
 * skips directories named like build output: an asset folder must not be able
 * to hide from this suite behind its name.
 */
function listResourceFiles() {
    const files = [];
    const pending = ['resources'];

    while (pending.length > 0) {
        const directory = pending.pop();
        for (const entry of fs.readdirSync(toAbsolute(directory), { withFileTypes: true })) {
            const entryPath = `${directory}/${entry.name}`;
            if (entry.isDirectory()) {
                pending.push(entryPath);
            } else {
                files.push(entryPath);
            }
        }
    }

    return files.sort();
}

function toAbsolute(posixPath) {
    return path.join(projectRoot, ...posixPath.split('/'));
}

function toProjectPath(absolutePath) {
    return path.relative(projectRoot, absolutePath).split(path.sep).join('/');
}

// ---------------------------------------------------------------- references in the code

/**
 * The code never spells an asset path in one piece. It hands SEGMENTS to
 * path.join / Uri.joinPath - `'resources', 'languages_icons', 'color', iconFileName` -
 * or keeps them in an array that is spread later, so a search for the joined
 * path finds nothing and would declare every asset orphaned. Two shapes count:
 *
 *  - a chain of quoted segments that starts at 'resources'. When the chain ends
 *    in an expression instead of a literal (a looked-up file name), the
 *    reference is to the DIRECTORY: it proves the folder is in use, not any
 *    particular file in it. Which files are reached is then a question for the
 *    executed probes further down, not for text.
 *  - a quoted literal that is the whole path, which is how the manifest writes
 *    it and how HTML or CSS would.
 *
 * Unquoted and backtick-quoted mentions are prose (comments cite
 * `resources/icon.svg` as the origin of generated contours).
 */
function extractReferences(text) {
    const references = [];
    const chainStart = /(['"])resources\1/g;
    const chainNext = /\s*,\s*(?:(['"])([^'"\n]+)\1|([A-Za-z_$`.]))/y;

    for (let start = chainStart.exec(text); start !== null; start = chainStart.exec(text)) {
        const segments = ['resources'];
        let computedTail = false;

        chainNext.lastIndex = chainStart.lastIndex;
        for (let next = chainNext.exec(text); next !== null; next = chainNext.exec(text)) {
            if (next[3] !== undefined) {
                computedTail = true;
                break;
            }
            segments.push(next[2]);
        }

        // A lone 'resources' string is a word, not a path into the folder.
        if (segments.length > 1 || computedTail) {
            references.push(segments.join('/'));
        }
    }

    for (const literal of text.matchAll(/(['"])(?:\.{0,2}\/)*(resources\/[\w./-]+)\1/g)) {
        references.push(literal[2]);
    }

    return references;
}

let codeCache;

/**
 * Everything that can consume an asset: src/, templates/ and the manifest. The
 * manifest goes in WITHOUT its `files` array - the allowlist naming a path is
 * the claim under test, not a consumer of that path.
 */
function readCode() {
    if (!codeCache) {
        const manifest = Object.fromEntries(Object.entries(packageJson).filter(([key]) => key !== 'files'));
        const exclude = (file) => NOT_CODE_EXTENSIONS.some((extension) => file.endsWith(extension));
        const files = [...collectFiles('src', { exclude }), ...collectFiles('templates', { exclude })];

        codeCache = [
            { file: 'package.json', text: JSON.stringify(manifest, null, 2) },
            ...files.map((file) => ({ file, text: readSource(file) })),
        ];
    }
    return codeCache;
}

/** reference (posix path of a file or a directory) -> the sources that hold it */
function collectReferences() {
    const references = new Map();

    for (const { file, text } of readCode()) {
        for (const reference of extractReferences(text)) {
            if (!references.has(reference)) {
                references.set(reference, new Set());
            }
            references.get(reference).add(file);
        }
    }

    return references;
}

// ---------------------------------------------------------------- consumers, executed

let liveConsumers;

/**
 * Asks the compiled consumers which assets they resolve, against the real
 * resources/ (the fake context's extensionPath is the repository root).
 */
function probeLiveConsumers() {
    if (!liveConsumers) {
        liveConsumers = runLiveConsumers();
    }
    return liveConsumers;
}

async function runLiveConsumers() {
    const fake = createFakeVscode();
    const context = fakeExtensionContext();

    try {
        return await withFakeVscode(fake, ({ requireOut }) => {
            // The avatar is loaded by name, but not by the browser: the scene
            // runtime fetches /api/collaboration/avatar-model and the server
            // streams whatever path the profile manager resolved. null means
            // "no model", and the scene then builds the procedural avatar.
            const { CollaborationProfileManager } = requireOut(PROFILE_MANAGER_MODULE);
            const manager = CollaborationProfileManager.initialize(context);
            let avatarModel;
            try {
                avatarModel = manager.getAvatarModelPath();
            } finally {
                manager.dispose();
            }

            // The names come from the table that classifies workspace files,
            // the only names the tree views ever request an icon for, plus one
            // nobody lists: that is how the fallback icon is reached.
            const { SupportedLanguages } = requireOut(LANGUAGE_TABLE_MODULE);
            const { WorkspaceFileScanner } = requireOut(LANGUAGE_ICON_MODULE);
            const names = [...SupportedLanguages.map((language) => language.name), 'a language no table lists'];
            const languageIcons = names.map(
                (name) => toProjectPath(WorkspaceFileScanner.getLanguageIconUri(context, name).fsPath),
            );

            return {
                avatarModel: avatarModel ? toProjectPath(avatarModel) : null,
                languageIcons: [...new Set(languageIcons)].sort(),
            };
        });
    } finally {
        context.cleanup();
    }
}

/**
 * The files a page asks its own folder for as its icon. The saved folder is
 * also the root the page is served from, so ./name and /name are the same
 * file; a data: URI or a URL with a host needs no copy. Either quote style and
 * the older "shortcut icon" spelling are read, because a link this function
 * skips is a page whose icon nobody checks.
 */
function findLinkedLocalIcons(html) {
    const names = [];

    for (const link of html.matchAll(/<link\b[^>]*>/gi)) {
        if (!/\brel\s*=\s*(["'])(?:shortcut\s+)?icon\1/i.test(link[0])) {
            continue;
        }
        const href = /\bhref\s*=\s*(["'])(?:\.?\/)?([^"':/?#][^"':?#]*)(?:[?#][^"']*)?\1/i.exec(link[0]);
        if (href) {
            names.push(href[2]);
        }
    }

    return names;
}

function silenceConsole() {
    const original = { log: console.log, warn: console.warn, error: console.error };
    console.log = () => {};
    console.warn = () => {};
    console.error = () => {};
    return () => Object.assign(console, original);
}

// ---------------------------------------------------------------- the comparisons

function findUnconsumed(shippedFiles, consumed) {
    return shippedFiles.filter((file) => !consumed.has(file));
}

/**
 * A reference is either a file or a directory (a chain that ends in a computed
 * name). Whatever it resolves to must be on disk AND inside the allowlist: the
 * F5 host stages all of resources/, so an asset that is on disk but outside the
 * allowlist works on every developer machine and is missing from the VSIX.
 */
function describeBrokenReferences(references, resourceFiles, isShipped) {
    const onDisk = new Set(resourceFiles);
    const problems = [];

    for (const [reference, sources] of references) {
        const origin = [...sources].sort().join(', ');
        const targets = onDisk.has(reference)
            ? [reference]
            : resourceFiles.filter((file) => file.startsWith(`${reference}/`));

        if (targets.length === 0) {
            problems.push(`${reference} is not on disk (referenced by ${origin})`);
        }
        for (const target of targets.filter((file) => !isShipped(file))) {
            problems.push(`${target} is on disk but outside the files allowlist (referenced by ${origin})`);
        }
    }

    return problems.sort();
}

/** A custom assert message replaces the diff, so the offenders go into the message. */
function assertNone(offenders, explanation) {
    assert.deepEqual(offenders, [], `${explanation}:\n  ${offenders.join('\n  ')}`);
}

async function collectConsumed() {
    const live = await probeLiveConsumers();
    return new Set([
        ...collectReferences().keys(),
        ...live.languageIcons,
        ...(live.avatarModel ? [live.avatarModel] : []),
    ]);
}

// ---------------------------------------------------------------- tests

test('the files allowlist only uses the glob shapes this suite evaluates, and they are read the way vsce reads them', () => {
    assert.ok(
        Array.isArray(packageJson.files) && packageJson.files.length > 0,
        'package.json has no files allowlist: what ships is then decided somewhere else (a .vscodeignore), '
        + 'and every verdict in this suite is about a gate that no longer exists',
    );
    assert.doesNotThrow(() => compileAllowlist(packageJson.files));

    const isShipped = compileAllowlist(['kept/file.txt', 'kept/tree/**/*', 'folder']);
    const paths = [
        'kept/file.txt',
        'kept/file.txt.bak',
        'kept/other.txt',
        'kept/tree/a.bin',
        'kept/tree/deep/down/.hidden',
        'kept/tree-sibling/a.bin',
        'folder/inside/a.bin',
        'folder.txt',
    ];

    assert.deepEqual(
        paths.filter(isShipped),
        ['kept/file.txt', 'kept/tree/a.bin', 'kept/tree/deep/down/.hidden', 'folder/inside/a.bin'],
    );

    for (const unknownShape of ['kept/*.png', 'kept/**', '!kept/file.txt', 'kept/{a,b}/c', '']) {
        assert.throws(() => compileAllowlist([unknownShape]), /glob shape this suite does not evaluate/);
    }
});

test('every resources entry in the allowlist still matches a file on disk', () => {
    const resourceFiles = listResourceFiles();
    const entries = packageJson.files.filter(isResourcesEntry);

    assert.ok(entries.length > 0, 'the allowlist ships nothing from resources/: every asset would be missing from the VSIX');

    // vsce packages without a word when an entry matches nothing, which is how
    // a renamed or deleted asset hides: the line stays and looks like coverage.
    assertNone(
        entries.filter((entry) => !resourceFiles.some(compileAllowlist([entry]))),
        'allowlist entries that match nothing (restore the asset, or delete the line in the commit that deletes the file)',
    );
});

test('every shipped file under resources/ has a consumer', async () => {
    const shipped = listResourceFiles().filter(compileAllowlist(packageJson.files));
    const consumed = await collectConsumed();

    assert.ok(shipped.length > 0, 'no shipped resources were found: this test is looking at the wrong tree');

    const unconsumed = findUnconsumed(shipped, consumed);
    const recorded = [...SHIPPED_WITHOUT_CONSUMER.keys()].filter((file) => shipped.includes(file)).sort();

    assertNone(
        unconsumed.filter((file) => !recorded.includes(file)),
        'shipped files that no manifest field, no source reference and no executed consumer reaches '
        + '(wire the file up, stop shipping it, or record it in SHIPPED_WITHOUT_CONSUMER with its reason)',
    );
    assertNone(
        recorded.filter((file) => !unconsumed.includes(file)),
        'files recorded in SHIPPED_WITHOUT_CONSUMER that have a consumer now (delete their entries)',
    );
});

test('the bundled avatar model resolves to a shipped file under resources/avatars/', async () => {
    const { avatarModel } = await probeLiveConsumers();
    const isShipped = compileAllowlist(packageJson.files);

    // This is the fence around resources/avatars/**: the model has no importer
    // and no literal path anywhere, and losing it breaks nothing loudly.
    assert.ok(
        avatarModel,
        'the profile manager found no avatar model: every collaborator now silently gets the procedural avatar',
    );
    assert.match(avatarModel, /^resources\/avatars\/[^/]+$/);
    assert.ok(isShipped(avatarModel), `${avatarModel} is on disk but outside the files allowlist`);
});

test('every resources path the code reaches for exists on disk and ships', async () => {
    const resourceFiles = listResourceFiles();
    const isShipped = compileAllowlist(packageJson.files);
    const references = collectReferences();
    const live = await probeLiveConsumers();

    // Canaries: an empty haystack would make the comparison below pass.
    const sources = new Set([...references.values()].flatMap((files) => [...files]));
    assert.ok(sources.has('package.json'), 'the manifest holds no reference: its icon fields are no longer being read');
    assert.ok(
        [...sources].some((file) => file.startsWith('src/')),
        'no source file holds a reference: the extractor no longer reads the way the code spells asset paths',
    );
    assert.ok(live.languageIcons.length > 1, 'the language icon lookup resolved nothing but its fallback');

    for (const icon of live.languageIcons) {
        references.set(icon, new Set([`${LANGUAGE_ICON_MODULE} (executed)`]));
    }

    assertNone(
        describeBrokenReferences(references, resourceFiles, isShipped),
        'assets the code reaches for that an installed extension will not have',
    );
});

test('resources/languages_icons/no_color/ is outside the allowlist and referenced by nothing, so deleting it cannot change the VSIX', () => {
    const isShipped = compileAllowlist(packageJson.files);

    // Probes rather than the files on disk: the directory is about to be
    // deleted and this verdict has to keep its meaning afterwards.
    for (const probe of [`${UNSHIPPED_DIRECTORY}/python.png`, `${UNSHIPPED_DIRECTORY}/nested/deeper/python.png`]) {
        assert.equal(isShipped(probe), false, `${probe} would ship`);
    }
    // Canary: the sibling folder does ship, so the verdict above comes from the
    // allowlist and not from a matcher that is blind to languages_icons/.
    assert.equal(isShipped('resources/languages_icons/color/probe.svg'), true);

    // The probes cover every entry that reaches the folder from above; an entry
    // that names something inside it has to be looked for by name.
    assert.deepEqual(
        packageJson.files.filter((entry) => entry === UNSHIPPED_DIRECTORY || entry.startsWith(`${UNSHIPPED_DIRECTORY}/`)),
        [],
    );

    // Finder and Explorer leave these behind; they are nobody's asset.
    const osMetadata = new Set(['.DS_Store', 'Thumbs.db', 'desktop.ini']);
    const unshipped = listResourceFiles().filter((file) => !isShipped(file) && !osMetadata.has(path.posix.basename(file)));
    assertNone(
        unshipped.filter((file) => !file.startsWith(`${UNSHIPPED_DIRECTORY}/`)),
        'files under resources/ that do not ship (a forgotten allowlist entry, or dead weight in every clone)',
    );

    const code = readCode().map((entry) => entry.text).join('\n');
    assertAbsent(code, UNSHIPPED_DIRECTORY_MENTION, {
        canary: /(['"])languages_icons\1/,
        message: 'something references the no_color icons: they are not shipped, so it only works from a checkout',
    });
});

test('a saved analysis folder gets the favicon its pages link to, copied from a shipped resource', async () => {
    const linkedIcons = new Set(
        collectFiles('templates', { extensions: ['.html'] }).flatMap((file) => findLinkedLocalIcons(readSource(file))),
    );
    assert.ok(linkedIcons.size > 0, 'no page template links a favicon of its own folder: this test is looking at the wrong pages');

    const shipped = listResourceFiles().filter(compileAllowlist(packageJson.files));
    const fake = createFakeVscode();
    const context = fakeExtensionContext();
    const restoreConsole = silenceConsole();

    try {
        const outputDirectory = await withFakeVscode(fake, ({ requireOut }) => {
            const { SaveFiles } = requireOut(SAVE_FILES_MODULE);
            return new SaveFiles().saveFilesToStorage(
                new Map([['index.html', '<!doctype html>']]),
                'fileAnalysis',
                'resource-consumers',
                context,
            );
        });
        restoreConsole();

        for (const name of linkedIcons) {
            const copied = path.join(outputDirectory, name);

            // The copy swallows its own errors, so a missing source only shows
            // up as a page without an icon. Which resource is the source may
            // change; that it is one the VSIX carries may not.
            assert.ok(fs.existsSync(copied), `the pages link ./${name} but the saved folder has no such file`);

            const bytes = fs.readFileSync(copied);
            const origins = shipped.filter((file) => (
                fs.statSync(toAbsolute(file)).size === bytes.length && fs.readFileSync(toAbsolute(file)).equals(bytes)
            ));
            assert.ok(origins.length > 0, `${name} in the saved folder is not a copy of any shipped file under resources/`);
        }
    } finally {
        restoreConsole();
        context.cleanup();
    }
});

test('each guard notices the change it exists for', async () => {
    const resourceFiles = listResourceFiles();
    const isShipped = compileAllowlist(packageJson.files);
    const shipped = resourceFiles.filter(isShipped);
    const references = collectReferences();
    const consumed = await collectConsumed();
    const baseline = findUnconsumed(shipped, consumed);

    // An asset dropped into a shipped folder that nothing asks for.
    const orphan = 'resources/languages_icons/color/orphan.svg';
    assert.deepEqual(findUnconsumed([...shipped, orphan], consumed), [...baseline, orphan]);

    // A consumer deleted while its asset keeps shipping.
    const consumedFile = shipped.find((file) => consumed.has(file));
    const withoutConsumer = new Set([...consumed].filter((file) => file !== consumedFile));
    assert.ok(findUnconsumed(shipped, withoutConsumer).includes(consumedFile));

    // An asset deleted, or dropped from the allowlist, while code still reaches for it.
    const referencedFile = [...references.keys()].find((reference) => resourceFiles.includes(reference));
    assert.ok(referencedFile, 'no source references a resource file by its full path');
    const afterDeletion = describeBrokenReferences(references, resourceFiles.filter((file) => file !== referencedFile), isShipped);
    assert.ok(afterDeletion.some((problem) => problem.startsWith(`${referencedFile} is not on disk`)));

    const narrowed = packageJson.files.filter((entry) => !compileAllowlist([entry])(referencedFile));
    const afterNarrowing = describeBrokenReferences(references, resourceFiles, compileAllowlist(narrowed));
    assert.ok(afterNarrowing.some((problem) => problem.startsWith(`${referencedFile} is on disk but outside the files allowlist`)));

    // An allowlist widened until it swallows the unshipped folder, by a glob or by a bare directory name.
    const probe = `${UNSHIPPED_DIRECTORY}/python.png`;
    assert.equal(compileAllowlist([...packageJson.files, 'resources/languages_icons/**/*'])(probe), true);
    assert.equal(compileAllowlist([...packageJson.files, 'resources/languages_icons'])(probe), true);

    // The shapes the extractor reads, and the prose it must not.
    assert.deepEqual(
        extractReferences([
            "path.join(root, 'resources', 'sounds', 'ping.ogg');",
            "const SEGMENTS = ['resources', 'models', ASSET.fileName] as const;",
            "Uri.joinPath(base,\n    'resources', \n    \"flags\",\n    `${id}.svg`\n);",
            '"icon": "resources/icon.png", <img src="../resources/logo.svg">',
            "// generated from `resources/icon.svg`; see resources/README for the 'resources' folder",
        ].join('\n')),
        ['resources/sounds/ping.ogg', 'resources/models', 'resources/flags', 'resources/icon.png', 'resources/logo.svg'],
    );

    // The unshipped folder named as a path segment, and the same word as an identifier.
    for (const mention of [
        "join(root, 'languages_icons', 'no_color', name)",
        '"resources/languages_icons/no_color/python.png"',
        'f"{icons}/no_color/{name}.png"',
        String.raw`'resources\\languages_icons\\no_color\\python.png'`,
    ]) {
        assert.match(mention, UNSHIPPED_DIRECTORY_MENTION);
    }
    for (const unrelated of ['def run(no_color=False):', 'process.env.NO_COLOR', 'const no_color_mode = true;']) {
        assert.doesNotMatch(unrelated, UNSHIPPED_DIRECTORY_MENTION);
    }

    // The icon links a page can carry, and the ones that need no copy.
    assert.deepEqual(
        findLinkedLocalIcons([
            '<link rel="icon" type="image/x-icon" href="./favicon.ico">',
            "<LINK href='brand.png?v=2' rel='shortcut icon'>",
            '<link rel="icon" href="/rooted.ico">',
            '<link rel="icon" href="data:image/png;base64,AAAA">',
            '<link rel="icon" href="https://example.test/favicon.ico">',
            '<link rel="icon" href="//cdn.example.test/favicon.ico">',
            '<link rel="icon" href="./nested/favicon.ico">',
            '<link rel="stylesheet" href="./panel.css">',
            '<link rel="apple-touch-icon" href="./touch.png">',
        ].join('\n')),
        ['favicon.ico', 'brand.png', 'rooted.ico', 'nested/favicon.ico'],
    );
});
