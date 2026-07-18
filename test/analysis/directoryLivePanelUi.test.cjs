const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const projectRoot = path.resolve(__dirname, '..', '..');
const directoryTemplateDir = path.join(projectRoot, 'templates', 'analysis_livePanel', 'directory');
const sharedComponentDir = path.join(projectRoot, 'templates', 'components', 'livepanel');

function readTemplate(fileName) {
    return fs.readFileSync(path.join(directoryTemplateDir, fileName), 'utf8');
}

function readSharedComponent(fileName) {
    return fs.readFileSync(path.join(sharedComponentDir, fileName), 'utf8');
}

// ── Minimal, deterministic DOM harness ─────────────────────────────────────
//
// The directory LivePanel ships as browser JS bundled with the shared DataTable
// component (exactly as LivePanelParser concatenates them into main.js). There
// is no jsdom in this repo, so we run that bundle inside a `vm` context backed by
// a tiny fake DOM. The DataTable builds its DOM programmatically and keeps a
// reference to its own <tbody>, so a test can call a render function and then read
// `table.tbody.innerHTML` (or the pure `table.getVisibleRows()`) to inspect the
// result — the "feed it code, examine the output" check.

function escapeLikeBrowser(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

function createClassList() {
    const classes = new Set();
    return {
        add: (name) => classes.add(name),
        remove: (name) => classes.delete(name),
        contains: (name) => classes.has(name),
        toggle: (name, force) => {
            const shouldHave = force === undefined ? !classes.has(name) : !!force;
            if (shouldHave) {
                classes.add(name);
            } else {
                classes.delete(name);
            }
            return shouldHave;
        },
    };
}

class FakeElement {
    constructor(id) {
        this.id = id;
        this._textContent = '';
        this.innerHTML = '';
        this.disabled = false;
        this.value = '';
        this.style = {};
        this.classList = createClassList();
        this.children = [];
        this._attributes = {};
        this.dataset = {};
    }

    get textContent() {
        return this._textContent;
    }

    set textContent(value) {
        this._textContent = value === null || value === undefined ? '' : String(value);
        this.innerHTML = escapeLikeBrowser(this._textContent);
        if (this._textContent === '') {
            this.children = [];
        }
    }

    setAttribute(name, value) { this._attributes[name] = String(value); }
    getAttribute(name) {
        return Object.prototype.hasOwnProperty.call(this._attributes, name) ? this._attributes[name] : null;
    }
    addEventListener() {}
    appendChild(child) { this.children.push(child); }
    append(...nodes) { nodes.forEach((node) => this.children.push(node)); }
    querySelectorAll() { return []; }
}

/**
 * Runs the bundled directory LivePanel script (shared DataTable + template code)
 * with a fake DOM, and exposes the internals a test needs via `__api`.
 */
function loadDirectoryBundle() {
    // Exactly the order LivePanelParser bundles the shared components
    // (alphabetical directory read) ahead of the template's own script.
    // Deliberately NO Chart.js stub: the bundle must be fully self-contained.
    const sharedJs = fs.readdirSync(sharedComponentDir)
        .filter((name) => name.endsWith('.js'))
        .sort()
        .map((name) => readSharedComponent(name));
    const bundle = [
        ...sharedJs,
        readTemplate('directoryAnalysismain.js'),
        // Epilogue: class/const declarations are lexically scoped in a vm script,
        // so re-export the ones the tests drive onto the context global.
        `this.__api = {
            DataTable: DataTable,
            CodexrDonutChart: CodexrDonutChart,
            CodexrBarChart: CodexrBarChart,
            CodexrPairedBarChart: CodexrPairedBarChart,
            escapeHtml: escapeHtml,
            buildSummaryFromFiles: buildSummaryFromFiles,
            getFileComplexityClassification: getFileComplexityClassification,
            formatFileSize: formatFileSize,
            dependencyPanel: dependencyPanel,
            historicalPanel: historicalPanel,
            renderFileDetailsTable: renderFileDetailsTable,
            renderComplexFilesTable: renderComplexFilesTable,
            dataTables: dataTables,
            setFileData: function (rows) { fileData = rows; },
        };`,
    ].join('\n\n');

    const elements = new Map();
    const getElementById = (id) => {
        if (!elements.has(id)) {
            elements.set(id, new FakeElement(id));
        }
        return elements.get(id);
    };

    const documentStub = {
        getElementById,
        createElement: (tag) => new FakeElement(`created:${tag}`),
        createElementNS: (namespace, tag) => new FakeElement(`createdNS:${tag}`),
        addEventListener: () => {},
        querySelectorAll: () => [],
        head: { appendChild: () => {} },
        body: new FakeElement('body'),
        documentElement: { scrollTop: 0, scrollLeft: 0 },
    };

    const sandbox = {
        document: documentStub,
        window: { addEventListener: () => {}, dispatchEvent: () => {}, scrollTo: () => {}, initialTheme: 'light', analysisData: null, innerWidth: 1280, innerHeight: 800 },
        console: { log: () => {}, warn: () => {}, error: () => {} },
        localStorage: { getItem: () => null, setItem: () => {} },
        acquireVsCodeApi: () => ({ postMessage: () => {} }),
        EventSource: function EventSource() { return {}; },
        fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({}) }),
        setTimeout: () => 0,
        clearTimeout: () => {},
    };
    sandbox.globalThis = sandbox;

    const context = vm.createContext(sandbox);
    vm.runInContext(bundle, context, { filename: 'directoryLivePanelBundle.js' });
    return { api: sandbox.__api, getElementById };
}

function sampleDependencyDataset() {
    return {
        nodes: [
            { id: 'a', label: 'a.ts', relativePath: 'src/a.ts', language: 'TypeScript', external: false, metrics: { fanIn: 3, fanOut: 1, degree: 4, cycleSize: 2 } },
            { id: 'b', label: 'b.ts', relativePath: 'src/b.ts', language: 'TypeScript', external: false, metrics: { fanIn: 1, fanOut: 2, degree: 3, cycleSize: 2 } },
            { id: 'c', label: 'c.ts', relativePath: 'src/c.ts', language: 'TypeScript', external: false, metrics: { fanIn: 0, fanOut: 5, degree: 5, cycleSize: 0 } },
            { id: 'ext-lodash', label: 'lodash', external: true },
            { id: 'ext-react', label: 'react', external: true },
            { id: 'ext-xss', label: '<script>bad</script>', external: true },
        ],
        edges: [
            { source: 'a', target: 'b', confidence: 'exact', kind: 'import' },
            { source: 'b', target: 'a', confidence: 'exact', kind: 'import' },
            { source: 'c', target: 'ext-lodash', confidence: 'probable', kind: 'import' },
            { source: 'c', target: 'ext-lodash', confidence: 'ambiguous', kind: 'import' },
            { source: 'a', target: 'ext-react', confidence: 'exact', kind: 'import' },
            { source: 'c', target: 'ext-xss', confidence: 'exact', kind: 'import' },
        ],
        capabilities: { TypeScript: { import: 'exact', call: 'best-effort' } },
        warnings: ['Some files were skipped.'],
    };
}

// ── Shared DataTable component ─────────────────────────────────────────────

test('DataTable filters rows by the search term across searchable columns only', () => {
    const { api } = loadDirectoryBundle();
    const table = new api.DataTable('search-mount', {
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'secret', label: 'Secret', searchable: false },
        ],
        rows: [
            { name: 'alpha', secret: 'findme' },
            { name: 'beta', secret: 'nope' },
        ],
    });

    table.searchTerm = 'alp';
    assert.deepEqual(table.getVisibleRows().map((r) => r.name), ['alpha']);

    // A term that only appears in a non-searchable column matches nothing.
    table.searchTerm = 'findme';
    assert.equal(table.getVisibleRows().length, 0);
});

test('DataTable sorts numerically or lexically and toggles direction on header click', () => {
    const { api } = loadDirectoryBundle();
    const table = new api.DataTable('sort-mount', {
        columns: [
            { key: 'name', label: 'Name' },
            { key: 'score', label: 'Score', defaultDir: 'desc', value: (row) => row.score },
        ],
        rows: [
            { name: 'a', score: 2 },
            { name: 'b', score: 10 },
            { name: 'c', score: 1 },
        ],
        sort: { key: 'score', dir: 'desc' },
    });

    assert.deepEqual(table.getVisibleRows().map((r) => r.score), [10, 2, 1]);

    table._toggleSort('score'); // desc -> asc
    assert.deepEqual(table.getVisibleRows().map((r) => r.score), [1, 2, 10]);

    table._applySort('name'); // strings, ascending
    assert.deepEqual(table.getVisibleRows().map((r) => r.name), ['a', 'b', 'c']);
});

test('DataTable renders an empty-state row spanning all columns when there is no data', () => {
    const { api } = loadDirectoryBundle();
    const table = new api.DataTable('empty-mount', {
        columns: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
        rows: [],
        emptyMessage: 'Nothing here.',
    });

    assert.match(table.tbody.innerHTML, /class="data-table-empty" colspan="2"/);
    assert.match(table.tbody.innerHTML, /Nothing here\./);
});

test('DataTable escapes untrusted values through the default renderer', () => {
    const { api } = loadDirectoryBundle();
    const table = new api.DataTable('escape-mount', {
        columns: [{ key: 'label', label: 'Label' }],
        rows: [{ label: '<script>alert(1)</script>' }],
    });

    assert.match(table.tbody.innerHTML, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
    assert.doesNotMatch(table.tbody.innerHTML, /<script>alert/);
});

// ── Classic-analysis aggregation logic ─────────────────────────────────────

test('buildSummaryFromFiles aggregates totals, ratios and weighted averages from the flat file payload', () => {
    const { api } = loadDirectoryBundle();
    const files = [
        {
            status: 'success', language: 'TypeScript', totalLines: 100, commentLines: 20, blankLines: 10, codeLines: 70,
            functionCount: 2, classCount: 1, fileSizeBytes: 2048, cyclomaticComplexityNumber: 4,
            averageFunctionParameters: 2, averageFunctionNestingDepth: 1, maxFunctionParameters: 3, maxFunctionNestingDepth: 2,
            highComplexityFunctions: 1, criticalComplexityFunctions: 0,
        },
        {
            status: 'success', language: 'TypeScript', totalLines: 100, commentLines: 0, blankLines: 0, codeLines: 100,
            functionCount: 8, classCount: 0, fileSizeBytes: 1024, cyclomaticComplexityNumber: 9,
            averageFunctionParameters: 4, averageFunctionNestingDepth: 3, maxFunctionParameters: 6, maxFunctionNestingDepth: 5,
            highComplexityFunctions: 3, criticalComplexityFunctions: 2,
        },
        { status: 'error', language: 'Python' },
    ];

    const summary = api.buildSummaryFromFiles(files);

    assert.equal(summary.totalFiles, 3);
    assert.equal(summary.totalFilesAnalyzed, 2);
    assert.equal(summary.totalFilesNotAnalyzed, 1);
    assert.equal(summary.totalFunctions, 10);
    assert.equal(summary.maxFunctionParameters, 6);
    assert.equal(summary.highComplexityFunctions, 4);
    assert.equal(summary.criticalComplexityFunctions, 2);
    assert.equal(summary.averageComplexity, 8); // (4*2 + 9*8) / 10
    assert.ok(Math.abs(summary.averageFunctionParameters - 3.6) < 1e-9);
    assert.ok(Math.abs(summary.commentRatio - 0.1) < 1e-9);
    assert.deepEqual({ ...summary.languages }, { TypeScript: 2, Python: 1 });
});

test('getFileComplexityClassification maps CCN boundaries to the four severity bands', () => {
    const { api } = loadDirectoryBundle();
    const band = (ccn) => api.getFileComplexityClassification(ccn).category;
    assert.equal(band(5), 'low');
    assert.equal(band(6), 'medium');
    assert.equal(band(10), 'medium');
    assert.equal(band(11), 'high');
    assert.equal(band(20), 'high');
    assert.equal(band(21), 'critical');
});

test('formatFileSize renders bytes, kilobytes and megabytes', () => {
    const { api } = loadDirectoryBundle();
    assert.equal(api.formatFileSize(0), '0 KB');
    assert.equal(api.formatFileSize(512), '512 B');
    assert.equal(api.formatFileSize(2048), '2.0 KB');
    assert.equal(api.formatFileSize(5 * 1024 * 1024), '5.00 MB');
});

// ── File Details table (the reference table) ───────────────────────────────

test('renderFileDetailsTable builds a searchable, sortable table with a clickable file name', () => {
    const { api } = loadDirectoryBundle();
    api.setFileData([
        { fileName: 'z.ts', filePath: '/p/z.ts', relativePath: 'src/z.ts', language: 'TypeScript', fileSizeBytes: 2048, totalLines: 120, functionCount: 4, cyclomaticComplexityNumber: 12, commentRatio: 0.25, criticalComplexityFunctions: 1 },
        { fileName: 'a.ts', filePath: '/p/a.ts', relativePath: 'src/a.ts', language: 'TypeScript', fileSizeBytes: 512, totalLines: 30, functionCount: 1, cyclomaticComplexityNumber: 2, commentRatio: 0.5, criticalComplexityFunctions: 0 },
    ]);
    api.renderFileDetailsTable();

    const table = api.dataTables['file-details-table'];
    assert.ok(table, 'the file details table should be registered by its mount id');

    // Default sort is by file name ascending.
    assert.deepEqual(table.getVisibleRows().map((r) => r.fileName), ['a.ts', 'z.ts']);
    // The file name renders as a clickable cell; comment ratio is formatted.
    assert.match(table.tbody.innerHTML, /class="cell-link"/);
    assert.match(table.tbody.innerHTML, /25\.0%/);
    // Rows carry the complexity accent class from the classification.
    assert.match(table.tbody.innerHTML, /class="high-complexity clickable"/);

    // Sorting by size (desc) puts the larger file first.
    table._applySort('fileSizeBytes');
    assert.deepEqual(table.getVisibleRows().map((r) => r.fileName), ['z.ts', 'a.ts']);
});

test('renderComplexFilesTable only lists files carrying complexity, highest CCN first', () => {
    const { api } = loadDirectoryBundle();
    api.setFileData([
        { fileName: 'plain.ts', filePath: '/p/plain.ts', cyclomaticComplexityNumber: 0, functionCount: 1 },
        { fileName: 'hot.ts', filePath: '/p/hot.ts', cyclomaticComplexityNumber: 25, functionCount: 9, highComplexityFunctions: 4 },
        { fileName: 'warm.ts', filePath: '/p/warm.ts', cyclomaticComplexityNumber: 8, functionCount: 3 },
    ]);
    api.renderComplexFilesTable();

    const rows = api.dataTables['complex-files-table'].getVisibleRows();
    assert.deepEqual(rows.map((r) => r.fileName), ['hot.ts', 'warm.ts']);
});

// ── Dependency summary as shared tables ────────────────────────────────────

test('groupDependencyCycles groups mutually-recursive nodes and ignores acyclic ones', () => {
    const { api } = loadDirectoryBundle();
    const groups = api.dependencyPanel.groupCycles(sampleDependencyDataset());
    assert.equal(groups.length, 1);
    assert.deepEqual([...groups[0].map((node) => node.relativePath).sort()], ['src/a.ts', 'src/b.ts']);
});

test('renderDependencyGraphSummary populates the tiles and every dependency table', () => {
    const { api, getElementById } = loadDirectoryBundle();
    api.dependencyPanel.render(sampleDependencyDataset());

    // Tiles.
    assert.equal(getElementById('dependency-node-count').textContent, '6');
    assert.equal(getElementById('dependency-edge-count').textContent, '6');
    assert.equal(getElementById('dependency-external-count').textContent, '3');
    assert.equal(getElementById('dependency-cycle-count').textContent, '1');
    assert.equal(getElementById('dependency-warning-count').textContent, '1');

    // Fan-in ranked highest first, external nodes excluded.
    const fanIn = api.dependencyPanel.tables.get('dependency-fan-in-table');
    assert.deepEqual(fanIn.getVisibleRows().map((r) => r.label), ['src/a.ts', 'src/b.ts']);

    // External packages ordered by incoming references; hostile name escaped.
    const external = api.dependencyPanel.tables.get('dependency-external-table');
    assert.equal(external.getVisibleRows()[0].package, 'lodash');
    assert.match(external.tbody.innerHTML, /&lt;script&gt;bad&lt;\/script&gt;/);
    assert.doesNotMatch(external.tbody.innerHTML, /<script>bad<\/script>/);

    // Cycles table: one row, sized, members listed.
    const cycles = api.dependencyPanel.tables.get('dependency-cycles-table');
    assert.equal(cycles.getVisibleRows().length, 1);
    assert.match(cycles.tbody.innerHTML, /2 nodes/);
    assert.match(cycles.tbody.innerHTML, /src\/a\.ts, src\/b\.ts/);

    // Confidence table: no search box, badge + share per level.
    const confidence = api.dependencyPanel.tables.get('dependency-confidence-table');
    assert.equal(confidence.searchable, false);
    assert.deepEqual([...confidence.getVisibleRows().map((r) => r.confidence)], ['exact', 'probable', 'ambiguous']);
    assert.match(confidence.tbody.innerHTML, /data-table-badge is-good/);
    assert.match(confidence.tbody.innerHTML, /66\.7%/); // exact = 4 of 6 edges

    // Capability table with badges.
    const capability = api.dependencyPanel.tables.get('dependency-capability-table');
    assert.match(capability.tbody.innerHTML, /TypeScript/);
    assert.match(capability.tbody.innerHTML, /data-table-badge is-warn">best-effort/);

    // Warnings list + revealed content.
    assert.match(getElementById('dependency-warnings-list').innerHTML, /Some files were skipped\./);
    assert.equal(getElementById('dependency-summary-content').classList.contains('hidden'), false);
});

test('renderDependencyGraphSummary degrades gracefully on an empty dataset', () => {
    const { api } = loadDirectoryBundle();
    api.dependencyPanel.render({ nodes: [], edges: [], capabilities: {}, warnings: [] });

    assert.match(api.dependencyPanel.tables.get('dependency-fan-in-table').tbody.innerHTML, /No data available/);
    assert.match(api.dependencyPanel.tables.get('dependency-external-table').tbody.innerHTML, /No external dependencies detected/);
    assert.match(api.dependencyPanel.tables.get('dependency-cycles-table').tbody.innerHTML, /No dependency cycles detected/);
    assert.match(api.dependencyPanel.tables.get('dependency-confidence-table').tbody.innerHTML, /No dependency edges to classify/);
    assert.match(api.dependencyPanel.tables.get('dependency-capability-table').tbody.innerHTML, /No capability data available/);
});

// ── Template wiring: shared mounts, shared component, no legacy ─────────────

test('HTML mounts every list as a shared DataTable container and drops the static tables/controls', () => {
    const html = readTemplate('directoryAnalysis.html');

    for (const mountId of [
        'complex-files-table', 'file-details-table',
        'dependency-fan-in-table', 'dependency-fan-out-table', 'dependency-external-table',
        'dependency-cycles-table', 'dependency-confidence-table', 'dependency-capability-table',
    ]) {
        assert.match(html, new RegExp(`<div id="${mountId}"></div>`));
    }

    // Legacy static markup is gone.
    assert.doesNotMatch(html, /id="file-table"/);
    assert.doesNotMatch(html, /id="file-filter"/);
    assert.doesNotMatch(html, /class="table-controls"/);
    assert.doesNotMatch(html, /class="file-list"/);
    assert.doesNotMatch(html, /id="dependency-fan-in-body"/);
    assert.doesNotMatch(html, /<th>Comment %<\/th>/);
});

test('JS uses the shared DataTable for every list and keeps no legacy table code', () => {
    const js = readTemplate('directoryAnalysismain.js');
    const panel = readSharedComponent('dependencySummaryPanel.js');
    const shell = readSharedComponent('panelShell.js');

    // The table registry moved into the shared page shell.
    assert.match(shell, /new DataTable\(mountId/);
    assert.match(js, /upsertDataTable\(/);
    assert.match(js, /function renderFileDetailsTable/);
    assert.match(js, /function renderComplexFilesTable/);
    // The dependency renderers moved into the shared panel component.
    assert.match(js, /new CodexrDependencySummaryPanel\(\)/);
    assert.match(panel, /renderCyclesTable\(/);
    assert.match(panel, /renderConfidenceTable\(/);

    // Legacy functions removed.
    assert.doesNotMatch(js, /function updateFileTable/);
    assert.doesNotMatch(js, /function updateTopComplexFiles/);
    assert.doesNotMatch(js, /function filterFiles/);
    assert.doesNotMatch(js, /function sortFiles/);
    assert.doesNotMatch(js, /function getComplexityClass/);
    // escapeHtml is provided by the shared component, not redefined here.
    assert.doesNotMatch(js, /function escapeHtml/);
});

test('The shared DataTable component and its styles exist and are self-contained', () => {
    const js = readSharedComponent('dataTable.js');
    const css = readSharedComponent('dataTable.css');

    assert.match(js, /class DataTable/);
    assert.match(js, /function escapeHtml/);
    assert.match(js, /getVisibleRows\(\)/);
    assert.match(css, /\.data-table-scroll\s*\{[\s\S]*max-height:\s*420px/);
    assert.match(css, /\.data-table thead th\s*\{[\s\S]*position:\s*sticky/);
    assert.match(css, /\.data-table-badge/);
});

test('The dependency summary loads a static artifact, has no manual refresh, and reacts to SSE updates', () => {
    const js = readTemplate('directoryAnalysismain.js');
    const panel = readSharedComponent('dependencySummaryPanel.js');

    assert.match(js, /function loadDependencySummary/);
    // Loading lives in the shared panel: same-origin static artifact, no REST call.
    assert.match(panel, /fetch\('\.\/dependency-graph\.json/);
    assert.doesNotMatch(js, /\/api\/dependency-graph\/summary/);
    assert.doesNotMatch(panel, /\/api\/dependency-graph\/summary/);
    assert.doesNotMatch(js, /function refreshDependencyGraphSummary/);
    assert.doesNotMatch(js, /dependency-refresh-btn/);
    assert.match(js, /case 'dependency-updated':/);
});

// ── Shared chart components (Chart.js replacement) ─────────────────────────

test('CodexrDonutChart renders CSS-slot-classed segments and a value+share legend', () => {
    const { api, getElementById } = loadDirectoryBundle();
    const donut = new api.CodexrDonutChart('donut-mount', { centerLabel: 'Files' });
    donut.setData([
        { label: 'Low', value: 3, colorClass: 'codexr-status-good' },
        { label: 'Critical', value: 1, colorClass: 'codexr-status-critical' },
    ]);

    const container = getElementById('donut-mount').children[0];
    assert.equal(container.className, 'codexr-donut');
    const svg = container.children[0];
    const segments = svg.children.filter((child) => String(child.getAttribute('class') || '').includes('codexr-donut-segment'));
    assert.equal(segments.length, 2);
    assert.match(segments[0].getAttribute('class'), /codexr-status-good/);
    assert.match(segments[1].getAttribute('class'), /codexr-status-critical/);

    const legendRows = container.children[1].children.map(
        (item) => item.children.map((child) => child.textContent).join(' ').trim(),
    );
    assert.match(legendRows[0], /Low 3 75\.0%/);
    assert.match(legendRows[1], /Critical 1 25\.0%/);
});

test('CodexrBarChart renders capped, scaled bars with direct value labels', () => {
    const { api, getElementById } = loadDirectoryBundle();
    const chart = new api.CodexrBarChart('bars-mount', { maxRows: 2 });
    chart.setData([
        { label: 'hot()', value: 20, colorClass: 'codexr-status-critical' },
        { label: 'warm()', value: 5, colorClass: 'codexr-status-warning' },
        { label: 'dropped()', value: 1 },
    ]);

    const rows = getElementById('bars-mount').children[0].children;
    assert.equal(rows.length, 2, 'maxRows caps the rendered rows');
    const [labelEl, trackEl, valueEl] = rows[0].children;
    assert.equal(labelEl.textContent, 'hot()');
    assert.equal(valueEl.textContent, '20');
    assert.equal(trackEl.children[0].style.width, '100%');
    assert.match(trackEl.children[0].className, /codexr-status-critical/);
});

test('The bundle is fully self-contained: no Chart.js, no CDN, charts styled via CSS variables', () => {
    const html = readTemplate('directoryAnalysis.html');
    const js = readTemplate('directoryAnalysismain.js');
    const chartsJs = readSharedComponent('charts.js');
    const chartsCss = readSharedComponent('charts.css');

    assert.doesNotMatch(html, /cdn\.jsdelivr|chart\.js/i);
    assert.doesNotMatch(js, /new Chart\(/);
    assert.doesNotMatch(js, /getThemeColors|generateColors/);
    assert.match(chartsJs, /class CodexrDonutChart/);
    assert.match(chartsJs, /class CodexrBarChart/);
    assert.match(chartsJs, /class CodexrPairedBarChart/);
    assert.match(chartsCss, /--codexr-viz-series-1/);
    assert.match(chartsCss, /body\[data-theme='dark'\]/);
});

// ── Historical comparison panel wiring ──────────────────────────────────────

test('Both LivePanel templates mount the shared historical panel and wire it to REST + SSE', () => {
    const fileTemplateDir = path.join(projectRoot, 'templates', 'analysis_livePanel', 'file');
    const directoryHtml = readTemplate('directoryAnalysis.html');
    const fileHtml = fs.readFileSync(path.join(fileTemplateDir, 'fileAnalysis.html'), 'utf8');
    for (const html of [directoryHtml, fileHtml]) {
        assert.match(html, /id="historical-comparison"/);
        assert.match(html, /id="historical-left-source"/);
        assert.match(html, /id="historical-right-source"/);
        assert.match(html, /id="historical-compare-btn"/);
        assert.match(html, /id="historical-metrics-chart"/);
        assert.match(html, /id="historical-detail-table"/);
        assert.match(html, /id="dependency-graph-summary"/);
        assert.doesNotMatch(html, /cdn\./);
    }

    const panel = readSharedComponent('historicalPanel.js');
    assert.match(panel, /fetch\('\/api\/historical\/references'\)/);
    assert.match(panel, /fetch\('\/api\/historical\/compare'/);
    assert.match(panel, /historical-progress/);
    assert.match(panel, /historical-updated/);
    assert.match(panel, /revision-\$\{revision\}\.json/);

    const directoryJs = readTemplate('directoryAnalysismain.js');
    const fileJs = fs.readFileSync(path.join(fileTemplateDir, 'fileAnalysismain.js'), 'utf8');
    for (const js of [directoryJs, fileJs]) {
        assert.match(js, /new CodexrHistoricalPanel\(\)/);
        assert.match(js, /historicalPanel\.initialize\(\)/);
        assert.match(js, /case 'historical-progress':/);
        assert.match(js, /case 'historical-updated':/);
        assert.match(js, /new CodexrDependencySummaryPanel\(\)/);
        assert.doesNotMatch(js, /new Chart\(/);
    }
});

test('CodexrHistoricalPanel joins both payloads by comparisonKey and derives per-item status', () => {
    const { api } = loadDirectoryBundle();
    const metrics = ['totalLines'];
    const left = [
        { comparisonKey: 'file:a', filePath: 'a.ts', totalLines: 10 },
        { comparisonKey: 'file:gone', filePath: 'gone.ts', totalLines: 5 },
        { comparisonKey: 'file:same', filePath: 'same.ts', totalLines: 7 },
    ];
    const right = [
        { comparisonKey: 'file:a', filePath: 'a.ts', totalLines: 14 },
        { comparisonKey: 'file:new', filePath: 'new.ts', totalLines: 3 },
        { comparisonKey: 'file:same', filePath: 'same.ts', totalLines: 7 },
    ];

    // Function-scoped rows (file comparisons) are labeled by function name —
    // every function of the file shares the same filePath, so the file path
    // must never win over the function identity.
    const functionRows = api.historicalPanel.buildDetailRows(
        [{ comparisonKey: 'function:app.ts:main#0:1', filePath: 'app.ts', functionName: 'main', complexity: 3 }],
        [{ comparisonKey: 'function:app.ts:main#0:1', filePath: 'app.ts', functionName: 'main', complexity: 5 }],
        ['complexity'],
    );
    assert.equal(functionRows[0].label, 'main');
    assert.equal(functionRows[0].status, 'modified');
    assert.equal(functionRows[0]['delta:complexity'], 2);

    const rows = api.historicalPanel.buildDetailRows(left, right, metrics);
    const byLabel = new Map(rows.map((row) => [row.label, row]));
    assert.equal(byLabel.get('a.ts').status, 'modified');
    assert.equal(byLabel.get('a.ts')['delta:totalLines'], 4);
    assert.equal(byLabel.get('gone.ts').status, 'removed');
    assert.equal(byLabel.get('new.ts').status, 'added');
    assert.equal(byLabel.get('same.ts').status, 'unchanged');
    // Sorted by status severity: added/removed/modified before unchanged.
    assert.equal(rows[rows.length - 1].status, 'unchanged');
});

test('The Live Updates indicator flashes "New data received" then reverts to the steady state', () => {
    const js = readTemplate('directoryAnalysismain.js');
    const shell = readSharedComponent('panelShell.js');

    // The indicator implementation lives in the shared page shell; the
    // template drives it on every SSE data refresh.
    assert.match(shell, /function flashSSEStatus/);
    assert.match(js, /flashSSEStatus\('New data received'\)/);
    // The flash schedules a revert back to the "connected" (Live Updates) state.
    assert.match(js, /showSSEStatus\('connected'\)/);
    assert.match(shell, /setTimeout\(\(\) => \{[\s\S]*showSSEStatus\('connected'\);/);
});

test('The header renders the file-count and timestamp as icon chips, not solid blocks', () => {
    const html = readTemplate('directoryAnalysis.html');
    const css = readTemplate('directoryAnalysisstyle.css');

    assert.match(html, /class="info-chip"/);
    assert.match(html, /class="info-chip-icon"/);
    assert.match(html, /<strong id="file-count">0<\/strong> \/ <span id="total-file-count">0<\/span> files analyzed/);
    assert.match(html, /class="info-chip-text" id="analysis-timestamp"/);
    assert.match(css, /\.info-chip\s*\{/);
    assert.match(css, /\.info-chip-icon\s*\{[\s\S]*width:\s*16px/);
    // The old solid-primary blocks were replaced.
    assert.doesNotMatch(css, /\.analysis-info span \{/);
});
