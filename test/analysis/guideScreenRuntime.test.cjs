const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..', '..');
const { readAssembledRuntime } = require(path.join(root, 'test', 'helpers', 'runtimeAssembly.cjs'));
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

function loadRuntime() {
    const source = readAssembledRuntime('guide-screen', 'guideScreenRuntime.js');
    const context = {};
    vm.runInNewContext(source, context, { filename: 'guideScreenRuntime.js' });
    return context.CodeXRGuideRuntime;
}

test('guide content covers every analysis mode from one declarative model', () => {
    const runtime = loadRuntime();
    const sections = runtime.__testing.GUIDE_SECTIONS;

    assert.ok(sections.length >= 5);
    const ids = sections.map(section => section.id);
    for (const mode of ['overview', 'single', 'dependency-graph', 'historical', 'evolution']) {
        assert.ok(ids.includes(mode), `has a section for ${mode}`);
    }
    for (const section of sections) {
        assert.ok(section.title && section.tab, `${section.id} has a title and tab label`);
        assert.match(section.color, /^#[0-9a-fA-F]{6}$/);
        assert.ok(Array.isArray(section.lines) && section.lines.length >= 3);
    }
    // The dependency section teaches the metrics the graph actually shows.
    const deps = sections.find(section => section.id === 'dependency-graph');
    assert.match(deps.lines.join(' '), /Instability/);
    assert.match(deps.lines.join(' '), /fan-in/i);
});

test('the DOM projection renders every section with escaped content', () => {
    const runtime = loadRuntime();
    const html = runtime.guideHtmlString();

    for (const section of runtime.__testing.GUIDE_SECTIONS) {
        assert.ok(html.includes('id="' + section.id + '"'), `renders section ${section.id}`);
        const escapedTitle = runtime.__testing.escapeHtml(section.title);
        assert.ok(html.includes('>' + escapedTitle + '</h2>'), `renders heading for ${section.id}`);
    }
    assert.match(html, /guide-toc/);
    assert.equal(runtime.__testing.escapeHtml('<a & "b">'), '&lt;a &amp; &quot;b&quot;&gt;');

    // renderGuideHtml mounts the same string.
    const container = { innerHTML: '' };
    assert.equal(runtime.renderGuideHtml(container), true);
    assert.equal(container.innerHTML, html);
});

test('the XR guide screen is interactive, configurable, and safe without A-Frame', () => {
    const source = readAssembledRuntime('guide-screen', 'guideScreenRuntime.js');
    // Tabs are raycastable, placement comes from the tooling config, and the
    // screen advertises the served guide.html twin.
    assert.match(source, /babiaxraycasterclass/);
    assert.match(source, /'data-codexr-interactive': 'true'/);
    assert.match(source, /codexr-tooling-config-guide-screen/);
    assert.match(source, /\/guide\.html/);
    // guide.html loads this runtime without AFRAME: autoInit must gate on it.
    assert.match(source, /!root\.AFRAME/);

    // Section navigation wraps around in both directions.
    const runtime = loadRuntime();
    const total = runtime.__testing.GUIDE_SECTIONS.length;
    runtime.setSection(total + 2);
    assert.equal(runtime.getState().sectionIndex, 2);
    runtime.setSection(-1);
    assert.equal(runtime.getState().sectionIndex, total - 1);
});

test('both XR parsers ship the guide runtime and the served guide.html page', () => {
    const fileParser = read('src/code_analysis/engine/parsers/fileXRParser.ts');
    const directoryParser = read('src/code_analysis/engine/parsers/directoryXRParser.ts');
    const sceneTemplate = read('templates/xr/file/xr-visualization.html');
    const guidePage = read('templates/guide/guide.html');

    assert.match(fileParser, /copyGuideScreenRuntimeToOutput/);
    assert.match(fileParser, /copyGuidePageToOutput/);
    assert.match(fileParser, /GUIDE_SCREEN_RUNTIME_OUTPUT_NAME/);
    assert.match(fileParser, /GUIDE_PAGE_OUTPUT_NAME/);
    assert.match(directoryParser, /readGuideScreenRuntimeContent/);
    assert.match(directoryParser, /readGuidePageContent/);
    assert.match(sceneTemplate, /guideScreenRuntime\.js/);
    // The served page is a thin shell over the shared model — no duplicated copy.
    assert.match(guidePage, /src="\.\/guideScreenRuntime\.js"/);
    assert.match(guidePage, /renderGuideHtml\(document\.getElementById\('guide-root'\)\)/);
    assert.doesNotMatch(guidePage, /Dependency graph<\/h2>/);
});

test('every analysis-mode section ships a grounded metric glossary', () => {
    const runtime = loadRuntime();
    const sections = runtime.__testing.GUIDE_SECTIONS;
    const byId = Object.fromEntries(sections.map(section => [section.id, section]));

    // The four analysis modes explain their data; the intro/tips tabs do not.
    for (const id of ['single', 'dependency-graph', 'historical', 'evolution']) {
        const metrics = byId[id].metrics;
        assert.ok(Array.isArray(metrics) && metrics.length >= 4, `${id} has a glossary`);
        assert.ok(metrics.length <= 8, `${id} glossary fits the XR screen`);
        for (const metric of metrics) {
            assert.ok(metric.term && metric.definition, `${id} entries are complete`);
            // One-row constraint on the XR screen (definition wrap-count is 52).
            assert.ok(metric.definition.length <= 52, `${id}: "${metric.term}" definition fits one row`);
        }
    }
    assert.equal(byId.overview.metrics, undefined);
    assert.equal(byId.tips.metrics, undefined);

    // The flagship terms the user asked about are defined where expected.
    const depTerms = byId['dependency-graph'].metrics.map(metric => metric.term);
    for (const term of ['Fan-in', 'Fan-out', 'Degree', 'Cycle', 'Instability', 'Confidence']) {
        assert.ok(depTerms.includes(term), `dependency glossary defines ${term}`);
    }
    const normalTerms = byId.single.metrics.map(metric => metric.term);
    assert.ok(normalTerms.includes('Complexity (CCN)'));
    assert.ok(byId.historical.metrics.some(metric => metric.term === 'Delta'));
    assert.ok(byId.evolution.metrics.some(metric => metric.term === 'Frame'));
});

test('the DOM projection renders a Data represented block per glossary section', () => {
    const runtime = loadRuntime();
    const html = runtime.guideHtmlString();
    const chunks = html.split('<section class="guide-section"').slice(1);
    const chunkById = {};
    for (const chunk of chunks) {
        const id = /id="([^"]+)"/.exec(chunk)[1];
        chunkById[id] = chunk;
    }

    for (const id of ['single', 'dependency-graph', 'historical', 'evolution']) {
        assert.match(chunkById[id], /Data represented/);
        assert.match(chunkById[id], /guide-metrics/);
    }
    assert.doesNotMatch(chunkById.overview, /guide-metrics/);
    assert.doesNotMatch(chunkById.tips, /guide-metrics/);
    assert.match(chunkById['dependency-graph'], />Fan-in<\/dt>/);
    assert.match(chunkById['dependency-graph'], />Instability<\/dt>/);
});

test('the XR screen offers a per-section Guide/Data toggle that resets on tab change', () => {
    const source = readAssembledRuntime('guide-screen', 'guideScreenRuntime.js');
    assert.match(source, /\{ id: 'lines', label: 'Guide'/);
    assert.match(source, /\{ id: 'metrics', label: 'Data'/);
    assert.match(source, /function setGuideView/);

    const runtime = loadRuntime();
    runtime.setSection(2); // dependency-graph
    assert.equal(runtime.getState().view, 'lines');
    runtime.setView('metrics');
    assert.equal(runtime.getState().view, 'metrics');
    // Unknown views fall back to the guide view.
    runtime.setView('bogus');
    assert.equal(runtime.getState().view, 'lines');
    // Switching tabs always lands on the how-to view.
    runtime.setView('metrics');
    runtime.setSection(3);
    assert.equal(runtime.getState().view, 'lines');
});

test('long sections paginate and the page state resets with tab and view changes', () => {
    const runtime = loadRuntime();
    const sections = runtime.__testing.GUIDE_SECTIONS;
    const rowsPerPage = runtime.__testing.rowsPerPage;

    // The dependency section grew past one page — the reason pagination exists.
    const deps = sections.find(section => section.id === 'dependency-graph');
    assert.ok(deps.lines.length > rowsPerPage);
    // Every line still fits one XR row.
    for (const section of sections) {
        for (const line of section.lines) {
            assert.ok(line.length <= 62, `${section.id}: "${line}" fits one row`);
        }
    }

    runtime.setSection(2); // dependency-graph, page 0
    assert.equal(runtime.getState().pageIndex, 0);
    runtime.setPage(1);
    assert.equal(runtime.getState().pageIndex, 1);
    // Wraps in both directions over the 2 pages of lines.
    runtime.setPage(2);
    assert.equal(runtime.getState().pageIndex, 0);
    runtime.setPage(-1);
    assert.equal(runtime.getState().pageIndex, 1);
    // Switching view or tab always returns to the first page.
    runtime.setView('metrics');
    assert.equal(runtime.getState().pageIndex, 0);
    runtime.setPage(1);
    runtime.setSection(0);
    assert.equal(runtime.getState().pageIndex, 0);
});

test('the guide screen is a fixed-content subtype of the virtual screen', () => {
    const source = readAssembledRuntime('guide-screen', 'guideScreenRuntime.js');
    // The parent contributes chrome/drag/resize/follow/shared entity; the
    // subtype only registers its immutable content and creates the screen
    // through the parent factory.
    assert.match(source, /CodeXRVirtualScreenRuntime/);
    assert.match(source, /registerContentProvider\(GUIDE_CONTENT_PROVIDER_ID, buildGuideContent\)/);
    assert.match(source, /parent\.createRuntime\(root\)/);
    assert.match(source, /contentKind: 'fixed'/);
    assert.match(source, /contentProviderId: GUIDE_CONTENT_PROVIDER_ID/);
    assert.match(source, /instanceId: GUIDE_SCREEN_ID/);
    assert.match(source, /broadcastEnabled: false/);
    assert.match(source, /registerWellKnownScreen\(GUIDE_SCREEN_ID/);
    // No self-made screen mechanics remain: drag, wheel depth and billboarding
    // are inherited, and the guide never touches WebRTC video.
    assert.doesNotMatch(source, /Drag to move/);
    assert.doesNotMatch(source, /startGuideDrag/);
    assert.doesNotMatch(source, /faceCameraYaw/);
    assert.doesNotMatch(source, /a-video/);
    // The overview teaches the inherited gesture (edge move / corner resize).
    const runtime = loadRuntime();
    const overview = runtime.__testing.GUIDE_SECTIONS.find(section => section.id === 'overview');
    assert.match(overview.lines.join(' '), /edges; corners resize/);
    assert.equal(runtime.__testing.GUIDE_SCREEN_ID, 'guide');
    assert.equal(runtime.__testing.GUIDE_CONTENT_PROVIDER_ID, 'codexr-guide');
});

test('the guide screen stacks above the default screen by derived anchor', () => {
    const source = readAssembledRuntime('guide-screen', 'guideScreenRuntime.js');
    // Same X/Z as the default screen; Y raised by the default's half height +
    // header clearance + the guide's half height, derived from the shared
    // screen config (parent mergeConfig) so re-anchoring the default moves the
    // guide with it. The tooling config script can still override.
    assert.match(source, /function guideStackAnchor/);
    assert.match(source, /GUIDE_STACK_CLEARANCE = 0\.65/);
    assert.match(source, /parent\.mergeConfig\?\./);
    assert.match(source, /defaultHalfHeight \+ GUIDE_STACK_CLEARANCE \+ \(SCREEN\.height \/ 2\)/);
    assert.match(source, /parseGuideVector\(config\.position, anchor\.position\)/);
    assert.match(source, /parseGuideVector\(config\.rotation, anchor\.rotation\)/);
    // The old corner placement is gone.
    assert.doesNotMatch(source, /8\.6, y: 2\.7, z: -13\.2/);
});

test('the guide reserves its well-known id at script load', () => {
    const source = readAssembledRuntime('guide-screen', 'guideScreenRuntime.js');
    const reserveAt = source.indexOf("reserveWellKnownScreenId?.(GUIDE_SCREEN_ID)");
    const createAt = source.indexOf('function createGuideScreen');
    assert.ok(reserveAt > -1, 'guide must reserve its id');
    assert.ok(createAt > -1);
    // Module scope: the reservation executes when the script loads, before the
    // scene (and any snapshot replay) can reach the manager.
    assert.ok(reserveAt < createAt, 'reservation must be at module scope, before screen creation');
});
