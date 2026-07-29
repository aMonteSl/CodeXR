const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

function readProjectFile(...segments) {
    return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

test('Active Analyses contributes the new action commands and removes the legacy open command', () => {
    const commandIds = packageJson.contributes.commands.map((command) => command.command);
    const contextCommands = packageJson.contributes.menus['view/item/context'].map((entry) => entry.command);

    assert.ok(commandIds.includes('codeXR.analysis.activeAnalyses.showActions'));
    assert.ok(commandIds.includes('codeXR.analysis.activeAnalyses.exportFolder'));
    assert.ok(commandIds.includes('codeXR.analysis.activeAnalyses.showDetails'));
    assert.ok(commandIds.includes('codeXR.analysis.activeAnalyses.close'));
    assert.ok(contextCommands.includes('codeXR.analysis.activeAnalyses.exportFolder'));
    assert.equal(commandIds.includes('codeXR.analysis.activeAnalyses.open'), false);
    assert.equal(contextCommands.includes('codeXR.analysis.activeAnalyses.open'), false);
});

test('Active Analyses tree items use showActions on left click', () => {
    const sectionProvider = readProjectFile('src', 'code_analysis', 'views', 'AnalysisSectionProvider.ts');
    const dataService = readProjectFile(
        'src',
        'code_analysis',
        'views',
        'subsections',
        'active_analyses',
        'services',
        'activeAnalysesDataService.ts',
    );

    assert.match(sectionProvider, /command: 'codeXR\.analysis\.activeAnalyses\.showActions'/);
    assert.match(sectionProvider, /Left-click to show available actions/);
    assert.match(dataService, /command: 'codeXR\.analysis\.activeAnalyses\.showActions'/);
    assert.match(dataService, /Left-click to show available actions/);
});

test('Active Analyses commands implement quick pick actions and recursive export from savedFilesPath first', () => {
    const source = readProjectFile(
        'src',
        'code_analysis',
        'views',
        'subsections',
        'active_analyses',
        'commands',
        'activeAnalysesCommands.ts',
    );

    assert.match(source, /commandId: 'codeXR\.analysis\.activeAnalyses\.showActions'/);
    assert.match(source, /commandId: 'codeXR\.analysis\.activeAnalyses\.exportFolder'/);
    assert.match(source, /showQuickPick\(quickPickItems/);
    assert.match(source, /session\.savedFilesPath && fs\.existsSync\(session\.savedFilesPath\)/);
    assert.match(source, /session\.outputPath && fs\.existsSync\(session\.outputPath\)/);
    assert.match(source, /beginExportPackageTransaction\(sourcePath, destinationPath\)/);
    assert.match(source, /publishExportPackage\(transaction\)/);
});

test('Active Analyses command registration injects ExtensionContext into its singleton', () => {
    const registrationSource = readProjectFile(
        'src',
        'code_analysis',
        'commands',
        'subsections',
        'active_analyses',
        'activeAnalysesCommands.ts',
    );
    const commandSource = readProjectFile(
        'src',
        'code_analysis',
        'views',
        'subsections',
        'active_analyses',
        'commands',
        'activeAnalysesCommands.ts',
    );

    assert.match(
        registrationSource,
        /ActiveAnalysesViewCommands\.getInstance\(\s*sessionRegistry,\s*serverWatcher,\s*context,\s*\)/,
    );
    assert.match(
        commandSource,
        /SessionRegistry, ServerWatcher, and ExtensionContext are required for first initialization/,
    );
    assert.doesNotMatch(
        commandSource,
        /The CodeXR extension context is unavailable/,
    );
});

test('Export produces a self-contained copy: dependency pre-generation plus destination-only post-processing', () => {
    const source = readProjectFile(
        'src',
        'code_analysis',
        'views',
        'subsections',
        'active_analyses',
        'commands',
        'activeAnalysesCommands.ts',
    );

    // Scope A: a missing dependency dataset is generated BEFORE the copy,
    // gated on the mode's capability, behind a progress notification with a
    // timeout that lets the export continue.
    assert.match(source, /resolveAnalysisServerCapabilities\(session\.analysisMode\)/);
    assert.match(source, /capabilities\.dependencyGraph\s*&&\s*!this\.hasDependencyDataset\(sourcePath\)/);
    assert.match(source, /forceRefreshModeAndWait\(\s*sessionId,\s*'dependency-graph'/);
    assert.match(source, /withProgress\(/);
    assert.match(source, /\/\^dependency-graph-\\d\+\\\.json\$\//);

    // Post-copy processing runs against private staging only, in order:
    // prune, relativize, refresh runtimes, manifest, README, validate, publish.
    assert.match(source, /pruneExportPackage\(stagingPath, selection\)/);
    assert.match(source, /configureOfflineExportHtml\(stagingPath\)/);
    assert.match(source, /relativizeExportArtifacts\(stagingPath\)/);
    assert.match(
        source,
        /refreshRuntimeCopies\(stagingPath, this\.extensionContext\.extensionPath\)/,
    );
    assert.match(source, /buildExportManifest\(stagingPath, \{/);
    assert.match(source, /writeExportReadme\(stagingPath, manifest\)/);
    assert.match(source, /validateExportPackage\(stagingPath, manifest\)/);
    // The active view travels with the export so the copy opens in the mode
    // the user actually left (getViewState is mode-agnostic: a plain string).
    assert.match(source, /analysisRefreshCoordinator\.getViewState\(session\.id\)/);
    assert.match(source, /viewState: \{/);
    assert.match(source, /isXrSceneFolder\(stagingPath\)/);
    assert.doesNotMatch(source, /relativizeExportArtifacts\(sourcePath\)/);
    assert.doesNotMatch(source, /buildExportManifest\(sourcePath/);
    assert.doesNotMatch(source, /refreshRuntimeCopies\(sourcePath/);

    // Publishing is atomic and cancellation removes staging.
    assert.match(source, /abortExportPackage\(transaction\)/);
    assert.match(source, /No partial folder was published/);
    assert.match(source, /Serve it with any static HTTP server/);
});

test('the export modal decides what ships, before the destination is picked', () => {
    const source = readProjectFile(
        'src',
        'code_analysis',
        'views',
        'subsections',
        'active_analyses',
        'commands',
        'activeAnalysesCommands.ts',
    );

    // Modal wiring: multi-select, interpreted, cancel aborts before the
    // destination dialog; dependency pregeneration and the git timeline step
    // are both gated on the selection.
    assert.match(source, /canPickMany: true/);
    assert.match(source, /interpretExportSelection\(await vscode\.window\.showQuickPick\(/);
    assert.match(source, /if \(selection\.cancelled\) \{\s*return;\s*\}/);
    const modalIndex = source.indexOf('canPickMany: true');
    const destinationIndex = source.indexOf("openLabel: 'Select Export Destination'");
    assert.ok(modalIndex > -1 && destinationIndex > -1 && modalIndex < destinationIndex,
        'the modal must come before the destination dialog');
    assert.match(source, /selection\.dependencyGraph\s*&&\s*capabilities\.dependencyGraph/);
    assert.match(source, /if \(selection\.gitTimeline\)/);
    assert.match(source, /exportGitRevisionData\(/);
    assert.match(source, /cancellable: true/);
    assert.match(source, /Entire Git history/);
    assert.match(source, /Only the latest N commits/);
    assert.match(source, /Balanced — \$\{balancedPlan\.workerCount\} workers/);
    assert.match(source, /Maximum speed — \$\{maximumPlan\.workerCount\} workers/);

    // Selection semantics live in the vscode-free helper.
    const selection = require('../../out/code_analysis/export/exportModeSelection.js');
    const allCapabilities = { dependencyGraph: true, historicalComparison: true, projectEvolution: true };
    const items = selection.buildExportModeItems(allCapabilities);
    assert.deepEqual(items.map((item) => item.modeId), ['normal', 'dependency-graph', 'historical', 'evolution']);
    assert.ok(items.every((item) => item.picked));
    assert.match(items.find((item) => item.modeId === 'historical').description, /latest N Git commits/);

    // Modes without capability disappear from the modal.
    const limited = selection.buildExportModeItems({ dependencyGraph: true, historicalComparison: false, projectEvolution: false });
    assert.deepEqual(limited.map((item) => item.modeId), ['normal', 'dependency-graph']);

    // Cancel vs empty vs partial selections.
    assert.equal(selection.interpretExportSelection(undefined).cancelled, true);
    const empty = selection.interpretExportSelection([]);
    assert.deepEqual(empty, {
        cancelled: false,
        normal: true,
        dependencyGraph: false,
        historicalComparison: false,
        projectEvolution: false,
        gitTimeline: false,
    });
    const historicalOnly = selection.interpretExportSelection([{ modeId: 'historical' }]);
    assert.equal(historicalOnly.gitTimeline, true);
    assert.equal(historicalOnly.historicalComparison, true);
    assert.equal(historicalOnly.projectEvolution, false);
    const evolutionOnly = selection.interpretExportSelection([{ modeId: 'evolution' }]);
    assert.equal(evolutionOnly.gitTimeline, true);
    assert.equal(evolutionOnly.historicalComparison, false);
    assert.equal(evolutionOnly.projectEvolution, true);
    const normalUnticked = selection.interpretExportSelection([{ modeId: 'dependency-graph' }]);
    assert.equal(normalUnticked.dependencyGraph, true);
    assert.equal(normalUnticked.cancelled, false);
    assert.equal(normalUnticked.normal, true);

    // Git-backed selections show a preflight count and explicit warning.
    assert.match(source, /inspectGitRevisionExport\(/);
    assert.match(source, /will export \$\{selectedCount\.toLocaleString\(\)\} Git commits/);
    assert.match(source, /showWarningMessage\(/);
});

test('Close Analysis confirmation uses the improved modal copy', () => {
    const source = readProjectFile(
        'src',
        'code_analysis',
        'views',
        'subsections',
        'active_analyses',
        'commands',
        'activeAnalysesCommands.ts',
    );

    assert.match(source, /Close analysis for/);
    assert.match(source, /Export the analysis folder first if you want to keep the generated artifacts for debugging/);
    assert.match(source, /'Close Analysis'/);
});
