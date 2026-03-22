const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const projectRoot = path.resolve(__dirname, '..', '..');
const artifactsRoot = path.join(projectRoot, 'artifacts');
const venvRoot = path.join(artifactsRoot, 'analysis-test-venv');
const isWindows = process.platform === 'win32';
const venvPython = path.join(venvRoot, isWindows ? 'Scripts' : 'bin', isWindows ? 'python.exe' : 'python');
const reportOnly = process.argv.includes('--report-only');

function run(command, args, options = {}) {
    const result = spawnSync(command, args, {
        cwd: projectRoot,
        stdio: 'inherit',
        ...options,
    });

    if (result.error) {
        throw result.error;
    }

    if ((result.status ?? 1) !== 0) {
        process.exit(result.status ?? 1);
    }
}

function getPythonCandidates() {
    const candidates = [];

    if (process.env.CODEXR_PYTHON) {
        candidates.push({ command: process.env.CODEXR_PYTHON, args: [] });
    }

    const localAppData = process.env.LOCALAPPDATA;
    if (localAppData) {
        for (const version of ['Python312', 'Python311', 'Python310']) {
            const interpreter = path.join(localAppData, 'Programs', 'Python', version, 'python.exe');
            if (fs.existsSync(interpreter)) {
                candidates.push({ command: interpreter, args: [] });
            }
        }
    }

    candidates.push({ command: 'py', args: ['-3'] });
    candidates.push({ command: 'python', args: [] });
    candidates.push({ command: 'python3', args: [] });
    return candidates;
}

function findSystemPython() {
    for (const candidate of getPythonCandidates()) {
        const result = spawnSync(candidate.command, [...candidate.args, '--version'], {
            cwd: projectRoot,
            encoding: 'utf8',
        });

        if (!result.error && result.status === 0) {
            return candidate;
        }
    }

    return null;
}

function ensureVenv(systemPython) {
    if (!fs.existsSync(venvPython)) {
        fs.mkdirSync(artifactsRoot, { recursive: true });
        run(systemPython.command, [...systemPython.args, '-m', 'venv', venvRoot]);
    }
}

function installDependencies() {
    run(venvPython, ['-m', 'pip', 'install', '--upgrade', 'pip']);
    run(venvPython, ['-m', 'pip', 'install', 'lizard']);
}

function main() {
    const systemPython = findSystemPython();
    if (!systemPython) {
        console.error('ANALYSIS_TEST_RUNNER: Python interpreter not found.');
        process.exit(1);
    }

    ensureVenv(systemPython);
    installDependencies();

    if (!reportOnly) {
        run(venvPython, ['test/analysis/manual_metrics_suite.py']);
    }

    run(venvPython, ['scripts/report-manual-metrics.py']);
}

main();
