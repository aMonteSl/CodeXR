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
    assert.match(source, /isXrSceneFolder\(destinationPath\)/);
    assert.doesNotMatch(source, /relativizeExportArtifacts\(sourcePath\)/);
    assert.doesNotMatch(source, /buildExportManifest\(sourcePath/);
    assert.doesNotMatch(source, /refreshRuntimeCopies\(sourcePath/);

    // The raw copy semantics stay: recursive, never overwriting an existing
    // destination.
    assert.match(source, /errorOnExist: true/);
    assert.match(source, /Serve it with any static HTTP server/);
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
