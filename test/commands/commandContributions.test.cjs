const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const { createFakeVscode, fakeExtensionContext, withFakeVscode } = require(path.join(projectRoot, 'test', 'helpers', 'fakeVscode.cjs'));
const { collectFiles, readSource } = require(path.join(projectRoot, 'test', 'helpers', 'sourceText.cjs'));
const { INTERNAL_COMMAND_IDS } = require('./internalCommandIds.cjs');

const manifest = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const contributedIds = manifest.contributes.commands.map((command) => command.command);

let surfacePromise;

/**
 * Runs the REAL registerAllCommands (and therefore the real
 * assertUniqueCommandIds) against a fake vscode, once per process. Static
 * extraction cannot do this: 28 ids are built at runtime from templates and
 * registration objects, so only execution sees the whole set.
 */
function loadCommandSurface() {
    if (!surfacePromise) {
        surfacePromise = (async () => {
            const fake = createFakeVscode();
            const context = fakeExtensionContext();
            const consoleLog = console.log;
            // Dozens of modules narrate their own loading; keep the test output readable.
            console.log = () => {};
            try {
                await withFakeVscode(fake, async ({ requireOut }) => {
                    requireOut('commands/index.js').registerAllCommands(context);
                    // Let the storage loads that registration kicks off settle inside the scope.
                    await new Promise((resolve) => setImmediate(resolve));
                    await new Promise((resolve) => setImmediate(resolve));
                });
            } finally {
                console.log = consoleLog;
                context.cleanup();
            }
            return { registeredIds: [...fake.registeredCommands.keys()] };
        })();
    }
    return surfacePromise;
}

const sorted = (values) => [...values].sort();
const difference = (left, right) => {
    const exclude = new Set(right);
    return sorted([...left].filter((value) => !exclude.has(value)));
};

function isRegistrationLine(line, id) {
    return new RegExp(`\\b(id|commandId)\\s*:\\s*['"\`]${id.replace(/\./g, '\\.')}['"\`]`).test(line);
}

let commandLiteralLines;

/** Every line of src/ and templates/ that mentions a command-looking literal, read once. */
function loadCommandLiteralLines() {
    if (!commandLiteralLines) {
        commandLiteralLines = [];
        const files = [
            ...collectFiles('src', { extensions: ['.ts'] }),
            ...collectFiles('templates', { extensions: ['.js', '.html'] }),
        ];
        for (const file of files) {
            readSource(file).split('\n').forEach((line, index) => {
                if (/codexr\./i.test(line)) {
                    commandLiteralLines.push({ location: `${file}:${index + 1}`, line });
                }
            });
        }
    }
    return commandLiteralLines;
}

/** Quoted occurrences of a command id anywhere in src/ or templates/, excluding the line that registers it. */
function findReferences(id) {
    const quoted = [`'${id}'`, `"${id}"`, `\`${id}\``];
    return loadCommandLiteralLines()
        .filter(({ line }) => quoted.some((literal) => line.includes(literal)) && !isRegistrationLine(line, id))
        .map(({ location }) => location);
}

function collectMenuCommandIds() {
    const menus = manifest.contributes.menus || {};
    const fromMenus = Object.values(menus).flatMap((entries) => entries.map((entry) => entry.command).filter(Boolean));
    const fromKeybindings = (manifest.contributes.keybindings || []).map((entry) => entry.command).filter(Boolean);
    return sorted(new Set([...fromMenus, ...fromKeybindings]));
}

test('the real command set registers without a duplicate id', async () => {
    // The first test that runs assertUniqueCommandIds on the actual registrations
    // instead of synthetic arrays. A duplicate here is an activation failure.
    const { registeredIds } = await loadCommandSurface();

    assert.ok(registeredIds.length >= contributedIds.length);
    assert.equal(new Set(registeredIds).size, registeredIds.length);
});

test('every command contributed in package.json is registered', async () => {
    // A contributed id with no registration is a palette entry that fails with
    // "command not found" the moment a user picks it.
    const { registeredIds } = await loadCommandSurface();

    assert.deepEqual(difference(contributedIds, registeredIds), []);
    assert.equal(new Set(contributedIds).size, contributedIds.length, 'no id is contributed twice');
});

test('every registered command is either contributed or listed as internal, with how it is reached', async () => {
    const { registeredIds } = await loadCommandSurface();
    const internalIds = INTERNAL_COMMAND_IDS.map((entry) => entry.id);

    assert.equal(new Set(internalIds).size, internalIds.length, 'internalCommandIds.cjs lists an id twice');
    assert.deepEqual(
        difference(registeredIds, contributedIds),
        sorted(internalIds),
        'registered-but-uncontributed commands must match test/commands/internalCommandIds.cjs exactly: '
        + 'contribute the new command in package.json, or list it there with the kind that says how it is reached',
    );
    assert.deepEqual(difference(internalIds, registeredIds), [], 'an internal id is listed but no longer registered: delete its entry');
    for (const entry of INTERNAL_COMMAND_IDS) {
        assert.ok(['tree-item', 'programmatic', 'legacy-alias', 'pending-removal'].includes(entry.kind), `${entry.id}: unknown kind "${entry.kind}"`);
        assert.ok(entry.reason && entry.reason.length > 0, `${entry.id}: say why it exists`);
    }
});

test('an internal command is reachable the way its kind says', () => {
    for (const entry of INTERNAL_COMMAND_IDS) {
        const references = findReferences(entry.id);

        if (entry.kind === 'tree-item' || entry.kind === 'programmatic') {
            assert.ok(
                references.length > 0,
                `${entry.id} is listed as ${entry.kind} but nothing references it: it became unreachable. Wire it, or reclassify it as pending-removal`,
            );
        }
        if (entry.kind === 'pending-removal') {
            assert.deepEqual(
                references,
                [],
                `${entry.id} is listed as pending-removal but is referenced: it is alive, reclassify it before anyone deletes it`,
            );
        }
        // legacy-alias: a published id kept for users' keybindings. No reference is required.
    }
});

test('the published legacy refresh aliases stay registered', async () => {
    // Shipped in 1.1.0. A user may have bound a key to either of them, and a
    // removed id fails silently for that user. They are fenced here on purpose:
    // `codexr.servers.refreshServers` has zero callers and still must not go.
    const { registeredIds } = await loadCommandSurface();
    const aliases = INTERNAL_COMMAND_IDS.filter((entry) => entry.kind === 'legacy-alias').map((entry) => entry.id);

    assert.deepEqual(sorted(aliases), ['codexr.servers.refresh', 'codexr.servers.refreshServers']);
    for (const alias of aliases) {
        assert.ok(registeredIds.includes(alias), `${alias} is a published legacy alias and must stay registered`);
    }
});

test('menus and keybindings only name contributed commands', () => {
    const menuIds = collectMenuCommandIds();

    assert.ok(menuIds.length > 0);
    assert.deepEqual(difference(menuIds, contributedIds), []);
});
