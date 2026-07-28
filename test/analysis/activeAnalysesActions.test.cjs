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
    assert.match(source, /fs\.promises\.cp\(sourcePath, destinationPath, \{/);
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
    assert.match(source, /forceRefreshMode\(sessionId, 'dependency-graph'\)/);
    assert.match(source, /withProgress\(/);
    assert.match(source, /\/\^dependency-graph-\\d\+\\\.json\$\//);

    // Post-copy processing runs against the DESTINATION only, in order:
    // relativize, refresh runtimes, manifest, README. The source folder is
    // never written to.
    assert.match(source, /relativizeExportArtifacts\(destinationPath\)/);
    assert.match(source, /refreshRuntimeCopies\(destinationPath, extensionPath\)/);
    assert.match(source, /buildExportManifest\(destinationPath, \{/);
    assert.match(source, /writeExportReadme\(destinationPath, manifest\)/);
    // The active view travels with the export so the copy opens in the mode
    // the user actually left (getViewState is mode-agnostic: a plain string).
    assert.match(source, /analysisRefreshCoordinator\.getViewState\(session\.id\)/);
    assert.match(source, /viewState: \{/);
    assert.match(source, /isXrSceneFolder\(destinationPath\)/);
    assert.doesNotMatch(source, /relativizeExportArtifacts\(sourcePath\)/);
    assert.doesNotMatch(source, /buildExportManifest\(sourcePath/);
    assert.doesNotMatch(source, /refreshRuntimeCopies\(sourcePath/);

    // The raw copy semantics stay: recursive, never overwriting an existing
    // destination.
    assert.match(source, /errorOnExist: true/);
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
    assert.match(source, /selection\.gitTimeline && this\.extensionContext/);
    assert.match(source, /exportGitRevisionData\(/);
    assert.match(source, /cancellable: true/);

    // Selection semantics live in the vscode-free helper.
    const selection = require('../../out/code_analysis/export/exportModeSelection.js');
    const allCapabilities = { dependencyGraph: true, historicalComparison: true, projectEvolution: true };
    const items = selection.buildExportModeItems(allCapabilities);
    assert.deepEqual(items.map((item) => item.modeId), ['normal', 'dependency-graph', 'historical', 'evolution']);
    assert.ok(items.every((item) => item.picked));
    assert.match(items.find((item) => item.modeId === 'historical').description, /whole git timeline/);

    // Modes without capability disappear from the modal.
    const limited = selection.buildExportModeItems({ dependencyGraph: true, historicalComparison: false, projectEvolution: false });
    assert.deepEqual(limited.map((item) => item.modeId), ['normal', 'dependency-graph']);

    // Cancel vs empty vs partial selections.
    assert.equal(selection.interpretExportSelection(undefined).cancelled, true);
    const empty = selection.interpretExportSelection([]);
    assert.deepEqual(empty, { cancelled: false, dependencyGraph: false, gitTimeline: false });
    const historicalOnly = selection.interpretExportSelection([{ modeId: 'historical' }]);
    assert.equal(historicalOnly.gitTimeline, true);
    const evolutionOnly = selection.interpretExportSelection([{ modeId: 'evolution' }]);
    assert.equal(evolutionOnly.gitTimeline, true);
    const normalUnticked = selection.interpretExportSelection([{ modeId: 'dependency-graph' }]);
    assert.equal(normalUnticked.dependencyGraph, true);
    assert.equal(normalUnticked.cancelled, false);
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
