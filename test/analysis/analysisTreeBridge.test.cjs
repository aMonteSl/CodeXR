const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const baseInterfacesSource = fs.readFileSync(path.join(projectRoot, 'src', 'views', 'common', 'baseInterfaces.ts'), 'utf8');
const modularTreeSource = fs.readFileSync(path.join(projectRoot, 'src', 'views', 'ModularTreeDataProvider.ts'), 'utf8');

test('modular tree base interfaces use the neutral analysis bridge properties', () => {
    assert.match(baseInterfacesSource, /analysisItemType\?:/);
    assert.match(baseInterfacesSource, /originalAnalysisItem\?: any;/);
    assert.equal(baseInterfacesSource.includes('codeAnalysisItemType'), false);
    assert.equal(baseInterfacesSource.includes('originalCodeAnalysisItem'), false);
});

test('modular tree provider routes analysis items through AnalysisSectionProvider without legacy bridge fields', () => {
    assert.match(modularTreeSource, /AnalysisSectionProvider/);
    assert.match(modularTreeSource, /analysisItemType/);
    assert.match(modularTreeSource, /originalAnalysisItem/);
    assert.equal(modularTreeSource.includes('codeAnalysisItemType'), false);
    assert.equal(modularTreeSource.includes('originalCodeAnalysisItem'), false);
    assert.equal(modularTreeSource.includes('../analysis/views'), false);
});