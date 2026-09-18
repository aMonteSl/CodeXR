const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');

/**
 * Controller-view routing: hand-maintained tables in two runtimes, one contract.
 *
 * The XR controller panel is addressed by "controller views"
 * ('historical.mapping', 'project-evolution.playback', ...). Which PANEL a
 * controller view lands on is written down twice:
 *  - analysis-mode runtime, PANEL_VIEW_BY_CONTROLLER_VIEW: the panel the mode
 *    machinery announces to the controller (context.panelViewId), and the one
 *    it opens by itself when the controller has no showView (a mixed-version
 *    scene);
 *  - chart-mapping-ui runtime, CONTROLLER_PANEL_BY_VIEW: the panel the
 *    controller really shows. It never reads the announced panelViewId.
 * A third table, CONTROLLER_VIEW_BY_PANEL (chart-mapping-ui), runs the other
 * way: the view the controller reports once a panel has been opened directly.
 * Which of a panel's views it names is settled by a table back in the other
 * runtime, MODE_CONTROLLER_VIEW_BY_ID: the view each analysis mode enters with.
 *
 * None of them can fail loudly. An unknown view is coerced to
 * 'single.mapping', an unknown panel falls back to 'mapping', and a panel with
 * no reverse row keeps reporting the previous panel's view. Drift therefore
 * shows up as the wrong panel on the controller, never as an error.
 *
 * The tables cannot be merged in 1.2.1: the only shared home would be
 * templates/components/common, which the DOM scene never loads and which the
 * refresh of an exported bundle does not rewrite. Until that move lands, this
 * suite is what keeps the copies in step. It reads the literals (to see a row
 * that exists on one side only) AND drives both real runtimes against each
 * other (to see what a user would see, and to outlive the day the literals
 * move).
 *
 * The extension host is a caller as well: it names a controller view in every
 * analysis-view snapshot and keeps its own copy of the mode defaults. The two
 * host tests hold it to the same pinned tables as the runtimes.
 *
 * Left out on purpose: MODE_PANEL_VIEW_BY_ID in the analysis-mode runtime. It
 * looks like a fourth relative, but it sits behind a lookup that always answers
 * (an unknown view already yields 'mapping'), so no transition can reach it,
 * and its 'historical-compare' row already disagrees with the routing table.
 * Holding it to the relation below would pin a contract the code never had.
 */

const projectRoot = path.resolve(__dirname, '..', '..');
const { readAssembledRuntime } = require(path.join(projectRoot, 'test', 'helpers', 'runtimeAssembly.cjs'));
const { collectFiles, readSource } = require(path.join(projectRoot, 'test', 'helpers', 'sourceText.cjs'));

const ANALYSIS_MODE = 'analysis-mode runtime';
const MAPPING_UI = 'chart-mapping-ui runtime';

const analysisModeSource = readAssembledRuntime('analysis-mode', 'analysisModeRuntime.js');
const mappingUiSource = readAssembledRuntime('xr-chart-mapping-ui', 'xrChartMappingUiRuntime.js');

// The routing contract 1.2.1 ships, spelled out on purpose. Controller-view ids
// are not private to the two runtimes that own the tables: the extension host
// sends them inside analysis-view snapshots, and the historical-comparison and
// project-evolution runtimes call showView() with them. A row that disappears
// from BOTH copies keeps them perfectly in sync while a caller's view starts
// landing on the single-analysis mapping panel, so the set itself is pinned.
const ROUTING_TABLE = Object.freeze({
    'visualization-menu': 'visualization-mode',
    'single.mapping': 'mapping',
    'dependency.settings': 'dependency-graph',
    'historical.selection': 'historical-selection',
    'historical.mapping': 'mapping',
    'project-evolution': 'project-evolution',
    'project-evolution.selection': 'project-evolution',
    'project-evolution.playback': 'project-evolution',
    'project-evolution.mapping': 'mapping',
});

// 'mapping' is the controller's built-in view; every other panel exists only
// once a feature runtime has registered it.
const BUILT_IN_PANEL = 'mapping';
const REGISTERED_PANELS = [...new Set(Object.values(ROUTING_TABLE))].filter((panel) => panel !== BUILT_IN_PANEL);
const UNKNOWN_VIEW = 'not-a.controller-view';

// The view each analysis mode enters with when nobody names one, pinned for the
// same reason. Modes and views are both wire values (the host names them in
// every analysis-view snapshot and keeps this very table on its side), and the
// relations below tie the mode defaults to the panel-to-view table, not to
// anything fixed: change both together and every relation still holds while a
// mode starts entering with another view.
//
// The tests that DRIVE the runtimes take ROUTING_TABLE and this table as their
// only inputs, never the extracted literals: on the day the tables move, the
// literal tests are retargeted and the driven ones keep judging the move.
const DEFAULT_VIEW_BY_MODE = Object.freeze({
    selection: 'visualization-menu',
    single: 'single.mapping',
    'historical-compare': 'historical.selection',
    'dependency-graph': 'dependency.settings',
    'project-evolution': 'project-evolution',
});
const ANALYSIS_MODES = Object.freeze(Object.keys(DEFAULT_VIEW_BY_MODE));

// ---------------------------------------------------------------------------
// Reading the literals
// ---------------------------------------------------------------------------

/** Finds `var <name> = {` and the brace that closes it; strings and comments are skipped. */
function locateObjectLiteral(source, name, label) {
    const declarations = [...source.matchAll(new RegExp(`\\b(?:var|let|const)\\s+${name}\\s*=\\s*\\{`, 'g'))];
    assert.equal(
        declarations.length,
        1,
        `${label}: expected exactly one "${name} = {" declaration, found ${declarations.length}. `
        + 'If the table moved or was renamed, retarget this suite in the same commit - it is the only thing '
        + 'keeping the controller-view tables of the two runtimes in step.',
    );
    const open = declarations[0].index + declarations[0][0].length - 1;
    let depth = 0;
    let quote = null;
    for (let index = open; index < source.length; index += 1) {
        const char = source[index];
        if (quote) {
            if (char === '\\') {
                index += 1;
            } else if (char === quote) {
                quote = null;
            }
        } else if (char === '/' && source[index + 1] === '/') {
            index = source.indexOf('\n', index);
            if (index === -1) { break; }
        } else if (char === '/' && source[index + 1] === '*') {
            index = source.indexOf('*/', index) + 1;
            if (index === 0) { break; }
        } else if (char === '\'' || char === '"' || char === '`') {
            quote = char;
        } else if (char === '{') {
            depth += 1;
        } else if (char === '}') {
            depth -= 1;
            if (depth === 0) {
                return { open, close: index };
            }
        }
    }
    return assert.fail(`${label}: the literal assigned to ${name} never closes`);
}

/**
 * Evaluates the literal instead of regexing its rows, so quoting, key order,
 * line breaks and trailing commas are free to change. A row that stops being a
 * plain string (a computed key, a reference to another constant) fails here
 * rather than being silently skipped.
 */
function extractStringTable(source, name, label) {
    const { open, close } = locateObjectLiteral(source, name, label);
    let evaluated;
    try {
        evaluated = vm.runInNewContext(`(${source.slice(open, close + 1)})`);
    } catch (error) {
        assert.fail(`${label}: ${name} is no longer a self-contained literal (${error.message}); this suite must learn its new shape.`);
    }
    const rows = Object.entries(evaluated);
    assert.ok(rows.length > 0, `${label}: ${name} is empty`);
    for (const [key, value] of rows) {
        assert.ok(typeof value === 'string' && value.length > 0, `${label}: ${name}[${JSON.stringify(key)}] is not a non-empty string`);
    }
    // Rebuilt in this realm: deepEqual also compares prototypes, and the
    // evaluated object carries the sandbox's Object.prototype.
    return Object.fromEntries(rows);
}

function readTables(sources = {}) {
    const modeSource = sources.analysisMode || analysisModeSource;
    const uiSource = sources.mappingUi || mappingUiSource;
    return {
        announced: extractStringTable(modeSource, 'PANEL_VIEW_BY_CONTROLLER_VIEW', ANALYSIS_MODE),
        defaultViewByMode: extractStringTable(modeSource, 'MODE_CONTROLLER_VIEW_BY_ID', ANALYSIS_MODE),
        routed: extractStringTable(uiSource, 'CONTROLLER_PANEL_BY_VIEW', MAPPING_UI),
        defaultViewByPanel: extractStringTable(uiSource, 'CONTROLLER_VIEW_BY_PANEL', MAPPING_UI),
    };
}

// The relations are functions that RETURN what is wrong, so the last test can
// show each of them reporting a drifted input instead of trusting that it would.

function describeTableDrift(leftLabel, left, rightLabel, right) {
    const show = (table, key) => (Object.hasOwn(table, key) ? JSON.stringify(table[key]) : 'no row');
    return [...new Set([...Object.keys(left), ...Object.keys(right)])]
        .filter((key) => left[key] !== right[key])
        .map((key) => `${JSON.stringify(key)}: ${leftLabel} -> ${show(left, key)}, ${rightLabel} -> ${show(right, key)}`);
}

function describeReverseTableFaults(defaultViewByPanel, routed) {
    const faults = [];
    for (const [panel, view] of Object.entries(defaultViewByPanel)) {
        if (routed[view] !== panel) {
            faults.push(`panel ${JSON.stringify(panel)} reports ${JSON.stringify(view)}, which routes to ${JSON.stringify(routed[view])}`);
        }
    }
    for (const panel of new Set(Object.values(routed))) {
        if (!Object.hasOwn(defaultViewByPanel, panel)) {
            faults.push(`panel ${JSON.stringify(panel)} is routable but has no reverse row`);
        }
    }
    return faults;
}

function describeModeDefaultFaults(defaultViewByMode, routed, defaultViewByPanel) {
    const faults = [];
    for (const [mode, view] of Object.entries(defaultViewByMode)) {
        if (!Object.hasOwn(routed, view)) {
            faults.push(`mode ${JSON.stringify(mode)} defaults to ${JSON.stringify(view)}, which the controller does not route`);
        } else if (defaultViewByPanel[routed[view]] !== view) {
            faults.push(
                `mode ${JSON.stringify(mode)} defaults to ${JSON.stringify(view)}, but its panel ${JSON.stringify(routed[view])} `
                + `reports ${JSON.stringify(defaultViewByPanel[routed[view]])}`,
            );
        }
    }
    return faults;
}

// ---------------------------------------------------------------------------
// Driving the real runtimes
// ---------------------------------------------------------------------------

// Every level, not only the ones the runtimes reach for today: which console
// method a debug line uses is the logging clean-up's business, not this suite's.
const silentConsole = { log() {}, info() {}, debug() {}, trace() {}, warn() {}, error() {} };

function createFakeElement(tagName) {
    const element = {
        tagName,
        children: [],
        parentNode: null,
        attributes: {},
        classList: { add() {}, remove() {}, contains() { return false; } },
        appendChild(child) {
            this.children.push(child);
            child.parentNode = this;
        },
        removeChild(child) {
            this.children = this.children.filter((candidate) => candidate !== child);
            child.parentNode = null;
        },
        remove() {
            this.parentNode?.removeChild(this);
        },
        setAttribute(name, value) {
            this.attributes[name] = value;
        },
        getAttribute(name) {
            return this.attributes[name];
        },
        removeAttribute(name) {
            delete this.attributes[name];
        },
        addEventListener() {},
        querySelectorAll() {
            return [];
        },
    };
    Object.defineProperty(element, 'firstChild', {
        get() {
            return this.children[0] || null;
        },
    });
    return element;
}

/**
 * The real controller, booted against just enough DOM to build its panel, with
 * the panels the feature runtimes register in a scene. Without them every
 * showPanelView falls back to 'mapping' and all nine rows would look alike.
 */
function loadController(uiSource = mappingUiSource) {
    const scene = createFakeElement('a-scene');
    const configScript = createFakeElement('script');
    configScript.textContent = JSON.stringify({ sceneSelector: '#scene', chartId: 'boats', chartEntityId: 'chart', dimensions: [] });
    const document = {
        readyState: 'complete',
        createElement: (tagName) => createFakeElement(tagName),
        getElementById: (id) => (id === 'codexr-tooling-config-xr-mapping-ui' ? configScript : null),
        querySelector: (selector) => (selector === '#scene' ? scene : null),
        querySelectorAll: () => [],
    };
    const sandbox = {
        console: silentConsole,
        document,
        module: { exports: {} },
        exports: {},
        // Inert timers: the runtime schedules retries and validations that must
        // not outlive the test inside the shared test process.
        setTimeout() { return 1; },
        clearTimeout() {},
    };
    sandbox.globalThis = sandbox;
    vm.runInNewContext(uiSource, sandbox, { filename: 'xrChartMappingUiRuntime.js' });
    const controller = sandbox.module.exports;
    assert.equal(controller.isPanelReady(), true, 'the fake scene no longer lets the controller build its panel');
    for (const panel of REGISTERED_PANELS) {
        assert.equal(
            typeof controller.registerPanelView({ id: panel, title: panel, content: document.createElement('a-entity') }),
            'function',
            `the controller refused to register the "${panel}" panel view`,
        );
    }
    return controller;
}

/** The real mode machinery, handing its views to `controller`; every hand-off is recorded. */
function loadModeRuntime(controller, modeSource = analysisModeSource) {
    const handOffs = [];
    const sandbox = {
        console: silentConsole,
        setTimeout() { return 1; },
        clearTimeout() {},
        CodeXRAnalysisControllerRuntime: {
            showView(view, context) {
                const shown = controller.showView(view, context);
                handOffs.push({
                    view,
                    announcedPanel: context.panelViewId,
                    acceptedView: shown.controllerView,
                    shownPanel: shown.panelView,
                });
                return shown;
            },
        },
    };
    vm.runInNewContext(modeSource, sandbox, { filename: 'analysisModeRuntime.js' });
    return { modeRuntime: sandbox.CodeXRAnalysisModeRuntime, handOffs };
}

/**
 * Sends each view through both runtimes. 'single' is the mode the machinery
 * boots in, so changeAnalysis only re-applies the routing: no lifecycle, no
 * scene, one hand-off to the controller per call.
 */
async function routeThroughBothRuntimes(views, sources = {}) {
    const controller = loadController(sources.mappingUi);
    const { modeRuntime, handOffs } = loadModeRuntime(controller, sources.analysisMode);
    const routes = [];
    for (const view of views) {
        const before = handOffs.length;
        await modeRuntime.changeAnalysis('single', { controllerView: view });
        assert.equal(handOffs.length, before + 1, `re-applying the active mode with ${view} must hand exactly one view to the controller`);
        routes.push(handOffs.at(-1));
    }
    return routes;
}

function describeRouteDisagreements(routes) {
    return routes
        .filter((route) => route.announcedPanel !== route.shownPanel)
        .map((route) => `${JSON.stringify(route.view)}: analysis-mode announces ${JSON.stringify(route.announcedPanel)}, the controller shows ${JSON.stringify(route.shownPanel)}`);
}

function viewRoutedElsewhere(panel) {
    return Object.keys(ROUTING_TABLE).find((view) => ROUTING_TABLE[view] !== panel);
}

/**
 * Opens every panel directly and asks the controller which view it is on. A
 * different panel is shown first: with no reverse row the controller keeps the
 * previous view, and only a previous view from ANOTHER panel gives that away.
 */
function openPanelsDirectly(uiSource = mappingUiSource) {
    const controller = loadController(uiSource);
    return [BUILT_IN_PANEL, ...REGISTERED_PANELS].map((panel) => {
        controller.showView(viewRoutedElsewhere(panel), {});
        const opened = controller.showPanelView(panel);
        const reportedView = controller.getControllerState().controllerView;
        const reopened = controller.showView(reportedView, {});
        return { panel, opened, reportedView, reopenedView: reopened.controllerView, reopenedPanel: reopened.panelView };
    });
}

/**
 * Enters every mode without naming a view, which is how the machinery falls
 * back on its own default, and records what the controller made of that view.
 */
async function enterEveryModeByDefault() {
    const controller = loadController();
    const { modeRuntime, handOffs } = loadModeRuntime(controller);
    const entries = [];
    for (const mode of ANALYSIS_MODES) {
        assert.equal(await modeRuntime.changeAnalysis(mode, { reason: 'controller-view-map-sync' }), true, `could not enter ${mode}`);
        const route = handOffs.at(-1);
        // A caller that names a view but no mode gets the mode inferred from the view.
        const inferredMode = controller.showView(route.view, {}).mode;
        // Coming from another panel, so that a missing reverse row cannot pass
        // by leaving the view that was just set in place.
        controller.showView(viewRoutedElsewhere(route.shownPanel), {});
        controller.showPanelView(route.shownPanel);
        entries.push({ mode, route, inferredMode, reportedView: controller.getControllerState().controllerView });
    }
    return entries;
}

function describeRoundTripFaults(visits) {
    return visits
        // reopenedView matters for the built-in panel: a view the controller
        // does not know is coerced to the single-analysis one, which lands on
        // 'mapping', so the mapping panel could report any unrouted id and
        // still appear to come back to itself.
        .filter((visit) => visit.opened !== visit.panel || visit.reopenedView !== visit.reportedView || visit.reopenedPanel !== visit.panel)
        .map((visit) => `panel ${JSON.stringify(visit.panel)} opened as ${JSON.stringify(visit.opened)}, reports ${JSON.stringify(visit.reportedView)}, `
            + `which the controller takes as ${JSON.stringify(visit.reopenedView)} and shows on ${JSON.stringify(visit.reopenedPanel)}`);
}

// ---------------------------------------------------------------------------
// Controller-view ids spelled by the other runtimes
// ---------------------------------------------------------------------------

function findUnroutedViewIds(texts, routed) {
    const namespaces = [...new Set(Object.keys(routed).filter((view) => view.includes('.')).map((view) => view.split('.')[0]))];
    assert.ok(namespaces.length > 0, 'the routing table has no namespaced view left to derive the scan from');
    const escaped = namespaces.map((namespace) => namespace.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    const spelledView = new RegExp(`(['"\`])((?:${escaped.join('|')})\\.[A-Za-z][\\w-]*)\\1`, 'g');
    const spelled = [];
    for (const { file, text } of texts) {
        for (const match of text.matchAll(spelledView)) {
            spelled.push({ file, view: match[2] });
        }
    }
    return { spelled, unrouted: spelled.filter(({ view }) => !Object.hasOwn(routed, view)) };
}

// ---------------------------------------------------------------------------
// Test-only drift, applied to in-memory copies of the assembled runtimes
// ---------------------------------------------------------------------------

/** Adds a row to the literal itself: drift the literal comparison must see. */
function withExtraRow(source, name, key, value) {
    const { open } = locateObjectLiteral(source, name, 'drift fixture');
    return `${source.slice(0, open + 1)} ${JSON.stringify(key)}: ${JSON.stringify(value)},${source.slice(open + 1)}`;
}

/** Rewrites a row AFTER the literal: invisible to the extractor, visible only to behaviour. */
function withStatementAfter(source, name, statement) {
    const { close } = locateObjectLiteral(source, name, 'drift fixture');
    return `${source.slice(0, close + 1)}; ${statement}${source.slice(close + 1)}`;
}

// ---------------------------------------------------------------------------

test('the analysis-mode and chart-mapping-ui runtimes declare the same controller-view routing table', () => {
    const { announced, routed } = readTables();

    // A custom message replaces the generated diff, so the differing rows are
    // named in it: that is the whole answer a maintainer needs.
    assert.deepEqual(
        announced,
        routed,
        'PANEL_VIEW_BY_CONTROLLER_VIEW (analysis-mode) and CONTROLLER_PANEL_BY_VIEW (chart-mapping-ui) must stay identical:\n'
        + `${describeTableDrift(ANALYSIS_MODE, announced, MAPPING_UI, routed).join('\n')}\n`
        + 'The mode runtime would announce one panel while the controller shows another.',
    );
});

test('the routing table is exactly the nine rows that 1.2.1 ships', () => {
    const { announced, routed } = readTables();

    assert.deepEqual(routed, { ...ROUTING_TABLE });
    assert.deepEqual(announced, { ...ROUTING_TABLE });
});

test('the panel-to-view table is a right inverse of the routing table and covers every routable panel', () => {
    const { routed, defaultViewByPanel } = readTables();
    const faults = describeReverseTableFaults(defaultViewByPanel, routed);

    // Several views share a panel, so this is not a full inverse. What must
    // hold is narrower: the view a panel reports has to route back to that
    // panel, and no routable panel may be left without a reported view.
    assert.equal(faults.length, 0, `CONTROLLER_VIEW_BY_PANEL disagrees with CONTROLLER_PANEL_BY_VIEW:\n${faults.join('\n')}`);
});

test('the view a panel reports is the default view of the mode that lands on it', async () => {
    const { routed, defaultViewByPanel, defaultViewByMode } = readTables();
    const faults = describeModeDefaultFaults(defaultViewByMode, routed, defaultViewByPanel);

    // This is what decides WHICH of a panel's views the reverse table names.
    // 'mapping' is shared by three views; deriving the reverse table from the
    // forward one ("last row wins") would make a directly opened mapping panel
    // report 'project-evolution.mapping' during a single analysis.
    assert.equal(faults.length, 0, `MODE_CONTROLLER_VIEW_BY_ID (analysis-mode) disagrees with the controller's tables:\n${faults.join('\n')}`);
    assert.deepEqual(
        new Set(Object.values(defaultViewByMode)),
        new Set(Object.values(defaultViewByPanel)),
        'every reported view is some mode\'s default view, and the other way round',
    );

    // The literal just judged has to be the table the machinery really falls
    // back on, for exactly the modes the driven tests enter. A new mode added
    // to the runtime alone fails here until DEFAULT_VIEW_BY_MODE learns it.
    const observed = Object.fromEntries((await enterEveryModeByDefault()).map(({ mode, route }) => [mode, route.view]));
    assert.deepEqual(observed, defaultViewByMode);
});

test('for every controller view, the panel analysis-mode announces is the panel the controller shows', async () => {
    const routes = await routeThroughBothRuntimes([...Object.keys(ROUTING_TABLE), UNKNOWN_VIEW]);
    const disagreements = describeRouteDisagreements(routes);

    assert.equal(disagreements.length, 0, `the two runtimes route the same view to different panels:\n${disagreements.join('\n')}`);
    for (const route of routes.slice(0, -1)) {
        assert.equal(route.acceptedView, route.view, `the controller coerced ${route.view} into another view`);
        assert.equal(route.shownPanel, ROUTING_TABLE[route.view], `${route.view} landed on the wrong panel`);
    }

    // Neither runtime rejects a view it does not know: each falls back on its
    // own, and the two fallbacks have to name the same panel as well.
    const unknown = routes.at(-1);
    assert.equal(unknown.view, UNKNOWN_VIEW);
    assert.equal(unknown.acceptedView, 'single.mapping');
    assert.equal(unknown.announcedPanel, ROUTING_TABLE['single.mapping']);
    assert.equal(unknown.shownPanel, ROUTING_TABLE['single.mapping']);
});

test('a panel opened directly reports a controller view that routes back to that panel', () => {
    const faults = describeRoundTripFaults(openPanelsDirectly());

    assert.equal(faults.length, 0, `the controller state would name a view whose panel is not the one on screen:\n${faults.join('\n')}`);
});

test('entering a mode without naming a view hands the controller the default view 1.2.1 ships, and the controller accepts it as is', async () => {
    const entries = await enterEveryModeByDefault();

    assert.deepEqual(
        Object.fromEntries(entries.map(({ mode, route }) => [mode, route.view])),
        { ...DEFAULT_VIEW_BY_MODE },
        'a mode enters with another view than the one 1.2.1 ships',
    );
    for (const { mode, route, inferredMode, reportedView } of entries) {
        assert.equal(route.acceptedView, route.view, `the controller coerced ${route.view}, the default view of ${mode}, into another view`);
        assert.equal(route.shownPanel, route.announcedPanel, `entering ${mode} announced one panel and showed another`);
        assert.equal(route.shownPanel, ROUTING_TABLE[route.view]);
        // Every caller names its mode today, so inferring one from the view is
        // only a fallback. It is also a fourth spelling of the same ids (one
        // literal and three namespace prefixes), and whatever becomes of it, a
        // mode's own default view must not infer another mode.
        assert.equal(inferredMode, mode, `the controller infers ${inferredMode} from ${route.view}, the default view of ${mode}`);
        // And the way back: the panel a mode lands on, opened directly, reports
        // the view that mode entered with.
        assert.equal(reportedView, route.view, `the ${route.shownPanel} panel reports ${reportedView}, not the view ${mode} lands on it with`);
    }
});

test('every namespaced controller-view id spelled under templates/ is a row of the routing table', () => {
    const files = collectFiles('templates', { extensions: ['.js', '.html'] });
    const { spelled, unrouted } = findUnroutedViewIds(files.map((file) => ({ file, text: readSource(file) })), ROUTING_TABLE);

    // The historical-comparison and project-evolution runtimes pick their own
    // views (showView calls, resolveControllerView). A misspelt or new id there
    // never throws: the controller shows the single-analysis mapping panel.
    assert.equal(
        unrouted.length,
        0,
        `controller-view ids that no routing table knows:\n${unrouted.map(({ file, view }) => `${file}: ${view}`).join('\n')}\n`
        + 'A controller view needs its row in BOTH routing tables and in ROUTING_TABLE. '
        + 'A string that only looks like one (say, a file name) is a reason to narrow this scan, not to route it.',
    );
    // Canary: the scan must still reach runtimes other than the two table owners.
    const owners = /\/(?:analysis-mode|xr-chart-mapping-ui)\//;
    assert.ok(
        spelled.some(({ file }) => !owners.test(file)),
        'the scan found no controller-view id outside the two runtimes that own the tables; it is looking at the wrong files',
    );
});

test('every namespaced controller-view id the extension host spells is a row of the routing table', () => {
    const files = collectFiles('src', { extensions: ['.ts'] });
    const { spelled, unrouted } = findUnroutedViewIds(files.map((file) => ({ file, text: readSource(file) })), ROUTING_TABLE);

    // The host picks views as well (the message router, the historical and
    // dependency bridges, the refresh coordinator, the export manifest) and
    // sends them to the browser inside analysis-view snapshots, where an id
    // without a row is shown as the single-analysis mapping panel.
    assert.equal(
        unrouted.length,
        0,
        `controller-view ids the host sends but no routing table knows:\n${unrouted.map(({ file, view }) => `${file}: ${view}`).join('\n')}\n`
        + 'A string that only looks like a controller view is a reason to narrow this scan, not to route it.',
    );
    // Canary: the host does spell views today, so finding none means the scan lost them.
    assert.ok(spelled.length > 0, 'the scan found no controller-view id under src/; it is looking at the wrong files');
});

test('the extension host enters every analysis mode with the view the browser enters it with', () => {
    // Executed from out/, not read from src/: the host keeps this table in more
    // than one place, and where it lives is about to change. What has to hold
    // is what the refresh coordinator answers, since that answer is the
    // controllerView of the snapshot the browser then routes.
    const { AnalysisRefreshCoordinator } = require(path.join(projectRoot, 'out', 'code_analysis', 'refresh', 'analysisRefreshCoordinator.js'));
    const hostDefaults = Object.fromEntries(ANALYSIS_MODES.map((mode) => {
        // One coordinator per mode: it remembers the last view of every mode it has been in.
        const coordinator = new AnalysisRefreshCoordinator();
        return [mode, coordinator.changeActiveMode('controller-view-map-sync', mode).controllerView];
    }));

    assert.deepEqual(hostDefaults, { ...DEFAULT_VIEW_BY_MODE });
});

test('each relation above reports drift when it is fed a drifted copy', async () => {
    // Nothing here compares the real tables with each other: when they do
    // drift, the tests above say so and this one stays out of the way.

    // The pure relations, on a miniature of the real shape (two views share panel "p").
    const routed = { 'a.one': 'p', 'a.two': 'p', 'b.one': 'q' };
    const reverse = { p: 'a.one', q: 'b.one' };
    const modes = { first: 'a.one', second: 'b.one' };
    assert.deepEqual(describeTableDrift('left', routed, 'right', { ...routed }), []);
    assert.deepEqual(describeTableDrift('left', routed, 'right', { ...routed, 'a.two': 'q' }), ['"a.two": left -> "p", right -> "q"']);
    assert.deepEqual(describeTableDrift('left', routed, 'right', { ...routed, 'c.one': 'p' }), ['"c.one": left -> no row, right -> "p"']);
    assert.deepEqual(describeReverseTableFaults(reverse, routed), []);
    assert.deepEqual(describeReverseTableFaults({ ...reverse, p: 'b.one' }, routed), ['panel "p" reports "b.one", which routes to "q"']);
    assert.deepEqual(describeReverseTableFaults({ p: 'a.one' }, routed), ['panel "q" is routable but has no reverse row']);
    assert.deepEqual(describeModeDefaultFaults(modes, routed, reverse), []);
    assert.equal(describeModeDefaultFaults({ ...modes, first: 'a.three' }, routed, reverse).length, 1);
    assert.equal(describeModeDefaultFaults(modes, routed, { ...reverse, p: 'a.two' }).length, 1);

    // The extractor sees a row added to a literal, and refuses a table it cannot find.
    const widened = readTables({ mappingUi: withExtraRow(mappingUiSource, 'CONTROLLER_PANEL_BY_VIEW', 'drift.probe', 'mapping') });
    assert.deepEqual(
        describeTableDrift('before', readTables().routed, 'after', widened.routed),
        ['"drift.probe": before -> no row, after -> "mapping"'],
    );
    assert.throws(
        () => readTables({ analysisMode: analysisModeSource.replaceAll('PANEL_VIEW_BY_CONTROLLER_VIEW', 'PANEL_BY_VIEW') }),
        /expected exactly one "PANEL_VIEW_BY_CONTROLLER_VIEW = \{" declaration, found 0/,
    );

    // Behaviour. The literals stay intact and one row is rewritten right after
    // them, on both sides, so the outcome does not depend on the rows under test.
    const announcing = (panel) => withStatementAfter(
        analysisModeSource, 'PANEL_VIEW_BY_CONTROLLER_VIEW', `PANEL_VIEW_BY_CONTROLLER_VIEW['historical.mapping'] = '${panel}'`,
    );
    const showing = (panel) => withStatementAfter(
        mappingUiSource, 'CONTROLLER_PANEL_BY_VIEW', `CONTROLLER_PANEL_BY_VIEW['historical.mapping'] = '${panel}'`,
    );
    const route = (announcedPanel, shownPanel) => routeThroughBothRuntimes(
        ['historical.mapping'], { analysisMode: announcing(announcedPanel), mappingUi: showing(shownPanel) },
    );
    // Such a rewrite is exactly what the literal comparison cannot see.
    assert.deepEqual(readTables({ mappingUi: showing('historical-selection') }).routed, readTables().routed);
    assert.deepEqual(describeRouteDisagreements(await route('mapping', 'mapping')), []);
    assert.deepEqual(
        describeRouteDisagreements(await route('mapping', 'historical-selection')),
        ['"historical.mapping": analysis-mode announces "mapping", the controller shows "historical-selection"'],
    );
    assert.deepEqual(
        describeRouteDisagreements(await route('historical-selection', 'mapping')),
        ['"historical.mapping": analysis-mode announces "historical-selection", the controller shows "mapping"'],
    );

    // Round trip: a panel that reports another panel's view, one that reports a
    // view nobody routes (the coercion brings it back to 'mapping' all the
    // same), and one that reports nothing.
    const reporting = (statement) => withStatementAfter(mappingUiSource, 'CONTROLLER_VIEW_BY_PANEL', statement);
    const staleReverseRow = reporting(
        'CONTROLLER_PANEL_BY_VIEW["historical.selection"] = "historical-selection"; CONTROLLER_VIEW_BY_PANEL.mapping = "historical.selection"',
    );
    const unroutedReverseRow = reporting('CONTROLLER_VIEW_BY_PANEL.mapping = "drift.probe"');
    const missingReverseRow = reporting('delete CONTROLLER_VIEW_BY_PANEL["dependency-graph"]');
    assert.ok(describeRoundTripFaults(openPanelsDirectly(staleReverseRow)).some((fault) => fault.startsWith('panel "mapping" ')));
    assert.ok(describeRoundTripFaults(openPanelsDirectly(unroutedReverseRow)).some((fault) => fault.startsWith('panel "mapping" ')));
    assert.ok(describeRoundTripFaults(openPanelsDirectly(missingReverseRow)).some((fault) => fault.startsWith('panel "dependency-graph" ')));

    // Scan: an id nobody routes, next to one that is routed.
    const scan = findUnroutedViewIds(
        [{ file: 'in-memory.js', text: 'controller.showView(`a.three`, {}); controller.showView("a.two", {});' }],
        routed,
    );
    assert.deepEqual(scan.unrouted, [{ file: 'in-memory.js', view: 'a.three' }]);
    assert.equal(scan.spelled.length, 2);
});
