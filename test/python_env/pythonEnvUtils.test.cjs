const test = require('node:test');
const assert = require('node:assert/strict');
const { PythonEnvUtils } = require('../../out/python_env/utils/pythonEnvUtils.js');

function normalizePath(value) {
    return value.replace(/\\/g, '/');
}

test('getSystemPythonCandidates prefers py -3 on Windows', () => {
    const candidates = PythonEnvUtils.getSystemPythonCandidates('win32');

    assert.deepEqual(candidates, [
        { executable: 'py', args: ['-3'] },
        { executable: 'python', args: [] },
        { executable: 'python3', args: [] },
    ]);
});

test('getSystemPythonCandidates prefers python3 on Unix-like systems', () => {
    const candidates = PythonEnvUtils.getSystemPythonCandidates('linux');

    assert.deepEqual(candidates, [
        { executable: 'python3', args: [] },
        { executable: 'python', args: [] },
    ]);
});

test('getVenvPipCommand uses the venv python interpreter instead of pip.exe', () => {
    const command = PythonEnvUtils.getVenvPipCommand('C:/CodeXR/venv', ['install', '--upgrade', 'pip'], 'win32');

    assert.equal(normalizePath(command.executable), 'C:/CodeXR/venv/Scripts/python.exe');
    assert.deepEqual(command.args, ['-m', 'pip', 'install', '--upgrade', 'pip']);
});

test('getEnsurePipCommand bootstraps pip through ensurepip inside the venv', () => {
    const command = PythonEnvUtils.getEnsurePipCommand('C:/CodeXR/venv', 'win32');

    assert.equal(normalizePath(command.executable), 'C:/CodeXR/venv/Scripts/python.exe');
    assert.deepEqual(command.args, ['-m', 'ensurepip', '--upgrade']);
});

test('required base packages only include setuptools and wheel', () => {
    assert.deepEqual([...PythonEnvUtils.REQUIRED_BASE_PACKAGES], ['setuptools', 'wheel']);
});

test('formatCommand quotes arguments with spaces for diagnostics', () => {
    const formatted = PythonEnvUtils.formatCommand({
        executable: 'C:/Program Files/Python/python.exe',
        args: ['-m', 'pip', 'install', 'my package'],
    });

    assert.equal(
        formatted,
        '"C:/Program Files/Python/python.exe" -m pip install "my package"',
    );
});
