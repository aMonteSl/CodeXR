const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createFakeVscode, fakeExtensionContext, withFakeVscode } = require('../helpers/fakeVscode.cjs');

/**
 * First behavioural net for src/visualize_data, which had no test of any kind.
 * It executes the compiled state manager, the model and the JSON field analyzer
 * the launcher feeds them with - everything that works without a dialog.
 *
 * Two planned changes make this net necessary. The logging migration rewrites
 * most lines of these files, and the 'invalid path resets' extraction folds the
 * five conditional resets that loadState() and updateSelectedJson() each spell
 * out into one helper. Both must leave every state below exactly as it is.
 *
 * Only members with a live caller in src/ are driven. The manager's
 * updateDimensionMapping(s), hasSelected*, getSelected*Name and reset(), and the
 * model's resetVisualizeDataState() and getStateSummary(), have none: pinning
 * them would only make deleting dead code look like a regression.
 */

// The workspaceState key the configuration is saved under. Renaming it silently
// drops the selection users have saved in their workspaces.
const STATE_KEY = 'visualizeDataState';

// The published command the model asks for when it has changed the state behind
// the tree's back.
const REFRESH_COMMAND = 'codexr.servers.refresh';

const RECORDS = [
    { name: 'alpha', size: 3, ratio: '0.5', tags: ['x'] },
    { name: 'beta', size: 4, ratio: '0.7', tags: [] },
];

function barsChart() {
    return {
        id: 'bars',
        name: 'Bars fixture',
        description: 'two required dimensions and an optional one',
        category: 'fixture',
        htmlTemplate: '<a-entity></a-entity>',
        dimensions: [
            { name: 'x_axis', label: 'X axis', dataType: 'text', required: true },
            { name: 'height', label: 'Height', dataType: 'numeric', required: true },
            { name: 'z_axis', label: 'Z axis', dataType: 'text', required: false },
        ],
    };
}

function pieChart() {
    return {
        id: 'pie',
        name: 'Pie fixture',
        description: 'a different chart, to change the selection',
        category: 'fixture',
        htmlTemplate: '<a-entity></a-entity>',
        dimensions: [
            { name: 'key', label: 'Key', dataType: 'text', required: true },
            { name: 'size', label: 'Size', dataType: 'numeric', required: true },
        ],
    };
}

function jsonClone(value) {
    return JSON.parse(JSON.stringify(value));
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
 * VS Code's Memento serializes what it is given. The shared fake keeps the live
 * object instead, and the manager mutates its state in place in several
 * methods: by reference, a change would look persisted even if saveState() had
 * never run. Persistence is asserted against this by-value memento.
 */
function serializingMemento() {
    const values = new Map();
    return {
        get: (key, defaultValue) => (values.has(key) ? JSON.parse(values.get(key)) : defaultValue),
        update: (key, value) => {
            if (value === undefined) {
                values.delete(key);
            } else {
                values.set(key, JSON.stringify(value));
            }
            return Promise.resolve();
        },
        keys: () => [...values.keys()],
        setKeysForSync() {},
    };
}

/** One workbench = one workspace: a storage context and a folder of data files. */
function createWorkbench() {
    const context = fakeExtensionContext();
    context.workspaceState = serializingMemento();
    const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-visualize-data-'));

    return {
        context,
        writeData(name, content) {
            const filePath = path.join(dataDir, name);
            fs.writeFileSync(filePath, typeof content === 'string' ? content : JSON.stringify(content), 'utf8');
            return filePath;
        },
        missingPath(name) {
            return path.join(dataDir, name);
        },
        persisted() {
            return context.workspaceState.get(STATE_KEY);
        },
        cleanup() {
            context.cleanup();
            fs.rmSync(dataDir, { recursive: true, force: true });
        },
    };
}

/**
 * One session = one VS Code window: a fresh copy of the compiled modules, hence
 * a fresh state-manager singleton that has to load whatever the workbench
 * persisted. withFakeVscode evicts the modules when the session ends.
 */
function openSession(workbench, callback) {
    const fake = createFakeVscode();

    return withQuietConsole(() => withFakeVscode(fake, ({ requireOut }) => {
        // The state module goes first: requireOut() always reloads the file it is
        // given, so asking for it after the model would hand the test a second
        // singleton instead of the one the model talks to.
        const { VisualizeDataStateManager } = requireOut('visualize_data/state/visualizeDataState.js');
        const { VisualizeDataModel } = requireOut('visualize_data/model/visualizeDataModel.js');
        const { JsonFieldAnalyzer } = requireOut('utils/jsonFieldAnalyzer.js');

        assert.equal(VisualizeDataStateManager.hasInstance(), false, 'precondition: a session starts without a state manager, or a reload would prove nothing');

        return callback({
            fake,
            VisualizeDataStateManager,
            VisualizeDataModel,
            JsonFieldAnalyzer,
            openManager: () => VisualizeDataStateManager.getInstance(workbench.context),
        });
    }));
}

/**
 * The seven fields, each compared by value. Whether an unset field is an own key
 * holding undefined or no key at all is not part of the contract.
 */
function snapshot(state) {
    return {
        selectedChart: state.selectedChart,
        selectedJsonPath: state.selectedJsonPath,
        selectedJsonName: state.selectedJsonName,
        jsonAnalysis: state.jsonAnalysis,
        dimensionMappings: state.dimensionMappings,
        isDimensionMappingConfigured: state.isDimensionMappingConfigured,
        isReadyToLaunch: state.isReadyToLaunch,
    };
}

/**
 * The same seven fields, detached from the manager. getState() is a shallow
 * copy: its mappings array and its analysis object are the manager's own, so an
 * expectation built from it would follow a later in-place change and agree with
 * whatever the manager did. JSON drops the unset fields; snapshot() puts their
 * keys back.
 */
function snapshotByValue(state) {
    return snapshot(jsonClone(snapshot(state)));
}

const NOTHING_SELECTED = {
    selectedChart: undefined,
    selectedJsonPath: undefined,
    selectedJsonName: undefined,
    jsonAnalysis: undefined,
    dimensionMappings: [],
    isDimensionMappingConfigured: false,
    isReadyToLaunch: false,
};

/** What is left once the selected JSON file is gone: the chart, and nothing derived from the file. */
function afterJsonLoss(chart) {
    return { ...NOTHING_SELECTED, selectedChart: chart };
}

/** The launcher's own sequence: pick a chart, pick a file, store its analysis, map the required dimensions. */
async function configureReadyVisualization(session, jsonPath) {
    const manager = session.openManager();
    const analysis = await session.JsonFieldAnalyzer.analyzeJsonFile(jsonPath);

    manager.updateSelectedChart(barsChart());
    manager.updateSelectedJson(jsonPath, path.basename(jsonPath));
    manager.updateJsonAnalysis(analysis);
    manager.updateSingleDimensionMapping('x_axis', 'name');
    manager.updateSingleDimensionMapping('height', 'size');

    const state = manager.getState();
    assert.equal(state.isReadyToLaunch, true, 'precondition: the visualization is fully configured, so a reset has something to reset');
    assert.equal(state.dimensionMappings.length, 2);
    assert.equal(state.jsonAnalysis.success, true);
    return manager;
}

// ---------------------------------------------------------------- state: defaults and selection

test('a first session starts with nothing selected, nothing mapped and nothing to launch', async () => {
    const workbench = createWorkbench();
    try {
        await openSession(workbench, ({ VisualizeDataStateManager, openManager }) => {
            assert.throws(() => VisualizeDataStateManager.getInstance(), 'the first caller has to bring the extension context');

            const manager = openManager();

            assert.equal(VisualizeDataStateManager.hasInstance(), true);
            assert.equal(VisualizeDataStateManager.getInstance(), manager, 'later callers get the same manager without a context');
            assert.deepEqual(snapshot(manager.getState()), NOTHING_SELECTED);
        });
    } finally {
        workbench.cleanup();
    }
});

test('only mapping every required dimension, with a chart and a JSON file selected, makes the visualization launchable', async () => {
    const workbench = createWorkbench();
    try {
        const jsonPath = workbench.writeData('records.json', RECORDS);

        await openSession(workbench, async ({ JsonFieldAnalyzer, openManager }) => {
            const manager = openManager();
            const readiness = () => {
                const state = manager.getState();
                return [state.isDimensionMappingConfigured, state.isReadyToLaunch];
            };

            manager.updateSelectedChart(barsChart());
            manager.updateSingleDimensionMapping('x_axis', 'name');
            manager.updateSingleDimensionMapping('height', 'size');
            assert.deepEqual(readiness(), [true, false], 'a complete mapping is not enough without a JSON file');

            manager.updateSelectedJson(jsonPath, 'records.json');
            assert.deepEqual(readiness(), [true, true]);

            // A new analysis means new fields: mappings made against the old ones are dropped.
            manager.updateJsonAnalysis(await JsonFieldAnalyzer.analyzeJsonFile(jsonPath));
            assert.deepEqual(manager.getState().dimensionMappings, []);
            assert.deepEqual(readiness(), [false, false]);

            manager.updateSingleDimensionMapping('x_axis', 'name');
            assert.deepEqual(readiness(), [false, false], 'one of two required dimensions');
            manager.updateSingleDimensionMapping('z_axis', 'name');
            assert.deepEqual(readiness(), [false, false], 'an optional dimension does not stand in for a required one');
            manager.updateSingleDimensionMapping('height', 'size');
            assert.deepEqual(readiness(), [true, true]);

            manager.updateSingleDimensionMapping('height', 'ratio');
            assert.deepEqual(manager.getState().dimensionMappings, [
                { dimension: 'x_axis', dataField: 'name' },
                { dimension: 'z_axis', dataField: 'name' },
                { dimension: 'height', dataField: 'ratio' },
            ], 'mapping a dimension again replaces its field instead of adding a second entry');
            assert.deepEqual(readiness(), [true, true]);
        });
    } finally {
        workbench.cleanup();
    }
});

test('choosing another chart keeps the JSON selection and its fields, and discards the mappings made for the previous chart', async () => {
    const workbench = createWorkbench();
    try {
        const jsonPath = workbench.writeData('records.json', RECORDS);

        await openSession(workbench, async (session) => {
            const manager = await configureReadyVisualization(session, jsonPath);
            const before = snapshotByValue(manager.getState());

            manager.updateSelectedChart(pieChart());

            assert.deepEqual(snapshot(manager.getState()), {
                selectedChart: pieChart(),
                selectedJsonPath: jsonPath,
                selectedJsonName: 'records.json',
                jsonAnalysis: before.jsonAnalysis,
                dimensionMappings: [],
                isDimensionMappingConfigured: false,
                isReadyToLaunch: false,
            });
        });
    } finally {
        workbench.cleanup();
    }
});

test('pointing at another existing file keeps the analysis and the mappings until the new analysis arrives', async () => {
    const workbench = createWorkbench();
    try {
        const firstPath = workbench.writeData('records.json', RECORDS);
        const secondPath = workbench.writeData('other.json', [{ label: 'gamma', weight: 9 }]);

        await openSession(workbench, async (session) => {
            const manager = await configureReadyVisualization(session, firstPath);
            const before = snapshotByValue(manager.getState());

            // The valid-path branch of the five conditional resets: nothing is reset.
            manager.updateSelectedJson(secondPath, 'other.json');

            assert.deepEqual(snapshot(manager.getState()), {
                ...before,
                selectedJsonPath: secondPath,
                selectedJsonName: 'other.json',
            });

            const secondAnalysis = await session.JsonFieldAnalyzer.analyzeJsonFile(secondPath);
            manager.updateJsonAnalysis(secondAnalysis);

            assert.deepEqual(snapshot(manager.getState()), {
                selectedChart: barsChart(),
                selectedJsonPath: secondPath,
                selectedJsonName: 'other.json',
                jsonAnalysis: secondAnalysis,
                dimensionMappings: [],
                isDimensionMappingConfigured: false,
                isReadyToLaunch: false,
            });
        });
    } finally {
        workbench.cleanup();
    }
});

test('every selection step is saved before it returns and announced to subscribers exactly once', async () => {
    const workbench = createWorkbench();
    try {
        const jsonPath = workbench.writeData('records.json', RECORDS);

        await openSession(workbench, async ({ JsonFieldAnalyzer, openManager }) => {
            const manager = openManager();
            const analysis = await JsonFieldAnalyzer.analyzeJsonFile(jsonPath);
            const announced = [];
            // The Visualize Data tree section repaints from this event. Three of the
            // steps fire it with the live state object, so what was announced is
            // copied on arrival: a change made after the event must not reach it.
            manager.onStateChanged((state) => announced.push(snapshotByValue(state)));

            assert.equal(workbench.persisted(), undefined, 'precondition: nothing is saved yet');

            const steps = [
                ['updateSelectedChart', () => manager.updateSelectedChart(barsChart())],
                ['updateSelectedJson', () => manager.updateSelectedJson(jsonPath, 'records.json')],
                ['updateJsonAnalysis', () => manager.updateJsonAnalysis(analysis)],
                ['updateSingleDimensionMapping', () => manager.updateSingleDimensionMapping('x_axis', 'name')],
                ['updateSelectedJson (missing file)', () => manager.updateSelectedJson(workbench.missingPath('gone.json'), 'gone.json')],
            ];

            for (const [name, act] of steps) {
                const announcedBefore = announced.length;
                act();

                assert.equal(announced.length, announcedBefore + 1, `${name} announces the change exactly once`);
                assert.deepEqual(announced[announced.length - 1], snapshotByValue(manager.getState()), `${name} announces the new state`);
                assert.deepEqual(workbench.persisted(), jsonClone(manager.getState()), `${name} saves the new state under '${STATE_KEY}'`);
            }
        });
    } finally {
        workbench.cleanup();
    }
});

// ---------------------------------------------------------------- state: save -> load

test('a saved configuration comes back intact in the next session while its JSON file still exists', async () => {
    const workbench = createWorkbench();
    try {
        const jsonPath = workbench.writeData('records.json', RECORDS);

        const saved = await openSession(workbench, async (session) => {
            const manager = await configureReadyVisualization(session, jsonPath);
            return snapshotByValue(manager.getState());
        });

        await openSession(workbench, ({ openManager }) => {
            const reloaded = snapshot(openManager().getState());

            assert.deepEqual(reloaded, saved);
            assert.equal(reloaded.isReadyToLaunch, true);
            assert.deepEqual(reloaded.dimensionMappings, [
                { dimension: 'x_axis', dataField: 'name' },
                { dimension: 'height', dataField: 'size' },
            ]);
        });
    } finally {
        workbench.cleanup();
    }
});

test('readiness is recomputed when a saved state is loaded, and a state saved without mappings loads as unmapped', async () => {
    const workbench = createWorkbench();
    try {
        const jsonPath = workbench.writeData('records.json', RECORDS);

        // Claims to be launchable, yet has no chart and none of the mapping fields.
        await workbench.context.workspaceState.update(STATE_KEY, {
            selectedJsonPath: jsonPath,
            selectedJsonName: 'records.json',
            isReadyToLaunch: true,
        });
        await openSession(workbench, ({ openManager }) => {
            assert.deepEqual(snapshot(openManager().getState()), {
                ...NOTHING_SELECTED,
                selectedJsonPath: jsonPath,
                selectedJsonName: 'records.json',
            });
        });

        // Claims not to be launchable, yet everything it needs is there.
        await workbench.context.workspaceState.update(STATE_KEY, {
            selectedChart: barsChart(),
            selectedJsonPath: jsonPath,
            selectedJsonName: 'records.json',
            dimensionMappings: [{ dimension: 'x_axis', dataField: 'name' }, { dimension: 'height', dataField: 'size' }],
            isDimensionMappingConfigured: true,
            isReadyToLaunch: false,
        });
        await openSession(workbench, ({ openManager }) => {
            assert.equal(openManager().getState().isReadyToLaunch, true);
        });
    } finally {
        workbench.cleanup();
    }
});

// ---------------------------------------------------------------- the 'invalid path resets', from each of their three entry points

test('loading a saved configuration whose JSON file has disappeared keeps the chart and resets everything derived from the file', async () => {
    const workbench = createWorkbench();
    try {
        const jsonPath = workbench.writeData('records.json', RECORDS);

        await openSession(workbench, (session) => configureReadyVisualization(session, jsonPath));
        fs.rmSync(jsonPath);

        await openSession(workbench, ({ openManager }) => {
            assert.deepEqual(snapshot(openManager().getState()), afterJsonLoss(barsChart()));
        });
    } finally {
        workbench.cleanup();
    }
});

test('selecting a path that does not exist applies the same resets as loading one', async () => {
    const workbench = createWorkbench();
    try {
        const jsonPath = workbench.writeData('records.json', RECORDS);

        await openSession(workbench, async (session) => {
            const manager = await configureReadyVisualization(session, jsonPath);

            manager.updateSelectedJson(workbench.missingPath('gone.json'), 'gone.json');

            assert.deepEqual(snapshot(manager.getState()), afterJsonLoss(barsChart()));
        });
    } finally {
        workbench.cleanup();
    }
});

test('validateAndCleanState applies the same resets once the file is gone, saves them and asks for one tree refresh', async () => {
    const workbench = createWorkbench();
    try {
        const jsonPath = workbench.writeData('records.json', RECORDS);

        await openSession(workbench, async (session) => {
            const { fake, VisualizeDataModel } = session;
            const manager = await configureReadyVisualization(session, jsonPath);

            const configured = snapshotByValue(manager.getState());

            VisualizeDataModel.validateAndCleanState(workbench.context);
            assert.deepEqual(snapshot(manager.getState()), configured, 'a selection whose file exists is left alone');
            assert.deepEqual(fake.executedCommands, [], 'and nothing is repainted');

            // The model's own validateFilePath() is not asked: it has no caller
            // outside the model, and inlining it must not look like a regression.
            fs.rmSync(jsonPath);
            VisualizeDataModel.validateAndCleanState(workbench.context);

            assert.deepEqual(snapshot(manager.getState()), afterJsonLoss(barsChart()));
            assert.deepEqual(workbench.persisted(), jsonClone(manager.getState()), 'the cleaned state is what the next session will load');
            assert.deepEqual(fake.executedCommands.map((entry) => entry.id), [REFRESH_COMMAND]);
        });
    } finally {
        workbench.cleanup();
    }
});

test('validateAndCleanState does nothing, and creates no state manager, when none exists yet', async () => {
    const workbench = createWorkbench();
    try {
        // A stale saved state must not be loaded - let alone cleaned - just because the tree asked for validation.
        await workbench.context.workspaceState.update(STATE_KEY, {
            selectedJsonPath: workbench.missingPath('gone.json'),
            selectedJsonName: 'gone.json',
        });
        const savedBefore = workbench.persisted();

        await openSession(workbench, ({ fake, VisualizeDataModel, VisualizeDataStateManager }) => {
            VisualizeDataModel.validateAndCleanState(workbench.context);

            assert.equal(VisualizeDataStateManager.hasInstance(), false);
            assert.deepEqual(fake.executedCommands, []);
            assert.deepEqual(workbench.persisted(), savedBefore);
        });
    } finally {
        workbench.cleanup();
    }
});

// ---------------------------------------------------------------- deriving the fields of the selected JSON

function describeFields(fields) {
    return fields.map((field) => [field.name, field.type, field.isNumeric, field.valueCount]);
}

test('analysing a JSON file derives one field per key, its type, and whether it can feed a numeric dimension', async () => {
    const workbench = createWorkbench();
    try {
        const arrayPath = workbench.writeData('records.json', RECORDS);
        const objectPath = workbench.writeData('single.json', { name: 'only', size: 1 });

        await openSession(workbench, async ({ JsonFieldAnalyzer }) => {
            const analysis = await JsonFieldAnalyzer.analyzeJsonFile(arrayPath);

            assert.equal(analysis.success, true);
            assert.equal(analysis.recordCount, 2);
            assert.equal(analysis.filePath, arrayPath);
            assert.deepEqual(describeFields(analysis.fields), [
                ['name', 'string', false, 2],
                ['size', 'number', true, 2],
                ['ratio', 'string', true, 2], // numbers written as strings still feed a numeric dimension
                ['tags', 'array', false, 2],
            ]);

            // What the dimension picker offers for each kind of dimension.
            const offered = (dataType) => JsonFieldAnalyzer.getFieldsForDimensionType(analysis, dataType).map((field) => field.name);
            assert.deepEqual(offered('numeric'), ['size', 'ratio']);
            assert.deepEqual(offered('text'), ['name', 'tags']);
            assert.deepEqual(offered('any'), ['name', 'size', 'ratio', 'tags']);

            const single = await JsonFieldAnalyzer.analyzeJsonFile(objectPath);
            assert.equal(single.recordCount, 1, 'a bare object is one record');
            assert.deepEqual(describeFields(single.fields), [['name', 'string', false, 1], ['size', 'number', true, 1]]);
        });
    } finally {
        workbench.cleanup();
    }
});

test('a file that cannot be analysed is reported as a failed analysis, never thrown', async () => {
    const workbench = createWorkbench();
    try {
        const unreadable = [
            workbench.writeData('broken.json', '{ "name": '),
            workbench.writeData('scalar.json', '42'),
            workbench.missingPath('gone.json'),
        ];

        await openSession(workbench, async ({ JsonFieldAnalyzer }) => {
            for (const filePath of unreadable) {
                // The launcher only touches the state when `success` is true.
                const analysis = await JsonFieldAnalyzer.analyzeJsonFile(filePath);

                assert.equal(analysis.success, false, filePath);
                assert.deepEqual(analysis.fields, []);
                assert.equal(analysis.recordCount, 0);
                assert.equal(analysis.filePath, filePath);
                assert.ok(typeof analysis.error === 'string' && analysis.error.length > 0, 'the launcher shows this text');
                assert.deepEqual(JsonFieldAnalyzer.getFieldsForDimensionType(analysis, 'any'), []);
            }
        });
    } finally {
        workbench.cleanup();
    }
});

test('a null value ends the scan of its record, so the fields after it are not counted for that record', async () => {
    const workbench = createWorkbench();
    try {
        // Known defect, pinned as it behaves today so that fixing it is a recorded
        // decision and not a side effect of a refactor: the loop over a record's
        // keys returns at the first null instead of skipping it.
        const onlyRecord = workbench.writeData('null-first.json', [{ id: 1, note: null, value: 2 }]);
        const twoRecords = workbench.writeData('null-then-value.json', [{ id: 1, note: null, value: 2 }, { id: 2, note: 'x', value: 3 }]);

        await openSession(workbench, async ({ JsonFieldAnalyzer }) => {
            assert.deepEqual(describeFields((await JsonFieldAnalyzer.analyzeJsonFile(onlyRecord)).fields), [
                ['id', 'number', true, 1],
                ['note', 'unknown', false, 0],
            ], "'value' is never offered");

            assert.deepEqual(describeFields((await JsonFieldAnalyzer.analyzeJsonFile(twoRecords)).fields), [
                ['id', 'number', true, 2],
                ['note', 'string', false, 1],
                ['value', 'number', true, 1],
            ], "'value' is counted once, for the record without a null before it");
        });
    } finally {
        workbench.cleanup();
    }
});
