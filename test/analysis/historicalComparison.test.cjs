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
    fs.writeFileSync(path.join(repositoryPath, 'large-asset.bin'), Buffer.alloc(1024 * 1024));
    runGit(repositoryPath, ['add', '.']);
    runGit(repositoryPath, ['commit', '-m', 'initial revision']);
    const initialSha = runGit(repositoryPath, ['rev-parse', 'HEAD']);
    runGit(repositoryPath, ['branch', 'historical-branch']);
    runGit(repositoryPath, ['tag', 'historical-tag']);

    fs.writeFileSync(path.join(repositoryPath, 'README.md'), 'current\n');
    fs.writeFileSync(path.join(repositoryPath, 'src', 'newer.js'), 'export const newer = true;\n');
    runGit(repositoryPath, ['add', '.']);
    runGit(repositoryPath, ['commit', '-m', 'current revision']);

    const rootService = new GitRepositoryService(repositoryPath, path.join(snapshotRoot, 'root'));
    const references = await rootService.listReferences();
    assert.equal(references.targetRelativePath, '.');
    assert.ok(references.sources.some((source) => source.kind === 'gitRef' && source.refType === 'branch'));
    assert.ok(references.sources.some((source) => source.kind === 'gitRef' && source.refType === 'tag'));
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
    const room = readProjectFile(
        'src',
        'servers',
        'runtime',
        'collaboration',
        'collaborationRoomServer.ts',
    );

    assert.match(server, /message\.type === 'historical-comparison-references-request'/);
    assert.match(server, /message\.type === 'historical-comparison-start'/);
    assert.match(server, /message\.type === 'historical-comparison-reset'/);
    assert.match(server, /historicalComparisonService\.isBusy\(\)/);
    assert.match(server, /await this\.historicalComparisonService\.getAvailability\(\)/);
    assert.match(server, /historicalComparisonReason: historicalComparison\.reason/);
    assert.match(server, /entityKind: 'historical-comparison'/);
    assert.match(server, /messageContext\.upsertSharedEntity/);
    assert.match(room, /handleApplicationMessage\?:/);
    assert.match(room, /upsertSharedEntity: \(entity\) => this\.upsertAuthoritativeEntity/);
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
    assert.match(runtime, /function buildComparisonBoatsTree/);
    assert.match(runtime, /safeNamespace \+ ':' \+ accumulated\.join\('\/'\)/);
    assert.match(runtime, /inlineData: buildComparisonBoatsTree\(state\.payloads\.left/);
    assert.match(runtime, /inlineData: buildComparisonBoatsTree\(state\.payloads\.right/);
    assert.match(runtime, /delete chartData\.from/);
    assert.match(runtime, /chartData\.field = 'uid'/);
    assert.doesNotMatch(runtime, /cloneNode\(true\)/);
    assert.match(runtime, /activeCategory: 'branch'/);
    assert.match(runtime, /registerPanelView\(\{/);
    assert.match(runtime, /title: 'Visualization mode'/);
    assert.match(runtime, /buttonLabel: 'V'/);
    assert.match(runtime, /Normal analysis/);
    assert.match(runtime, /Historical comparison/);
    assert.match(runtime, /setPanelViewHeight\?\.\('historical-comparison', 3\.35\)/);
    assert.match(runtime, /setPanelViewHeight\?\.\('historical-comparison', 6\.45\)/);
    assert.doesNotMatch(runtime, /scene\.appendChild\(refs\.panel\)/);
    assert.match(runtime, /capabilities\.historicalComparison === true/);
    assert.match(runtime, /getSessionInfoAsync/);
    assert.match(runtime, /Historical comparison unavailable/);
    assert.match(runtime, /requires an analysis inside a local Git repository/);
    assert.match(runtime, /codexr-chart-containment/);
    assert.match(runtime, /getAnalysisTableZones\?\.\('historical-compare'\)/);
    assert.match(runtime, /waitForChartsStable\?\.\(activeChartIds/);
    assert.match(runtime, /createEmptyState\(result\.left/);
    assert.match(runtime, /createEmptyState\(result\.right/);
    const emptyStateBlock = runtime.match(/function createEmptyState\(dataset, zone, color\) \{[\s\S]*?return empty;\s*\}/);
    assert.ok(emptyStateBlock);
    assert.doesNotMatch(emptyStateBlock[0], /rotation:\s*'-90 0 0'/);
    assert.match(runtime, /async function refreshLiveSide\(result, datasets\)/);
    assert.match(runtime, /state\.payloads\[liveSide\] = normalizePayload/);
    assert.match(runtime, /componentName === 'babia-boats'/);
    assert.match(runtime, /buildComparisonBoatsTree\(\s*state\.payloads\[liveSide\]/);
    assert.match(runtime, /codexr-mapping-confirmed/);
    assert.match(runtime, /function getMappedMetricDeltas/);
    assert.match(runtime, /function suspendRaycastInteraction\(rootEntity\)/);
    assert.match(runtime, /new root\.MutationObserver/);
    assert.match(runtime, /function restoreRaycastInteraction\(rootEntity\)/);
    assert.match(runtime, /function parkOriginalChart\(original\)/);
    assert.match(runtime, /refs\.originalChartParent\?\.removeChild\?\.\(original\)/);
    assert.match(runtime, /function restoreOriginalChart\(\)/);
    assert.match(runtime, /parent\.insertBefore\(original, nextSibling\)/);
    assert.match(runtime, /function restoreOriginalChartMapping\(config\)/);
    assert.match(runtime, /mappingRuntime\.restoreState\(mappingState\)/);
    assert.match(runtime, /parkOriginalChart\(original\)/);
    assert.match(runtime, /restoreOriginalChart\(\)/);
    assert.match(runtime, /mappingRuntime\.setChartEntityIds\(\[config\.chartEntityId\]\)/);
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
    assert.match(runtime, /truncate\(subject, 54\)/);
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
