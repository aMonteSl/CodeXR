const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const extensionBundlePath = path.join(projectRoot, 'dist', 'extension.js');

function collectMenuCommandIds(menus) {
    return Object.values(menus)
        .flatMap((entries) => entries.map((entry) => entry.command).filter(Boolean));
}

test('analysis package contributions only expose codeXR.analysis.* commands', () => {
    const commandIds = packageJson.contributes.commands.map((command) => command.command);
    const analysisCommandIds = commandIds.filter((commandId) => commandId.startsWith('codeXR.analysis.'));

    assert.ok(analysisCommandIds.length > 0);
    assert.ok(analysisCommandIds.includes('codeXR.analysis.analyzeFile'));
    assert.ok(analysisCommandIds.includes('codeXR.analysis.analyzeDirectory'));
    assert.ok(analysisCommandIds.includes('codeXR.analysis.visualizeDOM'));
    assert.ok(analysisCommandIds.includes('codeXR.analysis.activeAnalyses.refresh'));
    assert.equal(commandIds.includes(['codeXR.analysis', 'toggleBabiaUiXR'].join('.')), false);
    assert.equal(commandIds.some((commandId) => commandId.includes('newCodeAnalysis')), false);
});

test('packaged runtime exists before packaging or dev-host launch', () => {
    assert.ok(fs.existsSync(extensionBundlePath), 'dist/extension.js must exist before packaging or dev-host launch');
});

test('analysis menus and contributes do not reference the legacy newCodeAnalysis namespace', () => {
    const menuCommandIds = collectMenuCommandIds(packageJson.contributes.menus);

    assert.equal(menuCommandIds.some((commandId) => commandId.includes('newCodeAnalysis')), false);
    assert.equal(JSON.stringify(packageJson.contributes).includes('newCodeAnalysis'), false);
    assert.equal(JSON.stringify(packageJson.contributes).includes('codeXR.newCodeAnalysis'), false);
});

test('right-click analysis commands are grouped under Code-XR Analysis with one run-last shortcut', () => {
    const submenus = packageJson.contributes.submenus || [];
    assert.ok(submenus.some((submenu) =>
        submenu.id === 'codeXR.analysis.contextMenu'
        && submenu.label === 'Code-XR: Analysis'));

    const submenuCommands = packageJson.contributes.menus['codeXR.analysis.contextMenu'].map((entry) => entry.command);
    [
        'codeXR.analysis.analyzeFile',
        'codeXR.analysis.analyzeFileXR',
        'codeXR.analysis.analyzeDirectory',
        'codeXR.analysis.analyzeDirectoryDeep',
        'codeXR.analysis.analyzeDirectoryXR',
        'codeXR.analysis.analyzeDirectoryXRDeep',
        'codeXR.analysis.analyzeProject',
        'codeXR.analysis.analyzeProjectDeep',
        'codeXR.analysis.analyzeProjectXR',
        'codeXR.analysis.analyzeProjectXRDeep',
        'codeXR.analysis.visualizeDOM',
    ].forEach((commandId) => assert.ok(submenuCommands.includes(commandId), `${commandId} must be in the submenu`));

    ['editor/context', 'explorer/context'].forEach((menuId) => {
        const entries = packageJson.contributes.menus[menuId];
        assert.ok(entries.some((entry) => entry.submenu === 'codeXR.analysis.contextMenu'));
        const directAnalysisCommands = entries
            .map((entry) => entry.command)
            .filter(Boolean)
            .filter((commandId) => commandId.startsWith('codeXR.analysis.'))
            .filter((commandId) => !commandId.startsWith('codeXR.analysis.runLast.'));
        assert.deepEqual(directAnalysisCommands, [], `${menuId} should not expose flat analysis commands`);
        assert.ok(entries.some((entry) =>
            entry.command === 'codeXR.analysis.runLast.analyzeProjectXRDeep'
            && entry.when.includes('codeXR.analysis.lastKind == analyzeProjectXRDeep')));
    });
});

test('package manifest keeps runtime artifacts inside dist-based packaging', () => {
    assert.ok(packageJson.files.includes('dist/**/*'));
    assert.ok(packageJson.files.includes('templates/**/*'));
    assert.ok(packageJson.files.includes('examples/**/*'));
    assert.equal(packageJson.files.includes('src/**/*'), false);
});

test('analysis settings no longer expose the XR mapping UI toggle', () => {
    const analysisProvider = fs.readFileSync(
        path.join(projectRoot, 'src', 'code_analysis', 'views', 'subsections', 'analysis_settings', 'analysisSettingsSubsectionProvider.ts'),
        'utf8',
    );
    const analysisCommands = fs.readFileSync(
        path.join(projectRoot, 'src', 'code_analysis', 'commands', 'subsections', 'analysis_settings', 'analysisSettingsCommands.ts'),
        'utf8',
    );
    const commandCollector = fs.readFileSync(
        path.join(projectRoot, 'src', 'code_analysis', 'commands', 'analysisCommands.ts'),
        'utf8',
    );

    const removedMarkers = [
        ['toggle', 'Babia', 'Ui', 'XR'].join(''),
        ['CodeXR Mapping UI', '(XR)'].join(' '),
        ['Babia', 'Ui', 'Setting'].join(''),
        ['Babia', 'Ui', 'Commands'].join(''),
        ['babia', 'ui'].join('_'),
    ];
    for (const source of [analysisProvider, analysisCommands, commandCollector]) {
        for (const marker of removedMarkers) {
            assert.equal(source.includes(marker), false);
        }
    }
});
