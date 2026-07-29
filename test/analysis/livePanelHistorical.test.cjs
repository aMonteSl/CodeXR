/**
 * LivePanel historical-comparison integration (v1.2.0).
 *
 * The XR historical comparator is reused for LivePanel through three seams:
 *  1. the capability table grants LivePanel `historicalComparison`;
 *  2. HistoricalComparisonService's session gate admits LivePanel sessions;
 *  3. HttpServer exposes REST endpoints (references + compare) and pushes
 *     progress/results over SSE, since LivePanel has no collaboration room.
 * A comparison with a working-copy side stays live: the analysisUpdateEvents
 * wiring refreshes it after every incremental re-analysis.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

function readProjectFile(...segments) {
    return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

test('the capability table grants LivePanel historical comparison while project evolution stays XR-only', () => {
    const capabilities = readProjectFile('src', 'servers', 'runtime', 'analysisServerCapabilities.ts');
    const livePanelEntry = capabilities.match(/LivePanel: \{[\s\S]*?\},/)?.[0] || '';
    assert.match(livePanelEntry, /dependencyGraph: true/);
    assert.match(livePanelEntry, /historicalComparison: true/);
    assert.match(livePanelEntry, /projectEvolution: false/);
});

test('the historical comparison service admits LivePanel sessions and still throws for anything else', () => {
    const service = readProjectFile('src', 'code_analysis', 'historical', 'historicalComparisonService.ts');
    assert.match(service, /session\.analysisMode !== 'XR' && session\.analysisMode !== 'LivePanel'/);
    assert.match(service, /historical-comparison-session-unavailable/);
});

test('HttpServer exposes LivePanel REST endpoints for references and async compare', () => {
    // Routing stays in the façade; the handlers live in the historical bridge.
    const routing = readProjectFile('src', 'servers', 'runtime', 'httpServer.ts');
    const server = readProjectFile('src', 'servers', 'runtime', 'analysis', 'historicalComparisonBridge.ts');
    assert.match(routing, /case '\/historical\/references':/);
    assert.match(routing, /case '\/historical\/compare':/);
    assert.match(server, /public async handleHistoricalReferences\(/);
    assert.match(server, /public async handleHistoricalCompare\(/);
    // References report availability instead of failing on non-Git targets.
    assert.match(server, /sendJsonResponse\(res, 200, \{ enabled: false, reason: availability\.reason \}\)/);
    // Compare answers 202 and runs the comparison in the background.
    assert.match(server, /sendJsonResponse\(res, 202, \{ accepted: true \}\)/);
    assert.match(server, /A historical comparison is already running\./);
});

test('the analysis host pushes historical progress and results to LivePanel over SSE', () => {
    const server = readProjectFile('src', 'servers', 'runtime', 'analysis', 'analysisFeatureHost.ts');
    assert.match(server, /public notifyLivePanelHistoricalProgress\(/);
    assert.match(server, /public notifyLivePanelHistoricalUpdated\(/);
    assert.match(server, /type: 'historical-progress'/);
    assert.match(server, /type: 'historical-updated'/);
    // The SSE target helper keeps every notify call a no-op outside LivePanel.
    assert.match(server, /private getLivePanelSseTarget\(\): string \| null/);
    assert.match(server, /if \(this\.analysisMode !== 'LivePanel'\) \{\s*return null;/);
});

test('a live comparison refreshes after every incremental re-analysis and republishes over SSE', () => {
    const server = readProjectFile('src', 'servers', 'runtime', 'analysis', 'analysisFeatureHost.ts');
    // LivePanel sessions schedule the refresh straight from analysisUpdateEvents
    // (no XR view-mode gate); the schedule itself no-ops without a live source.
    assert.match(server, /if \(this\.analysisMode === 'LivePanel'\) \{[\s\S]*?this\.scheduleHistoricalComparisonRefresh\(\);[\s\S]*?return;/);
    // The watcher-driven refresh result reaches the panel too.
    assert.match(server, /this\.notifyLivePanelHistoricalUpdated\(result\.revision\);/);
});

test('file comparisons only offer versions that actually contain the analyzed file', () => {
    const service = readProjectFile('src', 'code_analysis', 'historical', 'historicalComparisonService.ts');
    const catalog = readProjectFile('src', 'code_analysis', 'historical', 'gitAnalysisEligibility.ts');
    const index = readProjectFile('src', 'code_analysis', 'historical', 'gitTimelineBlobIndex.ts');
    // The shared read-only Git catalogue filters target absence before either
    // Historical or Evolution publishes its reference list.
    assert.match(service, /this\.sourceCatalog\.filterSources\([\s\S]*sources: references\.sources/);
    assert.match(service, /sources: filtered\.sources/);
    assert.match(catalog, /revision\.missingTarget[\s\S]*code: 'target-missing'/);
    assert.match(index, /if \(this\.targetType === 'file'\)/);
    assert.match(index, /metricAnalyzable: isMetricAnalysisFile\(fileName\)/);
    // A raw API request is protected as well and removes the SHA from both
    // selectors through the same deterministic exclusion catalogue.
    assert.match(service, /if \(!materialized\.targetPath\)[\s\S]*this\.excludeSource\([\s\S]*'target-missing'/);
    assert.match(service, /recordDeterministicExclusion/);
});

test('file comparisons analyze only the analyzed file itself, at function scope', () => {
    const gitService = readProjectFile('src', 'code_analysis', 'historical', 'gitRepositoryService.ts');
    const service = readProjectFile('src', 'code_analysis', 'historical', 'historicalComparisonService.ts');
    const panel = readProjectFile('templates', 'components', 'livepanel', 'historicalPanel.js');
    // Only the analyzed file is materialized from the Git reference — never the
    // surrounding directory.
    assert.match(gitService, /this\.materializeFile\(repositoryRoot, source\.commitSha, targetRelativePath, destinationPath\)/);
    assert.match(gitService, /\['show', objectSpec\]/);
    // The historical session analyzes that single materialized file...
    assert.match(service, /targetPath: materialized\.targetPath/);
    // ...and file sessions key comparison rows per function of the file.
    assert.match(service, /comparisonKey: `function:\$\{targetKey\}:\$\{signature\.toLocaleLowerCase\(\)\}:\$\{ordinal\}`/);
    // The client labels function-scoped rows by function name, not the (shared) file path.
    assert.match(panel, /reference\.functionName \|\| reference\.filePath/);
});

test('LivePanel dependency seeding covers file sessions as well as directories', () => {
    const server = readProjectFile('src', 'servers', 'runtime', 'analysis', 'analysisFeatureHost.ts');
    // The old directory-only guard is gone; any LivePanel session seeds and
    // background-refreshes its dependency dataset (the service resolves the
    // project root for file targets).
    assert.doesNotMatch(server, /this\.analysisMode === 'LivePanel' && session\?\.targetType === 'directory'/);
    assert.match(server, /if \(this\.analysisMode === 'LivePanel'\) \{[\s\S]*?setBackgroundRefresh\(livePanelSessionId, 'dependency-graph', true\)/);
});

test('derived metric values are shown at the precision the metrics themselves use', () => {
    // formatMetricValue is executed for real: a regex over the source would not
    // catch the float noise this exists to remove.
    const shell = readProjectFile('templates', 'components', 'livepanel', 'panelShell.js');
    const source = shell.match(/function formatMetricValue[\s\S]*?\n\}/)?.[0];
    assert.ok(source, 'panelShell must define formatMetricValue');
    const formatMetricValue = new Function(`${source}; return formatMetricValue;`)();

    // The exact case seen in the comparison table: 5.44 - 8.86.
    assert.equal(formatMetricValue(5.44 - 8.86), '-3.42');
    assert.equal(formatMetricValue(4.82 - 5.51), '-0.69');
    // Integers keep their exact form — no ".00" tail on counts.
    assert.equal(formatMetricValue(3548), '3548');
    assert.equal(formatMetricValue(0), '0');
    assert.equal(formatMetricValue(-7), '-7');
    // Trailing zeros are dropped rather than padded.
    assert.equal(formatMetricValue(5.4), '5.4');
    assert.equal(formatMetricValue(5.401), '5.4');
    // Junk never reaches the DOM as "NaN"/"undefined".
    assert.equal(formatMetricValue(undefined), '0');
    assert.equal(formatMetricValue(null), '0');
    assert.equal(formatMetricValue(Number.NaN), '0');
    assert.equal(formatMetricValue(Number.POSITIVE_INFINITY), '0');
});

test('the comparison delta cell formats every number and never signs a rounded-away change', () => {
    const panel = readProjectFile('templates', 'components', 'livepanel', 'historicalPanel.js');
    const cell = panel.match(/key: `delta:\$\{metric\}`[\s\S]*?\n        \},/)?.[0] || '';
    assert.ok(cell, 'the delta column renderer should exist');

    // All three numbers go through the formatter — printing any of them raw is
    // what produced "8.86 → 5.44 (-3.419999999999999)".
    assert.equal((cell.match(/formatMetricValue\(/g) || []).length, 3);
    for (const side of ['left', 'right', 'delta']) {
        assert.match(
            cell,
            new RegExp(`const ${side} = formatMetricValue\\(row\\[\`${side}:`),
            `${side} must be formatted before it reaches the cell`,
        );
    }
    // The sign is decided from the displayed value, so "+0" cannot happen.
    assert.match(cell, /const sign = Number\(delta\) > 0 \? '\+' : '';/);
});
