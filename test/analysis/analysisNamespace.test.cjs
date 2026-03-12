const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));

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
    assert.equal(commandIds.some((commandId) => commandId.includes('newCodeAnalysis')), false);
});

test('analysis menus and contributes do not reference the legacy newCodeAnalysis namespace', () => {
    const menuCommandIds = collectMenuCommandIds(packageJson.contributes.menus);

    assert.equal(menuCommandIds.some((commandId) => commandId.includes('newCodeAnalysis')), false);
    assert.equal(JSON.stringify(packageJson.contributes).includes('newCodeAnalysis'), false);
    assert.equal(JSON.stringify(packageJson.contributes).includes('codeXR.newCodeAnalysis'), false);
});

test('package manifest keeps runtime artifacts inside dist-based packaging', () => {
    assert.ok(packageJson.files.includes('dist/**/*'));
    assert.ok(packageJson.files.includes('templates/**/*'));
    assert.ok(packageJson.files.includes('examples/**/*'));
    assert.equal(packageJson.files.includes('src/**/*'), false);
});