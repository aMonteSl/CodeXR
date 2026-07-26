const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const childProcess = require('node:child_process');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..', '..');
const { readAssembledRuntime } = require(path.join(projectRoot, 'test', 'helpers', 'runtimeAssembly.cjs'));

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

function loadTimelineSampler() {
    const sourcePath = path.join(projectRoot, 'src', 'code_analysis', 'historical', 'gitTimelineSampler.ts');
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
        return require(sourcePath).sampleTimeline;
    } finally {
        if (previousLoader) {
            require.extensions['.ts'] = previousLoader;
        } else {
            delete require.extensions['.ts'];
        }
    }
}

function commitSource(id, date, options = {}) {
    return {
        id,
        kind: 'gitRef',
        refType: options.refType || 'commit',
        refName: id,
        commitSha: id,
        label: id,
        date,
        live: false,
        revisionType: options.revisionType || 'commit',
        parentCount: options.revisionType === 'merge' ? 2 : 1,
    };
}

const WORKING_COPY = {
    id: 'working-copy',
    kind: 'workingCopy',
    label: 'main (live)',
    activeBranch: 'main',
    dirty: true,
    live: true,
    revisionType: 'working-copy',
};

test('automatic timeline spreads frames over time, prefers milestones and always ends on the current state', () => {
    const sampleTimeline = loadTimelineSampler();

    // A project with one quiet year and then a burst: sampling by position
    // would spend almost every frame inside the burst.
    const timeline = [];
    for (let month = 0; month < 12; month += 1) {
        timeline.push(commitSource(`slow-${month}`, `2024-${String(month + 1).padStart(2, '0')}-01`));
    }
    for (let day = 1; day <= 40; day += 1) {
        timeline.push(commitSource(`burst-${day}`, `2025-01-${String(day % 28 + 1).padStart(2, '0')}`));
    }

    const frames = sampleTimeline(timeline, 8, WORKING_COPY);

    assert.equal(frames.length, 8);
    // Anchors: starts at the beginning, ends on the current state of the branch.
    assert.equal(frames[0].id, 'slow-0');
    assert.equal(frames[frames.length - 1].id, 'working-copy');
    // No repeats.
    assert.equal(new Set(frames.map((frame) => frame.id)).size, frames.length);
    // Chronological order is preserved.
    const dated = frames.filter((frame) => frame.date).map((frame) => frame.date);
    assert.deepEqual(dated, [...dated].sort());
    // Time-spread, not position-spread: the quiet year keeps real presence
    // instead of being collapsed into one or two frames.
    const slowFrames = frames.filter((frame) => frame.id.startsWith('slow-')).length;
    assert.ok(slowFrames >= 3, `expected the quiet year to keep frames, saw ${slowFrames}`);
});

test('automatic timeline prefers a merge over a plain commit in the same window', () => {
    const sampleTimeline = loadTimelineSampler();
    const timeline = [
        commitSource('a', '2024-01-01'),
        commitSource('b', '2024-02-01'),
        commitSource('merge-b', '2024-02-02', { revisionType: 'merge' }),
        commitSource('c', '2024-03-01'),
        commitSource('d', '2024-04-01'),
        commitSource('e', '2024-05-01'),
    ];

    const frames = sampleTimeline(timeline, 3, null);
    assert.equal(frames[0].id, 'a');
    assert.equal(frames[frames.length - 1].id, 'e');
    // The middle slot lands near february/march and takes the merge.
    assert.ok(
        frames.some((frame) => frame.id === 'merge-b'),
        `expected the merge to win its window, got ${frames.map((f) => f.id).join(', ')}`,
    );
});

test('automatic timeline degrades safely when revisions carry no dates', () => {
    const sampleTimeline = loadTimelineSampler();
    const timeline = [];
    for (let index = 0; index < 10; index += 1) {
        timeline.push(commitSource(`c${index}`, undefined));
    }

    const frames = sampleTimeline(timeline, 4, WORKING_COPY);
    assert.ok(frames.length > 0 && frames.length <= 4);
    // Still ends on the current state, still no repeats.
    assert.equal(frames[frames.length - 1].id, 'working-copy');
    assert.equal(new Set(frames.map((frame) => frame.id)).size, frames.length);
});

test('automatic timeline returns everything when it already fits', () => {
    const sampleTimeline = loadTimelineSampler();
    const timeline = [commitSource('a', '2024-01-01'), commitSource('b', '2024-02-01')];
    const frames = sampleTimeline(timeline, 8, WORKING_COPY);
    assert.deepEqual(frames.map((frame) => frame.id), ['a', 'b', 'working-copy']);
});

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
    // Directory payloads rebuild filePath against the ORIGINAL target (the
    // normal-analysis shape the boats tree splits) while the comparison key
    // stays relative so both sides match the same file.
    assert.match(source, /filePath: buildBabiaStyleFilePath\(session\.targetPath, relativePath\),[\s\S]{0,500}relativePath,[\s\S]{0,500}comparisonKey:/);
    assert.match(source, /let added = 0/);
    assert.match(source, /let removed = 0/);
    assert.match(source, /let modified = 0/);
    assert.match(source, /let unchanged = 0/);
});

test('historical comparison is authoritative, shared per room, and rejects concurrent work', () => {
    const server = readProjectFile('src', 'servers', 'runtime', 'analysis', 'analysisMessageRouter.ts')
        + readProjectFile('src', 'servers', 'runtime', 'analysis', 'historicalComparisonBridge.ts')
        + readProjectFile('src', 'servers', 'runtime', 'analysis', 'projectEvolutionBridge.ts')
        + readProjectFile('src', 'servers', 'runtime', 'analysis', 'analysisFeatureHost.ts');
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
    assert.match(server, /setAnalysisViewMode\('historical-compare', 'historical.selection'\);/);
    assert.match(server, /setAnalysisViewMode\('historical-compare', 'historical.mapping'\);/);
    assert.doesNotMatch(server, /message\.type === 'historical-comparison-reset'/);
    assert.match(server, /historicalComparisonService\.isBusy\(\)/);
    assert.match(server, /await this\.historicalComparisonService\.getAvailability\(\)/);
    // The capability payload is built by the extracted CollaborationSessionApi.
    assert.match(
        readProjectFile('src', 'servers', 'runtime', 'collaboration', 'collaborationSessionApi.ts'),
        /historicalComparisonReason: historicalComparison\.reason/,
    );
    assert.match(server, /entityKind: 'historical-comparison'/);
    assert.match(server, /messageContext\.upsertSharedEntity/);
    assert.match(service, /activeRequest: this\.activeRequest \? \{ \.\.\.this\.activeRequest \} : null/);
    assert.match(room, /handleApplicationMessage\?:/);
    assert.match(room, /upsertSharedEntity: \(entity\) => this\.upsertAuthoritativeEntity/);
    assert.match(room, /removeSharedEntity: \(entityKind, entityId\) => this\.removeAuthoritativeEntity/);
    assert.match(room, /private removeAuthoritativeEntity/);
});

test('project evolution builds a chronological Git movie and publishes shared XR state', () => {
    const server = readProjectFile('src', 'servers', 'runtime', 'analysis', 'analysisMessageRouter.ts')
        + readProjectFile('src', 'servers', 'runtime', 'analysis', 'historicalComparisonBridge.ts')
        + readProjectFile('src', 'servers', 'runtime', 'analysis', 'projectEvolutionBridge.ts')
        + readProjectFile('src', 'servers', 'runtime', 'analysis', 'analysisFeatureHost.ts');
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
    const runtime = readAssembledRuntime('project-evolution', 'projectEvolutionRuntime.js');
    const docs = readProjectFile('docs', 'PROJECT_EVOLUTION_XR.md');

    assert.match(models, /\| 'project-evolution'/);
    assert.match(models, /export interface ProjectEvolutionRequest/);
    assert.match(models, /export interface ProjectEvolutionResult/);
    // Same boats tree contract as the normal analysis: directory frames
    // rebuild filePath against the ORIGINAL target while the evolution key
    // stays relative so the same file matches across commits.
    assert.match(service, /filePath: buildBabiaStyleFilePath\(session\.targetPath, relativePath\),[\s\S]{0,500}relativePath,[\s\S]{0,500}evolutionKey:/);
    assert.match(gitService, /listTimelineSources/);
    assert.match(gitService, /'--reverse'/);
    // Precise committer time travels with every source: the short date is
    // day-granular, and same-day refs were indistinguishable for ordering
    // and range membership.
    assert.match(gitService, /%\(committerdate:unix\)/);
    assert.match(gitService, /%\(\*committerdate:unix\)/);
    assert.match(gitService, /%ct/);
    assert.match(models, /timestamp\?: number/);
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
    // Frame selection is the shared sampler (even spacing in time, milestones
    // preferred), and the movie always ends on the current state of the branch —
    // the `--all` timeline's last entry can belong to another branch.
    assert.match(service, /import \{ sampleTimeline \} from '\.\/gitTimelineSampler'/);
    assert.match(service, /return sampleTimeline\(sources, maxFrames/);
    assert.match(service, /private resolveCurrentStateSource/);
    assert.match(service, /source\.kind === 'workingCopy'\) \|\| null/);
    // A picked range must be honoured or fail loudly: branch/tag/live endpoints
    // are resolved by commit sha into the commit-only timeline, and an
    // unresolvable endpoint throws instead of silently degrading to the full
    // automatic movie (which is how "my range was not analyzed" presented).
    assert.match(service, /private async resolveTimelineIndex/);
    assert.match(service, /source\.commitSha === picked\.commitSha/);
    assert.match(service, /sourceId === 'working-copy'[\s\S]{0,80}timeline\.length - 1/);
    assert.match(service, /throw new Error\('project-evolution-range-not-found'\)/);
    const sampler = readProjectFile('src', 'code_analysis', 'historical', 'gitTimelineSampler.ts');
    assert.match(sampler, /export function sampleTimeline/);
    assert.match(sampler, /function isMilestone/);
    assert.match(sampler, /function fillWidestGaps/);
    assert.match(sampler, /function sampleByPosition/);
    assert.match(server, /new ProjectEvolutionService/);
    assert.match(server, /projectEvolutionService\.getAvailability/);
    // The capability payload is built by the extracted CollaborationSessionApi.
    const sessionApi = readProjectFile('src', 'servers', 'runtime', 'collaboration', 'collaborationSessionApi.ts');
    assert.match(sessionApi, /projectEvolution: projectEvolution\.enabled/);
    assert.match(sessionApi, /projectEvolutionReason: projectEvolution\.reason/);
    assert.match(server, /message\.type === 'project-evolution-references-request'/);
    assert.match(server, /message\.type === 'project-evolution-clear'/);
    assert.match(server, /removeSharedEntity\('project-evolution', 'main'\)/);
    assert.match(server, /type: 'project-evolution-cleared'/);
    assert.match(server, /message\.type === 'project-evolution-apply-frame'/);
    assert.match(server, /projectEvolutionService\.applyFrameToBridge/);
    assert.match(server, /type: 'project-evolution-frame-applied'/);
    assert.match(server, /message\.type === 'project-evolution-start'/);
    assert.match(server, /setAnalysisViewMode\('project-evolution', 'project-evolution'\);/);
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
    assert.match(runtime, /function splitSourceDescription\(source\)/);
    assert.match(runtime, /function resolveRowStateForSource\(source\)/);
    // Source rows + the type vocabulary now come from the shared Git ref picker
    // — through the guarded helper: the picker is chrome, and an ungated
    // describeSource inside play()'s overlay froze the movie when it was absent.
    assert.match(runtime, /CodeXRGitRefPickerRuntime\.createPicker/);
    assert.match(runtime, /mode: 'sequence'/);
    assert.match(runtime, /function describeSourceSafe\(source\)/);
    assert.doesNotMatch(runtime, /root\.CodeXRGitRefPickerRuntime\.describeSource\(/);
    assert.match(runtime, /PANEL_LAYOUT = \{/);
    assert.match(runtime, /function modeButton\(label, position, onClick, color\)/);
    assert.match(runtime, /function primaryActionButton\(label, position, onClick\)/);
    assert.match(runtime, /function transportButton\(label, position, onClick\)/);
    assert.match(runtime, /speedButton\('0\.5x', '-1\.35 0 0', 0\.5\)/);
    assert.match(runtime, /function buildNowShowingCard\(\)/);
    assert.match(runtime, /function updateNowShowing\(frame, frameCount\)/);
    assert.match(runtime, /function clearMovie\(\)/);
    assert.match(runtime, /function applyClearedState\(message\)/);
    assert.match(runtime, /function clearChartVisualization\(\)/);
    assert.match(runtime, /refs\.picker\?\.setReferences\(state\.references\)/);
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
    // NOT forced per frame: re-applying the containment profile wrote the raw
    // anchor position over the fit the containment had just computed, so every
    // frame invalidated the measurement signature and forced a full re-fit.
    assert.match(runtime, /prepareChartForEvolution\(chart, chartId\);/);
    assert.doesNotMatch(runtime, /prepareChartForEvolution\(chart, chartId, \{ force: true \}\)/);
    // The movie chart is BUILT, not cloned from a `[babia-*]` DOM template: the
    // mapping UI's removeAttribute wiped the only such attribute on the first
    // chart switch, and every later chart failed to build.
    assert.match(runtime, /function buildEvolutionChart\(chartId\)/);
    assert.match(runtime, /function getChartStyleSource\(chartId\)/);
    assert.doesNotMatch(runtime, /function getTemplateChart\(/);
    // Replacement is built before the current chart is detached.
    assert.match(runtime, /var nextChart = buildEvolutionChart\(chartId\);\s*if \(!nextChart\) \{ return null; \}/);
    // A programmatic component leaves no DOM attribute, so the guard that used
    // hasAttribute re-set the component on every frame.
    assert.match(runtime, /!chart\.components\?\.\[componentName\]/);
    // A discarded chart must be unsubscribed from its data producer: Babia
    // never does it, so it would repaint over the new chart on every frame.
    assert.match(runtime, /releaseChartEntity\?\.\(chart\)/);
    assert.match(runtime, /releaseChartEntity\?\.\(refs\.evolutionChart\)/);
    assert.match(runtime, /function isHierarchicalBoatsChart\(chartId, componentName\)/);
    assert.match(runtime, /function projectEvolutionContainmentProfile\(\)/);
    assert.match(runtime, /getContainmentProfile\?\.\('project-evolution'\)/);
    assert.match(runtime, /applyContainmentProfile\(chart, profile\)/);
    assert.doesNotMatch(runtime, /planarUnderflowCorrectionEnabled: false; heightUnderflowCorrectionEnabled: false/);
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
    assert.match(runtime, /refs\.picker = root\.CodeXRGitRefPickerRuntime\.createPicker/);
    assert.match(runtime, /resolveRowState: resolveRowStateForSource/);
    assert.match(runtime, /refs\.frame = buildNowShowingCard\(\)/);
    // Sections are placed by layoutPanel (see below), not by per-element
    // constants, so the status only declares its left-aligned x here.
    assert.match(runtime, /refs\.status = smallText\('', PANEL_LAYOUT\.left \+ ' 0 0\.02'/);
    // Panel layout: computed in one pass, folding away sections that are not in
    // use, centred on the usable strip — the old hand-tuned constants overlapped
    // (pager vs "Now showing") and pushed "Clear movie" outside the panel.
    assert.match(runtime, /function layoutPanel\(\)/);
    assert.match(runtime, /show: state\.timelineMode === 'range'/);
    assert.match(runtime, /show: hasMovie/);
    assert.match(runtime, /setPanelViewHeight\?\.\(MODE, layoutPanel\(\)\)/);
    // Shared Git chrome: same tabs/order/buttons/nameplate as the comparison.
    assert.match(runtime, /tabs: true/);
    assert.match(runtime, /sortToggle: true/);
    assert.match(runtime, /CodeXRGitRefPickerRuntime\.buildButton\(/);
    assert.match(runtime, /createSourceNameplate\(source, zone, '#f59e0b'\)/);
    // The view title is the controller's; printing it inside duplicated it.
    assert.doesNotMatch(runtime, /text\('Project evolution', '0 ' \+ PANEL_LAYOUT/);
    // Companion visibility belongs to the mapping-ui's syncMappingCompanion
    // alone: forcing it visible from this runtime leaked the movie transport
    // over the NORMAL analysis' mapping rows.
    assert.doesNotMatch(runtime, /companionRoot\.setAttribute\('visible', 'true'\)/);
    assert.doesNotMatch(runtime, /companionRoot\.setAttribute\('visible', true\)/);
    // Range span highlight: with both endpoints picked, in-between (dated)
    // sources are marked too, not only the endpoints.
    assert.match(runtime, /function isInsideSelectedRange\(source\)/);
    assert.match(runtime, /state\.timelineMode === 'range' && isInsideSelectedRange\(source\)/);
    // Range membership compares precise committer times (the day-granular
    // date painted same-day refs NEWER than the end as span), and the Live
    // endpoint counts as "now" (Infinity) so a range ended on it still paints.
    assert.match(runtime, /function sourceTimeKey\(source\)/);
    assert.match(runtime, /function endpointTimeKey\(source\)/);
    assert.match(runtime, /return isLive \? Infinity : NaN/);
    assert.match(runtime, /endpointTimeKey\(findSource\(state\.startSourceId\)\)/);
    assert.match(runtime, /endpointTimeKey\(findSource\(state\.endSourceId\)\)/);
    // A ref aliasing an endpoint's commit (same sha) paints the endpoint
    // colour — it IS that commit, not span.
    assert.match(runtime, /source\.commitSha === findSource\(state\.startSourceId\)\?\.commitSha/);
    assert.match(runtime, /source\.commitSha === findSource\(state\.endSourceId\)\?\.commitSha/);
    // Per-instance bar width: the shared constant overflowed the narrower
    // companion column (the cursor at the last frame left the panel).
    assert.match(runtime, /function buildTimelineBar\(store, width\)/);
    assert.match(runtime, /store\.width = Number\(width\) \|\| TIMELINE_WIDTH/);
    assert.match(runtime, /buildTimelineBar\(refs\.companionTimeline, COMPANION_BAR_W\)/);
    // Companion is a framed card (historical pattern): frame fills the column
    // height and the Change movie action pins to the bottom edge.
    assert.match(runtime, /COMPANION_CARD_W = 2\.98/);
    assert.match(runtime, /var buttonY = cardBottom \+ 0\.34/);
    // Speed shortcuts live in the companion too (changing speed used to mean
    // leaving the mapping view), built from the SAME atom as the panel row and
    // narrowed to the column; both rows highlight the running speed.
    assert.match(runtime, /function speedButton\(label, position, speed, width\)/);
    assert.match(runtime, /speedButton\('0\.5x', '-0\.9 0 0', 0\.5, COMPANION_SPEED_W\)/);
    assert.match(runtime, /speedButton\('1x', '0 0 0', 1, COMPANION_SPEED_W\)/);
    assert.match(runtime, /speedButton\('2x', '0\.9 0 0', 2, COMPANION_SPEED_W\)/);
    assert.match(runtime, /function paintSpeedRow\(rootEntity\)/);
    assert.match(runtime, /paintSpeedRow\(refs\.companionSpeedRoot\)/);
    assert.match(runtime, /paintSpeedRow\(refs\.speedRoot\)/);
    // setSpeed must re-render, or the highlight never follows the click.
    assert.match(runtime, /setStatus\('Playback speed: ' \+ state\.speed \+ 'x', 'info'\);[\s\S]{0,160}render\(\);/);
    // Middle group spreads bar / transport / speed / countdown / hint around
    // its centre, and the companion mirrors the wait for the next frame (it
    // only existed on the panel's status line).
    assert.match(runtime, /companionSpeedRoot\?\.setAttribute\?\.\('position', '0 ' \+ midCentre/);
    assert.match(runtime, /companionCountdown\?\.setAttribute\?\.\('position', '0 ' \+ \(midCentre - 0\.52\)/);
    assert.match(runtime, /function playbackCountdownText\(\)/);
    assert.match(runtime, /'Next frame in ' \+ state\.nextFrameSeconds \+ 's'/);
    assert.match(runtime, /function setCountdownSeconds\(seconds\)/);
    assert.match(runtime, /setCountdownSeconds\(seconds\);\s*setStatus\('Next frame in '/);
    // Pausing clears it, or the last tick stays frozen on the companion.
    assert.match(runtime, /state\.nextFrameSeconds = 0;\s*hidePlaybackOverlay\(\);/);
    // Boats is the mode's identity chart; the scene's chartId (the normal
    // analysis' chart) opened the movie as a pie.
    assert.match(runtime, /hasBoats \? 'boats' : \(toolingConfig\.chartId \|\| 'boats'\)/);
    // The activate syncs the SELECTOR only — the frame pipeline owns the
    // movie chart's entities.
    assert.match(runtime, /selectChart\(state\.activeChartId, \{ applyToEntities: false \}\)/);
    // Leaving hands chart-entity targeting back to the scene: the override
    // pointed at the movie chart and the NORMAL analysis' chart switches
    // landed on it.
    assert.match(runtime, /hidePlaybackOverlay\(\);\s*\/\/[\s\S]{0,400}setChartEntityIds\?\.\(\[\]\);\s*\}/);
    // With a movie the mode lives on the Field Mapping view (chart/axis
    // controls left, movie companion right); the lifecycle resolver keeps the
    // local transition and the authoritative server echo in agreement — same
    // contract as historical-compare.
    assert.match(runtime, /resolveControllerView: function \(\) \{\s*return state\.result \? 'project-evolution\.mapping' : 'project-evolution';/);
    // Single entry paths: movie-ready and mode entry carry no forced
    // controllerView/panelViewId — the resolver routes both.
    assert.match(runtime, /transitionTo\?\.\(MODE, \{\s*reason: 'project-evolution-ready'\s*\}\)/);
    assert.match(runtime, /transitionTo\?\.\(MODE, \{\s*reason: 'project-evolution-selection'\s*\}\)/);
    // Both directions between the selection panel and the mapping view exist
    // without regenerating: companion "Change movie" + panel "Field mapping".
    assert.match(runtime, /button\('Change movie', '0 0 0', 2\.2, showMovieSelectionView, '#be123c'/);
    assert.match(runtime, /showView\?\.\('project-evolution\.playback'/);
    assert.match(runtime, /button\('Field mapping', '0 0 0\.02', 3\.15, showMovieMappingView, '#0e7490'/);
    assert.match(runtime, /showView\?\.\('project-evolution\.mapping'/);
    assert.match(runtime, /\{ node: refs\.mappingButton, height: L\.actionsHeight, show: hasMovie \}/);
    // Leave/enter semantics: a generation in flight is cancelled + cleaned; a
    // movie remembers whether it was playing and resumes on re-entry.
    assert.match(runtime, /function releaseEvolutionOnLeave\(\)/);
    assert.match(runtime, /deactivate: function \(\) \{\s*releaseEvolutionOnLeave\(\);/);
    // Leaving runs the release twice (deactivate + the selector's disposeView
    // sweep); OR-ing preserves the flag the first pass saved before stop().
    assert.match(runtime, /state\.resumePlayback = state\.resumePlayback \|\| state\.playing/);
    // Resume is deferred, not one-shot: re-entry re-applies the chart mapping,
    // whose safety lock silently rejected a plain play(); the flag survives and
    // setMappingApplying(false) retries once the change settles.
    assert.match(runtime, /function tryResumePlayback\(\)/);
    assert.match(runtime, /if \(applied\) \{\s*tryResumePlayback\(\);/);
    assert.match(runtime, /if \(!state\.applyingMapping\) \{[\s\S]{0,120}tryResumePlayback\(\);/);
    // A deliberate pause cancels any pending auto-resume.
    assert.match(runtime, /state\.resumePlayback = false;\s*stop\(\);/);
    assert.match(runtime, /state\.generating\) \{[\s\S]{0,200}clearMovie\(\);/);
    assert.match(runtime, /function setTimelineMode/);
    assert.match(runtime, /function selectSourceForTimeline/);
    assert.match(runtime, /refs\.picker\?\.getVisibleSources\?\.\(\)/);
    assert.match(runtime, /suggestedSourceIds/);
    assert.match(runtime, /Auto: CodeXR samples ' \+ \(autoCount \|\| 'the'\) \+ ' timeline frames\.'/);
    assert.match(runtime, /orderLabel: String\(autoOrder\)/);
    assert.match(runtime, /mode: state\.timelineMode/);
    assert.match(runtime, /startSourceId/);
    assert.match(runtime, /sourceIds/);
    assert.doesNotMatch(runtime, /function createEvolutionFrameRoot\(frame\)/);
    assert.match(runtime, /function ensureEvolutionPlaybackRoot\(frame\)/);
    assert.match(runtime, /function ensureEvolutionDataSource\(playbackRoot, initialUrl\)/);
    assert.match(runtime, /function refreshEvolutionDataSource\(frameUrl\)/);
    assert.match(runtime, /refs\.evolutionDataSource\?\.emit\('data-loaded', \{\}\)/);
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
    const runtime = readAssembledRuntime('historical-comparison', 'historicalComparisonRuntime.js');

    assert.match(runtime, /codexrComparisonChartLeft/);
    assert.match(runtime, /codexrComparisonChartRight/);
    assert.match(runtime, /function createChartFromTemplate/);
    // Zombie label helpers were removed (nameplates + the companion table own
    // the source vocabulary now).
    assert.doesNotMatch(runtime, /function buildSourceLabel/);
    assert.doesNotMatch(runtime, /function createLabel/);
    assert.match(runtime, /CodeXRGitRefPickerRuntime\.describeSource/);
    assert.match(runtime, /Working copy/);
    assert.match(runtime, /function buildComparisonBoatsTree/);
    assert.match(runtime, /safeNamespace \+ ':' \+ accumulated\.join\('\/'\)/);
    assert.match(runtime, /inlineData: buildComparisonBoatsTree\(state\.payloads\.left/);
    assert.match(runtime, /inlineData: buildComparisonBoatsTree\(state\.payloads\.right/);
    assert.match(runtime, /delete chartData\.from/);
    assert.match(runtime, /chartData\.field = 'uid'/);
    assert.doesNotMatch(runtime, /cloneNode\(true\)/);
    // Source selection is the shared Git ref picker in compare mode.
    assert.match(runtime, /CodeXRGitRefPickerRuntime\.createPicker/);
    assert.match(runtime, /mode: 'compare'/);
    assert.match(runtime, /registerPanelView\(\{/);
    assert.match(runtime, /id: 'historical-selection'/);
    assert.match(runtime, /headerButton: false/);
    assert.match(runtime, /title: 'History comparison'/);
    assert.match(runtime, /setPanelViewHeight\?\.\('historical-selection', 6\.45\)/);
    assert.doesNotMatch(runtime, /scene\.appendChild\(refs\.panel\)/);
    assert.match(runtime, /capabilities\.historicalComparison === true/);
    // Availability + mode gating now flow through the shared picker helper.
    assert.match(runtime, /resolveCapabilities/);
    assert.match(runtime, /registerGitGatedMode/);
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
    // Side labels are nameplates on the table's front edge (not floating over
    // the charts), fed by the shared Git vocabulary; the live refresh updates
    // the live plate in place.
    assert.match(runtime, /refs\.leftLabel = createSideNameplate\(result\.left\.source, zones\[0\]/);
    assert.match(runtime, /refs\.rightLabel = createSideNameplate\(result\.right\.source, zones\[1\]/);
    assert.match(runtime, /function createSideNameplate/);
    // The plate itself is shared Git chrome now (project evolution labels its
    // current frame with the same one), so the geometry lives in the common
    // runtime and this one delegates.
    assert.match(runtime, /CodeXRGitRefPickerRuntime\.createSourceNameplate\(source, zone, color\)/);
    const pickerRuntime = readProjectFile('templates', 'components', 'common', 'codexrGitRefPickerRuntime.js');
    assert.match(pickerRuntime, /function createSourceNameplate\(source, zone, color\)/);
    assert.match(pickerRuntime, /zone\.anchorZ \+ \(zoneDepth \/ 2\)/);
    assert.doesNotMatch(runtime, /' 3\.05 '/);
    assert.match(runtime, /setText\(liveSide === 'left' \? refs\.leftLabel : refs\.rightLabel, buildSideNameplateText\(dataset\.source\)/);
    // The live refresh renormalizes ONLY the refreshed chart: renormalizing
    // every chart reset the untouched immutable side to 'rebuilding' forever.
    assert.match(runtime, /renormalizeCharts\?\.\(/);
    assert.doesNotMatch(runtime, /renormalizeAll\?\.\('historical-comparison-live-refresh'\)/);
    // Field Mapping child section: a right-column ('side') companion with a
    // per-axis-metric comparison table (left / right / diff), the side chips,
    // the file-delta summary, and Change comparison.
    assert.match(runtime, /registerMappingCompanion\('historical-comparison'/);
    assert.match(runtime, /placement: 'side'/);
    assert.match(runtime, /Field Mapping - History comparison/);
    assert.match(runtime, /function changeComparison/);
    assert.match(runtime, /disposeComparisonGeometry\(true\)/);
    assert.match(runtime, /Change comparison/);
    // The comparison table is driven by the metrics currently mapped to the
    // chart axes, read LIVE from the mapping-ui (not a stale cache) so it is
    // populated on entry, and re-computed when a mapping is confirmed.
    assert.match(runtime, /function getLiveMapping/);
    assert.match(runtime, /root\.CodeXRMappingUiRuntime\?\.getState\?\.\(\)/);
    assert.match(runtime, /mappingState\.lastKnownGoodMapping/);
    assert.match(runtime, /state\.selectedMapping = getLiveMapping\(\)/);
    assert.match(runtime, /getMappedMetricDeltas\(state\.selectedMapping, state\.payloads\)/);
    assert.match(runtime, /function handleMappingConfirmed\(event\)[\s\S]*updateMappingCompanion\(\)/);
    assert.match(runtime, /refs\.companionRows/);
    // The companion is a framed card that fills the whole column: registered
    // with a layout callback, table centred in the middle, file dashboard +
    // Change comparison pinned near the bottom (from the available height).
    assert.match(runtime, /layout: layoutMappingCompanion/);
    assert.match(runtime, /function layoutMappingCompanion/);
    assert.match(runtime, /function positionMappingCompanion/);
    assert.match(runtime, /refs\.companionButton\.setAttribute\('position', '0 ' \+ buttonY/);
    assert.match(runtime, /var cardBottom = -\(h - 0\.18\)/);
    assert.match(runtime, /refs\.companionCard\b/);
    assert.match(runtime, /refs\.companionStats/);
    assert.match(runtime, /refs\.companionEmpty/);
    // File-delta dashboard cells (Added / Removed / Modified / Unchanged) under
    // a heading so it is clear the counts are files.
    assert.match(runtime, /COMPANION_STAT_META/);
    assert.match(runtime, /label: 'Added'[\s\S]*label: 'Removed'[\s\S]*label: 'Modified'[\s\S]*label: 'Unchanged'/);
    assert.match(runtime, /refs\.companionFilesLabel/);
    assert.match(runtime, /Files \(right vs left\)/);
    // Empty state shows a placeholder instead of a lone table header.
    assert.match(runtime, /setRowVisible\(refs\.companionEmpty, !hasRows\)/);
    // Source selector actions: only Back + Compare, centred (no 'Axes').
    assert.match(runtime, /buildButton\('Back', '-0\.75 -2\.4 0\.02'/);
    assert.match(runtime, /buildButton\('Compare', '0\.75 -2\.4 0\.02'/);
    assert.doesNotMatch(runtime, /buildButton\('Axes'/);
    // updateMappingCompanion re-centres the table after the row count changes.
    assert.match(runtime, /function updateMappingCompanion\(\)[\s\S]*positionMappingCompanion\(\)/);
    // The floating delta text over the table is gone (info lives in the panel).
    assert.doesNotMatch(runtime, /refs\.deltaLabel/);
    assert.doesNotMatch(runtime, /' 3\.48 -18'/);
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
    // Single entry path: no explicit controllerView/panelViewId — the mode's
    // resolveControllerView routes, so local and echo can never disagree.
    assert.match(runtime, /transitionTo\?\.\('historical-compare', \{\s*reason: 'historical-mode-entry'\s*\}/);
    assert.doesNotMatch(runtime, /panelViewId: 'historical-selection'/);
    assert.match(runtime, /function showHistoricalSelectionPanel\(\)/);
    assert.match(runtime, /function disposeComparisonGeometry/);
    // Leaving historical SAVES a live comparison: the root is preserved-and-
    // hidden (data-codexr-preserve; the surface hides it), result + payloads
    // kept, and re-entry restores in place (restoreComparisonScene) without a
    // rebuild — with a renderedRevision freshness check for live-side updates
    // that arrived while parked. With no comparison the geometry is disposed.
    assert.match(runtime, /'data-codexr-preserve': 'true'/);
    assert.match(runtime, /function releaseSceneToNormal/);
    assert.match(runtime, /function parkComparisonGeometry/);
    assert.match(runtime, /function releaseComparisonOnLeave/);
    assert.match(runtime, /preserveModeRoots\?\.\('historical-compare'\)/);
    assert.match(runtime, /function restoreComparisonScene/);
    // Re-fits are targeted at the comparison charts: renormalizeAll would also
    // re-fit other modes' (parked) charts. Restoring honours the re-fit that was
    // deferred while the charts were hidden — a no-op unless data changed.
    assert.match(runtime, /renormalizeCharts\?\.\(activeChartIds, 'historical-comparison-ready'\)/);
    assert.match(runtime, /renormalizeCharts\?\.\(chartIds, 'historical-comparison-restored'\)/);
    assert.doesNotMatch(runtime, /renormalizeAll\?\.\('historical-comparison-ready'\)/);
    assert.match(runtime, /refs\.renderedRevision = result\.revision/);
    assert.match(runtime, /state\.result\.revision !== refs\.renderedRevision/);
    assert.match(runtime, /deactivate: function \(\) \{\s*releaseComparisonOnLeave\(\);/);
    assert.match(runtime, /disposeView: function \(\) \{\s*releaseComparisonOnLeave\(\);/);
    assert.match(runtime, /resolveControllerView: function \(\) \{\s*return state\.result \? 'historical\.mapping' : 'historical\.selection';/);
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
    const runtime = readAssembledRuntime('historical-comparison', 'historicalComparisonRuntime.js');
    const gitService = readProjectFile(
        'src',
        'code_analysis',
        'historical',
        'gitRepositoryService.ts',
    );

    const picker = readProjectFile('templates', 'components', 'common', 'codexrGitRefPickerRuntime.js');

    // Historical embeds the shared picker in compare mode with 7-row pages.
    assert.match(runtime, /pageSize: 7/);
    assert.match(runtime, /mode: 'compare'/);
    // Categories: All (default) + Branch/Tags/Commits/Merges; time sort; Live
    // (working copy) pinned first in every category.
    assert.match(picker, /\{ id: 'all', label: 'All' \}/);
    assert.match(picker, /\{ id: 'merge', label: 'Merges' \}/);
    assert.match(picker, /category: opts\.defaultCategory \|\| 'all'/);
    assert.match(picker, /function sortByTime/);
    assert.match(picker, /function toggleSort/);
    assert.match(picker, /live \? \[live\]\.concat\(categorySources\)/);
    // The shared picker owns the row vocabulary: LIVE for the working copy,
    // BRANCH/TAG/COMMIT/MERGE colours for immutable refs, compact subject.
    assert.match(picker, /function describeSource/);
    assert.match(picker, /return 'LIVE'/);
    assert.match(picker, /LIVE: '#06b6d4'/);
    assert.match(picker, /BRANCH: '#22c55e'/);
    assert.match(picker, /COMMIT: '#64748b'/);
    // Rows are pooled (created once, updated by attribute only) so paging never
    // storms the controller panel's childList observer / raycaster.
    assert.match(picker, /function createPoolRow/);
    assert.match(picker, /function updatePoolRow/);
    assert.match(picker, /compact\(parts\.subject/);
    assert.doesNotMatch(picker, /clearChildren\(listRoot\)/);
    assert.match(runtime, /state\.selected\.left === state\.selected\.right/);
    assert.match(gitService, /id: 'working-copy'/);
    assert.match(gitService, /kind: 'workingCopy'/);
    assert.match(gitService, /pageSize: 5/);
    // Branches and tags now carry their target committer date so All + the time
    // sort can order every source, not just commits.
    assert.match(gitService, /%\(committerdate:short\)/);
    assert.match(gitService, /\*committerdate:short/);
    assert.match(gitService, /date: \(date \|\| ''\)\.trim\(\) \|\| undefined/);
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
