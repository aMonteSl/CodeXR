const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

function readProjectFile(...segments) {
    return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

test('directory sessions defer recursive discovery and initial hashing until after the first analysis', () => {
    const source = readProjectFile('src', 'code_analysis', 'engine', 'core', 'sessionRegistry.ts');

    assert.equal(source.includes('filterDirectoriesForAnalysis'), false);
    assert.equal(source.includes('discoverDirectoriesToAnalyze'), false);
    assert.equal(source.includes('discoverFilesToAnalyze'), false);
    assert.match(source, /Directory session will populate tracked files after initial analysis/);
});

test('directory python execution avoids passing large --files argument lists', () => {
    const source = readProjectFile('src', 'code_analysis', 'engine', 'utils', 'executePython.ts');

    assert.equal(source.includes("'--files'"), false);
    assert.match(source, /Python coordinator will scan and filter directory contents internally/);
});

test('directory analyzers still hydrate filesToHash after the initial analysis', () => {
    const xrSource = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'directoryXRParser.ts');
    const livePanelSource = readProjectFile(
        'src',
        'code_analysis',
        'engine',
        'processors',
        'requirementRules',
        'LivePanelDirectoryRequirements.ts',
    );

    assert.match(xrSource, /session\.filesToHash = filesToHash/);
    assert.match(livePanelSource, /session\.filesToHash = filesToHash/);
});
