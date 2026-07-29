const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');
const executePythonSource = fs.readFileSync(path.join(projectRoot, 'src', 'code_analysis', 'engine', 'utils', 'executePython.ts'), 'utf8');
const webpackConfigSource = fs.readFileSync(path.join(projectRoot, 'webpack.config.js'), 'utf8');

test('executePython resolves runtime scripts from code_analysis paths', () => {
    assert.match(executePythonSource, /'dist', 'code_analysis', 'python'/);
    assert.match(executePythonSource, /'src', 'code_analysis', 'python'/);
    assert.equal(executePythonSource.includes("'dist', 'analysis', 'python'"), false);
    assert.equal(executePythonSource.includes("'src', 'analysis', 'python'"), false);
});

test('webpack copies Python assets from src/code_analysis/python into dist/code_analysis/python', () => {
    assert.match(webpackConfigSource, /from: 'src\/code_analysis\/python'/);
    assert.match(webpackConfigSource, /to: 'code_analysis\/python'/);
    assert.equal(webpackConfigSource.includes('src/analysis/python'), false);
});

test('Python analysis uses the Lizard analyzer directly', () => {
    const fileEngineSource = fs.readFileSync(
        path.join(projectRoot, 'src', 'code_analysis', 'python', 'utils', 'file_analysis_engine.py'),
        'utf8',
    );
    assert.match(fileEngineSource, /from lizard_analyzer import analyze_file as analyze_with_lizard/);
    assert.match(fileEngineSource, /lizard_data = analyze_with_lizard\(file_path\)/);
});

test('analysis configuration uses the active storage module and no legacy storage shims', () => {
    const legacyStoragePath = path.join(projectRoot, 'src', 'utils', 'analysisSettingsStorage.ts');
    const emptyStoragePath = path.join(projectRoot, 'src', 'code_analysis', 'storage');
    const activeStoragePath = path.join(projectRoot, 'src', 'code_analysis', 'configuration', 'analysisConfigurationStorage.ts');

    assert.equal(fs.existsSync(legacyStoragePath), false);
    assert.equal(fs.existsSync(emptyStoragePath), false);
    assert.ok(fs.existsSync(activeStoragePath));
});
