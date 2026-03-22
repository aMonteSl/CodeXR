const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..', '..');
const testRoot = path.resolve(projectRoot, 'test');

function collectTests(directory) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === 'runners') {
                continue;
            }
            files.push(...collectTests(entryPath));
            continue;
        }

        if (entry.name.endsWith('.test.cjs')) {
            files.push(entryPath);
        }
    }

    return files;
}

const testFiles = collectTests(testRoot);

if (testFiles.length === 0) {
    console.error('TEST_RUNNER: No Node test files were found under test/.');
    process.exit(1);
}

const result = spawnSync(
    process.execPath,
    ['--test', '--test-isolation=none', '--test-concurrency=1', ...testFiles],
    {
        cwd: projectRoot,
        stdio: 'inherit',
    },
);

process.exit(result.status ?? 1);
