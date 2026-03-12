const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

function readProjectFile(...segments) {
    return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

test('file XR parser uses data.json for the XR template data entity', () => {
    const source = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'fileXRParser.ts');

    assert.match(source, /const dataSource = 'data\.json';/);
    assert.equal(source.includes('./data.json'), false);
});

test('directory XR parser keeps using data.json for standard and deep XR analysis', () => {
    const source = readProjectFile('src', 'code_analysis', 'engine', 'parsers', 'directoryXRParser.ts');

    assert.match(source, /'data\.json', \/\/ Data source file name/);
});

test('XR boats tree builder uses treePath for file analysis and filePath for directory analysis', () => {
    const source = readProjectFile('src', 'babia_templates', 'processing', 'placeholders', 'createStructure.ts');

    assert.match(
        source,
        /Adding tree builder for XR boats chart \(directory analysis\)[\s\S]*babia-treebuilder="field: filePath; split_by: \/; from: data"/,
    );
    assert.match(
        source,
        /Adding tree builder for XR boats chart \(file analysis\)[\s\S]*babia-treebuilder="field: treePath; split_by: \/; from: data"/,
    );
});

test('XR template keeps babia-queryjson bound to the injected DATA_SOURCE placeholder', () => {
    const template = readProjectFile('templates', 'xr', 'file', 'xr-visualization.html');

    assert.match(
        template,
        /<a-entity id="data" babia-queryjson="url: \$\{DATA_SOURCE\}"><\/a-entity>/,
    );
});
