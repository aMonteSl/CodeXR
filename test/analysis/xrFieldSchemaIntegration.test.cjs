const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

function readProjectFile(...segments) {
    return fs.readFileSync(path.join(projectRoot, ...segments), 'utf8');
}

test('Python entry point exposes schema mode for XR file and directory mappings', () => {
    const source = readProjectFile('src', 'code_analysis', 'python', 'main.py');

    assert.match(source, /choices=\['livePanel', 'xr', 'schema'\]/);
    assert.match(source, /if args\.mode == 'schema':/);
    assert.match(source, /def execute_schema_request\(target_type\):/);
});

test('XR schema registry includes the new file and directory metrics used by the UI', () => {
    const source = readProjectFile('src', 'code_analysis', 'python', 'utils', 'xr_field_schema.py');

    assert.match(source, /_numeric_field\("spanLines", "Span Lines"/);
    assert.match(source, /_text_field\("complexityBand", "Complexity Band"/);
    assert.match(source, /_numeric_field\("commentRatio", "Comment Ratio"/);
    assert.match(source, /_numeric_field\("averageFunctionLines", "Average Function Lines"/);
    assert.match(source, /_numeric_field\("maxFunctionNestingDepth", "Max Function Nesting Depth"/);
});

test('Dimension mapping settings consume the schema service instead of hardcoded field lists', () => {
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

    assert.match(fileSetting, /XRFieldSchemaService/);
    assert.match(fileSetting, /getFieldsForDataType\('file'/);
    assert.equal(fileSetting.includes('getAvailableDataFields()'), false);
    assert.equal(fileSetting.includes('getNumericDataFields()'), false);

    assert.match(directorySetting, /XRFieldSchemaService/);
    assert.match(directorySetting, /getFieldsForDataType\('directory'/);
    assert.equal(directorySetting.includes('DIRECTORY_DATA_FIELDS'), false);
});

test('XR launcher validates mappings with schema-provided field types before execution', () => {
    const source = readProjectFile('src', 'code_analysis', 'engine', 'launchers', 'launcherXRAnalysis.ts');

    assert.match(source, /getFieldTypeMap\(analysisType, true\)/);
    assert.match(source, /Python field schema is not available yet/);
    assert.match(source, /DimensionValidator\.validateMappings\(chartMetadata, mappingsArray, fieldTypes\)/);
});

test('boats chart metadata keeps numeric-only area and height with any-valued color', () => {
    const templateCharts = readProjectFile('src', 'babia_templates', 'charts', 'templateCharts.ts');
    const createChart = readProjectFile('src', 'babia_templates', 'processing', 'placeholders', 'createChart.ts');

    assert.match(templateCharts, /id: 'boats'[\s\S]*name: 'area'[\s\S]*dataType: 'numeric'/);
    assert.match(templateCharts, /id: 'boats'[\s\S]*name: 'height'[\s\S]*dataType: 'numeric'/);
    assert.match(templateCharts, /id: 'boats'[\s\S]*name: 'color'[\s\S]*dataType: 'any'/);

    assert.match(createChart, /name: 'area'[\s\S]*dataType: 'numeric'/);
    assert.match(createChart, /name: 'height'[\s\S]*dataType: 'numeric'/);
    assert.match(createChart, /name: 'color'[\s\S]*dataType: 'any'/);
});
