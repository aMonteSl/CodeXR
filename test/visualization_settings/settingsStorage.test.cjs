const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { createFakeVscode, fakeExtensionContext, withFakeVscode } = require('../helpers/fakeVscode.cjs');

/**
 * First behavioural net for src/visualization_settings, which had no test of
 * any kind. It executes the compiled storage and the accessors that scene
 * generation reads (through utils/getVisualizationConfiguration), against a
 * real temp globalStorage folder and an in-memory globalState.
 *
 * Planned changes that must leave all of this as it is: the logging migration,
 * and the de-duplication that makes the accessors reuse the storage's path and
 * key and read the file once.
 *
 * The part that protects published users is the legacy migration. The storage
 * treats a globalState value under 'visualizationSettings' as the pre-file
 * format: it copies it into the settings file whenever it finds no file, and it
 * still mirrors every save into that key. Every tagged release (v1.0.0 to
 * v1.2.0) ships this code unchanged, so installed copies hold values in both
 * places and any of them may be the only one left.
 *
 * Only members with a live caller in src/ are driven. hasStoredSettings(),
 * getFormattedSettings() and validateSettings() have none. Neither has
 * getAllSelectedSettings(), but the de-duplication rewrites it instead of
 * deleting it, so it is pinned - in one test of its own, so that removing it
 * later turns that test red and no other.
 */

// Where the file lives under globalStorage, and the keys inside it, are a
// contract with the files already on users' disks - hard-coded on purpose.
const SETTINGS_FILE_SEGMENTS = ['visualization-configuration', 'visualization-settings.json'];

// The globalState key of the pre-file storage, still mirrored on every save.
const LEGACY_KEY = 'visualizationSettings';

// Changing a default repaints the scenes of every user who never chose a value.
const SHIPPED_DEFAULTS = {
    backgroundColor: '#FFFFFF',
    groundColor: '#000000',
    environmentPreset: 'default',
    chartPalette: 'ubuntu',
};

const LEGACY_VALUE = {
    backgroundColor: '#112233',
    groundColor: '#445566',
    environmentPreset: 'forest',
    chartPalette: 'foxy',
};

const CHOSEN = {
    backgroundColor: '#B10DC9',
    groundColor: '#0A0B0C',
    environmentPreset: 'tron',
    chartPalette: 'sunset',
};

/** The settings as the file and the accessors name them: environment / palette. */
function asStored(settings) {
    return {
        backgroundColor: settings.backgroundColor,
        groundColor: settings.groundColor,
        environment: settings.environmentPreset,
        palette: settings.chartPalette,
    };
}

/**
 * These modules narrate every call through console.* today, and the logging
 * migration will move that elsewhere. Nothing here asserts on it: it is muted so
 * the unit gate stays readable, and always restored, because every suite shares
 * this process.
 */
async function withQuietConsole(callback) {
    const methods = ['log', 'info', 'warn', 'error', 'debug'];
    const originals = methods.map((name) => console[name]);
    for (const name of methods) {
        console[name] = () => {};
    }
    try {
        return await callback();
    } finally {
        methods.forEach((name, index) => {
            console[name] = originals[index];
        });
    }
}

/**
 * Runs the callback with freshly loaded modules and an empty installation: no
 * settings file, empty globalState. The accessors keep the extension context in
 * a module variable, so a fresh load is also an uninitialized one.
 */
async function withSettings(callback, options = {}) {
    const fake = createFakeVscode();
    const context = fakeExtensionContext();
    const settingsFile = path.join(context.globalStorageUri.fsPath, ...SETTINGS_FILE_SEGMENTS);

    try {
        await withQuietConsole(() => withFakeVscode(fake, ({ requireOut }) => {
            const { DEFAULT_VISUALIZATION_SETTINGS } = requireOut('visualization_settings/model/settingsModel.js');
            const { VisualizationSettingsStorage } = requireOut('visualization_settings/storage/settingsStorage.js');
            const accessors = requireOut('visualization_settings/utils/settingsAccessors.js');

            if (options.initializeAccessors !== false) {
                accessors.initializeSettingsAccessors(context);
            }

            return callback({
                context,
                accessors,
                DEFAULT_VISUALIZATION_SETTINGS,
                settingsFile,
                newStorage: () => new VisualizationSettingsStorage(context),
                fileExists: () => fs.existsSync(settingsFile),
                readFile: () => JSON.parse(fs.readFileSync(settingsFile, 'utf8')),
                readFileText: () => fs.readFileSync(settingsFile, 'utf8'),
                writeFile(content) {
                    fs.mkdirSync(path.dirname(settingsFile), { recursive: true });
                    fs.writeFileSync(settingsFile, typeof content === 'string' ? content : JSON.stringify(content, null, 2), 'utf8');
                },
            });
        }));
    } finally {
        context.cleanup();
    }
}

/** The four single accessors: what scene generation asks, one setting at a time. */
async function selected(accessors) {
    return {
        backgroundColor: await accessors.getSelectedBackgroundColor(),
        groundColor: await accessors.getSelectedGroundColor(),
        environment: await accessors.getSelectedEnvironment(),
        palette: await accessors.getSelectedPalette(),
    };
}

// ---------------------------------------------------------------- defaults

test('with nothing stored, the storage and every accessor answer with the shipped defaults and write nothing', async () => {
    await withSettings(async ({ context, accessors, newStorage, fileExists, DEFAULT_VISUALIZATION_SETTINGS }) => {
        const storage = newStorage();

        assert.deepEqual(DEFAULT_VISUALIZATION_SETTINGS, SHIPPED_DEFAULTS);
        assert.deepEqual(storage.getSettings(), SHIPPED_DEFAULTS);
        assert.deepEqual(await selected(accessors), asStored(SHIPPED_DEFAULTS));

        assert.equal(fileExists(), false, 'reading never creates the settings file');
        assert.deepEqual(context.globalState.keys(), [], 'nor any globalState key');

        // The defaults are handed out by value: a caller that edits its copy must not redefine them.
        const handedOut = storage.getSettings();
        handedOut.backgroundColor = '#123456';
        try {
            assert.deepEqual(storage.getSettings(), SHIPPED_DEFAULTS);
        } finally {
            handedOut.backgroundColor = SHIPPED_DEFAULTS.backgroundColor;
        }
    });
});

test('the accessors answer with the defaults, without throwing, before they are given the extension context', async () => {
    // Scene generation falls back to a different palette, environment and
    // colours when an accessor throws, so 'not initialized yet' has to stay a
    // quiet default here.
    await withSettings(async ({ accessors }) => {
        assert.deepEqual(await selected(accessors), asStored(SHIPPED_DEFAULTS));
    }, { initializeAccessors: false });
});

// ---------------------------------------------------------------- save -> load

test('saveSettings writes the four-key file the accessors read and mirrors the settings into globalState', async () => {
    await withSettings(async ({ context, accessors, newStorage, readFile }) => {
        await newStorage().saveSettings({ ...CHOSEN });

        assert.deepEqual(readFile(), asStored(CHOSEN), 'on disk the keys are backgroundColor, groundColor, environment, palette');
        assert.deepEqual(context.globalState.get(LEGACY_KEY), CHOSEN, 'the mirror keeps the in-memory names: environmentPreset, chartPalette');
        assert.deepEqual(context.globalState.keys(), [LEGACY_KEY]);

        assert.deepEqual(newStorage().getSettings(), CHOSEN, 'a storage created later loads what was saved');
        assert.deepEqual(await selected(accessors), asStored(CHOSEN));
    });
});

test('a settings file already on disk is read from its location and key names, without any save in this session', async () => {
    // A save -> load round trip alone would stay green if both sides renamed the
    // file or a key together, and would strand the files users already have.
    await withSettings(async ({ accessors, newStorage, writeFile }) => {
        writeFile(asStored(CHOSEN));

        assert.deepEqual(newStorage().getSettings(), CHOSEN);
        assert.deepEqual(await selected(accessors), asStored(CHOSEN));
    });
});

test('updateSetting changes one setting and keeps the other three; resetSettings restores the defaults everywhere', async () => {
    await withSettings(async ({ context, accessors, newStorage, readFile }) => {
        const storage = newStorage();
        await storage.saveSettings({ ...CHOSEN });

        await storage.updateSetting('chartPalette', 'pearl');
        await storage.updateSetting('groundColor', '#FEDCBA');

        const expected = { ...CHOSEN, chartPalette: 'pearl', groundColor: '#FEDCBA' };
        assert.deepEqual(storage.getSettings(), expected);
        assert.deepEqual(readFile(), asStored(expected));
        assert.deepEqual(context.globalState.get(LEGACY_KEY), expected);
        assert.deepEqual(await selected(accessors), asStored(expected));

        await storage.resetSettings();

        assert.deepEqual(storage.getSettings(), SHIPPED_DEFAULTS);
        assert.deepEqual(readFile(), asStored(SHIPPED_DEFAULTS));
        assert.deepEqual(context.globalState.get(LEGACY_KEY), SHIPPED_DEFAULTS);
        assert.deepEqual(await selected(accessors), asStored(SHIPPED_DEFAULTS));
    });
});

test('the first change on an installation that never saved anything starts from the defaults', async () => {
    await withSettings(async ({ newStorage, readFile }) => {
        await newStorage().updateSetting('environmentPreset', 'japan');

        assert.deepEqual(readFile(), asStored({ ...SHIPPED_DEFAULTS, environmentPreset: 'japan' }));
    });
});

// ---------------------------------------------------------------- the legacy migration

test('a legacy globalState value is migrated into the settings file on the first read, and the legacy key is left as it was', async () => {
    await withSettings(async ({ context, accessors, newStorage, fileExists, readFile }) => {
        await context.globalState.update(LEGACY_KEY, { ...LEGACY_VALUE });
        assert.equal(fileExists(), false, 'precondition: an installation that predates the settings file');

        assert.deepEqual(newStorage().getSettings(), LEGACY_VALUE);

        assert.deepEqual(readFile(), asStored(LEGACY_VALUE), 'environmentPreset and chartPalette are renamed on their way to disk');
        assert.deepEqual(context.globalState.get(LEGACY_KEY), LEGACY_VALUE, 'the legacy value is neither removed nor rewritten');
        assert.deepEqual(context.globalState.keys(), [LEGACY_KEY], 'and no marker key records the migration');

        // The point of the migration: scenes keep the user's environment and palette.
        assert.deepEqual(await selected(accessors), asStored(LEGACY_VALUE));
    });
});

test('the migration runs only while there is no settings file: it never overwrites one', async () => {
    await withSettings(async ({ context, newStorage, readFileText, writeFile }) => {
        const storage = newStorage();

        // Migrated once ...
        await context.globalState.update(LEGACY_KEY, { ...LEGACY_VALUE });
        storage.getSettings();
        const migratedText = readFileText();

        // ... so a legacy value that changes afterwards is not migrated again.
        await context.globalState.update(LEGACY_KEY, { ...CHOSEN });
        assert.deepEqual(storage.getSettings(), LEGACY_VALUE);
        assert.deepEqual(newStorage().getSettings(), LEGACY_VALUE);
        assert.equal(readFileText(), migratedText);

        // And a file that was there first always wins over the legacy value.
        writeFile(asStored(SHIPPED_DEFAULTS));
        const existingText = readFileText();
        assert.deepEqual(newStorage().getSettings(), SHIPPED_DEFAULTS);
        assert.equal(readFileText(), existingText);
    });
});

test('a lost settings file is rebuilt from the globalState mirror that every save keeps', async () => {
    // The consequence of the two rules above: because saveSettings still writes
    // the legacy key and the migration runs whenever the file is missing, the
    // user's choices survive the loss of the globalStorage folder.
    await withSettings(async ({ accessors, newStorage, settingsFile, fileExists, readFile }) => {
        await newStorage().saveSettings({ ...CHOSEN });
        fs.rmSync(path.dirname(settingsFile), { recursive: true, force: true });
        assert.equal(fileExists(), false, 'precondition: the file is gone');

        assert.deepEqual(newStorage().getSettings(), CHOSEN);
        assert.deepEqual(readFile(), asStored(CHOSEN));
        assert.deepEqual(await selected(accessors), asStored(CHOSEN));
    });
});

// ---------------------------------------------------------------- the accessors' globalState fallback

test('without a settings file the accessors take the two colours from globalState, and only the colours', async () => {
    await withSettings(async ({ context, accessors, fileExists }) => {
        await context.globalState.update(LEGACY_KEY, { ...LEGACY_VALUE });

        // Nothing has asked the storage for the settings, so nothing has migrated yet.
        assert.deepEqual(await selected(accessors), {
            backgroundColor: LEGACY_VALUE.backgroundColor,
            groundColor: LEGACY_VALUE.groundColor,
            environment: SHIPPED_DEFAULTS.environmentPreset,
            palette: SHIPPED_DEFAULTS.chartPalette,
        });
        assert.equal(fileExists(), false, 'the accessors never migrate or write');
    });
});

test('a settings file without colours gets them from globalState through the accessors, and from the defaults through the storage', async () => {
    await withSettings(async ({ context, accessors, newStorage, writeFile }) => {
        // The shape the file type still declares: colours optional, environment and palette required.
        writeFile({ environment: 'egypt', palette: 'blues' });
        await context.globalState.update(LEGACY_KEY, { ...LEGACY_VALUE });

        assert.deepEqual(await selected(accessors), {
            backgroundColor: LEGACY_VALUE.backgroundColor,
            groundColor: LEGACY_VALUE.groundColor,
            environment: 'egypt',
            palette: 'blues',
        });
        assert.deepEqual(newStorage().getSettings(), {
            backgroundColor: SHIPPED_DEFAULTS.backgroundColor,
            groundColor: SHIPPED_DEFAULTS.groundColor,
            environmentPreset: 'egypt',
            chartPalette: 'blues',
        }, 'the storage does not look at globalState once a file exists');

        await context.globalState.update(LEGACY_KEY, undefined);
        assert.deepEqual(await selected(accessors), { ...asStored(SHIPPED_DEFAULTS), environment: 'egypt', palette: 'blues' });
    });
});

test('colours in the settings file win over the colours in globalState', async () => {
    await withSettings(async ({ context, accessors, writeFile }) => {
        writeFile(asStored(CHOSEN));
        await context.globalState.update(LEGACY_KEY, { ...LEGACY_VALUE });

        assert.deepEqual(await selected(accessors), asStored(CHOSEN));
    });
});

test('getAllSelectedSettings() answers with the same four values as the single accessors, whatever is stored', async () => {
    const defaults = asStored(SHIPPED_DEFAULTS);
    const legacyColours = { backgroundColor: LEGACY_VALUE.backgroundColor, groundColor: LEGACY_VALUE.groundColor };
    const withoutColours = { environment: 'egypt', palette: 'blues' };

    // One situation per branch of the accessors. Today it reads the file three
    // times and repeats the environment and palette lookups; it is about to
    // read the file once.
    const situations = [
        { name: 'nothing stored', expected: defaults },
        { name: 'not given the extension context yet', initializeAccessors: false, expected: defaults },
        { name: 'a complete file, other colours in globalState', file: asStored(CHOSEN), legacy: LEGACY_VALUE, expected: asStored(CHOSEN) },
        { name: 'no file, a legacy value', legacy: LEGACY_VALUE, expected: { ...defaults, ...legacyColours } },
        { name: 'a file without colours, a legacy value', file: withoutColours, legacy: LEGACY_VALUE, expected: { ...legacyColours, ...withoutColours } },
        { name: 'a file without colours, no legacy value', file: withoutColours, expected: { ...defaults, ...withoutColours } },
        { name: 'a corrupt file, a legacy value', file: '{ "backgroundColor": ', legacy: LEGACY_VALUE, expected: { ...defaults, ...legacyColours } },
    ];

    for (const situation of situations) {
        await withSettings(async ({ context, accessors, writeFile }) => {
            if (situation.file !== undefined) {
                writeFile(situation.file);
            }
            if (situation.legacy !== undefined) {
                await context.globalState.update(LEGACY_KEY, { ...situation.legacy });
            }

            assert.deepEqual(await accessors.getAllSelectedSettings(), situation.expected, situation.name);
            assert.deepEqual(await selected(accessors), situation.expected, `${situation.name}: the single accessors`);
        }, { initializeAccessors: situation.initializeAccessors });
    }
});

// ---------------------------------------------------------------- a damaged file

test('a corrupt settings file never throws: the storage answers with the defaults and the accessors with their fallbacks', async () => {
    await withSettings(async ({ context, accessors, newStorage, readFileText, writeFile }) => {
        writeFile('{ "backgroundColor": ');
        const corruptText = readFileText();

        assert.deepEqual(newStorage().getSettings(), SHIPPED_DEFAULTS);
        assert.deepEqual(await selected(accessors), asStored(SHIPPED_DEFAULTS));

        await context.globalState.update(LEGACY_KEY, { ...LEGACY_VALUE });
        assert.deepEqual(newStorage().getSettings(), SHIPPED_DEFAULTS, 'a file exists, so the legacy value is not migrated over it');
        assert.equal(readFileText(), corruptText);
        assert.deepEqual(await selected(accessors), {
            backgroundColor: LEGACY_VALUE.backgroundColor,
            groundColor: LEGACY_VALUE.groundColor,
            environment: SHIPPED_DEFAULTS.environmentPreset,
            palette: SHIPPED_DEFAULTS.chartPalette,
        });

        // The next change the user makes repairs the file.
        await newStorage().updateSetting('chartPalette', 'flat');
        assert.deepEqual(newStorage().getSettings(), { ...SHIPPED_DEFAULTS, chartPalette: 'flat' });
    });
});
