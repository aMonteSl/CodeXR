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
    const server = readProjectFile('src', 'servers', 'runtime', 'httpServer.ts');
    assert.match(server, /case '\/historical\/references':/);
    assert.match(server, /case '\/historical\/compare':/);
    assert.match(server, /private async handleHistoricalReferences\(/);
    assert.match(server, /private async handleHistoricalCompare\(/);
    // References report availability instead of failing on non-Git targets.
    assert.match(server, /this\.sendJsonResponse\(res, 200, \{ enabled: false, reason: availability\.reason \}\)/);
    // Compare answers 202 and runs the comparison in the background.
    assert.match(server, /this\.sendJsonResponse\(res, 202, \{ accepted: true \}\)/);
    assert.match(server, /A historical comparison is already running\./);
});

test('HttpServer pushes historical progress and results to LivePanel over SSE', () => {
    const server = readProjectFile('src', 'servers', 'runtime', 'httpServer.ts');
    assert.match(server, /private notifyLivePanelHistoricalProgress\(/);
    assert.match(server, /private notifyLivePanelHistoricalUpdated\(/);
    assert.match(server, /type: 'historical-progress'/);
    assert.match(server, /type: 'historical-updated'/);
    // The SSE target helper keeps every notify call a no-op outside LivePanel.
    assert.match(server, /private getLivePanelSseTarget\(\): string \| null/);
    assert.match(server, /if \(this\.analysisMode !== 'LivePanel'\) \{\s*return null;/);
});

test('a live comparison refreshes after every incremental re-analysis and republishes over SSE', () => {
    const server = readProjectFile('src', 'servers', 'runtime', 'httpServer.ts');
    // LivePanel sessions schedule the refresh straight from analysisUpdateEvents
    // (no XR view-mode gate); the schedule itself no-ops without a live source.
    assert.match(server, /if \(this\.analysisMode === 'LivePanel'\) \{[\s\S]*?this\.scheduleHistoricalComparisonRefresh\(\);[\s\S]*?return;/);
    // The watcher-driven refresh result reaches the panel too.
    assert.match(server, /this\.notifyLivePanelHistoricalUpdated\(result\.revision\);/);
});

test('file comparisons only offer versions that actually contain the analyzed file', () => {
    const gitService = readProjectFile('src', 'code_analysis', 'historical', 'gitRepositoryService.ts');
    const service = readProjectFile('src', 'code_analysis', 'historical', 'historicalComparisonService.ts');
    // The read-only existence probe on the Git service...
    assert.match(gitService, /public async targetExistsInCommit\(commitSha: string\): Promise<boolean>/);
    assert.match(gitService, /gitObjectExists\(repositoryRoot, `\$\{commitSha\}:\$\{targetRelativePath\}`\)/);
    // ...filters the reference list for file sessions (working copy always stays,
    // directory sessions keep every reference)...
    assert.match(service, /sources: await this\.filterSourcesForTarget\(references\.sources\)/);
    assert.match(service, /targetType !== 'file'/);
    assert.match(service, /source\.kind === 'workingCopy'/);
    assert.match(service, /targetExistsInCommit\(source\.commitSha\)/);
    // ...and a raw API request against a version lacking the file is refused.
    assert.match(service, /comparison-target-missing-in-version/);
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
    const server = readProjectFile('src', 'servers', 'runtime', 'httpServer.ts');
    // The old directory-only guard is gone; any LivePanel session seeds and
    // background-refreshes its dependency dataset (the service resolves the
    // project root for file targets).
    assert.doesNotMatch(server, /this\.analysisMode === 'LivePanel' && session\?\.targetType === 'directory'/);
    assert.match(server, /if \(this\.analysisMode === 'LivePanel'\) \{[\s\S]*?setBackgroundRefresh\(livePanelSessionId, 'dependency-graph', true\)/);
});
