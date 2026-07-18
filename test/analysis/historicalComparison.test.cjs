const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..', '..');

function readProjectFile(...segments) {
    return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

function loadGitRepositoryService() {
    const sourcePath = path.join(
        projectRoot,
        'src',
        'code_analysis',
        'historical',
        'gitRepositoryService.ts',
    );
    const previousLoader = require.extensions['.ts'];
    require.extensions['.ts'] = function compileTypeScript(module, filename) {
        const source = fs.readFileSync(filename, 'utf8');
        const transpiled = ts.transpileModule(source, {
            compilerOptions: {
                module: ts.ModuleKind.CommonJS,
                target: ts.ScriptTarget.ES2022,
                esModuleInterop: true,
            },
            fileName: filename,
        }).outputText;
        module._compile(transpiled, filename);
    };
    try {
        delete require.cache[sourcePath];
        return require(sourcePath).GitRepositoryService;
    } finally {
        if (previousLoader) {
            require.extensions['.ts'] = previousLoader;
        } else {
            delete require.extensions['.ts'];
        }
    }
}

function runGit(repositoryPath, args) {
    return childProcess.execFileSync(
        'git',
        ['-C', repositoryPath, ...args],
        { encoding: 'utf8', windowsHide: true },
    ).trim();
}

test('historical Git service resolves server-owned refs without checkout, fetch, shell, or .git writes', () => {
    const source = readProjectFile(
        'src',
        'code_analysis',
        'historical',
        'gitRepositoryService.ts',
    );

    assert.match(source, /childProcess\.execFile\(/);
    assert.match(source, /const execFile = promisify\(childProcess\.execFile\)/);
    assert.doesNotMatch(source, /shell\s*:/);
    assert.doesNotMatch(source, /['"]checkout['"]/);
    assert.doesNotMatch(source, /['"]fetch['"]/);
    assert.doesNotMatch(source, /writeFile\([^)]*\.git/);
    assert.match(source, /MAX_SNAPSHOT_FILES = 5000/);
    assert.match(source, /MAX_SNAPSHOT_BYTES = 100 \* 1024 \* 1024/);
    assert.match(source, /comparison-snapshot-path-escape/);
    assert.match(source, /comparison-snapshot-file-limit/);
    assert.match(source, /comparison-snapshot-size-limit/);
});

test('historical Git service materializes repository roots, branches, tags, commits, and nested targets', async () => {
    const GitRepositoryService = loadGitRepositoryService();
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-history-git-'));
    const repositoryPath = path.join(temporaryRoot, 'repository');
    const snapshotRoot = path.join(temporaryRoot, 'snapshots');
    fs.mkdirSync(path.join(repositoryPath, 'src'), { recursive: true });
    runGit(repositoryPath, ['init']);
    runGit(repositoryPath, ['config', 'user.name', 'CodeXR Tests']);
    runGit(repositoryPath, ['config', 'user.email', 'codexr-tests@example.invalid']);
    fs.writeFileSync(path.join(repositoryPath, 'README.md'), 'initial\n');
    fs.writeFileSync(path.join(repositoryPath, 'src', 'existing.js'), 'export const value = 1;\n');
    fs.mkdirSync(path.join(repositoryPath, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(repositoryPath, 'dist', 'generated.js'), 'generated\n');
    fs.mkdirSync(path.join(repositoryPath, 'exceltools', 'lib', 'python3.12', 'site-packages', 'thirdparty'), { recursive: true });
    fs.writeFileSync(
        path.join(repositoryPath, 'exceltools', 'lib', 'python3.12', 'site-packages', 'thirdparty', 'vendor.py'),
        'def vendor():\n    return True\n',
    );
    fs.writeFileSync(path.join(repositoryPath, 'large-asset.bin'), Buffer.alloc(1024 * 1024));
    runGit(repositoryPath, ['add', '.']);
    runGit(repositoryPath, ['commit', '-m', 'initial revision']);
    const initialSha = runGit(repositoryPath, ['rev-parse', 'HEAD']);
    const initialBranch = runGit(repositoryPath, ['branch', '--show-current']);
    runGit(repositoryPath, ['branch', 'historical-branch']);
    runGit(repositoryPath, ['tag', 'historical-tag']);
    runGit(repositoryPath, ['update-ref', 'refs/remotes/github/main', initialSha]);
    runGit(repositoryPath, ['update-ref', 'refs/remotes/gitlab/develop', initialSha]);
    runGit(repositoryPath, ['update-ref', 'refs/remotes/company/release', initialSha]);

    fs.writeFileSync(path.join(repositoryPath, 'README.md'), 'current\n');
    fs.writeFileSync(path.join(repositoryPath, 'src', 'newer.js'), 'export const newer = true;\n');
    runGit(repositoryPath, ['add', '.']);
    runGit(repositoryPath, ['commit', '-m', 'current revision']);
    runGit(repositoryPath, ['checkout', '-b', 'merge-side', initialSha]);
    fs.writeFileSync(path.join(repositoryPath, 'src', 'side.js'), 'export const side = true;\n');
    runGit(repositoryPath, ['add', '.']);
    runGit(repositoryPath, ['commit', '-m', 'side revision']);
    runGit(repositoryPath, ['checkout', initialBranch]);
    runGit(repositoryPath, ['merge', '--no-ff', 'merge-side', '-m', 'merge side revision']);

    const rootService = new GitRepositoryService(repositoryPath, path.join(snapshotRoot, 'root'));
    const references = await rootService.listReferences();
    const timelineSources = await rootService.listTimelineSources(20);
    assert.ok(timelineSources.length >= 2);
    assert.ok(timelineSources.some((source) => source.revisionType === 'merge' && source.parentCount > 1));
    await rootService.listReferences();
    const oldestTimelineSource = await rootService.resolveSource(timelineSources[0].id);
    assert.equal(oldestTimelineSource.kind, 'gitRef');
    assert.equal(oldestTimelineSource.commitSha, timelineSources[0].commitSha);
    assert.equal(references.targetRelativePath, '.');
    assert.ok(references.sources.some((source) => source.kind === 'gitRef' && source.refType === 'branch'));
    assert.ok(references.sources.some((source) => source.kind === 'gitRef' && source.refType === 'tag'));
    assert.ok(references.sources.some(
        (source) => source.kind === 'gitRef' && source.label === 'github/main',
    ));
    assert.ok(references.sources.some(
        (source) => source.kind === 'gitRef' && source.label === 'gitlab/develop',
    ));
    assert.ok(references.sources.some(
        (source) => source.kind === 'gitRef' && source.label === 'company/release',
    ));
    const initialCommit = references.sources.find(
        (source) => source.kind === 'gitRef'
            && source.refType === 'commit'
            && source.commitSha === initialSha,
    );
    assert.ok(initialCommit);
    const resolvedCommit = await rootService.resolveSource(initialCommit.id);
    const materializedRoot = await rootService.materialize(resolvedCommit);
    assert.equal(materializedRoot.missingTarget, false);
    assert.ok(materializedRoot.targetPath);
    assert.equal(
        fs.readFileSync(path.join(materializedRoot.targetPath, 'src', 'existing.js'), 'utf8'),
        'export const value = 1;\n',
    );
    assert.equal(fs.existsSync(path.join(materializedRoot.targetPath, 'README.md')), false);
    assert.equal(fs.existsSync(path.join(materializedRoot.targetPath, 'src', 'newer.js')), false);
    assert.equal(fs.existsSync(path.join(materializedRoot.targetPath, 'dist', 'generated.js')), false);
    assert.equal(fs.existsSync(path.join(materializedRoot.targetPath, 'exceltools', 'lib', 'python3.12', 'site-packages')), false);
    assert.equal(fs.existsSync(path.join(materializedRoot.targetPath, 'large-asset.bin')), false);

    const directoryService = new GitRepositoryService(
        path.join(repositoryPath, 'src'),
        path.join(snapshotRoot, 'directory'),
    );
    const directoryReferences = await directoryService.listReferences();
    const directoryCommit = directoryReferences.sources.find(
        (source) => source.kind === 'gitRef'
            && source.refType === 'commit'
            && source.commitSha === initialSha,
    );
    assert.ok(directoryCommit);
    const materializedDirectory = await directoryService.materialize(
        await directoryService.resolveSource(directoryCommit.id),
    );
    assert.equal(materializedDirectory.missingTarget, false);
    assert.ok(fs.existsSync(path.join(materializedDirectory.targetPath, 'existing.js')));

    const missingFileService = new GitRepositoryService(
        path.join(repositoryPath, 'src', 'newer.js'),
        path.join(snapshotRoot, 'missing-file'),
    );
    const missingReferences = await missingFileService.listReferences();
    const missingCommit = missingReferences.sources.find(
        (source) => source.kind === 'gitRef'
            && source.refType === 'commit'
            && source.commitSha === initialSha,
    );
    assert.ok(missingCommit);
    const missingFile = await missingFileService.materialize(
        await missingFileService.resolveSource(missingCommit.id),
    );
    assert.equal(missingFile.missingTarget, true);
    assert.equal(missingFile.targetPath, null);

    await Promise.all([
        rootService.dispose(),
        directoryService.dispose(),
        missingFileService.dispose(),
    ]);
    fs.rmSync(temporaryRoot, { recursive: true, force: true });
});

test('historical snapshots use private extension storage and publish only immutable result artifacts', () => {
    const source = readProjectFile(
        'src',
        'code_analysis',
        'historical',
        'historicalComparisonService.ts',
    );

    assert.match(source, /context\.storageUri\?\.fsPath \|\| context\.globalStorageUri\.fsPath/);
    assert.match(source, /'historical-comparisons'/);
    assert.doesNotMatch(source, /\.codexr-comparison-snapshots/);
    assert.match(source, /revision-\$\{revision\}-left\.json/);
    assert.match(source, /revision-\$\{revision\}-right\.json/);
    assert.match(source, /comparisonKey:/);
    assert.match(source, /let added = 0/);
    assert.match(source, /let removed = 0/);
    assert.match(source, /let modified = 0/);
    assert.match(source, /let unchanged = 0/);
});

test('historical comparison is authoritative, shared per room, and rejects concurrent work', () => {
    const server = readProjectFile('src', 'servers', 'runtime', 'httpServer.ts');
    const service = readProjectFile(
        'src',
        'code_analysis',
        'historical',
        'historicalComparisonService.ts',
    );
    const room = readProjectFile(
        'src',
        'servers',
        'runtime',
        'collaboration',
        'collaborationRoomServer.ts',
    );

    assert.match(server, /message\.type === 'historical-comparison-references-request'/);
    assert.match(server, /message\.type === 'historical-comparison-start'/);
    assert.match(server, /allowsEmptyShell = mode === 'historical-compare'[\s\S]*\|\| mode === 'project-evolution'/);
    assert.match(server, /if \(!available && !allowsEmptyShell\)/);
    assert.match(server, /this\.setAnalysisViewMode\('historical-compare', 'historical.selection'\);/);
    assert.match(server, /this\.setAnalysisViewMode\('historical-compare', 'historical.mapping'\);/);
    assert.doesNotMatch(server, /message\.type === 'historical-comparison-reset'/);
    assert.match(server, /historicalComparisonService\.isBusy\(\)/);
    assert.match(server, /await this\.historicalComparisonService\.getAvailability\(\)/);
    assert.match(server, /historicalComparisonReason: historicalComparison\.reason/);
    assert.match(server, /entityKind: 'historical-comparison'/);
    assert.match(server, /messageContext\.upsertSharedEntity/);
    assert.match(service, /activeRequest: this\.activeRequest \? \{ \.\.\.this\.activeRequest \} : null/);
    assert.match(room, /handleApplicationMessage\?:/);
    assert.match(room, /upsertSharedEntity: \(entity\) => this\.upsertAuthoritativeEntity/);
    assert.match(room, /removeSharedEntity: \(entityKind, entityId\) => this\.removeAuthoritativeEntity/);
    assert.match(room, /private removeAuthoritativeEntity/);
});

test('project evolution builds a chronological Git movie and publishes shared XR state', () => {
    const server = readProjectFile('src', 'servers', 'runtime', 'httpServer.ts');
    const service = readProjectFile(
        'src',
        'code_analysis',
        'historical',
        'projectEvolutionService.ts',
    );
    const models = readProjectFile(
        'src',
        'code_analysis',
        'historical',
        'historicalComparisonModels.ts',
    );
    const gitService = readProjectFile(
        'src',
        'code_analysis',
        'historical',
        'gitRepositoryService.ts',
    );
    const runtime = readProjectFile(
        'templates',
        'components',
        'codexr',
        'project-evolution',
        'projectEvolutionRuntime.js',
    );
    const docs = readProjectFile('docs', 'PROJECT_EVOLUTION_XR.md');

    assert.match(models, /\| 'project-evolution'/);
    assert.match(models, /export interface ProjectEvolutionRequest/);
    assert.match(models, /export interface ProjectEvolutionResult/);
    assert.match(gitService, /listTimelineSources/);
    assert.match(gitService, /'--reverse'/);
    assert.match(service, /class ProjectEvolutionService/);
    assert.match(service, /DEFAULT_MAX_FRAMES = 24/);
    assert.match(service, /DEFAULT_ANALYSIS_CONCURRENCY = 4/);
    assert.match(service, /sampleSources/);
    assert.match(service, /Promise\.all\(workers\)/);
    assert.match(service, /Analyzing \$\{sources\.length\} project revisions with \$\{concurrency\} workers/);
    assert.match(service, /references\.sources\.filter\(\(source\) => source\.kind === 'gitRef'\)/);
    assert.match(service, /'project-evolution'/);
    assert.match(service, /path\.join\(this\.staticRoot, 'evolution'\)/);
    assert.match(service, /path\.join\(evolutionDirectory, `revision-\$\{revision\}`\)/);
    assert.match(service, /const fileName = `data\$\{index \+ 1\}\.json`/);
    assert.match(service, /bridgeUrl: `\/evolution\/revision-\$\{revision\}\/data\.json`/);
    assert.match(service, /path\.join\(revisionDirectory, 'data\.json'\)/);
    assert.match(service, /applyFrameToBridge/);
    assert.match(service, /copyFileAtomically/);
    assert.match(service, /manifest\.json/);
    assert.match(service, /Project evolution ready\./);
    assert.match(service, /clearGeneratedMovie/);
    assert.match(service, /fs\.promises\.rm\(revisionDirectory, \{ recursive: true, force: true \}\)/);
    assert.match(service, /project-evolution-cleared/);
    assert.match(service, /references\.workingTreeDirty/);
    assert.match(server, /new ProjectEvolutionService/);
    assert.match(server, /projectEvolutionService\.getAvailability/);
    assert.match(server, /projectEvolution: projectEvolution\.enabled/);
    assert.match(server, /projectEvolutionReason: projectEvolution\.reason/);
    assert.match(server, /message\.type === 'project-evolution-references-request'/);
    assert.match(server, /message\.type === 'project-evolution-clear'/);
    assert.match(server, /removeSharedEntity\('project-evolution', 'main'\)/);
    assert.match(server, /type: 'project-evolution-cleared'/);
    assert.match(server, /message\.type === 'project-evolution-apply-frame'/);
    assert.match(server, /projectEvolutionService\.applyFrameToBridge/);
    assert.match(server, /type: 'project-evolution-frame-applied'/);
    assert.match(server, /message\.type === 'project-evolution-start'/);
    assert.match(server, /this\.setAnalysisViewMode\('project-evolution', 'project-evolution'\);/);
    assert.match(server, /projectEvolutionService\.isBusy\(\)/);
    assert.match(server, /entityKind: 'project-evolution'/);
    assert.match(server, /mode: 'project-evolution'/);
    assert.match(runtime, /CodeXRProjectEvolutionRuntime/);
    assert.match(runtime, /label: 'Project evolution'/);
    assert.match(runtime, /project-evolution-references-request/);
    assert.match(runtime, /project-evolution-clear/);
    assert.match(runtime, /project-evolution-cleared/);
    assert.match(runtime, /project-evolution-start/);
    assert.match(runtime, /function unwrapPayload\(message\)/);
    assert.match(runtime, /Object\.prototype\.hasOwnProperty\.call\(message, 'payload'\)/);
    assert.match(runtime, /function handleReferences\(message\)/);
    assert.match(runtime, /var payload = unwrapPayload\(message\)/);
    assert.match(runtime, /function referenceRow\(source, index, selection\)/);
    assert.match(runtime, /function splitSourceDescription\(source\)/);
    assert.match(runtime, /function sourceTypeLabel\(source\)/);
    assert.match(runtime, /MERGE/);
    assert.match(runtime, /BRANCH/);
    assert.match(runtime, /COMMIT/);
    assert.match(runtime, /PANEL_LAYOUT = \{/);
    assert.match(runtime, /function modeButton\(label, position, onClick, color\)/);
    assert.match(runtime, /function primaryActionButton\(label, position, onClick\)/);
    assert.match(runtime, /function transportButton\(label, position, onClick\)/);
    assert.match(runtime, /function speedButton\(label, position, speed\)/);
    assert.match(runtime, /function buildNowShowingCard\(\)/);
    assert.match(runtime, /function updateNowShowing\(frame, frameCount\)/);
    assert.match(runtime, /function clearMovie\(\)/);
    assert.match(runtime, /function applyClearedState\(message\)/);
    assert.match(runtime, /function clearChartVisualization\(\)/);
    assert.match(runtime, /function clampSelectionPage\(\)/);
    assert.match(runtime, /function setSelectionPage\(page\)/);
    assert.match(runtime, /function getSuggestedAutoOrderById\(\)/);
    assert.match(runtime, /function ensurePlaybackOverlay\(\)/);
    assert.match(runtime, /function waitForFrameStable\(generation\)/);
    assert.match(runtime, /wait\(chartIds, \{ timeoutMs: 12000, pollMs: 160, stablePasses: 2 \}\)/);
    assert.match(runtime, /function ensureEvolutionRoot\(\)/);
    assert.match(runtime, /id: 'codexrProjectEvolutionRoot'/);
    assert.match(runtime, /mountRoot\(MODE, refs\.evolutionRoot\)/);
    assert.match(runtime, /function ensureEvolutionChart\(chartId\)/);
    assert.match(runtime, /id', 'codexrProjectEvolutionChart'/);
    assert.match(runtime, /function prepareChartForEvolution\(chart, chartId, options\)/);
    assert.match(runtime, /prepareChartForEvolution\(chart, chartId, \{ force: true \}\)/);
    assert.match(runtime, /function isHierarchicalBoatsChart\(chartId, componentName\)/);
    assert.match(runtime, /function projectEvolutionContainmentProfile\(\)/);
    assert.match(runtime, /getContainmentProfile\?\.\('project-evolution'\)/);
    assert.match(runtime, /applyContainmentProfile\(chart, profile\)/);
    assert.doesNotMatch(runtime, /planarUnderflowCorrectionEnabled: false; heightUnderflowCorrectionEnabled: false/);
    assert.match(runtime, /minHeightOccupancyRatio: 0\.45/);
    assert.match(runtime, /heightBandMinRatio: 0\.38/);
    assert.match(runtime, /function projectEvolutionInitialScale\(chartId\)/);
    assert.match(runtime, /return isBoats \? '0\.01 0\.05 0\.01' : '1 1 1'/);
    assert.match(runtime, /setChartEntityIds\?\.\(getChartEntities\(\)\.map/);
    assert.match(runtime, /Next frame in ' \+ seconds \+ 's/);
    assert.match(runtime, /color: '#f59e0b'/);
    assert.match(runtime, /frameDurationMs: 5000/);
    assert.match(runtime, /settleDelayMs: 5000/);
    assert.match(runtime, /Project evolution finished\./);
    assert.match(runtime, /transitionTo\?\.\(MODE/);
    assert.doesNotMatch(runtime, /setNormalVisible\?\.\(!!state\.result\)/);
    assert.match(runtime, /activateMode\?\.\(MODE\)/);
    assert.match(runtime, /state\.startSourceId = ''/);
    assert.match(runtime, /state\.manualSourceIds = \[\]/);
    assert.match(runtime, /refs\.pagerRoot = entity\('a-entity'/);
    assert.match(runtime, /referencesRoot = entity\('a-entity', \{ position: '0 ' \+ PANEL_LAYOUT\.referencesY/);
    assert.match(runtime, /refs\.frame = buildNowShowingCard\(\)/);
    assert.match(runtime, /refs\.status = smallText\('', '-2\.85 ' \+ PANEL_LAYOUT\.statusY/);
    assert.match(runtime, /function setTimelineMode/);
    assert.match(runtime, /function selectSourceForTimeline/);
    assert.match(runtime, /function getReferenceSources/);
    assert.match(runtime, /suggestedSourceIds/);
    assert.match(runtime, /Auto: CodeXR samples ' \+ \(autoCount \|\| 'the'\) \+ ' timeline frames\.'/);
    assert.match(runtime, /orderLabel: String\(autoOrderById\[source\.id\]\)/);
    assert.match(runtime, /No commit date/);
    assert.match(runtime, /Working copy/);
    assert.match(runtime, /mode: state\.timelineMode/);
    assert.match(runtime, /startSourceId/);
    assert.match(runtime, /sourceIds/);
    assert.doesNotMatch(runtime, /function createEvolutionFrameRoot\(frame\)/);
    assert.match(runtime, /function ensureEvolutionPlaybackRoot\(frame\)/);
    assert.match(runtime, /function ensureEvolutionDataSource\(playbackRoot, initialUrl\)/);
    assert.match(runtime, /function refreshEvolutionDataSource\(frameUrl\)/);
    assert.match(runtime, /emit\?\.\('data-loaded', \{\}\)/);
    assert.match(runtime, /function ensureEvolutionTreeBuilder\(playbackRoot, targetType\)/);
    assert.match(runtime, /function applyBridgeFrameToChart\(frame, appliedBridgeUrl\)/);
    assert.match(runtime, /function requestBridgeFrame\(frameIndex\)/);
    assert.match(runtime, /project-evolution-apply-frame/);
    assert.match(runtime, /project-evolution-frame-applied/);
    assert.match(runtime, /data\.from = 'codexrProjectEvolutionTree'/);
    assert.match(runtime, /data\.from = 'codexrProjectEvolutionData'/);
    assert.match(runtime, /function scheduleFrameRenormalization\(\)/);
    assert.doesNotMatch(runtime, /function buildEvolutionBoatsTree/);
    assert.doesNotMatch(runtime, /data\.field = 'uid'/);
    assert.match(service, /if \(!path\.isAbsolute\(candidate\)\)/);
    assert.ok(service.includes(".replace(/\\\\/g, '/')"));
    assert.match(runtime, /play: play/);
    assert.match(runtime, /seek: seek/);
    assert.doesNotMatch(runtime, /data\.data = prepared\.payload/);
    assert.doesNotMatch(runtime, /buildEvolutionVisualPayload/);
    assert.match(runtime, /renormalizeAll\?\.\('project-evolution-frame'\)/);
    assert.match(docs, /Clear movie/);
    assert.match(docs, /Project Evolution XR/);
    assert.match(docs, /chronological XR analysis mode/);
    assert.match(docs, /does not call\s+remote provider APIs/);
});

test('XR historical runtime renders two contained charts and restores the single view cleanly', () => {
    const runtime = readProjectFile(
        'templates',
        'components',
        'codexr',
        'historical-comparison',
        'historicalComparisonRuntime.js',
    );

    assert.match(runtime, /codexrComparisonChartLeft/);
    assert.match(runtime, /codexrComparisonChartRight/);
    assert.match(runtime, /function createChartFromTemplate/);
    assert.match(runtime, /function splitSourceDescription\(source\)/);
    assert.match(runtime, /function buildSourceLabel\(source\)/);
    assert.match(runtime, /Working copy/);
    assert.match(runtime, /No commit date/);
    assert.match(runtime, /function buildComparisonBoatsTree/);
    assert.match(runtime, /safeNamespace \+ ':' \+ accumulated\.join\('\/'\)/);
    assert.match(runtime, /inlineData: buildComparisonBoatsTree\(state\.payloads\.left/);
    assert.match(runtime, /inlineData: buildComparisonBoatsTree\(state\.payloads\.right/);
    assert.match(runtime, /delete chartData\.from/);
    assert.match(runtime, /chartData\.field = 'uid'/);
    assert.doesNotMatch(runtime, /cloneNode\(true\)/);
    assert.match(runtime, /activeCategory: 'branch'/);
    assert.match(runtime, /registerPanelView\(\{/);
    assert.match(runtime, /id: 'historical-selection'/);
    assert.match(runtime, /headerButton: false/);
    assert.match(runtime, /title: 'History comparison'/);
    assert.match(runtime, /setPanelViewHeight\?\.\('historical-selection', 6\.45\)/);
    assert.doesNotMatch(runtime, /scene\.appendChild\(refs\.panel\)/);
    assert.match(runtime, /capabilities\.historicalComparison === true/);
    assert.match(runtime, /getSessionInfoAsync/);
    assert.match(runtime, /Historical comparison requires a local Git repository/);
    assert.match(runtime, /state\.references\?\.activeRequest/);
    assert.match(runtime, /left: activeRequest\.leftSourceId/);
    assert.match(runtime, /right: activeRequest\.rightSourceId/);
    assert.match(runtime, /requires an analysis inside a local Git repository/);
    assert.match(runtime, /codexr-chart-containment/);
    assert.match(runtime, /getAnalysisTableZones\?\.\('historical-compare'\)/);
    assert.match(runtime, /getHistoricalContainmentProfile\(zone\)/);
    assert.match(runtime, /getContainmentProfile\?\.\(profileId\)/);
    assert.match(runtime, /applyContainmentProfile\(clone, containmentProfile\)/);
    assert.match(runtime, /waitForChartsStable\?\.\(activeChartIds/);
    assert.match(runtime, /createEmptyState\(result\.left/);
    assert.match(runtime, /createEmptyState\(result\.right/);
    const emptyStateBlock = runtime.match(/function createEmptyState\(dataset, zone, color\) \{[\s\S]*?return empty;\s*\}/);
    assert.ok(emptyStateBlock);
    assert.doesNotMatch(emptyStateBlock[0], /rotation:\s*'-90 0 0'/);
    assert.match(runtime, /async function refreshLiveSide\(result, datasets\)/);
    assert.match(runtime, /state\.payloads\[liveSide\] = normalizePayload/);
    assert.match(runtime, /refs\.leftLabel = createLabel\(buildSourceLabel\(result\.left\.source\)/);
    assert.match(runtime, /refs\.rightLabel = createLabel\(buildSourceLabel\(result\.right\.source\)/);
    assert.match(runtime, /setText\(liveSide === 'left' \? refs\.leftLabel : refs\.rightLabel, buildSourceLabel\(dataset\.source\)/);
    assert.match(runtime, /function isHierarchicalBoatsComponent\(componentName\)/);
    assert.match(runtime, /componentName === 'babia-boats'/);
    assert.match(runtime, /isHierarchicalBoatsComponent\(componentName\)/);
    assert.match(runtime, /buildComparisonBoatsTree\(\s*state\.payloads\[liveSide\]/);
    assert.match(runtime, /codexr-mapping-confirmed/);
    assert.match(runtime, /function getMappedMetricDeltas/);
    assert.match(runtime, /function suspendRaycastInteraction\(rootEntity\)/);
    assert.match(runtime, /new root\.MutationObserver/);
    assert.match(runtime, /function restoreRaycastInteraction\(rootEntity\)/);
    assert.match(runtime, /function getNormalVisualizationRoots\(config\)/);
    assert.match(runtime, /function getNormalMappingTargetIds\(config\)/);
    assert.match(runtime, /function parkOriginalChart\(original\)/);
    assert.doesNotMatch(runtime, /originalChartParent|originalChartNextSibling/);
    assert.match(runtime, /refs\.originalCharts = uniqueElements\(roots\)/);
    assert.match(runtime, /element\.setAttribute\?\.\('visible', false\)/);
    assert.match(runtime, /function restoreOriginalChart\(\)/);
    assert.match(runtime, /getState\?\.\(\)\.mode === 'single'/);
    assert.match(runtime, /element\.setAttribute\?\.\('visible', true\)/);
    assert.match(runtime, /function restoreOriginalChartMapping\(config\)/);
    assert.match(runtime, /mappingRuntime\.switchMappingContext\?\.\('normal-analysis'/);
    assert.match(runtime, /setStatus\('Analyzing historical comparison\. Please wait\.\.\.', 'info'\)/);
    assert.match(runtime, /function handleProgress\(message\) \{\s*setStatus\(message\?\.payload\?\.message \|\| 'Analyzing\.\.\.', 'info'\);/);
    assert.match(runtime, /parkOriginalChart\(original\)/);
    assert.match(runtime, /restoreOriginalChart\(\)/);
    assert.match(runtime, /CodeXRAnalysisModeRuntime/);
    assert.match(runtime, /\|\| !isHistoricalModeActiveOrActivating\(\)/);
    assert.doesNotMatch(runtime, /getState\?\.\(\)\.mode !== 'historical-compare'/);
    assert.match(runtime, /enterHistoricalSelection/);
    assert.match(runtime, /registerModeOption/);
    assert.doesNotMatch(runtime, /activateNormalAnalysis/);
    assert.doesNotMatch(runtime, /sendMessage\?\.\('analysis-mode-selection'/);
    assert.match(runtime, /transitionTo\?\.\('historical-compare', \{[\s\S]*panelViewId: 'historical-selection'/);
    assert.match(runtime, /function showHistoricalSelectionPanel\(\)/);
    assert.match(runtime, /function disposeComparisonGeometry/);
    assert.doesNotMatch(runtime, /setAttribute\('codexr-analysis-table', 'mode', 'single'\)/);
    assert.doesNotMatch(runtime, /sendMessage\?\.\('historical-comparison-reset'/);
    assert.match(runtime, /loadGeneration/);
    assert.match(runtime, /mappingRuntime\.setChartEntityIds\(ids\)/);
    assert.match(runtime, /CodeXRMappingUiRuntime\.switchMappingContext\?\.\('historical-comparison'/);
    assert.match(runtime, /'historical-compare'/);
    assert.match(runtime, /'single'/);
    assert.match(runtime, /refs\.comparisonRoot\.parentNode\.removeChild/);
    assert.doesNotMatch(runtime, /codexr-historical-comparison-open-request/);
    assert.doesNotMatch(runtime, /codexr-historical-comparison-reset-request/);
});

test('historical source selector keeps commit cards compact and identifies live and immutable refs', () => {
    const runtime = readProjectFile(
        'templates',
        'components',
        'codexr',
        'historical-comparison',
        'historicalComparisonRuntime.js',
    );
    const gitService = readProjectFile(
        'src',
        'code_analysis',
        'historical',
        'gitRepositoryService.ts',
    );

    assert.match(runtime, /pageSize: 5/);
    assert.match(runtime, /function buildReferenceRow/);
    assert.match(runtime, /source\.kind === 'workingCopy'\s*\?\s*'LIVE'/);
    assert.match(runtime, /String\(source\.refType \|\| 'ref'\)\.toUpperCase\(\)/);
    assert.match(runtime, /truncate\(parts\.subject, 54\)/);
    assert.match(runtime, /state\.selected\.left === state\.selected\.right/);
    assert.match(gitService, /id: 'working-copy'/);
    assert.match(gitService, /kind: 'workingCopy'/);
    assert.match(gitService, /pageSize: 5/);
});

test('Cloudflare remote access documentation states the official Quick Tunnel operating limits', () => {
    const docs = readProjectFile('docs', 'CLOUDFLARE_REMOTE_ACCESS.md');

    assert.match(docs, /200 solicitudes simultáneas en curso por túnel/i);
    assert.match(docs, /HTTP `429`/);
    assert.match(docs, /no se admite Server-Sent Events \(SSE\)/i);
    assert.match(docs, /sin SLA/i);
    assert.match(docs, /best effort/i);
    assert.match(docs, /Named Tunnels/i);
    assert.match(docs, /relay propio de CodeXR/i);
    assert.match(docs, /trycloudflare/i);
});

test('historical comparison documentation explains provider-neutral Git behavior and XR architecture', () => {
    const docs = readProjectFile('docs', 'HISTORICAL_COMPARISON_XR.md');

    assert.match(docs, /depende de \*\*Git\*\*, no de la API de un proveedor concreto/i);
    assert.match(docs, /\| GitHub \| Sí \|/);
    assert.match(docs, /\| GitLab \| Sí \|/);
    assert.match(docs, /CodeXR no ejecuta `git fetch` automáticamente/i);
    assert.match(docs, /`codexr-analysis-table`/);
    assert.match(docs, /`codexr-chart-containment`/);
    assert.match(docs, /CodeXRMappingUiRuntime/);
    assert.match(docs, /`codexr-left:` o `codexr-right:`/);
    assert.match(docs, /working-copy/);
    assert.match(docs, /Cloudflare Quick Tunnel/);
});
