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

function makeDestination() {
    const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-export-dest-'));
    fs.writeFileSync(path.join(destination, 'data.json'), JSON.stringify([
        { fileName: 'module.py', filePath: 'module.py', totalLines: 3 },
    ]), 'utf8');
    return destination;
}

function stubAnalyzer(callLog) {
    return async (snapshotTargetPath, source) => {
        callLog.push(source.kind === 'gitRef' ? source.commitSha : source.id);
        return [{
            fileName: 'module.py',
            filePath: path.join(snapshotTargetPath, 'module.py'),
            totalLines: 3,
            analyzedSha: source.kind === 'gitRef' ? source.commitSha : 'working-copy',
        }];
    };
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
            analyzeSnapshot: stubAnalyzer(calls),
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
            analyzeSnapshot: async (_snapshotPath, source) => {
                if (source.kind === 'gitRef' && source.commitSha === failingSha) {
                    throw new Error('boom');
                }
                return [{ fileName: 'module.py', totalLines: 1 }];
            },
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
            analyzeSnapshot: async () => [{ fileName: 'module.py', totalLines: 1 }],
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
});

test('a folder that is not a git repository fails softly with a reason', async () => {
    const GitRepositoryService = loadGitRepositoryService();
    const plainFolder = fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-export-plain-'));
    const outcome = await runGitRevisionExport(
        {
            gitService: new GitRepositoryService(
                plainFolder, fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-export-snap-')),
            ),
            analyzeSnapshot: async () => [],
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
