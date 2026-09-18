const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..', '..');
const testRoot = path.resolve(projectRoot, 'test');
const sourceRoot = path.resolve(projectRoot, 'src');
const compiledRoot = path.resolve(projectRoot, 'out');

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

function collectFiles(directory, extension) {
    if (!fs.existsSync(directory)) {
        return [];
    }

    const files = [];
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        const entryPath = path.join(directory, entry.name);
        if (entry.isDirectory()) {
            files.push(...collectFiles(entryPath, extension));
        } else if (entry.name.endsWith(extension) && !entry.name.endsWith('.d.ts')) {
            files.push(entryPath);
        }
    }
    return files;
}

/**
 * Many suites require compiled modules from out/. A stale out/ makes them
 * vouch for code that no longer exists: a module deleted from src/ keeps its
 * compiled twin, and an edited one keeps its old behaviour. Both directions are
 * checked per file, so `tsc -w` (which rewrites only what changed) stays valid.
 */
function findStaleCompiledOutput() {
    const problems = [];
    const expectedOutputs = new Set();

    for (const sourceFile of collectFiles(sourceRoot, '.ts')) {
        const relativePath = path.relative(sourceRoot, sourceFile).replace(/\.ts$/, '.js');
        const compiledFile = path.join(compiledRoot, relativePath);
        expectedOutputs.add(compiledFile);

        if (!fs.existsSync(compiledFile)) {
            problems.push(`not compiled: src/${path.relative(sourceRoot, sourceFile).split(path.sep).join('/')}`);
        } else if (fs.statSync(compiledFile).mtimeMs < fs.statSync(sourceFile).mtimeMs) {
            problems.push(`older than its source: out/${relativePath.split(path.sep).join('/')}`);
        }
    }

    for (const compiledFile of collectFiles(compiledRoot, '.js')) {
        if (!expectedOutputs.has(compiledFile)) {
            problems.push(`no source left: out/${path.relative(compiledRoot, compiledFile).split(path.sep).join('/')}`);
        }
    }

    return problems;
}

const testFiles = collectTests(testRoot);

if (testFiles.length === 0) {
    console.error('TEST_RUNNER: No Node test files were found under test/.');
    process.exit(1);
}

const staleOutput = findStaleCompiledOutput();
if (staleOutput.length > 0) {
    console.error('TEST_RUNNER: out/ does not match src/, so the suites would test stale code. Run `npm run compile-tests` (or `npm test`).');
    for (const problem of staleOutput.slice(0, 10)) {
        console.error(`  - ${problem}`);
    }
    if (staleOutput.length > 10) {
        console.error(`  ... and ${staleOutput.length - 10} more`);
    }
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
