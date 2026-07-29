const test = require('node:test');
const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const {
    decorateRevisionPayload,
    runGitRevisionExport,
} = require('../../out/code_analysis/export/gitRevisionExportCore.js');
const {
    calculateGitExportWorkerPlan,
    validateGitRevisionScope,
} = require('../../out/code_analysis/export/gitExportOptions.js');
const {
    GitTimelineBlobAnalyzer,
} = require('../../out/code_analysis/export/gitTimelineBlobAnalyzer.js');
const {
    GitExportPythonWorkerPool,
} = require('../../out/code_analysis/export/gitExportPythonWorkerPool.js');
const {
    GitAnalysisSourceCatalog,
    validateGitAnalysisPayload,
} = require('../../out/code_analysis/historical/gitAnalysisEligibility.js');
const { sampleTimeline } = require('../../out/code_analysis/historical/gitTimelineSampler.js');

function loadGitRepositoryService() {
    return require('../../out/code_analysis/historical/gitRepositoryService.js').GitRepositoryService;
}

function runGit(repositoryPath, args) {
    return childProcess.execFileSync(
        'git',
        ['-C', repositoryPath, ...args],
        { encoding: 'utf8', windowsHide: true },
    ).trim();
}

/** A tiny real repository: 3 commits, a branch and a tag on HEAD. */
function buildFixtureRepository() {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-export-git-'));
    const repositoryPath = path.join(temporaryRoot, 'repository');
    fs.mkdirSync(repositoryPath, { recursive: true });
    runGit(repositoryPath, ['init', '--initial-branch=main']);
    runGit(repositoryPath, ['config', 'user.email', 'test@example.com']);
    runGit(repositoryPath, ['config', 'user.name', 'CodeXR Test']);
    for (let index = 1; index <= 3; index += 1) {
        fs.writeFileSync(path.join(repositoryPath, 'module.py'), `def f():\n    return ${index}\n`, 'utf8');
        runGit(repositoryPath, ['add', '.']);
        runGit(repositoryPath, ['commit', '-m', `commit ${index}`]);
    }
    runGit(repositoryPath, ['branch', 'feature']);
    runGit(repositoryPath, ['tag', 'v1']);
    return { temporaryRoot, repositoryPath };
}

function buildInitiallyEmptyRepository() {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-export-empty-git-'));
    const repositoryPath = path.join(temporaryRoot, 'repository');
    fs.mkdirSync(repositoryPath, { recursive: true });
    runGit(repositoryPath, ['init', '--initial-branch=main']);
    runGit(repositoryPath, ['config', 'user.email', 'test@example.com']);
    runGit(repositoryPath, ['config', 'user.name', 'CodeXR Test']);
    fs.writeFileSync(path.join(repositoryPath, 'notes.txt'), 'nothing analyzable\n', 'utf8');
    runGit(repositoryPath, ['add', '.']);
    runGit(repositoryPath, ['commit', '-m', 'unsupported only']);
    for (let index = 1; index <= 2; index += 1) {
        fs.writeFileSync(path.join(repositoryPath, 'module.py'), `def f():\n    return ${index}\n`, 'utf8');
        runGit(repositoryPath, ['add', '.']);
        runGit(repositoryPath, ['commit', '-m', `code ${index}`]);
    }
    return { temporaryRoot, repositoryPath };
}

function buildNestedOnlyRepository() {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-export-nested-git-'));
    const repositoryPath = path.join(temporaryRoot, 'repository');
    fs.mkdirSync(path.join(repositoryPath, 'nested'), { recursive: true });
    fs.mkdirSync(path.join(repositoryPath, 'node_modules'), { recursive: true });
    runGit(repositoryPath, ['init', '--initial-branch=main']);
    runGit(repositoryPath, ['config', 'user.email', 'test@example.com']);
    runGit(repositoryPath, ['config', 'user.name', 'CodeXR Test']);
    fs.writeFileSync(path.join(repositoryPath, 'notes.txt'), 'root metadata\n', 'utf8');
    fs.writeFileSync(path.join(repositoryPath, 'nested', 'module.py'), 'def nested():\n    return 1\n', 'utf8');
    fs.writeFileSync(path.join(repositoryPath, 'node_modules', 'ignored.js'), 'function ignored() {}\n', 'utf8');
    runGit(repositoryPath, ['add', '.']);
    runGit(repositoryPath, ['commit', '-m', 'nested source only']);
    return { temporaryRoot, repositoryPath };
}

function makeDestination() {
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-export-dest-'));
    fs.writeFileSync(path.join(destination, 'data.json'), JSON.stringify([
        { fileName: 'module.py', filePath: 'module.py', totalLines: 3 },
    ]), 'utf8');
    return destination;
}

function stubRevisionStore(callLog, overrides = {}) {
    return async (sources) => ({
        statistics: {
            revisionCount: sources.length,
            fileOccurrences: sources.length,
            uniqueAnalysisCount: sources.length,
            maxActiveWorkers: Math.min(2, sources.length),
        },
        async get(source) {
            const sha = source.kind === 'gitRef' ? source.commitSha : source.id;
            callLog.push(sha);
            if (overrides.failSha === sha) {
                throw new Error(overrides.failureReason || 'boom');
            }
            return {
                entries: [{
                    fileName: 'module.py',
                    filePath: 'module.py',
                    totalLines: 3,
                    analyzedSha: sha,
                }],
                analyzedTargetPath: '/snapshot',
                warnings: [],
            };
        },
        async dispose() {},
    });
}

function buildRepeatedBlobRepository() {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-export-blobs-'));
    const repositoryPath = path.join(temporaryRoot, 'repository');
    fs.mkdirSync(repositoryPath, { recursive: true });
    runGit(repositoryPath, ['init', '--initial-branch=main']);
    runGit(repositoryPath, ['config', 'user.email', 'test@example.com']);
    runGit(repositoryPath, ['config', 'user.name', 'CodeXR Test']);
    fs.writeFileSync(path.join(repositoryPath, 'stable.py'), 'def stable():\n    return 1\n', 'utf8');
    fs.writeFileSync(path.join(repositoryPath, 'stable.js'), 'def stable():\n    return 1\n', 'utf8');
    fs.writeFileSync(
        path.join(repositoryPath, 'unicodé name.py'),
        'def unicode_name():\n    return 2\n',
        'utf8',
    );
    for (let index = 1; index <= 6; index += 1) {
        fs.writeFileSync(
            path.join(repositoryPath, 'changing.py'),
            `def changing():\n    return ${index}\n`,
            'utf8',
        );
        runGit(repositoryPath, ['add', '.']);
        runGit(repositoryPath, ['commit', '-m', `commit ${index}`]);
    }
    return { temporaryRoot, repositoryPath };
}

function writeStubPersistentWorker(temporaryRoot) {
    const workerPath = path.join(temporaryRoot, 'stub-worker.cjs');
    fs.writeFileSync(workerPath, [
        "const fs=require('node:fs');",
        "const readline=require('node:readline');",
        "const send=(value)=>process.stdout.write(JSON.stringify(value)+'\\n');",
        "send({type:'ready',protocol:1,pid:process.pid});",
        "const lines=readline.createInterface({input:process.stdin});",
        "lines.on('line',(line)=>{",
        " const job=JSON.parse(line);",
        " if(job.type==='shutdown'){send({type:'stopped'});process.exit(0);}",
        " const text=fs.readFileSync(job.inputPath,'utf8');",
        " const result=job.targetType==='file'?[]:{filePath:job.inputPath,totalLines:text.split(/\\r?\\n/).length-1};",
        " fs.writeFileSync(job.outputPath,JSON.stringify(result),'utf8');",
        " send({type:'complete',id:job.id});",
        "});",
    ].join('\n'), 'utf8');
    return workerPath;
}

test('the export analyzes each unique commit once and shares the payload with its refs', async () => {
    const { repositoryPath } = buildFixtureRepository();
    const GitRepositoryService = loadGitRepositoryService();
    const snapshotRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-export-snap-'));
    const destination = makeDestination();
    const calls = [];

    const outcome = await runGitRevisionExport(
        {
            gitService: new GitRepositoryService(repositoryPath, snapshotRoot),
            prepareRevisionStore: stubRevisionStore(calls),
            readWorkingCopyPayload: async () => JSON.parse(
                fs.readFileSync(path.join(destination, 'data.json'), 'utf8'),
            ),
        },
        { targetPath: repositoryPath, targetType: 'directory', destinationPath: destination },
    );

    assert.equal(outcome.failureReason, undefined);
    assert.equal(outcome.cancelled, false);
    const gitData = outcome.gitData;
    assert.ok(gitData, 'usable git data expected');

    // 3 unique commits analyzed once each, even though branch `feature`, tag
    // `v1` and branch `main` all point at existing commits.
    assert.equal(calls.length, 3, `each unique sha analyzed exactly once, got ${calls.join(', ')}`);
    assert.equal(new Set(calls).size, 3);

    // Every usable source resolves to a payload file that exists on disk.
    for (const source of gitData.references.sources) {
        assert.ok(source.payloadUrl.startsWith('./git-revisions/'), source.payloadUrl);
        const filePath = path.join(destination, source.payloadUrl.replace('./', ''));
        assert.ok(fs.existsSync(filePath), `missing payload for ${source.id}`);
        assert.ok(source.itemCount >= 1);
    }

    // The working copy ships as its own decorated payload.
    const workingCopy = JSON.parse(fs.readFileSync(
        path.join(destination, 'git-revisions', 'working-copy.json'), 'utf8',
    ));
    assert.equal(workingCopy[0].comparisonKey, 'file:module.py');
    assert.equal(workingCopy[0].evolutionKey, 'file:module.py');

    // Timeline ids ascend chronologically and the suggestion matches the
    // extension-side sampler over the same inputs.
    assert.ok(gitData.timelineSourceIds.length >= 3);
    const exportedTimeline = gitData.timelineSourceIds
        .map((id) => gitData.references.sources.find((source) => source.id === id))
        .filter((source) => source && source.kind === 'gitRef');
    const expectedSuggestion = sampleTimeline(
        exportedTimeline,
        gitData.maxFrames,
        gitData.references.sources.find((source) => source.kind === 'workingCopy'),
    ).map((source) => source.id);
    assert.deepEqual(gitData.suggestedSourceIds, expectedSuggestion);
});

test('Git payload eligibility rejects empty shapes but keeps zero-valued metric records', () => {
    for (const payload of [0, {}, [], [null, 'not-a-record']]) {
        const validation = validateGitAnalysisPayload(payload);
        assert.equal(validation.usable, false);
        assert.equal(validation.entries.length, 0);
    }
    const zeroMetrics = validateGitAnalysisPayload([{
        fileName: 'empty.py',
        totalLines: 0,
        complexity: 0,
        functionCount: 0,
    }]);
    assert.equal(zeroMetrics.usable, true);
    assert.equal(zeroMetrics.entries.length, 1);
});

test('the shared Git catalogue filters invalid working data and all aliases of an excluded SHA', async (t) => {
    const { temporaryRoot, repositoryPath } = buildFixtureRepository();
    const snapshotRoot = path.join(temporaryRoot, 'catalog-snapshots');
    const workingDataPath = path.join(temporaryRoot, 'data.json');
    fs.writeFileSync(workingDataPath, '0', 'utf8');
    const GitRepositoryService = loadGitRepositoryService();
    const service = new GitRepositoryService(repositoryPath, snapshotRoot);
    const catalog = new GitAnalysisSourceCatalog('directory', true, workingDataPath);
    t.after(async () => {
        await catalog.dispose();
        await service.dispose();
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    });

    const references = await service.listReferences();
    const repository = await service.getRepositoryContext();
    const first = await catalog.filterSources({
        ...repository,
        sources: references.sources,
    });
    assert.equal(first.sources.some((source) => source.kind === 'workingCopy'), false);
    assert.equal(
        first.eligibility.excludedSources.find((entry) => entry.id === 'working-copy').code,
        'invalid-payload',
    );

    const headSource = references.sources.find(
        (source) => source.kind === 'gitRef' && source.refType === 'branch',
    );
    assert.ok(headSource);
    catalog.recordDeterministicExclusion(
        headSource,
        'no-analyzable-content',
        'The analyzer produced no records.',
    );
    const second = await catalog.filterSources({
        ...repository,
        sources: references.sources,
    });
    const aliasesAtHead = references.sources.filter(
        (source) => source.kind === 'gitRef' && source.commitSha === headSource.commitSha,
    );
    assert.ok(aliasesAtHead.length >= 2, 'branch and tag aliases should share the HEAD SHA');
    for (const alias of aliasesAtHead) {
        assert.equal(second.sources.some((source) => source.id === alias.id), false);
        assert.equal(
            second.eligibility.excludedSources.find((entry) => entry.id === alias.id).stage,
            'analysis',
        );
    }
});

test('Git eligibility respects shallow depth, ignored folders, and missing targets', async (t) => {
    const { temporaryRoot, repositoryPath } = buildNestedOnlyRepository();
    const GitRepositoryService = loadGitRepositoryService();
    const service = new GitRepositoryService(
        repositoryPath,
        path.join(temporaryRoot, 'snapshots'),
    );
    const workingDataPath = path.join(temporaryRoot, 'data.json');
    fs.writeFileSync(workingDataPath, JSON.stringify([{ totalLines: 0 }]), 'utf8');
    const shallow = new GitAnalysisSourceCatalog('directory', false, workingDataPath);
    const deep = new GitAnalysisSourceCatalog('directory', true, workingDataPath);
    const missing = new GitAnalysisSourceCatalog('file', false, workingDataPath);
    t.after(async () => {
        await Promise.all([shallow.dispose(), deep.dispose(), missing.dispose()]);
        await service.dispose();
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    });

    const repository = await service.getRepositoryContext();
    const sources = await service.listTimelineSources(null);
    const shallowResult = await shallow.filterSources({ ...repository, sources });
    assert.equal(shallowResult.sources.length, 0);
    assert.equal(shallowResult.eligibility.excludedSources[0].code, 'no-analyzable-content');

    const deepResult = await deep.filterSources({ ...repository, sources });
    assert.equal(deepResult.sources.length, 1);

    const missingResult = await missing.filterSources({
        repositoryRoot: repository.repositoryRoot,
        targetRelativePath: 'missing.py',
        sources,
    });
    assert.equal(missingResult.sources.length, 0);
    assert.equal(missingResult.eligibility.excludedSources[0].code, 'target-missing');
});

test('invalid working-copy JSON is excluded without disabling valid exported revisions', async () => {
    const { repositoryPath } = buildFixtureRepository();
    const GitRepositoryService = loadGitRepositoryService();
    const destination = makeDestination();
    const outcome = await runGitRevisionExport(
        {
            gitService: new GitRepositoryService(
                repositoryPath,
                fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-export-snap-')),
            ),
            prepareRevisionStore: stubRevisionStore([]),
            readWorkingCopyPayload: async () => 0,
        },
        { targetPath: repositoryPath, targetType: 'directory', destinationPath: destination },
    );

    assert.ok(outcome.gitData);
    assert.equal(outcome.gitData.workingCopyPayloadUrl, undefined);
    assert.equal(
        outcome.gitData.references.sources.some((source) => source.id === 'working-copy'),
        false,
    );
    const exclusion = outcome.gitData.skippedRevisions.find(
        (entry) => entry.id === 'working-copy',
    );
    assert.equal(exclusion.code, 'invalid-payload');
    assert.equal(exclusion.stage, 'index');
});

test('export requests the complete Git timeline while live callers keep bounded scans', async () => {
    const destination = makeDestination();
    const sha = 'a'.repeat(40);
    let requestedLimit = 'not-called';
    const source = {
        id: 'commit-a',
        kind: 'gitRef',
        refType: 'commit',
        refName: sha,
        commitSha: sha,
        label: 'commit a',
    };
    const outcome = await runGitRevisionExport(
        {
            gitService: {
                async listReferences() {
                    return {
                        repositoryRoot: '/repo',
                        targetRelativePath: '.',
                        workingTreeDirty: false,
                        activeBranch: 'main',
                        pageSize: 5,
                        sources: [
                            { id: 'working-copy', kind: 'workingCopy', label: 'Working copy' },
                            source,
                        ],
                    };
                },
                async listTimelineSources(maxCount) {
                    requestedLimit = maxCount;
                    return [source];
                },
                async dispose() {},
            },
            prepareRevisionStore: stubRevisionStore([]),
            async readWorkingCopyPayload() {
                return [{ fileName: 'a.js', filePath: 'a.js', totalLines: 1 }];
            },
        },
        {
            targetPath: '/repo',
            targetType: 'directory',
            destinationPath: destination,
            request: { scope: { kind: 'all' }, performanceProfile: 'balanced' },
        },
    );

    assert.equal(requestedLimit, null, 'null is the explicit complete-timeline contract');
    assert.ok(outcome.gitData);
});

test('latest N limits both commits and refs while keeping the working copy separately', async () => {
    const destination = makeDestination();
    const commits = ['a', 'b', 'c'].map((letter, index) => ({
        id: `commit-${letter}`,
        kind: 'gitRef',
        refType: 'commit',
        refName: letter.repeat(40),
        commitSha: letter.repeat(40),
        label: `commit ${letter}`,
        timestamp: index + 1,
    }));
    const oldBranch = {
        ...commits[0],
        id: 'branch-old',
        refType: 'branch',
        refName: 'refs/heads/old',
        label: 'old',
    };
    const selectedBranch = {
        ...commits[2],
        id: 'branch-current',
        refType: 'branch',
        refName: 'refs/heads/current',
        label: 'current',
    };
    let requestedLimit;
    let preparedSources = [];
    const outcome = await runGitRevisionExport(
        {
            gitService: {
                async listReferences() {
                    return {
                        repositoryRoot: '/repo',
                        targetRelativePath: '.',
                        workingTreeDirty: false,
                        activeBranch: 'current',
                        pageSize: 5,
                        sources: [
                            { id: 'working-copy', kind: 'workingCopy', label: 'Working copy' },
                            oldBranch,
                            selectedBranch,
                        ],
                    };
                },
                async listTimelineSources(limit) {
                    requestedLimit = limit;
                    return commits.slice(-limit);
                },
                async dispose() {},
            },
            prepareRevisionStore: async (sources) => {
                preparedSources = sources;
                return stubRevisionStore([])(sources);
            },
            async readWorkingCopyPayload() {
                return [{ fileName: 'a.js', filePath: 'a.js', totalLines: 1 }];
            },
        },
        {
            targetPath: '/repo',
            targetType: 'directory',
            destinationPath: destination,
            request: { scope: { kind: 'latest', count: 2 }, performanceProfile: 'maximum' },
        },
    );

    assert.equal(requestedLimit, 2);
    assert.deepEqual(
        preparedSources.map((source) => source.commitSha),
        [commits[1].commitSha, commits[2].commitSha],
    );
    assert.equal(
        outcome.gitData.references.sources.some((source) => source.id === oldBranch.id),
        false,
    );
    assert.equal(
        outcome.gitData.references.sources.some((source) => source.id === selectedBranch.id),
        true,
    );
    assert.deepEqual(outcome.gitData.timelineSelection, {
        kind: 'latest',
        requestedCommitCount: 2,
        selectedCommitCount: 2,
        exportedCommitCount: 2,
        exportedSourceCount: 4,
    });
    assert.equal(outcome.gitData.analyzedRevisionCount, 2);
});

test('cancellation keeps what completed; a failing revision is skipped, not fatal', async () => {
    const { repositoryPath } = buildFixtureRepository();
    const GitRepositoryService = loadGitRepositoryService();

    // Failing revision: the analyzer throws for one sha, the run continues.
    const destinationA = makeDestination();
    const shas = runGit(repositoryPath, ['log', '--format=%H']).split('\n');
    const failingSha = shas[shas.length - 1];
    const outcomeA = await runGitRevisionExport(
        {
            gitService: new GitRepositoryService(
                repositoryPath, fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-export-snap-')),
            ),
            prepareRevisionStore: stubRevisionStore([], { failSha: failingSha }),
            readWorkingCopyPayload: async () => [{ fileName: 'module.py', totalLines: 3 }],
        },
        { targetPath: repositoryPath, targetType: 'directory', destinationPath: destinationA },
    );
    assert.ok(outcomeA.gitData, 'the run must survive one failing revision');
    assert.ok(outcomeA.gitData.skippedRevisions.some((entry) => entry.reason === 'boom'));
    assert.equal(
        outcomeA.gitData.references.sources.some(
            (source) => source.kind === 'gitRef' && source.commitSha === failingSha,
        ),
        false,
        'the failing revision must not be listed as usable',
    );

    // Cancellation before anything runs: too few payloads, honest failure.
    const destinationB = makeDestination();
    const outcomeB = await runGitRevisionExport(
        {
            gitService: new GitRepositoryService(
                repositoryPath, fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-export-snap-')),
            ),
            prepareRevisionStore: async () => {
                throw new Error('git-export-cancelled');
            },
            readWorkingCopyPayload: async () => undefined,
        },
        {
            targetPath: repositoryPath,
            targetType: 'directory',
            destinationPath: destinationB,
            token: { isCancellationRequested: true },
        },
    );
    assert.equal(outcomeB.gitData, undefined);
    assert.equal(outcomeB.cancelled, true);
    assert.match(outcomeB.failureReason, /cancelled/);
    assert.equal(
        fs.existsSync(path.join(destinationB, 'git-revisions')),
        false,
        'an aborted export must not leave a partial revision folder',
    );
});

test('a folder that is not a git repository fails softly with a reason', async () => {
    const GitRepositoryService = loadGitRepositoryService();
    const plainFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-export-plain-'));
    const outcome = await runGitRevisionExport(
        {
            gitService: new GitRepositoryService(
                plainFolder, fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-export-snap-')),
            ),
            prepareRevisionStore: stubRevisionStore([]),
            readWorkingCopyPayload: async () => undefined,
        },
        { targetPath: plainFolder, targetType: 'directory', destinationPath: makeDestination() },
    );
    assert.equal(outcome.gitData, undefined);
    assert.match(outcome.failureReason, /git timeline could not be listed/);
});

test('the unified decorator serves both modes: shared key for directories, both keys for files', () => {
    const directory = decorateRevisionPayload(
        [{ fileName: 'a.py', filePath: 'C:/snap/core/a.py' }],
        'directory',
        'C:/projects/demo',
        'C:/snap',
    );
    assert.equal(directory[0].comparisonKey, 'file:core/a.py');
    assert.equal(directory[0].evolutionKey, 'file:core/a.py');
    assert.equal(directory[0].relativePath, 'core/a.py');
    assert.equal(directory[0].filePath, '/projects/demo/core/a.py');

    const file = decorateRevisionPayload(
        [
            { functionName: 'foo', parameters: 2 },
            { functionName: 'foo', parameters: 2 },
            { functionName: 'Bar', parameters: 0 },
        ],
        'file',
        'C:/projects/demo/Module.PY',
        'C:/snap/Module.PY',
    );
    assert.equal(file[0].comparisonKey, 'function:module.py:foo#2:1');
    assert.equal(file[1].comparisonKey, 'function:module.py:foo#2:2');
    assert.equal(file[2].comparisonKey, 'function:module.py:bar#0:1');
    assert.equal(file[0].evolutionKey, 'function:foo');
    assert.equal(file[2].evolutionKey, 'function:bar');
    assert.equal(file[0].filePath, 'module.py');
});

test('worker plans are bounded by CPU and memory and revision counts are validated', () => {
    const resources = {
        availableParallelism: 12,
        freeMemoryBytes: 16 * 1024 * 1024 * 1024,
    };
    assert.equal(calculateGitExportWorkerPlan('balanced', resources).workerCount, 9);
    assert.equal(calculateGitExportWorkerPlan('maximum', resources).workerCount, 32);
    assert.equal(calculateGitExportWorkerPlan('balanced', {
        availableParallelism: 12,
        freeMemoryBytes: 512 * 1024 * 1024,
    }).workerCount, 2);
    assert.deepEqual(validateGitRevisionScope({ kind: 'latest', count: 15 }, 100), {
        kind: 'latest',
        count: 15,
    });
    assert.throws(
        () => validateGitRevisionScope({ kind: 'latest', count: 101 }, 100),
        /between 1 and 100/,
    );
});

test('a structurally empty revision creates no Python job or payload', async (t) => {
    const { temporaryRoot, repositoryPath } = buildInitiallyEmptyRepository();
    const cacheRoot = path.join(temporaryRoot, 'pipeline-cache');
    const workerPath = writeStubPersistentWorker(temporaryRoot);
    const GitRepositoryService = loadGitRepositoryService();
    const service = new GitRepositoryService(
        repositoryPath,
        path.join(temporaryRoot, 'snapshots'),
    );
    t.after(async () => {
        await service.dispose();
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    });

    const references = await service.listReferences();
    const sources = await service.listTimelineSources(null);
    const analyzer = new GitTimelineBlobAnalyzer({
        repositoryRoot: references.repositoryRoot,
        targetRelativePath: references.targetRelativePath,
        originalTargetPath: repositoryPath,
        targetType: 'directory',
        recursive: true,
        pythonExecutable: process.execPath,
        workerScriptPath: workerPath,
        workerCount: 2,
        temporaryRoot: cacheRoot,
    });
    const store = await analyzer.prepare(sources);
    assert.equal(store.statistics.revisionCount, 3);
    assert.equal(store.statistics.fileOccurrences, 2);
    assert.equal(store.statistics.uniqueAnalysisCount, 2);
    await assert.rejects(
        store.get(sources[0]),
        /no-analyzable-content/,
        'the unsupported-only revision must be rejected before Python analysis',
    );
    assert.equal((await store.get(sources[1])).entries.length, 1);
    await store.dispose();
});

test('the real Git blob pipeline analyzes unchanged files once across revisions', async (t) => {
    const { temporaryRoot, repositoryPath } = buildRepeatedBlobRepository();
    const cacheRoot = path.join(temporaryRoot, 'pipeline-cache');
    const snapshotRoot = path.join(temporaryRoot, 'snapshots');
    const workerPath = writeStubPersistentWorker(temporaryRoot);
    const GitRepositoryService = loadGitRepositoryService();
    const service = new GitRepositoryService(repositoryPath, snapshotRoot);
    t.after(async () => {
        await service.dispose();
        fs.rmSync(temporaryRoot, { recursive: true, force: true });
    });

    const references = await service.listReferences();
    const sources = await service.listTimelineSources(null);
    const analyzer = new GitTimelineBlobAnalyzer({
        repositoryRoot: references.repositoryRoot,
        targetRelativePath: references.targetRelativePath,
        originalTargetPath: repositoryPath,
        targetType: 'directory',
        recursive: true,
        pythonExecutable: process.execPath,
        workerScriptPath: workerPath,
        workerCount: 2,
        temporaryRoot: cacheRoot,
    });
    const store = await analyzer.prepare(sources);
    assert.equal(store.statistics.revisionCount, 6);
    assert.equal(store.statistics.fileOccurrences, 24);
    assert.equal(
        store.statistics.uniqueAnalysisCount,
        9,
        'same bytes with different extensions must remain distinct analyzer jobs',
    );
    assert.ok(store.statistics.maxActiveWorkers <= 2);

    const latest = await store.get(sources[sources.length - 1]);
    assert.deepEqual(
        latest.entries.map((entry) => entry.relativePath),
        ['changing.py', 'stable.js', 'stable.py', 'unicodé name.py'],
    );
    assert.ok(latest.entries.every((entry) => entry.modifiedAtMs > 0));
    await store.dispose();
    assert.equal(fs.existsSync(cacheRoot), false, 'the per-export cache must be removed');
});

test('the persistent worker pool retries a crashed job and respects its worker bound', async (t) => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-worker-retry-'));
    t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
    const workerPath = path.join(temporaryRoot, 'retry-worker.cjs');
    fs.writeFileSync(workerPath, [
        "const fs=require('node:fs');",
        "const readline=require('node:readline');",
        "const send=(value)=>process.stdout.write(JSON.stringify(value)+'\\n');",
        "send({type:'ready',protocol:1,pid:process.pid});",
        "readline.createInterface({input:process.stdin}).on('line',(line)=>{",
        " const job=JSON.parse(line);",
        " if(job.type==='shutdown'){process.exit(0);}",
        " const marker=job.inputPath+'.retried';",
        " if(job.id==='retry'&&!fs.existsSync(marker)){fs.writeFileSync(marker,'1');process.exit(7);}",
        " fs.writeFileSync(job.outputPath,JSON.stringify({ok:true,id:job.id}));",
        " send({type:'complete',id:job.id});",
        "});",
    ].join('\n'), 'utf8');
    const jobs = ['retry', 'normal'].map((id) => {
        const inputPath = path.join(temporaryRoot, `${id}.py`);
        fs.writeFileSync(inputPath, 'print(1)\n', 'utf8');
        return {
            id,
            inputPath,
            outputPath: path.join(temporaryRoot, `${id}.json`),
            targetType: 'directory',
            prepareInput: async () => {},
        };
    });
    const pool = new GitExportPythonWorkerPool(
        process.execPath,
        workerPath,
        2,
    );
    const result = await pool.run(jobs);
    assert.equal(result.failures.size, 0);
    assert.ok(result.maxActiveWorkers <= 2);
    assert.deepEqual(
        jobs.map((job) => JSON.parse(fs.readFileSync(job.outputPath, 'utf8')).id).sort(),
        ['normal', 'retry'],
    );
    await pool.dispose();
});

test('cancelling the persistent pool terminates active work without publishing a result', async (t) => {
    const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-worker-cancel-'));
    t.after(() => fs.rmSync(temporaryRoot, { recursive: true, force: true }));
    const workerPath = path.join(temporaryRoot, 'slow-worker.cjs');
    fs.writeFileSync(workerPath, [
        "const readline=require('node:readline');",
        "const send=(value)=>process.stdout.write(JSON.stringify(value)+'\\n');",
        "send({type:'ready',protocol:1,pid:process.pid});",
        "readline.createInterface({input:process.stdin}).on('line',(line)=>{",
        " const job=JSON.parse(line);",
        " if(job.type==='shutdown'){process.exit(0);}",
        " setTimeout(()=>send({type:'complete',id:job.id}),10000);",
        "});",
    ].join('\n'), 'utf8');
    const inputPath = path.join(temporaryRoot, 'input.py');
    const outputPath = path.join(temporaryRoot, 'output.json');
    fs.writeFileSync(inputPath, 'print(1)\n', 'utf8');
    let cancellationListener;
    const cancellationState = { requested: false };
    const token = {
        get isCancellationRequested() {
            return cancellationState.requested;
        },
        onCancellationRequested(listener) {
            cancellationListener = listener;
            return { dispose() {} };
        },
    };
    const pool = new GitExportPythonWorkerPool(
        process.execPath,
        workerPath,
        1,
        token,
    );
    const running = pool.run([{
        id: 'slow',
        inputPath,
        outputPath,
        targetType: 'directory',
        prepareInput: async () => {},
    }]);
    await new Promise((resolve) => setTimeout(resolve, 100));
    cancellationState.requested = true;
    cancellationListener();
    await assert.rejects(running, /cancelled/);
    assert.equal(fs.existsSync(outputPath), false);
});
