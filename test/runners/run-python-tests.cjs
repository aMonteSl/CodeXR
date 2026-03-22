const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..', '..');
const testRoot = path.join(projectRoot, 'test', 'python');

function getPythonCandidates() {
    const candidates = [];

    if (process.env.CODEXR_PYTHON) {
        candidates.push({ command: process.env.CODEXR_PYTHON, args: [], source: 'CODEXR_PYTHON' });
    }

    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
        for (const version of ['Python312', 'Python311', 'Python310']) {
            const interpreter = path.join(localAppData, 'Programs', 'Python', version, 'python.exe');
            if (fs.existsSync(interpreter)) {
                candidates.push({ command: interpreter, args: [], source: version });
            }
        }
    }

    candidates.push({ command: 'py', args: ['-3'], source: 'py launcher' });
    candidates.push({ command: 'python', args: [], source: 'python on PATH' });
    candidates.push({ command: 'python3', args: [], source: 'python3 on PATH' });

    return candidates;
}

let blockedBySandbox = false;

function tryInterpreter(candidate) {
    const versionCheck = spawnSync(candidate.command, [...candidate.args, '--version'], {
        cwd: projectRoot,
        encoding: 'utf8',
    });

    if (versionCheck.error) {
        if (versionCheck.error.code === 'EPERM') {
            blockedBySandbox = true;
        }
        return false;
    }

    if (versionCheck.status !== 0) {
        return false;
    }

    const result = spawnSync(
        candidate.command,
        [
            ...candidate.args,
            '-m',
            'unittest',
            'discover',
            '-s',
            testRoot,
            '-p',
            'test_*.py',
        ],
        {
            cwd: projectRoot,
            stdio: 'inherit',
        },
    );

    process.exit(result.status ?? 1);
}

for (const candidate of getPythonCandidates()) {
    tryInterpreter(candidate);
}

if (blockedBySandbox) {
    console.warn('TEST_RUNNER: Python interpreter detected, but this sandbox cannot execute it. Backend Python tests were skipped.');
    process.exit(0);
}

console.warn('TEST_RUNNER: Python interpreter not available. Backend Python tests were skipped.');
process.exit(0);
