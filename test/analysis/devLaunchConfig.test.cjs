const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const projectRoot = path.resolve(__dirname, '..', '..');

function readJson(...segments) {
    return JSON.parse(fs.readFileSync(path.join(projectRoot, ...segments), 'utf8'));
}

test('default F5 launch uses an isolated extension development copy', () => {
    const launch = readJson('.vscode', 'launch.json');
    const defaultConfig = launch.configurations.find(config => config.name === 'Run CodeXR Extension');

    assert.ok(defaultConfig);
    assert.deepEqual(defaultConfig.args, [
        '--extensionDevelopmentPath=${workspaceFolder}/.vscode-test/dev-extension',
        '--user-data-dir=${workspaceFolder}/.vscode-test/user-data',
        '--extensions-dir=${workspaceFolder}/.vscode-test/extensions',
    ]);
    assert.equal(defaultConfig.preLaunchTask, 'npm: compile:dev-host');
    assert.deepEqual(defaultConfig.outFiles, [
        '${workspaceFolder}/.vscode-test/dev-extension/dist/**/*.js',
    ]);
});

test('development host task compiles and prepares the isolated extension copy', () => {
    const packageJson = readJson('package.json');
    const tasks = readJson('.vscode', 'tasks.json');
    const task = tasks.tasks.find(item => item.label === 'npm: compile:dev-host');

    assert.match(packageJson.scripts['compile:dev-host'], /npm run compile && node scripts\/prepare-dev-extension\.mjs/);
    assert.ok(task);
    assert.equal(task.script, 'compile:dev-host');
    assert.deepEqual(task.problemMatcher, []);
});

test('workspace direct launch remains available as an explicit fallback', () => {
    const launch = readJson('.vscode', 'launch.json');
    const directConfig = launch.configurations.find(config => config.name === 'Run CodeXR Extension (workspace direct)');

    assert.ok(directConfig);
    assert.deepEqual(directConfig.args, [
        '--extensionDevelopmentPath=${workspaceFolder}',
    ]);
    assert.equal(directConfig.preLaunchTask, 'npm: compile');
});
