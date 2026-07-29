const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const {
  abortExportPackage,
  beginExportPackageTransaction,
  pruneExportPackage,
  publishExportPackage,
  validateExportPackage,
} = require('../../out/code_analysis/export/exportPackageTransaction.js');

function makeRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'codexr-export-transaction-'));
}

function write(root, relative, contents = '') {
  const filePath = path.join(root, relative);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents, 'utf8');
}

function selection(overrides = {}) {
  const historicalComparison = overrides.historicalComparison ?? false;
  const projectEvolution = overrides.projectEvolution ?? false;
  return {
    cancelled: false,
    normal: true,
    dependencyGraph: overrides.dependencyGraph ?? false,
    historicalComparison,
    projectEvolution,
    gitTimeline: historicalComparison || projectEvolution,
  };
}

test('export transaction prunes stale unselected modes and publishes atomically', async () => {
  const parent = makeRoot();
  const source = path.join(parent, 'live');
  const destination = path.join(parent, 'published');
  write(source, 'index.html', '<!doctype html>');
  write(source, 'data.json', '[]');
  write(source, 'xrChartMappingUiRuntime.js', '// runtime');
  write(source, 'dependencies/dependency-graph-1.json', '{}');
  write(source, 'dependency-graph.json', '{}');
  write(source, 'comparison/revision-1.json', '{}');
  write(source, 'evolution/revision-1/manifest.json', '{}');
  write(source, 'git-revisions/stale.json', '{}');
  write(source, 'codexr-export-manifest.json', '{"kind":"old"}');
  write(source, 'README-EXPORT.md', 'old');

  const transaction = await beginExportPackageTransaction(source, destination);
  assert.equal(fs.existsSync(destination), false, 'final destination stays invisible during preparation');
  assert.equal(fs.existsSync(transaction.stagingPath), true);

  await pruneExportPackage(transaction.stagingPath, selection({
    historicalComparison: true,
  }));
  assert.equal(fs.existsSync(path.join(transaction.stagingPath, 'data.json')), true);
  assert.equal(fs.existsSync(path.join(transaction.stagingPath, 'comparison')), true);
  assert.equal(fs.existsSync(path.join(transaction.stagingPath, 'dependencies')), false);
  assert.equal(fs.existsSync(path.join(transaction.stagingPath, 'dependency-graph.json')), false);
  assert.equal(fs.existsSync(path.join(transaction.stagingPath, 'evolution')), false);
  assert.equal(fs.existsSync(path.join(transaction.stagingPath, 'git-revisions')), false);
  assert.equal(fs.existsSync(path.join(transaction.stagingPath, 'codexr-export-manifest.json')), false);

  await publishExportPackage(transaction);
  assert.equal(fs.existsSync(transaction.stagingPath), false);
  assert.equal(fs.existsSync(path.join(destination, 'comparison/revision-1.json')), true);
});

test('cancelled transaction removes staging and never creates the destination', async () => {
  const parent = makeRoot();
  const source = path.join(parent, 'live');
  const destination = path.join(parent, 'published');
  write(source, 'index.html', '<!doctype html>');

  const transaction = await beginExportPackageTransaction(source, destination);
  await abortExportPackage(transaction);

  assert.equal(fs.existsSync(transaction.stagingPath), false);
  assert.equal(fs.existsSync(destination), false);
});

test('package validation follows every manifest payload before publication', async () => {
  const root = makeRoot();
  write(root, 'index.html', '<!doctype html>');
  write(root, 'data.json', '[]');
  write(root, 'xrChartMappingUiRuntime.js', '// runtime');
  write(root, 'git-revisions/working-copy.json', '[]');
  write(root, 'git-revisions/abc.json', '[]');
  const manifest = {
    schemaVersion: 3,
    kind: 'codexr-export',
    exportedAt: new Date().toISOString(),
    target: { name: 'fixture', type: 'directory', analysisMode: 'XR' },
    selectedModes: {
      normal: true,
      dependencyGraph: false,
      historicalComparison: true,
      projectEvolution: false,
    },
    capabilities: {
      dependencyGraph: false,
      dependencyGraphReason: 'Not selected for this export.',
      historicalComparison: true,
      historicalComparisonReason: '',
      projectEvolution: false,
      projectEvolutionReason: 'Not selected for this export.',
    },
    entities: [],
    historicalComparison: { comparisons: [] },
    gitData: {
      references: {
        targetRelativePath: '.',
        workingTreeDirty: false,
        activeBranch: 'main',
        pageSize: 5,
        sources: [
          { id: 'working-copy', payloadUrl: './git-revisions/working-copy.json', itemCount: 0 },
          { id: 'commit-a', payloadUrl: './git-revisions/abc.json', itemCount: 0 },
        ],
      },
      timelineSourceIds: ['commit-a', 'working-copy'],
      suggestedSourceIds: ['commit-a', 'working-copy'],
      maxFrames: 24,
      workingCopyPayloadUrl: './git-revisions/working-copy.json',
      analyzedRevisionCount: 2,
    },
  };
  write(root, 'codexr-export-manifest.json', JSON.stringify(manifest));

  await validateExportPackage(root, manifest);
  fs.rmSync(path.join(root, 'git-revisions', 'abc.json'));
  await assert.rejects(
    validateExportPackage(root, manifest),
    /missing payload .*abc\.json/,
  );
});
