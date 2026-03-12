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
    assert.equal(executePythonSource.includes('dist/new_code_analysis'), false);
    assert.equal(executePythonSource.includes("'dist', 'analysis', 'python'"), false);
    assert.equal(executePythonSource.includes("'src', 'analysis', 'python'"), false);
});

test('webpack copies Python assets from src/code_analysis/python into dist/code_analysis/python', () => {
    assert.match(webpackConfigSource, /from: 'src\/code_analysis\/python'/);
    assert.match(webpackConfigSource, /to: 'code_analysis\/python'/);
    assert.equal(webpackConfigSource.includes('src/analysis/python'), false);
});