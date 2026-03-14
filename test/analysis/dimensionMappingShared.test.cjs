const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

function readProjectFile(...segments) {
    return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

test('file and directory dimension mapping settings delegate to the shared core', () => {
    const sharedCore = readProjectFile(
        'src',
        'code_analysis',
        'views',
        'subsections',
        'analysis_settings',
        'dimension_mapping_shared',
        'sharedDimensionMappingSettingCore.ts',
    );
    const fileSetting = readProjectFile(
        'src',
        'code_analysis',
        'views',
        'subsections',
        'analysis_settings',
        'dimension_mapping_file',
        'dimensionMappingFile.ts',
    );
    const directorySetting = readProjectFile(
        'src',
        'code_analysis',
        'views',
        'subsections',
        'analysis_settings',
        'dimension_mapping_directory',
        'dimensionMappingDirectory.ts',
    );

    assert.match(sharedCore, /class SharedDimensionMappingSettingCore/);
    assert.match(sharedCore, /getFieldsForDataType\(\s*this\.adapter\.targetType,/);
    assert.match(sharedCore, /DimensionMappingValidator\.validateMappingsForChart/);
    assert.match(sharedCore, /mappedValue \? `→ \$\{mappedLabel\}` : 'Click to map'/);

    assert.match(fileSetting, /SharedDimensionMappingSettingCore/);
    assert.match(fileSetting, /return this\.core\.getSettingItem\(\);/);
    assert.match(fileSetting, /return this\.core\.getChildren\(\);/);
    assert.match(fileSetting, /showDimensionMappingSelection\(dimensionName: string\)/);
    assert.doesNotMatch(fileSetting, /getFieldsForDataType\(/);
    assert.doesNotMatch(fileSetting, /Click to configure dimension mapping/);

    assert.match(directorySetting, /SharedDimensionMappingSettingCore/);
    assert.match(directorySetting, /return this\.core\.getSettingItem\(\);/);
    assert.match(directorySetting, /return this\.core\.getChildren\(\);/);
    assert.match(directorySetting, /showDimensionMappingSelection\(dimensionName: string\)/);
    assert.doesNotMatch(directorySetting, /getFieldsForDataType\(/);
    assert.doesNotMatch(directorySetting, /currentMapping \? `→ \$\{mappedLabel\}` : 'Click to map'/);
});

test('file and directory dimension mapping commands use the same dimension-name flow', () => {
    const fileCommands = readProjectFile(
        'src',
        'code_analysis',
        'commands',
        'subsections',
        'analysis_settings',
        'dimension_mapping_file',
        'dimensionMappingFileCommands.ts',
    );
    const directoryCommands = readProjectFile(
        'src',
        'code_analysis',
        'commands',
        'subsections',
        'analysis_settings',
        'dimension_mapping_directory',
        'dimensionMappingDirectoryCommands.ts',
    );

    assert.match(fileCommands, /callback: async \(dimensionName: string\) =>/);
    assert.match(fileCommands, /showDimensionMappingSelection\(dimensionName\)/);
    assert.doesNotMatch(fileCommands, /ChartDimension/);

    assert.match(directoryCommands, /callback: async \(dimensionName: string\) =>/);
    assert.match(directoryCommands, /showDimensionMappingSelection\(dimensionName\)/);
    assert.doesNotMatch(directoryCommands, /dimensionLabel/);
});
